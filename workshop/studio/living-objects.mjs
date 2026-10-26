import * as THREE from "three";
import {vehicleConfig,driveStep,clamp} from "./living-physics.mjs";

const $=id=>document.getElementById(id);
const LIVING_KEY="duoforgeLiving";
const wheelName=/wheel|tire|tyre|hjul|dack|däck/i;
export function initLivingObjects(ctx){
 const {scene,root,camera,orbit,transform,canvas,getSelected,select,notify,pushHistory,dirty,refreshTree,updateInspector,updateStats,fitScene}=ctx;
 const input={left:false,right:false,gas:false,brake:false,handbrake:false,interact:false};
 const runtime={active:false,paused:false,vehicle:null,state:null,snapshot:null,prevTime:null,doorSnapshots:[],lastCamera:null,elapsed:0,collisions:0,wheels:[]};
 let lastInteract=false,frameCount=0;
 function topLevel(node){
  let current=node;
  while(current&&current.parent&&current.parent!==root)current=current.parent;
  return current?.parent===root?current:null;
 }
 function living(node){return node?.userData?.[LIVING_KEY]||null}
 function pick(){
  return topLevel(getSelected());
 }
 function currentVehicle(){
  const selected=pick();
  if(living(selected)?.type==="vehicle")return selected;
  return root.children.find(o=>living(o)?.type==="vehicle")||null;
 }
 function assign(type){
  if(runtime.active)return;
  const target=pick();
  if(!target)return notify("Välj först ett objekt eller en modell i objektträdet.");
  pushHistory();
  if(type==="vehicle"){
   target.userData[LIVING_KEY]={type:"vehicle",...vehicleConfig(target.userData[LIVING_KEY]||{})};
   const wheels=[];
   target.traverse(node=>{if(node.isMesh&&wheelName.test(node.name))wheels.push(node.name)});
   notify("Körbart fordon skapat. "+wheels.length+" namngivna hjul hittade.");
  }else if(type==="door"){
   target.userData[LIVING_KEY]={type:"door",version:1,openAngle:90,interactionDistance:3};
   notify("Interaktiv dörr skapad. Kör nära och tryck E för att öppna/stänga.");
  }else{
   delete target.userData[LIVING_KEY];notify("Objektbeteende borttaget.");
  }
  refreshTree();syncInspector();dirty();
 }
 $("makeVehicle").onclick=()=>assign("vehicle");
 $("makeDoor").onclick=()=>assign("door");
 $("removeBehavior").onclick=()=>assign(null);
 function syncInspector(){
  const selected=pick();
  const meta=living(selected);
  const type=meta?.type||"none";
  $("behaviorType").textContent=type==="vehicle"?"Körbart fordon":type==="door"?"Interaktiv dörr":"Inget beteende";
  $("vehicleSettings").hidden=type!=="vehicle";
  $("doorSettings").hidden=type!=="door";
  $("removeBehavior").disabled=type==="none";
  if(type==="vehicle"){
   const config=vehicleConfig(meta);
   for(const key of ["maxSpeed","acceleration","braking","steeringDegrees","wheelBase","wheelRadius"])
    $("vehicle"+key).value=config[key];
   let wheels=0;
   selected.traverse(obj=>{if(obj.isMesh&&wheelName.test(obj.name))wheels++});
   $("wheelDetection").textContent=wheels+" namngivna hjul hittade. Saknas namn kan fordonet ändå köras, men hjulen animeras inte.";
  }
 }
 let editingMeta=false;
 const metaInputs=["maxSpeed","acceleration","braking","steeringDegrees","wheelBase","wheelRadius"];
 for(const key of metaInputs){
  const inputEl=$("vehicle"+key);
  inputEl.addEventListener("focus",()=>{editingMeta=true;pushHistory()});
  inputEl.addEventListener("change",()=>{editingMeta=false});
  inputEl.addEventListener("input",()=>{
   const target=pick(),meta=living(target);
   if(!meta||meta.type!=="vehicle")return;
   if(!editingMeta){pushHistory();editingMeta=true}
   Object.assign(meta,vehicleConfig({...meta,[key]:Number(inputEl.value)}));
   dirty();
  });
  inputEl.addEventListener("blur",()=>{editingMeta=false;syncInspector()});
 }
 function addRoad(){
  if(runtime.active)return;
  if(root.children.some(obj=>obj.userData?.duoforgeTrack))return notify("Det finns redan en testbana i scenen.");
  pushHistory();
  const track=new THREE.Group();track.name="Testbana – asfalt och vägmarkeringar";
  track.userData.duoforgeTrack=true;track.userData.livingCollider=false;
  const roadMaterial=new THREE.MeshStandardMaterial({color:0x28333f,roughness:.96});
  const road=new THREE.Mesh(new THREE.PlaneGeometry(11,100),roadMaterial);
  road.rotation.x=-Math.PI/2;road.position.set(0,.025,25);road.receiveShadow=true;track.add(road);
  for(const x of [-5.25,5.25]){
   const stripe=new THREE.Mesh(new THREE.BoxGeometry(.12,.012,100),new THREE.MeshStandardMaterial({color:0xe6ede1,roughness:.8}));
   stripe.position.set(x,.045,25);track.add(stripe);
  }
  const yellow=new THREE.MeshStandardMaterial({color:0xfac65b,roughness:.8});
  for(let z=-22;z<74;z+=7){
   const stripe=new THREE.Mesh(new THREE.BoxGeometry(.16,.016,3.5),yellow);
   stripe.position.set(0,.051,z);track.add(stripe);
  }
  for(const z of [9,33,56]){
   for(const x of [-8,8]){
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.13,.17,2.5,10),new THREE.MeshStandardMaterial({color:0x805637}));
    trunk.position.set(x,1.25,z);track.add(trunk);
    const crown=new THREE.Mesh(new THREE.ConeGeometry(1.2,3,10),new THREE.MeshStandardMaterial({color:0x2f8d64}));
    crown.position.set(x,3.4,z);track.add(crown);
   }
  }
  root.add(track);
  for(const [i,x,z] of [[1,2.6,17],[2,-2.5,36],[3,2.8,53]]){
   const crate=new THREE.Mesh(new THREE.BoxGeometry(1.3,1.5,1.3),new THREE.MeshStandardMaterial({color:0xe7a44f,roughness:.7}));
   crate.name="Hinder "+i;crate.position.set(x,.75,z);crate.castShadow=true;crate.receiveShadow=true;
   crate.userData.livingCollider=true;root.add(crate);
  }
  refreshTree();updateStats();dirty();notify("Testbana tillagd. Välj fordon och tryck Spela.");
 }
 $("addTestTrack").onclick=addRoad;

 function clearInput(){for(const key of Object.keys(input))input[key]=false}
 const keyBinding={KeyW:"gas",ArrowUp:"gas",KeyS:"brake",ArrowDown:"brake",KeyA:"left",ArrowLeft:"left",KeyD:"right",ArrowRight:"right",Space:"handbrake",KeyE:"interact"};
 function onKey(event,pressed){
  if(!runtime.active)return;
  const action=keyBinding[event.code];
  if(action){
   event.preventDefault();input[action]=pressed;
  }
  if(pressed&&event.code==="Escape"){event.preventDefault();stop();}
  if(pressed&&event.code==="KeyP"){event.preventDefault();pause();}
 }
 window.addEventListener("keydown",event=>onKey(event,true),{capture:true});
 window.addEventListener("keyup",event=>onKey(event,false),{capture:true});
 window.addEventListener("blur",clearInput);
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&runtime.active){clearInput();runtime.paused=true;syncPlayUI()}});
 for(const button of document.querySelectorAll("[data-drive]")){
  const action=button.dataset.drive;
  button.addEventListener("pointerdown",event=>{
   if(!runtime.active)return;event.preventDefault();
   button.setPointerCapture(event.pointerId);input[action]=true;button.classList.add("held");
  });
  for(const name of ["pointerup","pointercancel","lostpointercapture"]){
   button.addEventListener(name,()=>{input[action]=false;button.classList.remove("held")});
  }
 }
 function gamepadControl(){
  const pads=navigator.getGamepads?.()||[];
  const pad=Array.from(pads).find(p=>p&&p.connected);
  if(!pad)return null;
  const axis=Number(pad.axes?.[0])||0,forward=Number(pad.axes?.[1])||0;
  const trigger=idx=>Number(pad.buttons?.[idx]?.value)||0;
  const pressed=idx=>Boolean(pad.buttons?.[idx]?.pressed);
  return {
   connected:true,
   steer:Math.abs(axis)>.13?axis:0,
   throttle:Math.max(trigger(7),forward<-.2?-forward:0,pressed(0)?1:0),
   brake:Math.max(trigger(6),forward>.2?forward:0,pressed(1)?1:0),
   handbrake:pressed(2),
   interact:pressed(3)
  };
 }
 function snapshotDoors(){
  runtime.doorSnapshots=[];
  root.traverse(obj=>{
   if(living(obj)?.type==="door"){
    runtime.doorSnapshots.push({obj,rotation:obj.rotation.clone(),open:false});
   }
  });
 }
 function nearestDoor(){
  if(!runtime.vehicle)return null;
  const pos=runtime.vehicle.getWorldPosition(new THREE.Vector3());
  let nearest=null,best=Infinity;
  for(const door of runtime.doorSnapshots){
   const other=door.obj.getWorldPosition(new THREE.Vector3());
   const dist=other.distanceTo(pos);
   if(dist<best&&dist<=Number(living(door.obj)?.interactionDistance||3)){nearest=door;best=dist}
  }
  return nearest;
 }
 function checkDoor(interact){
  const nearest=nearestDoor();
  $("nearbyDoor").textContent=nearest?"E / △ – "+(nearest.open?"Stäng":"Öppna")+" dörr":"";
  if(interact&&!lastInteract&&nearest){
   nearest.open=!nearest.open;
   nearest.obj.rotation.y=nearest.rotation.y+(nearest.open?THREE.MathUtils.degToRad(living(nearest.obj)?.openAngle||90):0);
   notify(nearest.open?"Dörr öppnad":"Dörr stängd",1300);
  }
  lastInteract=interact;
 }
 function collectColliders(){
  const colliders=[];
  for(const obj of root.children){
   if(obj===runtime.vehicle||obj.userData?.livingCollider===false||!obj.visible)continue;
   const b=new THREE.Box3().setFromObject(obj);
   if(b.isEmpty()||b.max.y-b.min.y<.38)continue;
   if(living(obj)?.type==="door"){
    const d=runtime.doorSnapshots.find(x=>x.obj===obj);
    if(d?.open)continue;
   }
   colliders.push(b);
  }
  return colliders;
 }
 function touchesBox(x,z,radius,box){
  const nearestX=clamp(x,box.min.x,box.max.x),nearestZ=clamp(z,box.min.z,box.max.z);
  return (x-nearestX)**2+(z-nearestZ)**2 < radius*radius;
 }
 function rememberWheels(vehicle){
  runtime.wheels=[];
  vehicle.traverse(obj=>{
   if(obj.isMesh&&wheelName.test(obj.name)){
    runtime.wheels.push({mesh:obj,rotation:obj.rotation.clone()});
   }
  });
 }
 function start(){
  if(runtime.active)return;
  const vehicle=currentVehicle();
  if(!vehicle)return notify("Välj en 3D-modell och tryck Gör körbar först.");
  const meta=living(vehicle);
  if(!meta||meta.type!=="vehicle")return notify("Fordonets inställningar saknas.");
  select(vehicle);
  const cameraState={position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:orbit.target.clone(),enabled:orbit.enabled};
  runtime.vehicle=vehicle;
  runtime.snapshot={position:vehicle.position.clone(),rotation:vehicle.rotation.clone(),camera:cameraState};
  runtime.state={x:vehicle.position.x,z:vehicle.position.z,yaw:vehicle.rotation.y,speed:0,distance:0};
  runtime.elapsed=0;runtime.collisions=0;runtime.paused=false;
  runtime.prevTime=null;runtime.active=true;lastInteract=false;clearInput();
  snapshotDoors();rememberWheels(vehicle);
  transform.detach();orbit.enabled=false;
  $("playMode").hidden=false;
  $("playToolbar").hidden=false;
  document.body.classList.add("living-play");
  syncPlayUI();
  notify("Spelläge! Kör med W/A/S/D, piltangenter, gamepad eller mobilknappar.",4200);
 }
 function stop(){
  if(!runtime.active)return;
  runtime.active=false;runtime.paused=false;clearInput();
  const vehicle=runtime.vehicle,saved=runtime.snapshot;
  if(vehicle&&saved){vehicle.position.copy(saved.position);vehicle.rotation.copy(saved.rotation);}
  for(const wheel of runtime.wheels)wheel.mesh.rotation.copy(wheel.rotation);
  for(const door of runtime.doorSnapshots)door.obj.rotation.copy(door.rotation);
  camera.position.copy(saved.camera.position);camera.quaternion.copy(saved.camera.quaternion);
  orbit.target.copy(saved.camera.target);orbit.enabled=saved.camera.enabled;orbit.update();
  transform.attach(vehicle);
  runtime.wheels=[];runtime.doorSnapshots=[];runtime.vehicle=null;runtime.snapshot=null;
  $("playMode").hidden=true;$("playToolbar").hidden=true;document.body.classList.remove("living-play");
  $("nearbyDoor").textContent="";
  syncPlayUI();refreshTree();updateInspector();
  notify("Tillbaka i 3D-verkstaden. Modellen har återställts till sitt ursprungliga läge.",4000);
 }
 function pause(){if(!runtime.active)return;runtime.paused=!runtime.paused;clearInput();syncPlayUI()}
 function syncPlayUI(){
  $("togglePlay").textContent=runtime.active?"Avsluta spel":"▶ Spela";
  $("togglePlay").classList.toggle("active",runtime.active);
  $("pausePlay").textContent=runtime.paused?"▶ Fortsätt":"Ⅱ Pausa";
  $("playStatus").textContent=runtime.paused?"Pausat":runtime.active?"Spelar":"Byggläge";
 }
 $("togglePlay").onclick=()=>runtime.active?stop():start();
 $("pausePlay").onclick=pause;
 $("exitPlay").onclick=stop;
 function update(dt){
  if(!runtime.active)return;
  const controls=gamepadControl();
  const connected=Boolean(controls?.connected);
  $("controllerStatus").textContent=connected?"🎮 Gamepad ansluten":"⌨️ Tangentbord / touch";
  if(runtime.paused)return;
  const control={
   throttle:Math.max(input.gas?1:0,controls?.throttle||0),
   brake:Math.max(input.brake?1:0,controls?.brake||0),
   steer:clamp((input.right?1:0)-(input.left?1:0)+(controls?.steer||0),-1,1),
   handbrake:input.handbrake||controls?.handbrake,
  };
  const vehicle=runtime.vehicle,config=vehicleConfig(living(vehicle));
  const prev=runtime.state,next=driveStep(prev,control,dt,config);
  const bounds=new THREE.Box3().setFromObject(vehicle),span=bounds.getSize(new THREE.Vector3());
  const radius=clamp(Math.min(span.x,span.z)*.27,.35,2.4);
  const collided=collectColliders().some(b=>touchesBox(next.x,next.z,radius,b));
  if(collided){
   runtime.state={...next,x:prev.x,z:prev.z,speed:0};
   runtime.collisions++;
  }else{
   runtime.state=next;vehicle.position.set(next.x,vehicle.position.y,next.z);
   vehicle.rotation.y=next.yaw;
   for(const wheel of runtime.wheels)wheel.mesh.rotation.y+=next.speed*dt/config.wheelRadius;
  }
  const heading=new THREE.Vector3(Math.sin(runtime.state.yaw),0,Math.cos(runtime.state.yaw));
  const target=vehicle.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,1.2,0));
  const desired=target.clone().addScaledVector(heading,-7).add(new THREE.Vector3(0,3.7,0));
  const smoothing=1-Math.exp(-dt*6);
  camera.position.lerp(desired,smoothing);
  orbit.target.lerp(target,smoothing);
  camera.lookAt(orbit.target);
  checkDoor(input.interact||controls?.interact);
  runtime.elapsed+=dt;
  if(++frameCount%7===0){
   $("speedKmh").textContent=Math.round(Math.abs(runtime.state.speed)*3.6);
   $("distanceM").textContent=Math.round(runtime.state.distance);
   $("elapsedTime").textContent=runtime.elapsed.toFixed(1);
   $("collisionCount").textContent=runtime.collisions;
  }
 }
 function onSelectionChanged(){if(!runtime.active)syncInspector()}
 function isPlaying(){return runtime.active}
 // Kick off default kart binding only for a model with the exact starter name.
 function enableStarter(){
  const starter=root.children.find(obj=>obj.name==="DuoForge Kart – startmodell");
  if(starter&&!living(starter)){
   starter.userData[LIVING_KEY]={type:"vehicle",...vehicleConfig()};
   starter.traverse(node=>{
    if(node.isMesh&&node.geometry?.type==="CylinderGeometry"&&node.material?.color?.getHex()===0x151d27){
     // Procedural kart tyres are cylinders aligned to the X axis; name only tyres.
     node.name="wheel_"+runtime.wheels.length+"_"+node.id;
    }
   });
  }
  syncInspector();
 }
 enableStarter();
 return {update,onSelectionChanged,isPlaying,enableStarter,stop};
}
