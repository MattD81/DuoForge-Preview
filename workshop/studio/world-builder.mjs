import * as THREE from "three";
import {parseWorldPrompt,seededRandom} from "./world-planner.mjs";

const $=id=>document.getElementById(id);
const MATERIALS={
 brick:0xc5aa8e,roof:0x98584d,wood:0x765136,glass:0x78adc9,
 road:0x2b343f,leaves:0x28764d,leaves2:0x329868,trunk:0x775339,
 crate:0xb98346,metal:0xa8bdca,tire:0x17202a
};
function material(color,roughness=.8,metalness=0){
 return new THREE.MeshStandardMaterial({color,roughness,metalness});
}
function part(parent,geometry,color,position,rotation){
 const mesh=new THREE.Mesh(geometry,material(color));
 mesh.position.set(...position);
 if(rotation)mesh.rotation.set(...rotation);
 mesh.castShadow=true;mesh.receiveShadow=true;
 parent.add(mesh);return mesh;
}
function createHouse(n,rng,theme){
 const g=new THREE.Group();g.name="Hus "+String(n).padStart(2,"0");
 const color=theme==="winter"?0xc9d5d8:[0xc5aa8e,0xdec6a1,0xc9b79a,0xabc5b4][n%4];
 const w=2.5+rng()*1.1,h=2+rng()*1.2,d=2.4+rng()*.9;
 part(g,new THREE.BoxGeometry(w,h,d),color,[0,h/2,0]);
 const roof=part(g,new THREE.ConeGeometry(w*.83,1.35,4),0x98584d,[0,h+.55,0],[0,Math.PI/4,0]);
 roof.name="Tak";
 const door=part(g,new THREE.BoxGeometry(.55,1.3,.1),0x61402e,[0,.65,d/2+.06]);
 door.name="Entrédörr (dekor)";
 for(const x of [-w*.3,w*.3]){
  for(const y of [h*.6])part(g,new THREE.BoxGeometry(.48,.5,.08),MATERIALS.glass,[x,y,d/2+.07]);
 }
 const chimney=part(g,new THREE.BoxGeometry(.35,.8,.35),0x75665e,[w*.2,h+.55,-.25]);
 chimney.name="Skorsten";
 return g;
}
function createTree(n,rng,theme){
 const g=new THREE.Group();g.name="Tall "+String(n).padStart(2,"0");
 const h=2.1+rng()*1.7,leaf=theme==="winter"?0xb0c8c3:MATERIALS.leaves;
 part(g,new THREE.CylinderGeometry(.12,.18,h*.42,8),MATERIALS.trunk,[0,h*.21,0]).name="Stam";
 for(let i=0;i<3;i++){
  part(g,new THREE.ConeGeometry(.65-i*.12,h*.63,9),i%2?MATERIALS.leaves2:leaf,[0,h*.48+i*h*.19,0]).name="Krona "+(i+1);
 }
 return g;
}
function createKart(){
 const g=new THREE.Group();g.name="Körbar racerbil";
 g.userData.duoforgeLiving={type:"vehicle",kind:"vehicle",version:1,maxSpeed:19,reverseSpeed:6,acceleration:9,braking:16,rollingResistance:2.2,wheelBase:2.3,steeringDegrees:29,wheelRadius:.42};
 part(g,new THREE.BoxGeometry(2.3,.5,3.5),0x24b78b,[0,.7,0]).name="Chassi";
 part(g,new THREE.BoxGeometry(1.55,.65,1.7),0x3e668b,[0,1.18,-.4]).name="Förarplats";
 for(const x of [-1.18,1.18])for(const z of [-1.05,1.1]){
  const wheel=part(g,new THREE.CylinderGeometry(.42,.42,.28,28),MATERIALS.tire,[x,.42,z],[0,0,Math.PI/2]);
  wheel.name="wheel_"+(z>0?"front":"rear")+"_"+(x<0?"L":"R")+"_tire";
  part(g,new THREE.CylinderGeometry(.2,.2,.29,20),MATERIALS.metal,[x,.42,z],[0,0,Math.PI/2]).name="Fälg";
 }
 return g;
}
function createObstacle(i){
 const box=part(new THREE.Group(),new THREE.BoxGeometry(1.4,1.3,1.4),MATERIALS.crate,[0,.65,0]);
 box.name="Hinder "+String(i).padStart(2,"0");box.userData.livingCollider=true;
 return box.parent;
}
function createDoor(i){
 const g=new THREE.Group();g.name="Öppningsbar dörr "+String(i).padStart(2,"0");
 const mesh=part(g,new THREE.BoxGeometry(.9,1.8,.14),0x7c5537,[0,.9,0]);
 mesh.name="Dörrblad";
 g.userData.duoforgeLiving={type:"door",version:1,openAngle:90,interactionDistance:3};
 g.userData.livingCollider=true;
 return g;
}
function createRoad(){
 const group=new THREE.Group();group.name="Väg med körfält";
 group.userData.livingCollider=false;
 group.userData.duoforgeRoad=true;
 const road=new THREE.Mesh(new THREE.PlaneGeometry(10.5,130),material(MATERIALS.road,.96));
 road.rotation.x=-Math.PI/2;road.position.set(0,.02,27);road.receiveShadow=true;group.add(road);
 const line=material(0xe0d9bd,.95),mark=material(0xf0c44b,.95);
 for(const x of [-4.9,4.9])part(group,new THREE.BoxGeometry(.12,.018,130),0xd7d9d3,[x,.044,27]);
 for(let z=-33;z<90;z+=9)part(group,new THREE.BoxGeometry(.17,.02,4),0xf3c756,[0,.05,z]);
 return group;
}
export function initWorldBuilder({root,scene,sun,skyLight,pushHistory,refreshTree,updateStats,dirty,fitScene,notify,select}){
 const input=$("worldPrompt"),preview=$("worldPlan");
 const examples={
  village:"Skapa en by med 8 hus, 16 träd, 1 bil och en väg i dagsljus",
  night:"Skapa en nattstad med 12 hus, 20 träd, 1 bil, 4 hinder och en väg",
  forest:"Skapa en skog med 35 träd, 3 hus, 1 bil, 2 hinder och en väg",
  track:"Skapa en racerbana med 1 bil, 9 hinder, 6 träd och 3 hus"
 };
 function showPlan(){
  const plan=parseWorldPrompt(input.value);
  if(plan.error){preview.textContent=plan.error;$("buildWorld").disabled=true;return}
  $("buildWorld").disabled=false;
  const counts=plan.counts;
  preview.textContent=[counts.houses+" hus",counts.trees+" träd",counts.cars+" bilar",
    counts.crates+" hinder",counts.doors+" dörrar",plan.road?"väg":"ingen väg",
    "ljus: "+({night:"natt",sunset:"kväll",winter:"vinter",desert:"öken",day:"dag"})[plan.theme]
  ].join(" · ")+" (regelbaserat, gratis)";
 }
 input.addEventListener("input",showPlan);
 for(const btn of document.querySelectorAll("[data-world-example]")){
  btn.onclick=()=>{input.value=examples[btn.dataset.worldExample];showPlan()};
 }
 function lighting(theme){
  const color=theme==="night"?0x09172a:theme==="sunset"?0x64506f:theme==="winter"?0xa6c4df:theme==="desert"?0x8d9d9c:0x101d30;
  scene.background=new THREE.Color(color);
  skyLight.intensity=theme==="night"?.75:theme==="sunset"?1.5:2.15;
  sun.intensity=theme==="night"?.8:theme==="sunset"?1.5:2.55;
  sun.color.set(theme==="sunset"?0xffba78:0xffffff);
 }
 function generate(){
  const plan=parseWorldPrompt(input.value);
  if(plan.error)return notify(plan.error);
  const rng=seededRandom(plan.seed);
  const existing=root.children.some(o=>o.userData?.duoforgeGenerated);
  if(existing&&!window.confirm("Det finns redan en genererad värld. Lägg till ytterligare en värld?"))return;
  pushHistory();
  const created=[];
  const insert=(obj,position)=>{
   if(position)obj.position.set(...position);
   obj.userData.duoforgeGenerated=true;
   root.add(obj);created.push(obj);return obj;
  };
  if(plan.road&&!root.children.some(o=>o.userData?.duoforgeRoad||o.userData?.duoforgeTrack)){
   insert(createRoad(),[0,0,0]);
  }
  let chosenVehicle=root.children.find(o=>o.userData?.duoforgeLiving?.type==="vehicle");
  for(let i=0;i<plan.counts.cars;i++){
   if(i===0&&chosenVehicle)continue;
   const kart=insert(createKart(),[i*2.8,0,-3-i*5]);
   if(!chosenVehicle)chosenVehicle=kart;
  }
  for(let i=0;i<plan.counts.houses;i++){
   const side=i%2===0?-1:1;
   const x=side*(8+rng()*3),z=-22+Math.floor(i/2)*7.8+rng()*2;
   const house=createHouse(i+1,rng,plan.theme);
   house.rotation.y=(rng()-.5)*.22;
   insert(house,[x,0,z]);
  }
  for(let i=0;i<plan.counts.trees;i++){
   const side=i%2===0?-1:1;
   const x=side*(14+rng()*14),z=-25+rng()*113;
   insert(createTree(i+1,rng,plan.theme),[x,0,z]);
  }
  for(let i=0;i<plan.counts.crates;i++){
   const x=(rng()-.5)*6.5,z=13+i*7+rng()*2.5;
   const obstacle=createObstacle(i+1);
   obstacle.position.set(x,0,z);
   insert(obstacle);
  }
  for(let i=0;i<plan.counts.doors;i++){
   const x=(i%2?1:-1)*5.7,z=9+i*9;
   insert(createDoor(i+1),[x,0,z]);
  }
  lighting(plan.theme);
  if(chosenVehicle)select(chosenVehicle);
  else if(created.length)select(created[0]);
  if(chosenVehicle)fitScene(chosenVehicle);
  else if(created.length)fitScene(created[0]);
  refreshTree();updateStats();dirty();
  preview.textContent="Klart: "+created.length+" nya objekt från lokala byggmallar. Inga AI-anrop.";
  notify("3D-världen skapad helt lokalt! Testa, redigera eller exportera GLB.",5500);
 }
 $("buildWorld").onclick=generate;
 $("clearWorld").onclick=()=>{
  const generated=root.children.filter(o=>o.userData?.duoforgeGenerated);
  if(!generated.length)return notify("Inga genererade objekt att ta bort.");
  if(!confirm("Ta bort alla objekt från textgeneratorn? Dina manuellt skapade modeller finns kvar."))return;
  pushHistory();
  select(null);
  for(const obj of generated)root.remove(obj);
  lighting("day");
  refreshTree();updateStats();dirty();
  notify("Genererade objekt borttagna; egna objekt finns kvar.");
 };
 showPlan();
}
