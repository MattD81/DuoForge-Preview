/**
 * DuoForge Architect UI V1.
 * A truthful, no-API workbench for the EXISTING Game Builder runtime.
 * No new account, platform, database or magical AI claim: the planner remains
 * rule based and every edit goes through the original project's revision flow.
 */
import {normalizeConfig,planGame} from "./planner.mjs";

const $=id=>document.getElementById(id);
const FIELD_NAMES={
 world:"Värld",weather:"Ljus & väder",hero:"Huvudfigur",genre:"Spelläge",
 quality:"Grafikprofil",levels:"Banor",enemies:"Fiender",collectibles:"Kristaller"
};
const CHOICES={
 world:[["forest","🌲 Skog"],["city","🌆 Stad"],["ocean","🌊 Hav"],["ruins","🏛 Ruiner"]],
 weather:[["clear","☀ Dagsljus"],["sunset","🌇 Solnedgång"],["night","🌙 Natt"],["storm","⛈ Storm"]],
 genre:[["adventure","🧭 Äventyr"],["arena","⚔ Arena"]],
 hero:[["knight","🛡 Riddare"],["viking","🪓 Viking"],["explorer","🧭 Utforskare"]],
 quality:[["auto","⚡ Adaptiv"],["quality","✨ Hög kvalitet"],["performance","🚀 Prestanda"]]
};
const STEPS=[["idea","01","Idé & text"],["logic","02","Spelregler"],["play","03","Provspela"],["deliver","04","Leverera"]];
const safeText=x=>String(x??"");
const node=(tag,classes,textContent)=>{
 const element=document.createElement(tag);
 if(classes)element.className=classes;
 if(textContent!==undefined)element.textContent=safeText(textContent);
 return element;
};
function checkLine(ok,title,description){
 const row=node("div","architect-check");
 const status=node("span","result "+(ok===true?"":ok===false?"fail":"warn"),ok===true?"OK":ok===false?"FEL":"INFO");
 const group=node("div");group.append(node("b","",title),node("small","",description));
 row.append(status,group);return row;
}
function optionFor(select,value,label){
 const option=node("option","",label);option.value=value;select.append(option);
}
export function cleanPair(value,min,max){
 const n=Math.round(Number(value));
 return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;
}
function field(label,key,choices){
 const block=node("label","architect-field");
 const title=node("span","",label);const input=node(choices?"select":"input");
 input.name=key;
 if(choices){for(const [value,text]of choices)optionFor(input,value,text);}
 else{input.type="number";input.min=key==="levels"?"1":"0";input.max=key==="levels"?"10":"12";input.step="1";}
 block.append(title,input);return block;
}
function displayNode(icon,title,description){
 const box=node("div","architect-node");
 box.append(node("span","icon",icon));
 const copy=node("div");copy.append(node("b","",title),node("small","",description));box.append(copy);
 return box;
}
export function graphFor(config){
 return [
  ["◎","Spelstart",config.genre==="arena"?"Arenaspel i vald 3D-värld":"Äventyrsläge i vald 3D-värld"],
  ["▧","Bygg värld",CHOICES.world.find(x=>x[0]===config.world)?.[1]||config.world],
  ["☻","Placera spelare",CHOICES.hero.find(x=>x[0]===config.hero)?.[1]||config.hero],
  ["⚔","Spelregler",config.enemies+" fiender · "+config.collectibles+" kristaller på första banan"],
  ["⇢","Nästa nivå",config.levels+" banor · portal och nivåprogression"]
 ];
}
export function mountArchitectUI({getConfig,getHistory,getGame,getAssets,applyPatch}){
 if(!$("build")||!document.querySelector(".workspace"))return null;
 const shell=node("section","architect-shell");shell.setAttribute("aria-label","DuoForge Architect arbetsflöde");
 shell.innerHTML=`<div class="identity"><div class="architect-mark" aria-hidden="true">◈</div>
  <div><h2>Architect <span class="architect-version">V1 · Preview</span></h2>
  <p class="sub">Skapa → redigera → provspela → exportera · befintliga DuoForge-motorer</p></div></div>
  <div class="architect-topmeta"><span class="architect-mini" id="architectProject">Projekt</span>
  <span class="architect-mini" id="architectRevision">Version</span><span class="architect-mini"><em>●</em> Lokal, regelbaserad beta</span></div>
  <div class="architect-steps" role="group" aria-label="Arbetsflöde"></div>`;
 document.querySelector(".intro").before(shell);
 const steps=shell.querySelector(".architect-steps");
 const stepButtons=new Map();
 for(const [key,n,title]of STEPS){
  const button=node("button","architect-step");button.type="button";button.dataset.step=key;
  button.append(node("strong","",n),node("span","",title));button.addEventListener("click",()=>go(key));
  steps.append(button);stepButtons.set(key,button);
 }
 const side=node("aside","card architect-panel");side.id="architectInspector";
 side.setAttribute("aria-label","Visuell speldesign och kvalitetskontroll");
 side.innerHTML=`<div class="sectiontag">03 / SPELARKITEKT</div><h3>Din spelstudio</h3>
  <p>Ändra spelets riktiga spelvärden här, eller skriv en instruktion till vänster. Du bygger vidare på samma projekt.</p>
  <div class="architect-overview" id="architectStats"></div>
  <div class="architect-tabs" role="tablist" aria-label="Verktyg">
   <button class="architect-tab" type="button" data-pane="settings" role="tab" aria-selected="true">⚙ Design</button>
   <button class="architect-tab" type="button" data-pane="flow" role="tab" aria-selected="false">◇ Logik</button>
   <button class="architect-tab" type="button" data-pane="test" role="tab" aria-selected="false">✓ Test</button>
  </div>
  <section class="architect-pane" data-panel="settings" role="tabpanel">
   <div class="sectiontag">DIREKTREDIGERA SPELET</div>
   <form id="architectForm"><div class="architect-field-grid" id="architectFields"></div>
    <button type="submit" id="architectApply" class="primary architect-commit" disabled>Tillämpa i samma spel</button>
    <p id="architectDirty" class="architect-dirty" role="status">Alla ändringar sparade.</p></form>
   <p class="architect-caption">Ett tryck uppdaterar 3D-spelet direkt och skapar en ny revision. Övriga inställningar och projekt-ID behålls.</p>
  </section>
  <section class="architect-pane" data-panel="flow" role="tabpanel" hidden>
   <div class="sectiontag">SPELBAR LOGIK · ANSLUTEN</div>
   <p>Den här kedjan visar spelmotorns faktiska standardlogik, inte fria programmerbara noder.</p>
   <div class="architect-flow" id="architectGraph"></div>
   <div class="architect-timeline" id="architectHistory"></div>
   <button type="button" id="architectEditLogic" class="secondary">⚙ Ändra spelreglerna</button>
  </section>
  <section class="architect-pane" data-panel="test" role="tabpanel" hidden>
   <div class="sectiontag">BROWSER SMOKE TEST</div>
   <p>Lokala kontroller av uppstart, 3D-yta och gamepadgränssnitt. Inte ett bevis på iPhone- eller TV-prestanda.</p>
   <div class="architect-checks" id="architectChecks" aria-live="polite"></div>
   <div class="architect-actions"><button type="button" id="architectRunTest" class="primary">✓ Kör kontroller</button>
   <button type="button" id="architectGoPlay" class="secondary">▶ Öppna spelet</button></div>
  </section>
  <div class="architect-linkgrid">
   <a href="../workshop/studio/" aria-label="Öppna DuoForge 3D Studio">⬡ 3D-verkstaden ↗</a>
   <a href="../workshop/studio/" aria-label="Importera GLB genom 3D Studio">⬢ GLB & material ↗</a>
  </div>
  <p class="architect-caption">AI-kodagent och Sites-publicering kräver en separat, auktoriserad integration. Här används befintlig lokal prompttolkning.</p>`;
 const stage=document.querySelector(".stage");stage.after(side);
 const graph=$("architectGraph"),history=$("architectHistory");
 const fields=$("architectFields");
 for(const [key,choices]of Object.entries(CHOICES))fields.append(field(FIELD_NAMES[key],key,choices));
 for(const key of ["levels","enemies","collectibles"])fields.append(field(FIELD_NAMES[key],key));
 const form=$("architectForm");let dirty=false,currentPane="settings",activeStep="idea",device=window.matchMedia?.("(max-width: 600px)")?.matches?"phone":"wide";
 let notifiedTimer=0,debounce=0;
 const toast=node("div","architect-toast");toast.role="status";document.body.append(toast);
 function notice(message){toast.textContent=message;toast.classList.add("show");clearTimeout(notifiedTimer);notifiedTimer=setTimeout(()=>toast.classList.remove("show"),3300);}
 function currentFields(){
  const patch={};for(const control of form.querySelectorAll("[name]")){
   patch[control.name]=control.type==="number"?cleanPair(control.value,control.name==="levels"?1:0,control.name==="levels"?10:12):control.value;
  }
  return patch;
 }
 function formChanges(){const c=getConfig(),patch=currentFields();return Object.keys(patch).filter(key=>c[key]!==patch[key]);}
 function setDirty(){
  const changes=formChanges();dirty=changes.length>0;
  $("architectApply").disabled=!dirty;
  $("architectDirty").textContent=dirty?changes.length+" ändring(ar) väntar på att tillämpas: "+changes.map(k=>FIELD_NAMES[k]).join(", "):"Alla ändringar sparade.";
 }
 for(const control of form.querySelectorAll("[name]"))control.addEventListener("input",setDirty);
 form.addEventListener("submit",e=>{
  e.preventDefault();const changes=formChanges();
  if(!changes.length)return;
  const patch=currentFields(),selected=Object.fromEntries(changes.map(key=>[key,patch[key]]));
  const result=applyPatch(selected);
  refresh();notice(result?"✓ Spelet uppdaterat – provspela nu.":"Ingen förändring behövdes.");
 });
 function selectPane(pane){
  if(!["settings","flow","test"].includes(pane))return;
  currentPane=pane;
  side.querySelectorAll("[data-pane]").forEach(button=>button.setAttribute("aria-selected",String(button.dataset.pane===pane)));
  side.querySelectorAll("[data-panel]").forEach(section=>section.hidden=section.dataset.panel!==pane);
 }
 side.querySelectorAll("[data-pane]").forEach(button=>button.addEventListener("click",()=>selectPane(button.dataset.pane)));
 $("architectEditLogic").addEventListener("click",()=>{selectPane("settings");side.scrollIntoView({block:"start",behavior:"smooth"});});
 $("architectGoPlay").addEventListener("click",()=>go("play"));
 $("architectRunTest").addEventListener("click",runChecks);
 function go(step){
  const target={idea:document.querySelector(".editor"),logic:side,play:stage,deliver:document.querySelector(".exportbar")}[step];
  if(!target)return;
  activeStep=step;
  for(const [key,button]of stepButtons)button.setAttribute("aria-current",key===step?"step":"false");
  if(step==="logic")selectPane("flow");
  if(step==="deliver")notice("ZIP-export finns längst ner i provspelningsvyn. Publicering till Sites sker inte automatiskt.");
  target.scrollIntoView({block:"start",behavior:"smooth"});
 }
 // Explicit device *preview*, not false hardware emulation.
 const devices=node("div","architect-devices");
 const caption=node("span","architect-caption","Förhandsvisa format:");
 devices.append(caption);
 for(const [key,label]of [["wide","▣ 16:9"],["phone","▯ 9:16"]]){
  const btn=node("button","architect-device",label);
  btn.type="button";btn.dataset.device=key;btn.setAttribute("aria-pressed",String(key===device));
  btn.addEventListener("click",()=>{
   device=key;stage.classList.toggle("device-phone",key==="phone");
   stage.classList.toggle("device-wide",key==="wide");
   devices.querySelectorAll("[data-device]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.device===key)));
   requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
  });
  devices.append(btn);
 }
 const stageToolbar=stage.querySelector(".game-toolbar");
 stageToolbar?.after(devices);
 stage.classList.toggle("device-phone",device==="phone");
 stage.classList.toggle("device-wide",device==="wide");
 requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
 function drawFlow(){
  const config=getConfig();graph.replaceChildren();
  const lines=graphFor(config);
  lines.forEach(([icon,title,summary],index)=>{
   if(index)graph.append(node("div","architect-arrow","↓"));
   graph.append(displayNode(icon,title,summary));
  });
  history.replaceChildren();
  history.append(node("div","sectiontag","VERSIONER I DETTA WEBBLÄSARPROJEKT"));
  const versions=[...(getHistory()||[]).map(x=>x.revision),config.revision];
  const unique=[...new Set(versions)].slice(-5).reverse();
  for(const version of unique)history.append(node("div","item",version===config.revision?"✓ Nuvarande version "+version:"↶ Tidigare version "+version+" (Ångra i vänsterpanelen)"));
 }
 function getState(){try{return getGame()?.state||null;}catch{return null;}}
 function runChecks(){
  const list=$("architectChecks");list.replaceChildren();
  const config=getConfig(),runtime=getGame(),state=getState();
  const canvas=$("viewport")?.querySelector("canvas");
  const bounds=canvas?.getBoundingClientRect();
  const controls=$("controls");
  let saved=true;try{localStorage.getItem("duoforge-intelligent-builder-v1");}catch{saved=false;}
  const tests=[
   [!!runtime&&!!state,"3D-motorn startad",state?"Spelvärldens runtime är tillgänglig.":"Ingen aktiv runtime – kontrollera WebGL-felmeddelandet."],
   [!!canvas&&!!bounds&&bounds.width>0&&bounds.height>0,"Spelbar 3D-yta",canvas?"Canvas: "+Math.round(bounds?.width||0)+" × "+Math.round(bounds?.height||0)+" CSS-pixlar.":"Ingen Canvas efter uppstart."],
   [!!controls&&controls.querySelectorAll("[data-move]").length===4&&controls.querySelectorAll("[data-action]").length>=3,"Styrning och touchknappar","Riktnings- och actionknappar finns i DOM. Fysiska kontroller testas inte här."],
   [config.id.length>0&&config.revision>0&&normalizeConfig(config).id===config.id,"Projekt och revision","Projekt-ID bevarat. Revision "+config.revision+"."],
   [saved,"Lokal projektlagring","Webbläsarens localStorage kan läsas."],
   [typeof Blob!=="undefined"&&typeof fetch==="function","ZIP-förutsättningar","Webbläsaren stöder de API:er exportfunktionen använder. ZIP-filen är inte testexporterad."],
   [getAssets().length<=6,"GLB-importgräns",getAssets().length+" av 6 modeller importerade."],
  ];
  let passed=0;
  for(const [ok,title,detail] of tests){list.append(checkLine(ok,title,detail));if(ok)passed++;}
  const pads=typeof navigator.getGamepads==="function"?Array.from(navigator.getGamepads()||[]).filter(Boolean).length:0;
  list.append(checkLine(null,"Fysisk gamepad",pads?pads+" ansluten/anslutna enheter rapporteras av Gamepad API.":"Ingen ansluten gamepad rapporterades; manuell provspelning behövs."));
  const msg=passed+"/"+tests.length+" automatiska webbläsarkontroller godkända.";
  notice(msg);return {passed,total:tests.length};
 }
 function drawIdeaPreview(){
  const input=$("prompt"),existing=$("architectPromptPreview");
  let badge=existing;
  if(!badge){
   badge=node("div","architect-caption");badge.id="architectPromptPreview";
   input.after(badge);
  }
  const prompt=input.value.trim();
  if(!prompt){badge.textContent="Skriv en beskrivning för att förhandsgranska vilka inställningar som kan ändras.";return;}
  const plan=planGame(prompt,getConfig());
  const readable=plan.changes.filter(c=>c.field!=="status").map(c=>FIELD_NAMES[c.field]||c.field);
  badge.textContent=readable.length?
   "◈ Förstådda ändringar: "+readable.join(", ")+(plan.warnings.length?" · ⚠ "+plan.warnings.length+" begränsning(ar)":""):
   "◌ Inga nya spelvärden upptäckta. Den här versionen använder regelbaserad svensk tolkning.";
 }
 $("prompt").addEventListener("input",()=>{clearTimeout(debounce);debounce=setTimeout(drawIdeaPreview,110);});
 // Use actual existing buttons: no forked game start or export route.
 $("build").addEventListener("click",()=>setTimeout(()=>{refresh();go("play");},0));
 $("undo").addEventListener("click",()=>setTimeout(refresh,0));
 $("newProject").addEventListener("click",()=>setTimeout(refresh,0));
 function refresh(){
  const config=getConfig(),state=getState();
  $("architectProject").textContent="◈ "+config.title;
  $("architectProject").title="Projekt-ID: "+config.id;
  $("architectRevision").textContent="Revision "+config.revision;
  const stats=$("architectStats");stats.replaceChildren();
  for(const [value,label]of [[config.levels,"Banor"],[config.enemies,"Fiender"],[config.collectibles,"Föremål"]]){
   const stat=node("div","architect-stat");stat.append(node("b","",value),node("small","",label));stats.append(stat);
  }
  // Only committed game updates call refresh; preserve all changes through the original config.
  dirty=false;
  for(const control of form.querySelectorAll("[name]"))control.value=String(config[control.name]);
  setDirty();drawFlow();drawIdeaPreview();
  if(state?.assetsLoaded)$("architectRevision").title=state.assetsLoaded+" modeller aktiva i spelet";
 }
 refresh();
 stepButtons.get("idea")?.setAttribute("aria-current","step");
 return Object.freeze({refresh,runChecks,go,selectPane});
}
