import * as THREE from "three";
import {SURFACE_PRESETS,createSurfaceLibrary,surfacePreset,hasSurfaceTexture} from "./procedural-materials.mjs";
import {classifySurfaceName} from "./surface-classifier.mjs";
import {initPbrVault} from "./pbr-vault-ui.mjs";
import {initOneClickTexturing} from "./one-click-texturing.mjs";

const $=id=>document.getElementById(id);
function isTextured(mesh){
 const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 return source.some(mat=>Boolean(mat?.map)&&!mat?.userData?.duoforgeSurface);
}
function safeUV(mesh){
 const geo=mesh.geometry;
 if(!geo?.attributes?.position)return false;
 if(geo.attributes.uv)return true;
 // Missing UV: generate a basic non-destructive planar projection on a CLONED
 // geometry. The original asset remains available through Undo/project history.
 const clone=geo.clone(),position=clone.attributes.position;
 if(position.count>200000)return false; // avoid huge browser CPU allocations
 clone.computeBoundingBox();
 const bb=clone.boundingBox,span=bb.getSize(new THREE.Vector3());
 const dims=[["x",span.x],["y",span.y],["z",span.z]].sort((a,b)=>b[1]-a[1]);
 const [u,v]=[dims[0][0],dims[1][0]];
 const uv=new Float32Array(position.count*2),vertex=new THREE.Vector3();
 for(let i=0;i<position.count;i++){
  vertex.fromBufferAttribute(position,i);
  uv[2*i]=(vertex[u]-bb.min[u])/Math.max(span[u],1e-5);
  uv[2*i+1]=(vertex[v]-bb.min[v])/Math.max(span[v],1e-5);
 }
 clone.setAttribute("uv",new THREE.BufferAttribute(uv,2));
 mesh.geometry=clone;return true;
}
export function initMaterialLab({getSelected,notify,pushHistory,dirty,refreshTree,updateInspector}){
 const surfaceLibrary=createSurfaceLibrary("medium");
 let preset="paint",tintEdited=false,vault=null,oneClick=null;
 const container=$("materialSwatches");
 function chosen(){
  let item=getSelected();
  if(!item)return null;
  return item;
 }
 function swatches(){
  const palette={paint:"#288ad0",carbon:"#29333b",chrome:"#b1e0ef",brushed:"#b5c6c9",glass:"#71c4de",
   rubber:"#343b43",leather:"#995a34",asphalt:"#454a4e",grass:"#518548",bark:"#87522f",wood:"#b88751",
   concrete:"#aaa9a4",brick:"#be5e46",stone:"#94988e",sand:"#d7ba7b",neon:"#2dffce",plaster:"#d6d0b8"};
  for(const p of SURFACE_PRESETS){
   const button=document.createElement("button");
   button.type="button";button.className="surface-swatch";button.dataset.surface=p.id;
   button.title=p.label;button.setAttribute("aria-pressed",p.id===preset?"true":"false");
   const circle=document.createElement("span");circle.className="swatch-dot";
   circle.style.background="radial-gradient(circle at 28% 22%,#ffffff9c 0%,transparent 42%),linear-gradient(135deg,"+
    (palette[p.id]||p.color)+",#121820)";
   const label=document.createElement("small");label.textContent=p.label;
   button.append(circle,label);
   button.onclick=()=>{preset=p.id;tintEdited=false;$("surfaceTint").value=p.color;updateSwatches()};
   container.append(button);
  }
 }
 function updateSwatches(){
  for(const btn of container.querySelectorAll("[data-surface]"))btn.setAttribute("aria-pressed",btn.dataset.surface===preset?"true":"false");
  $("surfacePresetName").textContent=surfacePreset(preset).label;
  $("surfaceColorHint").textContent="PBR • metall "+Math.round(surfacePreset(preset).metalness*100)+" % • grovhet "+Math.round(surfacePreset(preset).roughness*100)+" %";
  $("surfaceTint").disabled=false;
  $("surfaceTile").disabled=!hasSurfaceTexture(preset);
 }
 function selectionChanged(){
  const obj=chosen();
  const count=obj?Array.from((function*(){let meshes=[];obj.traverse(o=>{if(o.isMesh)meshes.push(o)});yield*meshes})()).length:0;
  $("surfaceTarget").textContent=obj?obj.name+" • "+count+" mesh"+(count===1?"":"ar"):"Markera ett objekt i scenen";
  $("applySurface").disabled=!count;$("autoSurface").disabled=!count;
  vault?.selectionChanged();
  oneClick?.selectionChanged();
  return count;
 }
 function assign(mesh,type,tint,repeat){
  const actualType=type==="neon"?"neon":type;
  if(!safeUV(mesh)&&hasSurfaceTexture(type))return false;
  const chosenTint=tint||surfacePreset(type).color;
  const material=surfaceLibrary.material(actualType,{color:chosenTint,repeat:[repeat,repeat]});
  // Use one PBR material per mesh. Explicit user action may replace several
  // materials, but smart mode NEVER replaces existing photographic textures.
  mesh.material=material;
  return true;
 }
 function targetMeshes(){
  const obj=chosen(),list=[];
  obj?.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&mesh.geometry)list.push(mesh)});
  return list;
 }
 function setStatus(summary){$("surfaceStatus").textContent=summary;notify(summary,3400)}
 function applyChosen(){
  const meshes=targetMeshes();
  if(!meshes.length)return setStatus("Markera ett 3D-objekt först.");
  const repeat=Math.max(.5,Math.min(12,Number($("surfaceTile").value)||1));
  const tint=$("surfaceTint").value;
  pushHistory();
  let count=0;
  for(const mesh of meshes)if(assign(mesh,preset,tint,repeat))count++;
  dirty();refreshTree();updateInspector();selectionChanged();
  setStatus(count+" av "+meshes.length+" meshar fick "+surfacePreset(preset).label+" och PBR-inställningar.");
 }
 function autoFinish(){
  const meshes=targetMeshes();
  if(!meshes.length)return setStatus("Markera hela modellen, eller ett enskilt mesh.");
  const root=chosen();
  const isVehicle=Boolean(root?.userData?.duoforgeLiving?.type==="vehicle"||
   /vehicle|car|kart|gtr|racer|bil|fordon/i.test(root?.name||""));
  const overwrite=$("surfaceOverwrite").checked;
  const plan=meshes.map(mesh=>{
   const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
   const kind=classifySurfaceName(mesh.name,mesh.parent?.name,isVehicle);
   if(!kind||(!overwrite&&isTextured(mesh)))return null;
   // Respect original colour on special parts; bodywork gets showroom blue.
   const originalColor=material?.color?.getHexString?.();
   const color=kind==="paint"?"#287fbd":kind==="brushed"?"#a5b0bc":kind==="rubber"?"#32383c":surfacePreset(kind).color;
   return {mesh,kind,color};
  }).filter(Boolean);
  if(!plan.length)return setStatus("Inga omålade delar hittades. Aktivera 'Ersätt befintliga texturer' för att skriva över importerade material.");
  pushHistory();
  const counts={};let applied=0;
  for(const {mesh,kind,color} of plan){
   if(assign(mesh,kind,color,2)){counts[kind]=(counts[kind]||0)+1;applied++}
  }
  dirty();refreshTree();updateInspector();selectionChanged();
  const categories=Object.entries(counts).map(([kind,count])=>surfacePreset(kind).label+" "+count).join(" · ");
  setStatus(applied+" av "+meshes.length+" delar auto-texturerade. "+categories);
 }
 swatches();
 $("surfaceTint").value=surfacePreset(preset).color;
 $("surfaceTint").oninput=()=>{tintEdited=true};
 $("surfaceTile").oninput=()=>{$("surfaceTileOut").textContent=Number($("surfaceTile").value).toFixed(1)+"×"};
 $("applySurface").onclick=applyChosen;
 $("autoSurface").onclick=autoFinish;
 updateSwatches();
 oneClick=initOneClickTexturing({getSelected,notify,pushHistory,dirty,refreshTree,updateInspector,safeUV,selectionChanged,surfaceLibrary});
 vault=initPbrVault({getSelected,notify,pushHistory,dirty,refreshTree,updateInspector,safeUV,selectionChanged});
 selectionChanged();
 return {selectionChanged};
}
