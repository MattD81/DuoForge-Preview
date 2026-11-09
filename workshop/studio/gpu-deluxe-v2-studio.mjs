/**
 * GPU Deluxe V2 opt-in panel in the EXISTING DuoForge 3D Studio.
 * Does not change editable GLB meshes or any saved project.
 */
import * as THREE from "three";
import {createGpuTimer,reconstructionPolicy} from "./gpu-deluxe-v2.mjs";
import {TEMPORAL_RECONSTRUCT_SHADER,PROXY_RAYTRACE_SHADER} from "./gpu-deluxe-v2-effects.mjs";
import {createNeuralSRShader,createNeuralBudget,NEURAL_SR_MODEL} from "./neural-sr.mjs";
import {captureTrainingAtlas} from "./neural-training-capture.mjs";

const MAX=PROXY_RAYTRACE_SHADER.maxSpheres;
export function collectRayProxies(root,{limit=MAX}={}){
 const items=[],center=new THREE.Vector3();
 root.updateMatrixWorld(true);
 root.traverse(node=>{
  if(!node.isMesh||!node.visible||!node.geometry||items.length>=limit)return;
  const g=node.geometry;
  if(!g.boundingSphere)g.computeBoundingSphere();
  if(!g.boundingSphere||!Number.isFinite(g.boundingSphere.radius))return;
  center.copy(g.boundingSphere.center).applyMatrix4(node.matrixWorld);
  node.matrixWorld.decompose(new THREE.Vector3(),new THREE.Quaternion(),_proxyScale);
  const radius=g.boundingSphere.radius*Math.max(Math.abs(_proxyScale.x),Math.abs(_proxyScale.y),Math.abs(_proxyScale.z));
  if(!Number.isFinite(radius)||radius<=.0001)return;
  const mat=Array.isArray(node.material)?node.material[0]:node.material;
  const color=mat?.color?.isColor?mat.color.clone():new THREE.Color(.55,.66,.78);
  items.push({sphere:new THREE.Vector4(center.x,center.y,center.z,radius),
   color,reflectivity:Math.min(.7,Math.max(0,Number(mat?.metalness)||0)*.55+.08)});
 });
 return items;
}
const _proxyScale=new THREE.Vector3();

export function initGpuDeluxeV2Studio({renderer,canvas,scene,root,camera,isBusy=()=>false,notify=()=>{}}={}){
 if(!renderer||!canvas||!scene||!root||!camera)throw Error("GPU Deluxe V2 requires active 3D Studio");
 const sidebar=document.querySelector(".sidebar.right-panel")||document.querySelector(".sidebar");
 if(!sidebar)return null;
 const panel=document.createElement("section");
 panel.className="panel-section";panel.id="gpuDeluxeV2";
 panel.innerHTML=[
  '<div class="section-heading"><h2>⚡ GPU Deluxe V2</h2><span class="mini-pill">EXPERIMENT V2</span></div>',
  '<p class="hint">Verklig GPU-tid där WebGL2 stöder det. Prova temporal uppskalning eller egen ray tracing med förenklade modellformer. Ingen neural DLSS-modell.</p>',
  '<div style="display:flex;gap:7px;flex-wrap:wrap;margin:8px 0">',
  '<button type="button" id="gpuV2Temporal" aria-pressed="false">◈ Temporal uppskalning</button>',
  '<button type="button" id="gpuV2Ray" aria-pressed="false">✦ Ray tracing (prototyp)</button>',
  '<button type="button" id="gpuV2Neural" aria-pressed="false">🧠 Neural SR (tränad AI)</button>',
  '<button type="button" id="gpuV2Capture">↓ Spara träningspar</button>',
  '<button type="button" id="gpuV2Off">Normal vy</button>',
  '</div>',
  '<p id="gpuV2Status" class="hint" role="status" aria-live="polite">V2 redo.</p>',
  '<p class="hint">Neural SR kör lokalt med en liten tränad CNN-modell. Experimentell, inte DLSS-kvalitet. Automatisk reservväg vid fel eller för hög GPU-tid.</p>',
  '<p class="hint">Ray tracing visar högst 12 av objektens omslutande sfärer, inte de exakta GLB-ytorna. Kan vara långsam på mobil. Ändrar inte ditt sparade projekt.</p>'
 ].join("");
 sidebar.append(panel);
 const $=id=>panel.querySelector("#"+id);
 const status=$("gpuV2Status");
 const timer=createGpuTimer(renderer);
 const neuralBudget=createNeuralBudget({maxGpuMs:Math.min(canvas.clientWidth||1280,canvas.clientHeight||720)<700?28:19,consecutive:10});
 let mode="off",low=null,history=[],rayTarget=null,outSize=[0,0],
  upscaleMaterial=null,rayMaterial=null,neuralMaterial=null,lastCamera=null,stable=0,frame=0,
  rayProxyCount=0,rayMeshCount=0,outputs=null,disposed=false;
 const quadGeometry=new THREE.PlaneGeometry(2,2);
 const fullscreen=new THREE.Scene(),quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const quad=new THREE.Mesh(quadGeometry,new THREE.MeshBasicMaterial({color:0xffffff}));
 quad.frustumCulled=false;fullscreen.add(quad);
 const finalMaterial=new THREE.MeshBasicMaterial({map:null,depthTest:false,depthWrite:false,toneMapped:false});
 function makeMaterial(shader,uniforms){
  return new THREE.ShaderMaterial({
   vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader,
   uniforms,depthTest:false,depthWrite:false,toneMapped:false
  });
 }
 function setMode(next){
  if(mode===next)return;
  mode=next;stable=0;lastCamera=null;
  $("gpuV2Temporal").setAttribute("aria-pressed",String(mode==="temporal"));
  $("gpuV2Ray").setAttribute("aria-pressed",String(mode==="raytrace"));
  $("gpuV2Neural").setAttribute("aria-pressed",String(mode==="neural"));
  if(next==="neural")neuralBudget.reset(timer.snapshot().samples);
  status.textContent=mode==="neural"?"Neural SR: tränad CNN körs lokalt på GPU.":
   mode==="temporal"?"Temporal uppskalning aktiv. Stilla kamera bygger upp historik.":
   mode==="raytrace"?"Ray tracing av modellernas ungefärliga sfärformer aktiv.":
   "Normal 3D-vy. GPU-tidsmätning fortsätter om den stöds.";
  if(mode!=="off")notify("GPU Deluxe V2: "+(mode==="neural"?"Neural SR":"temporal"===mode?"Temporal uppskalning":"Ray tracing-prototyp")+".");
 }
 $("gpuV2Temporal").onclick=()=>setMode(mode==="temporal"?"off":"temporal");
 $("gpuV2Ray").onclick=()=>setMode(mode==="raytrace"?"off":"raytrace");
 $("gpuV2Neural").onclick=()=>setMode(mode==="neural"?"off":"neural");
 $("gpuV2Capture").onclick=()=>{
  if(isBusy()){status.textContent="Avsluta spelning eller rendering före bildinsamling.";return;}
  try{
   const saved=captureTrainingAtlas({renderer,scene,camera,canvas});
   status.textContent="Träningsbild sparad lokalt: "+saved.width+"×"+saved.height+" referens + 2× lågupplöst par.";
  }catch(e){status.textContent="Bildinsamling misslyckades: "+e.message;}
 };
 $("gpuV2Off").onclick=()=>setMode("off");
 const dimensions=new THREE.Vector2();
 function clearTargets(){
  low?.dispose();low=null;
  for(const target of history)target.dispose();
  history=[];
  rayTarget?.dispose();rayTarget=null;outSize=[0,0];stable=0;
 }
 function allocate(){
  renderer.getDrawingBufferSize(dimensions);
  const w=Math.max(1,Math.floor(dimensions.x)),h=Math.max(1,Math.floor(dimensions.y));
  if(outSize[0]===w&&outSize[1]===h)return;
  clearTargets();outSize=[w,h];
  const mobile=Math.min(canvas.clientWidth||w,canvas.clientHeight||h)<700;
  const p=reconstructionPolicy({width:w,height:h,scale:.72,mobile});
  const options={depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter};
  low=new THREE.WebGLRenderTarget(p.renderWidth,p.renderHeight,{...options,depthBuffer:true});
  history=[new THREE.WebGLRenderTarget(w,h,options),new THREE.WebGLRenderTarget(w,h,options)];
  // Ray tracer is a separate optional inexpensive low-resolution effect.
  const rayScale=Math.min(1,Math.sqrt((mobile?320000:700000)/(w*h)));
  rayTarget=new THREE.WebGLRenderTarget(Math.max(1,Math.round(w*rayScale)),
   Math.max(1,Math.round(h*rayScale)),options);
  outputs=0;
 }
 function temporal(){
  if(!upscaleMaterial){
   upscaleMaterial=makeMaterial(TEMPORAL_RECONSTRUCT_SHADER,{
    tCurrent:{value:null},tHistory:{value:null},
    uTexel:{value:new THREE.Vector2(1,1)},uHistoryWeight:{value:0}
   });
  }
  camera.updateMatrixWorld(true);
  const elements=camera.matrixWorld.elements.concat(camera.projectionMatrix.elements);
  const moved=!lastCamera||elements.some((v,i)=>Math.abs(v-lastCamera[i])>.0001);
  lastCamera=elements;
  stable=moved?0:Math.min(stable+1,40);
  // History only after the camera is stable. Object animation may still ghost.
  const weight=stable<3?0:Math.min(.72,(stable-2)*.055);
  const active=history[outputs%2],old=history[(outputs+1)%2];
  renderer.setRenderTarget(low);renderer.clear();renderer.render(scene,camera);
  upscaleMaterial.uniforms.tCurrent.value=low.texture;
  upscaleMaterial.uniforms.tHistory.value=old.texture;
  upscaleMaterial.uniforms.uTexel.value.set(1/low.width,1/low.height);
  upscaleMaterial.uniforms.uHistoryWeight.value=weight;
  quad.material=upscaleMaterial;
  renderer.setRenderTarget(active);renderer.clear();renderer.render(fullscreen,quadCamera);
  finalMaterial.map=active.texture;quad.material=finalMaterial;
  renderer.setRenderTarget(null);renderer.render(fullscreen,quadCamera);
  outputs++;
 }
 function neural(){
  if(!neuralMaterial){
   const shader=createNeuralSRShader();
   neuralMaterial=makeMaterial(shader,{
    tCurrent:{value:null},uOutputTexel:{value:new THREE.Vector2(1,1)}
   });
  }
  renderer.setRenderTarget(low);renderer.clear();renderer.render(scene,camera);
  neuralMaterial.uniforms.tCurrent.value=low.texture;
  neuralMaterial.uniforms.uOutputTexel.value.set(1/outSize[0],1/outSize[1]);
  quad.material=neuralMaterial;
  renderer.setRenderTarget(null);renderer.render(fullscreen,quadCamera);
 }
 function proxies(){
  const list=collectRayProxies(root),spheres=[],colors=[],reflect=[];
  rayMeshCount=0;root.traverse(x=>{if(x.isMesh)rayMeshCount++});
  rayProxyCount=list.length;
  for(let i=0;i<MAX;i++){
   const p=list[i];spheres.push(p?.sphere||new THREE.Vector4(0,-10000,0,.01));
   colors.push(p?.color||new THREE.Color(.5,.5,.5));
   reflect.push(p?.reflectivity||0);
  }
  return {spheres,colors,reflect};
 }
 function raytrace(){
  if(!rayMaterial){
   rayMaterial=makeMaterial(PROXY_RAYTRACE_SHADER,{
    uCameraWorld:{value:new THREE.Matrix4()},uFovRad:{value:1},
    uAspect:{value:1},uCount:{value:0},
    uSpheres:{value:[]},uColors:{value:[]},uReflect:{value:[]}
   });
  }
  const data=proxies();camera.updateMatrixWorld(true);
  rayMaterial.uniforms.uCameraWorld.value.copy(camera.matrixWorld);
  rayMaterial.uniforms.uFovRad.value=camera.fov*Math.PI/180;
  rayMaterial.uniforms.uAspect.value=camera.aspect;
  rayMaterial.uniforms.uCount.value=rayProxyCount;
  rayMaterial.uniforms.uSpheres.value=data.spheres;
  rayMaterial.uniforms.uColors.value=data.colors;
  rayMaterial.uniforms.uReflect.value=data.reflect;
  quad.material=rayMaterial;
  renderer.setRenderTarget(rayTarget);renderer.clear();renderer.render(fullscreen,quadCamera);
  finalMaterial.map=rayTarget.texture;quad.material=finalMaterial;
  renderer.setRenderTarget(null);renderer.render(fullscreen,quadCamera);
 }
 function render(){
  if(mode==="off"||disposed||isBusy())return false;
  try{
   allocate();
   if(mode==="raytrace")raytrace();else if(mode==="neural")neural();else temporal();
   return true;
  }catch(error){
   console.error("GPU Deluxe V2 fallback",error);
   setMode("off");clearTargets();
   status.textContent="V2 kunde inte renderas på den här enheten; normal WebGL återställd.";
   return false;
  }
 }
 function updateStatus(){
  if(disposed||++frame%30)return;
  const q=timer.snapshot();
  const perf=q.supported?(q.gpuMs===null?"GPU väntar på mätvärde":q.gpuMs+" ms GPU")
   :"GPU-timer stöds inte i webbläsaren";
  if(mode==="neural"&&neuralBudget.sample(q)){
   setMode("temporal");
   status.textContent="Neural SR pausad: uppmätt GPU-tid över säkerhetsgränsen. Temporal reservläge.";
   return;
  }
  if(mode==="neural")status.textContent=perf+" · Neural SR · "+NEURAL_SR_MODEL.training.kind+" · 2×, modell v0.1";
  else if(mode==="raytrace")status.textContent=perf+" · Ray tracing-proxy: "+rayProxyCount+"/"+rayMeshCount+" meshdelar. Geometrin är approximativ.";
  else if(mode==="temporal")status.textContent=perf+" · Temporal 0,72× rekonstruktion · "+
   (stable>=3?"stabil kamera, historik aktiv":"historik pausad under rörelse")+". Ingen neural AI.";
  else status.textContent=perf+" · Normal WebGL-rendering.";
 }
 function dispose(){
  disposed=true;timer.dispose();clearTargets();
  upscaleMaterial?.dispose();rayMaterial?.dispose();neuralMaterial?.dispose();
  finalMaterial.dispose();quadGeometry.dispose();panel.remove();
 }
 window.addEventListener("pagehide",dispose,{once:true});
 return Object.freeze({render,updateStatus,dispose,timer,get mode(){return mode}});
}
