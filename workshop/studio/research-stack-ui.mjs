// Optional, additive Open Research panel in the existing editor — browser-only.
import {
 inspectGLB,inspectScene,makeIndexEntry,makePortableReport,recommendReuse,
 MAX_GLB_BYTES
} from "./research-stack-core.mjs";
const DB="duoforge-research-index-local";
function openDB(){
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB)return reject(Error("IndexedDB saknas."));
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
   if(!request.result.objectStoreNames.contains("assets"))
    request.result.createObjectStore("assets",{keyPath:"sha256"});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error("IndexedDB kunde inte öppnas."));
 });
}
async function storage(mode,run){
 const db=await openDB();
 try{return await new Promise((resolve,reject)=>{
  let value,done=false;
  const tx=db.transaction("assets",mode);
  tx.oncomplete=()=>{done=true;resolve(value);};
  tx.onerror=()=>reject(tx.error||Error("Databasen kunde inte sparas."));
  tx.onabort=()=>reject(tx.error||Error("Lagringen avbröts."));
  try{
   const request=run(tx.objectStore("assets"));
   request.onsuccess=()=>{value=request.result;};
   request.onerror=()=>{if(!done)reject(request.error||Error("Läsfel"));};
  }catch(error){tx.abort();reject(error);}
 })}finally{db.close();}
}
async function sha256(blob){
 const digest=await crypto.subtle.digest("SHA-256",await blob.arrayBuffer());
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
function downloadJSON(data,name){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),12000);
}
function browserStatus(renderer,canvas){
 let isLost=false;
 try{isLost=Boolean(renderer?.getContext?.()?.isContextLost?.());}catch{isLost=true;}
 return {
  activeRenderer:renderer?.capabilities?.isWebGL2?"WebGL2":"WebGL",
  webGPUAvailable:!!(globalThis.isSecureContext&&navigator?.gpu),
  canvasPixels:[canvas?.width||0,canvas?.height||0],
  webglContextLost:isLost,
  // This status is NOT an actual frame benchmark or a WebGPU context.
  benchmarked:false
 };
}
function size(bytes){return (bytes/1024/1024).toFixed(2)+" MB";}
export function initResearchStack({root,renderer,canvas,toGLB,getProjectName,getProjectId,notify}){
 const sidebar=document.querySelector(".sidebar.right-panel");
 if(!sidebar||document.getElementById("freeResearchLab"))return;
 const section=document.createElement("section");
 section.id="freeResearchLab";section.className="panel-section";
 section.innerHTML=[
  '<div class="section-heading"><h2>🔬 Öppen forskningsstack</h2><span class="mini-pill">LOKALT</span></div>',
  '<p class="hint">Kostnadsfri scene/GLB-analys och SHA-256-index. Ingen modell laddas upp.</p>',
  '<div class="row two"><button id="stackHealth">🧪 Testa 3D-scen</button><button id="stackMobile">📱 Mobil-GLB</button></div>',
  '<button id="stackIndex" class="accent-outline">💾 Indexera scen (SHA-256)</button>',
  '<button id="stackReport">⬇ Rapport + resursmanifest (JSON)</button>',
  '<label class="field-label" for="stackImport">Analysera en GLB-fil utan att importera</label>',
  '<input id="stackImport" type="file" accept=".glb,model/gltf-binary">',
  '<div id="stackInfo" class="hint" role="status" aria-live="polite">Redo. Inga analyser har körts.</div>',
  '<div class="subheading">Lokalt resursindex (metadata)</div>',
  '<div id="stackAssets" class="hint" role="status">Läser resursindex …</div>',
  '<p class="hint">Indexet sparar inte GLB-bytes. Gaussian Splats, KTX2 och meshopt behöver separata renderare/avkodare. Aktiv motor är WebGL.</p>'
 ].join("");
 const before=sidebar.querySelector("#researchPerfPanel");
 sidebar.insertBefore(section,before||null);
 const $=id=>section.querySelector("#"+id);
 let busy=false;
 const message=s=>{$("stackInfo").textContent=s;};
 async function entries(){return (await storage("readonly",s=>s.getAll())).sort((a,b)=>b.updated-a.updated);}
 async function renderEntries(){
  const holder=$("stackAssets"),items=await entries();
  holder.replaceChildren();
  if(!items.length){holder.textContent="Inga indexerade scener på denna enhet.";return;}
  for(const item of items.slice(0,12)){
   const row=document.createElement("div");row.className="saved-row";
   const small=document.createElement("small");
   small.textContent=item.name+" · "+size(item.bytes)+" · "+item.sha256.slice(0,12)+"…";
   row.append(small);holder.append(row);
  }
  if(items.length>12){
   const more=document.createElement("small");more.textContent="Visar 12 av "+items.length+" lokala indexposter.";
   holder.append(more);
  }
 }
 const safeRun=async(fn)=>{
  if(busy)return;
  busy=true;
  for(const id of ["stackHealth","stackMobile","stackIndex","stackReport"])$(id).disabled=true;
  try{await fn();}catch(error){message("Fel: "+(error?.message||String(error)));notify?.("Analysen misslyckades: "+(error?.message||error),5000);}
  finally{busy=false;for(const id of ["stackHealth","stackMobile","stackIndex","stackReport"])$(id).disabled=false;}
 };
 function diagnostic(){
  const report=inspectScene(root),capability=browserStatus(renderer,canvas);
  return {report,capability};
 }
 async function analyzeExport(){
  const model=await toGLB(1024);
  if(model.size>MAX_GLB_BYTES)throw Error("Max 50 MB per analys.");
  const bytes=await model.arrayBuffer();
  const glb=inspectGLB(bytes);
  const digest=await sha256(model);
  return {glb,digest};
 }
 $("stackHealth").onclick=()=>safeRun(async()=>{
  const {report,capability}=diagnostic();
  const problems=[...report.issues];
  if(capability.webglContextLost)problems.push("WebGL-kontexten är förlorad.");
  if(capability.canvasPixels.some(x=>x<1))problems.push("Canvas saknar renderstorlek.");
  message("Scenkontroll: "+report.meshes+" meshar · "+report.triangles.toLocaleString("sv-SE")+
   " trianglar · "+report.textureCount+" texturer. Aktiv: "+capability.activeRenderer+
   ", WebGPU tillgänglig: "+(capability.webGPUAvailable?"ja (inte aktiv)":"nej")+
   ". "+(problems.join(" ")||"Inga upptäckta strukturfel. Detta är inte ett automatiskt speltest."));
 });
 $("stackMobile").onclick=()=>{
  const button=document.getElementById("exportMobileGLB");
  if(button){button.click();message("Mobil-GLB: befintlig export begränsar texturer till 1024 px; ingen automatisk meshförenkling.");}
  else message("Mobilprofilen finns inte i denna studieversion.");
 };
 $("stackIndex").onclick=()=>safeRun(async()=>{
  message("Beräknar GLB och SHA-256 lokalt …");
  const {glb,digest}=await analyzeExport(),scene=inspectScene(root);
  const name=getProjectName(),all=await entries();
  const match=recommendReuse(digest,name,all);
  if(match.status==="identical"){
   message("Samma GLB finns redan i lokalt index (SHA-256: "+digest.slice(0,12)+"…). Ingen kopia skapad.");return;
  }
  const entry=makeIndexEntry({sha256:digest,name,projectId:getProjectId(),glb,scene});
  await storage("readwrite",s=>s.put(entry));
  await renderEntries();
  message((match.status==="new-version"?"Ny version indexerad. ":"Ny resurs indexerad. ")+
   size(glb.bytes)+" · "+glb.meshes+" meshar. Bara metadata sparas (inte GLB).");
 });
 $("stackReport").onclick=()=>safeRun(async()=>{
  message("Skapar verifierbar GLB-rapport lokalt …");
  const {glb,digest}=await analyzeExport(),{report,capability}=diagnostic();
  const entry=makeIndexEntry({sha256:digest,name:getProjectName(),projectId:getProjectId(),glb,scene:report});
  const portable=makePortableReport({entry,glb,scene:report,capability});
  downloadJSON(portable,"duoforge-research-report.json");
  message("Analysrapport exporterad: "+entry.sha256.slice(0,12)+"… GLB-modellen måste exporteras separat.");
 });
 $("stackImport").addEventListener("change",()=>safeRun(async()=>{
  const file=$("stackImport").files?.[0];if(!file)return;
  if(file.size>MAX_GLB_BYTES)throw Error("GLB över 50 MB.");
  const result=inspectGLB(await file.arrayBuffer());
  message("GLB: "+result.meshes+" meshar, "+result.estimatedTriangles+" uppskattade trianglar, "+
   result.animations+" animationer, "+result.bytes+" byte. "+
   (result.issues.join(" ")||"GLB-strukturen ser rimlig ut; rendering är inte verifierad."));
 }));
 renderEntries().catch(error=>{$("stackAssets").textContent="Lokal indexlagring saknas: "+error.message;});
 return {inspectScene:()=>inspectScene(root)};
}
