import * as THREE from "three";
import {createVolvoS90,identifyVolvoS90,S90_REFERENCE} from "./volvo-s90-model.mjs";

const $=id=>document.getElementById(id);
const paints={
 "Vapour Grey":"#35495d",
 "Crystal White":"#d9dee2",
 "Onyx Black":"#171c22",
 "Denim Blue":"#244e75",
 "Bright Dusk":"#917d74",
 "Silver Dawn":"#b3bfc7",
 "Recharge Forest":"#244a47"
};
const interiors={sand:"#b99a73",black:"#33383d",brown:"#86634e",blue:"#3a4a62"};
const credit="Volvo S90 Recharge – high-poly original by Adam Wiese (lazercar), CC BY 4.0, https://sketchfab.com/3d-models/volvo-s90-recharge-free-9462b07c10244fd4a28d86846dc9e3a9";
function hasS90(node){
 return identifyVolvoS90(node);
}
function selectedS90(getSelected,root){
 let node=getSelected();
 while(node&&node.parent&&node.parent!==root)node=node.parent;
 return hasS90(node)?node:root.children.find(hasS90)||null;
}
function repaint(car,hex){
 const color=new THREE.Color(hex);
 car.traverse(obj=>{
  if(!obj.isMesh||!/^(?:Sculpted|S90|Long rear|Front bumper|Rear bumper|Door sill|Lower structural|Chrome sill)?/i.test(obj.name))return;
  const mat=obj.material;
  if(!mat?.userData?.duoforgeSurface||mat.userData.duoforgeSurface!=="paint")return;
  if(/caliper|charging|indicator|speaker|brake/i.test(obj.name))return;
  const copy=mat.clone();copy.color.copy(color);
  obj.material=copy;
 });
 car.userData.duoforgeS90.paint=hex;
}
function recabin(car,tone){
 const hex=interiors[tone]||interiors.black;
 const shade=new THREE.Color(hex);
 car.traverse(obj=>{
  if(!obj.isMesh)return;
  if(!/Seat cushion|Seat backrest|Headrest|Center leather stitched bolster|Outer side bolster|Back support side/i.test(obj.name))return;
  const mat=obj.material;
  if(!mat||!mat.color)return;
  const copy=mat.clone();copy.color.copy(shade);obj.material=copy;
 });
 car.userData.duoforgeS90.interior=tone;
}
function setDoors(car,isOpen){
 let count=0;
 car.traverse(node=>{
  if(!node.isGroup||!/^(Left|Right) (Front|Rear) door hinge$/.test(node.name))return;
  const side=node.name.startsWith("Left")?-1:1;
  node.rotation.y=(isOpen?side*.8:0);count++;
 });
 return count;
}
function setLights(car,enabled){
 const shared=new Map();
 let count=0;
 car.traverse(mesh=>{
  if(!mesh.isMesh||!/(?:LED|taillight|projector)/i.test(mesh.name)||/indicator/i.test(mesh.name))return;
  if(!mesh.material?.emissive)return;
  let mat=shared.get(mesh.material);
  if(!mat){mat=mesh.material.clone();mat.emissiveIntensity=enabled?(mesh.name.includes("taillight")?2.3:2):.02;shared.set(mesh.material,mat);}
  mesh.material=mat;count++;
 });
 car.userData.duoforgeS90.lights=Boolean(enabled);
 return count;
}
export function initVolvoGarage({root,getSelected,select,pushHistory,dirty,refreshTree,updateStats,fitScene,notify,getRenderWorld}){
 let doorsOpen=false,lightsOn=true;
 const set=(id,text)=>{$(id).textContent=text;};
 const format=(value)=>value.toLocaleString("sv-SE");
 function listModels(){
  const car=selectedS90(getSelected,root);
  set("s90GarageSelected",car?
   car.name+" • "+car.userData.duoforgeS90.quality:
   "Ingen S90 i scenen ännu – välj Skapa modell");
  $("s90Preview").disabled=!car;
  $("s90Doors").disabled=!car;
  $("s90Lights").disabled=!car;
  $("s90UpdatePaint").disabled=!car;
  $("s90UpdateCabin").disabled=!car;
  $("s90Export").disabled=!car;
  return car;
 }
 function create(){
  const quality=$("s90Detail").value==="performance"?"performance":"detailed";
  const paint=$("s90Paint").value,interior=$("s90Interior").value;
  pushHistory();
  // On the welcome screen, replace the starter kart; preserve any actual
  // user-created scenes instead of clearing unrelated work.
  if(root.children.length===1&&root.children[0].name==="DuoForge Kart – startmodell")
   root.remove(root.children[0]);
  const car=createVolvoS90({quality,paint,interior});
  const suffix=root.children.filter(hasS90).length+1;
  car.name=S90_REFERENCE.name+(suffix>1?" #"+suffix:"");
  root.add(car);
  select(car);refreshTree();updateStats();fitScene(car);
  const meshes=[];let tris=0;
  car.traverse(obj=>{if(obj.isMesh){meshes.push(obj);const g=obj.geometry;
   tris+=(g.index?g.index.count:g.attributes?.position?.count||0)/3;}});
  set("s90BuildStatus","Skapad: "+format(meshes.length)+" delar • "+format(Math.round(tris))+" trianglar. Skapad direkt i webbläsaren.");
  $("projectName").value="Volvo S90 Recharge – Garage";
  dirty();listModels();
  notify("Volvo S90 Studio Edition skapad. Prova showroom, dörrar, ljus och GLB-export!",6000);
 }
 function changePaint(){
  const car=listModels();if(!car)return;
  pushHistory();repaint(car,$("s90Paint").value);dirty();refreshTree();updateStats();
  set("s90BuildStatus","Karossen lackerad. Testa den i Render World med Showroom och Hög kvalitet.");
  notify("Nytt karosslack applicerat – befintliga material och hjul bevaras.");
 }
 function changeCabin(){
  const car=listModels();if(!car)return;
  pushHistory();recabin(car,$("s90Interior").value);dirty();
  notify("Kupéfärgen ändrad.");
 }
 function toggleDoors(){
  const car=listModels();if(!car)return;
  pushHistory();doorsOpen=!doorsOpen;
  const count=setDoors(car,doorsOpen);dirty();
  $("s90Doors").textContent=doorsOpen?"🚪 Stäng dörrar":"🚪 Öppna dörrar";
  notify(count+" dörrar "+(doorsOpen?"öppnade":"stängda")+" – använd kameran för att se kupén.");
 }
 function toggleLights(){
  const car=listModels();if(!car)return;
  pushHistory();lightsOn=!lightsOn;
  const count=setLights(car,lightsOn);dirty();
  $("s90Lights").textContent=lightsOn?"💡 Släck LED":"💡 Tänd LED";
  notify(count+" strålkastar-/bakljusdelar uppdaterade.");
 }
 function preview(){
  const car=listModels();if(!car)return;
  select(car);
  $("renderWorld").value=$("s90World").value;
  $("renderWorld").dispatchEvent(new Event("change",{bubbles:true}));
  if($("s90World").value==="showroom"){
   $("renderCamera").value="orbit";$("renderCamera").dispatchEvent(new Event("change",{bubbles:true}));
  }else{
   $("renderCamera").value="follow";$("renderCamera").dispatchEvent(new Event("change",{bubbles:true}));
  }
  getRenderWorld()?.start();
 }
 function openSource(){
  $("s90OriginalDialog").showModal();
 }
 function exportGLB(){
  const car=listModels();if(!car)return;
  select(car);
  $("exportGLB").click();
 }
 $("s90Build").onclick=create;
 $("s90UpdatePaint").onclick=changePaint;
 $("s90UpdateCabin").onclick=changeCabin;
 $("s90Doors").onclick=toggleDoors;
 $("s90Lights").onclick=toggleLights;
 $("s90Preview").onclick=preview;
 $("s90Original").onclick=openSource;
 $("s90Export").onclick=exportGLB;
 const menu=$("s90Paint");
 for(const [name,value]of Object.entries(paints)){
  const item=document.createElement("option");item.textContent=name;item.value=value;
  menu.appendChild(item);
 }
 menu.value="#35495d";
 listModels();
 return {selectionChanged:listModels,create};
}
export const S90_ORIGINAL_CREDIT=credit;
