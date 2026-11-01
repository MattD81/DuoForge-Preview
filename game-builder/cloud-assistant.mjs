/**
 * DuoForge Cloud Assistant — UI adapter for the existing Game Builder.
 * Local-first. This static GitHub Pages preview has NO backend or API keys.
 * A verified Sites backend may expose same-origin /api/duoforge/ai/* endpoints.
 */
import {planGame} from "./planner.mjs";

export const AI_MODELS=Object.freeze([
  {id:"local",label:"⚡ DuoForge lokalt · 0 AI-anrop"},
  {id:"llama-fast",label:"☁ Cloudflare Llama · kodförslag"},
  {id:"glm-flash",label:"☁ Cloudflare GLM Flash · kodförslag"}
]);
export const AI_ENDPOINT=Object.freeze({
  status:"/api/duoforge/ai/status",
  proposal:"/api/duoforge/ai/proposal"
});
const MODEL_IDS=new Set(AI_MODELS.slice(1).map(x=>x.id));
const safeString=(s,max)=>String(s??"").slice(0,max);
const timeout=9000;
const makeError=code=>new Error(code);

export function validateProposalInput({prompt,model,projectId,revision}={}){
  if(typeof prompt!=="string"||prompt.trim().length<5||prompt.trim().length>1200)throw makeError("Skriv 5–1200 tecken om spelet.");
  if(!MODEL_IDS.has(model))throw makeError("Modellen är inte tillåten.");
  if(typeof projectId!=="string"||!/^[a-zA-Z0-9_-]{1,72}$/.test(projectId))throw makeError("Ogiltigt projekt-ID.");
  if(!Number.isSafeInteger(revision)||revision<1||revision>9999)throw makeError("Ogiltig projektrevision.");
  return {prompt:prompt.trim(),model,projectId,revision};
}
function jsonResponse(res){
  if(!res?.ok)throw makeError(res?.status===401||res?.status===403?"Du behöver vara inloggad och behörig i DuoForge.":"AI-bryggan är inte tillgänglig.");
  if(!res.headers?.get("content-type")?.includes("application/json"))throw makeError("AI-bryggan svarade inte med JSON.");
  return res.json();
}
export async function getCloudStatus({fetchImpl=fetch,signal}={}){
  try{
    const res=await fetchImpl(AI_ENDPOINT.status,{method:"GET",credentials:"same-origin",
      headers:{accept:"application/json"},cache:"no-store",signal:signal||AbortSignal.timeout(timeout)});
    const data=await jsonResponse(res);
    const allowed=(data.models||[]).filter(x=>typeof x.id==="string"&&MODEL_IDS.has(x.id));
    if(data.connected!==true||!allowed.length)return {connected:false,models:[],message:"Cloudflare är inte anslutet till denna webbplats. Lokal byggare fungerar gratis."};
    return {connected:true,models:allowed.map(x=>x.id),
      quota:data.quota&&typeof data.quota==="object"?data.quota:null,message:"Cloudflare AI är anslutet. Kodförslag måste granskas före användning."};
  }catch{
    return {connected:false,models:[],message:"Den här förhandsversionen kör lokalt. Cloudflare kräver DuoForges autentiserade Sites-backend."};
  }
}
export async function requestCloudProposal(data,{fetchImpl=fetch,signal,csrfToken}={}){
  const input=validateProposalInput(data);
  const headers={"content-type":"application/json",accept:"application/json"};
  if(csrfToken)headers["x-csrf-token"]=safeString(csrfToken,200);
  const response=await fetchImpl(AI_ENDPOINT.proposal,{method:"POST",headers,credentials:"same-origin",
    cache:"no-store",signal:signal||AbortSignal.timeout(25000),body:JSON.stringify(input)});
  const output=await jsonResponse(response);
  if(output.ok!==true||typeof output.proposal!=="string"||!output.requiresApproval||!output.proposalId)
    throw makeError("AI-bryggan gav inget granskningsbart kodförslag.");
  return {proposal:safeString(output.proposal,8000),proposalId:safeString(output.proposalId,80),
    source:safeString(output.source,40),model:input.model};
}
function node(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
}
export function mountCloudAssistant({getProject,getPrompt}){
  const editor=document.querySelector(".editor"),promptField=document.getElementById("prompt");
  if(!editor||!promptField)return null;
  const card=node("section","cloud-assistant");
  card.setAttribute("aria-label","DuoForge kostnadsfri AI-assistans");
  const title=node("h3","cloud-title","◈ DuoForge Cloud Engine");
  const caption=node("p","cloud-caption","Välj en assistent. Byggknappen ovan fortsätter skapa spel lokalt; AI ger separata kodförslag som kräver granskning.");
  const label=node("label","cloud-label","Assistentmodell");
  const select=node("select","cloud-select");select.id="cloudModel";label.htmlFor=select.id;
  for(const option of AI_MODELS){
    const el=node("option","",option.label);el.value=option.id;
    if(option.id!=="local")el.disabled=true;
    select.append(el);
  }
  const action=node("button","secondary cloud-action","◈ Visa lokal byggplan");
  action.type="button";
  const status=node("p","cloud-status","Kontrollerar om Cloudflare är anslutet …");
  status.setAttribute("role","status");
  const output=node("pre","cloud-proposal");output.hidden=true;output.setAttribute("aria-label","AI-förslag för granskning");
  card.append(title,caption,label,select,action,status,output);
  const summary=editor.querySelector(".summary");
  if(summary)summary.before(card);else editor.append(card);
  let connected=false,busy=false,available=[],stopped=false;
  function redraw(){
    action.disabled=busy;
    action.textContent=busy?"◌ Hämtar AI-förslag …":select.value==="local"?"◈ Visa lokal byggplan":"✦ Föreslå kod med vald AI";
  }
  async function refresh(){
    const info=await getCloudStatus();
    if(stopped)return info;
    connected=info.connected;available=info.models;
    for(const option of select.options)if(option.value!=="local")option.disabled=!connected||!available.includes(option.value);
    if(select.selectedOptions[0]?.disabled)select.value="local";
    status.textContent=info.message;
    redraw();return info;
  }
  select.addEventListener("change",()=>{output.hidden=true;output.textContent="";redraw();});
  action.addEventListener("click",async()=>{
    if(busy)return;
    output.hidden=true;output.textContent="";
    const prompt=getPrompt?.()??promptField.value;
    if(select.value==="local"){
      const plan=planGame(prompt,getProject?.());
      output.textContent=["Lokal DuoForge-plan (0 AI-anrop):",
        ...plan.changes.map(x=>String(x.field)+": "+String(x.to)),
        ...plan.warnings.map(x=>"⚠ "+x),
        "Använd Skapa / förbättra spelet för att tillämpa stödda inställningar."].join("\n");
      output.hidden=false;status.textContent="Ingen Cloudflare-förbrukning. Projektet är oförändrat.";return;
    }
    if(!connected||!available.includes(select.value)){
      status.textContent="Cloudflare är inte anslutet. Bygg spelet lokalt tills den befintliga Sites-backenden är kopplad.";return;
    }
    busy=true;redraw();
    try{
      const project=getProject?.();
      const result=await requestCloudProposal({
        prompt,model:select.value,projectId:project?.id,revision:project?.revision
      });
      output.textContent=result.proposal;
      output.hidden=false;
      status.textContent="Förslag "+result.proposalId+" sparat för granskning. Ingen kod har ändrats eller publicerats.";
    }catch(error){
      status.textContent="Inget AI-anrop lyckades: "+String(error?.message||"Okänt fel")+". Lokala spelbyggaren är fortsatt tillgänglig.";
    }finally{busy=false;redraw();}
  });
  refresh();
  return Object.freeze({refresh,dispose(){stopped=true;card.remove();},get model(){return select.value;}});
}
