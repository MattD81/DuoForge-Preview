/**
 * UI adapter for DuoForge Scene Fusion Engine in EXISTING 3D Studio.
 * Geometry is never edited or hidden by these features. Live camera/quality is
 * opt-in, cancelable and restores user camera + pixel ratio on exit.
 */
import * as THREE from "three";
import {
 sceneDNA,planDetailBudget,createTemporalBudgetGovernor,
 createCinemaPlan,cameraAt,normalizeScene,FUSION_VERSION
} from "./fusion-engine.mjs";

function materialKey(material){
 const m=Array.isArray(material)?material[0]:material;
 if(!m)return "none";
 return [m.type||"mat",m.color?.getHexString?.()||"",
  Number.isFinite(m.roughness)?m.roughness.toFixed(2):"",
  Number.isFinite(m.metalness)?m.metalness.toFixed(2):""].join("/");
}
function geometryKey(g){
 const p=g?.attributes?.position,number=p?.count||0;
 const count=g?.index?.count||number;
 if(!p)return "no-positions";
 const samples=[];
 for(const i of [0,Math.floor(number/3),Math.floor(number*2/3),number-1]){
  if(i<0||i>=number)continue;
  for(const getter of ["getX","getY","getZ"]){
   const n=p[getter]?.(i);
   samples.push(Number.isFinite(n)?Math.round(n*1000)/1000:0);
  }
 }
 return [number,count,...samples].join(",");
}
export function describeThreeScene(root,{limit=500}={}){
 const result=[],box=new THREE.Box3(),center=new THREE.Vector3(),size=new THREE.Vector3();
 root.updateMatrixWorld(true);
 root.traverse(node=>{
  if(!node.isMesh||!node.geometry||result.length>=limit)return;
  const geo=node.geometry,pts=geo.attributes?.position?.count||0;
  const triangles=Math.floor((geo.index?.count||pts)/3);
  box.setFromObject(node);
  if(box.isEmpty())return;
  box.getCenter(center);box.getSize(size);
  result.push({
   id:String(result.length)+"-"+String(node.name||"Mesh").slice(0,40),
   name:node.name||"Mesh "+result.length,
   center:center.toArray(),radius:Math.max(.001,size.length()*.5),
   triangles,visible:node.visible,
   material:materialKey(node.material),geometry:geometryKey(geo),
   skinned:!!node.isSkinnedMesh,animated:!!node.userData?.duoforgeAnimated
  });
 });
 return normalizeScene(result);
}
function makeCamera(camera,canvas){
 const target=new THREE.Vector3();camera.getWorldDirection(target);
 return {
  position:camera.position.toArray(),direction:target.toArray(),
  fovDegrees:camera.fov,near:camera.near,far:camera.far,
  aspect:camera.aspect,heightPixels:Math.max(100,canvas.clientHeight||720)
 };
}
function downloadJSON(name,data){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),12000);
}
const nfmt=n=>Number(n||0).toLocaleString("sv-SE");
export function initFusionLab({
 root,renderer,canvas,camera,orbit,renderWorld,livingRuntime,getProjectName,notify
 }={}){
 const sidebar=document.querySelector(".sidebar.right-panel");
 if(!sidebar||document.getElementById("fusionLab"))return null;
 const panel=document.createElement("section");
 panel.id="fusionLab";panel.className="panel-section";
 panel.innerHTML=[
  '<div class="section-heading"><h2>🧬 DuoForge Fusion Lab</h2><span class="mini-pill">FORSKNING V1</span></div>',
  '<p class="hint">Scen-DNA + perspektivstyrd detaljbudget + stabil GPU-profil + fem filmvinklar. Fungerar lokalt utan AI-server.</p>',
  '<label class="field-label" for="fusionBudget">Rekommenderad geometri-budget</label>',
  '<select id="fusionBudget"><option value="60000">Mobil · 60 000 trianglar</option><option value="150000" selected>Balanserad · 150 000</option><option value="500000">Desktop · 500 000</option></select>',
  '<div class="row two"><button id="fusionAnalyze" class="accent">🔎 Samla & analysera</button><button id="fusionExport">⬇ Fusion-plan JSON</button></div>',
  '<div id="fusionResult" class="hint" aria-live="polite" role="status">Analysera scenen för att se forskningsbaserade förslag.</div>',
  '<div class="subheading">🧠 Adaptiv detalj och prestanda</div>',
  '<button id="fusionAdaptive" class="accent-outline">▶ Starta adaptiv förhandsvisning</button>',
  '<div id="fusionLive" class="hint" role="status">Avstängt. Ändrar inte geometry eller originalexport.</div>',
  '<div class="subheading">🎬 Auto Director: 5 kameravinklar</div>',
  '<div class="row two"><button id="fusionCinema" class="accent-outline">▶ Visa kameraflygning</button><button id="fusionCinemaJson">⬇ Kameraplan JSON</button></div>',
  '<p class="hint">Detta är egna deterministiska algoritmer inspirerade av forskning kring adaptiv LoD. Ingen faktisk meshoptimering, filmrendering, WebGPU-renderare eller generativ AI utlovas.</p>'
 ].join("");
 sidebar.insertBefore(panel,sidebar.querySelector("#freeResearchLab")||sidebar.querySelector("#researchPerfPanel")||null);
 const $=id=>panel.querySelector("#"+id);
 let last=null,cinema=null,active=null,raf=0;
 const isOtherMode=()=>!!(renderWorld?.isActive?.()||livingRuntime?.isPlaying?.());
 function collect(){
  const objects=describeThreeScene(root);
  if(!objects.length)throw Error("Scenen saknar synliga eller renderbara 3D-objekt.");
  return objects;
 }
 function analyze(){
  const objects=collect(),budget=Number($("fusionBudget").value);
  const dna=sceneDNA(objects),quality=planDetailBudget(objects,makeCamera(camera,canvas),{triangleBudget:budget});
  const scenePlan=createCinemaPlan(objects,{name:getProjectName?.()||"DuoForge 3D",aspect:camera.aspect});
  last={format:FUSION_VERSION,title:getProjectName?.()||"DuoForge",dna,quality,cinema:scenePlan,
   warnings:["Geometribudgeten är en rekommendation, ingen faktisk meshförenkling.",
   "Liknande SceneDNA innebär INTE garanterat identiska 3D-objekt."]};
  const dup=dna.approximateGeometryMatches.reduce((s,g)=>s+g.items.length,0);
  $("fusionResult").textContent=
   "SceneDNA "+dna.sceneKey+" · "+dna.objects+" meshar · "+dna.distinctSignatures+" formgrupper."+
   " Möjliga likheter: "+dup+" objekt. Detaljbudget: "+nfmt(quality.budget)+
   " trianglar, önskat "+nfmt(quality.requestedTriangles)+", rekommenderat "+
   nfmt(quality.plannedTriangles)+(quality.overBudget?" (kritiska objekt överskrider budgeten)":"")+
   ". 5 filmvinklar beräknade. Resultatet ändrar inte scenen.";
  return last;
 }
 function stop(){
  if(!active)return;
  const previous=active;active=null;
  cancelAnimationFrame(raf);
  camera.position.fromArray(previous.position);
  camera.quaternion.copy(previous.quaternion);
  camera.fov=previous.fov;camera.updateProjectionMatrix();
  orbit.target.fromArray(previous.target);orbit.enabled=previous.orbitEnabled;
  renderer.setPixelRatio(previous.pixelRatio);
  const width=Math.max(canvas.clientWidth,1),height=Math.max(canvas.clientHeight,1);
  renderer.setSize(width,height,false);
  $("fusionAdaptive").textContent="▶ Starta adaptiv förhandsvisning";
  $("fusionCinema").textContent="▶ Visa kameraflygning";
  $("fusionLive").textContent="Avstängt. Ursprunglig kamera och pixelratio återställda.";
 }
 function start(mode){
  if(isOtherMode())throw Error("Stäng Render World eller Living Objects före Fusion-förhandsvisning.");
  if(active)stop();
  if(!last)analyze();
  const plan=last.cinema;
  active={mode,position:camera.position.toArray(),quaternion:camera.quaternion.clone(),fov:camera.fov,
   target:orbit.target.toArray(),orbitEnabled:orbit.enabled,pixelRatio:renderer.getPixelRatio(),
   started:performance.now(),lastTick:performance.now(),governor:createTemporalBudgetGovernor({
    targetFps:canvas.clientWidth<600?30:60,minScale:.65,maxScale:1,windowFrames:36
   })};
  if(mode==="cinema"){
   orbit.enabled=false;$("fusionCinema").textContent="■ Stoppa kameraflygning";
   $("fusionLive").textContent="Kamera och scen används för visning. Originalet bevaras.";
  }else{
   $("fusionAdaptive").textContent="■ Stoppa adaptiv förhandsvisning";
   $("fusionLive").textContent="Mäter bildruteintervall (inte GPU-tid). Skärmens renderupplösning kan anpassas.";
  }
  const tick=now=>{
   if(!active||active.mode!==mode)return;
   if(isOtherMode()){stop();notify?.("Fusion pausad eftersom ett annat 3D-läge startades.");return;}
   const elapsed=now-active.started,delta=now-active.lastTick;active.lastTick=now;
   if(mode==="adaptive"){
    const state=active.governor.sample(delta);
    if(state.changed){
     renderer.setPixelRatio(Math.max(.5,active.pixelRatio*state.scale));
     renderer.setSize(Math.max(canvas.clientWidth,1),Math.max(canvas.clientHeight,1),false);
    }
    if(Math.floor(elapsed/1000)!==Math.floor((elapsed-delta)/1000)){
     $("fusionLive").textContent="Renderingsskala "+Math.round(state.scale*100)+" % · "+
      (state.averageMs===null?"–":state.averageMs+" ms")+
      " per bildruta (väggklocka, ej GPU-mätning). Ingen mesh modifieras.";
    }
   }else{
    const t=(elapsed/1000)%plan.seconds;
    const p=cameraAt(plan,t);
    camera.position.fromArray(p.position);
    orbit.target.fromArray(p.target);
    camera.lookAt(...p.target);
    camera.updateMatrixWorld(true);
    if(Math.floor(elapsed/1000)!==Math.floor((elapsed-delta)/1000))
     $("fusionLive").textContent="Auto Director: "+p.shotId+" / 5 · "+Math.floor(t)+" / "+plan.seconds+" sekunder.";
   }
   raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
 }
 $("fusionBudget").addEventListener("change",()=>{try{analyze();}catch(e){$("fusionResult").textContent=e.message;}});
 $("fusionAnalyze").onclick=()=>{try{analyze();}catch(e){$("fusionResult").textContent="Analys: "+e.message;}};
 $("fusionExport").onclick=()=>{try{downloadJSON("duoforge-fusion-plan.json",analyze());notify?.("Scene Fusion-plan exporterad.");}catch(e){$("fusionResult").textContent=e.message;}};
 $("fusionAdaptive").onclick=()=>{
  try{if(active?.mode==="adaptive")stop();else start("adaptive");}
  catch(e){$("fusionLive").textContent=e.message;}
 };
 $("fusionCinema").onclick=()=>{
  try{if(active?.mode==="cinema")stop();else{analyze();start("cinema");}}
  catch(e){$("fusionLive").textContent=e.message;}
 };
 $("fusionCinemaJson").onclick=()=>{
  try{const doc=analyze().cinema;downloadJSON("duoforge-five-camera-shots.json",doc);
   notify?.("25 sekunders kameraplan exporterad (inte renderad MP4).");}
  catch(e){$("fusionLive").textContent=e.message;}
 };
 window.addEventListener("pagehide",stop);
 return {analyze,stop,get active(){return !!active;}};
}
