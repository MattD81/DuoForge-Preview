// DuoForge Render World — free, non-destructive, browser-based scene preview.
// Three stages: playable 3D environments, quality/post FX, checkpoint demo.
// All environments and assets are procedural. No backend, API keys, or AI calls.
import * as THREE from "three";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {driveStep,vehicleConfig} from "./living-physics.mjs";
import {createWheelRig} from "./wheel-rig.mjs";
import {createEnvironment,worldNames} from "./render-environments.mjs";

const $=id=>document.getElementById(id);
const KEY_ACTIONS={KeyW:"gas",ArrowUp:"gas",KeyS:"brake",ArrowDown:"brake",KeyA:"left",ArrowLeft:"left",KeyD:"right",ArrowRight:"right",Space:"handbrake",KeyE:"interact"};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const tempV=()=>new THREE.Vector3();
function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),6000);
}
export function initRenderWorld(ctx){
 const {scene,renderer,camera,orbit,transform,root,grid,axes,ground,skyLight,sun,
  canvas,getSelected,notify,select,filename,boundsHelper}=ctx;
 const group=new THREE.Group();group.name="TEMP Render World, never included in exported GLB";
 group.userData.previewOnly=true;scene.add(group);
 const controls={gas:false,brake:false,left:false,right:false,handbrake:false,interact:false};
 let active=false,model=null,anchor=null,wheelRig=null,simulation=null;
 let saved=null,environment=null,quality="medium",world="showroom",mode="orbit";
 let composer=null,envTexture=null,pmrem=null,sessionTime=0,gameTime=0,mission=[],nextGate=0,completed=false;
 let frame=0,cinematicAngle=0,interactionHeld=false,doorOpen=false;
 let recording=null,recordTimer=null;
 let freeMoving={forward:false,backward:false,left:false,right:false,up:false,down:false};
 const previewPane=$("renderWorldOverlay"),controlsPanel=$("renderWorldControls");
 const viewOptions=[{value:"orbit",label:"Orbit"},{value:"follow",label:"Följkamera"},{value:"free",label:"Fri kamera"},{value:"cinematic",label:"Film-kamera"}];
 function clearKeys(){Object.keys(controls).forEach(k=>controls[k]=false);Object.keys(freeMoving).forEach(k=>freeMoving[k]=false);}
 function objectToPreview(){
  let obj=getSelected();while(obj&&obj.parent&&obj.parent!==root)obj=obj.parent;
  if(obj?.parent===root)return obj;
  return root.children.find(x=>x.visible&&!x.userData?.duoforgeTrack&&!x.userData?.duoforgeRoad&&!x.userData?.duoforgeGenerated)||root.children.find(x=>x.visible)||null;
 }
 function makePMREM(){
  if(envTexture)return envTexture;
  try{
   pmrem=new THREE.PMREMGenerator(renderer);
   envTexture=pmrem.fromScene(new RoomEnvironment(),.04).texture;
   return envTexture;
  }catch(err){console.warn("PMREM unavailable; using scene lights",err);return null;}
 }
 function capture(){
  return {
   background:scene.background,fog:scene.fog,environment:scene.environment,
   exposure:renderer.toneMappingExposure,toneMapping:renderer.toneMapping,
   shadow:renderer.shadowMap.enabled,shadowMapSize:sun.shadow.mapSize.clone(),
   sunIntensity:sun.intensity,sunColor:sun.color.clone(),sunPos:sun.position.clone(),
   hemiIntensity:skyLight.intensity,hemiColor:skyLight.color.clone(),
   cameraPosition:camera.position.clone(),cameraQuat:camera.quaternion.clone(),
   orbitTarget:orbit.target.clone(),orbitEnabled:orbit.enabled,
   rootVisible:root.visible,gridVisible:grid.visible,axesVisible:axes.visible,
   groundVisible:ground.visible,helperVisible:transform.getHelper().visible,
   selection:getSelected()
  };
 }
 function restore(){
  if(!saved)return;
  scene.background=saved.background;scene.fog=saved.fog;scene.environment=saved.environment;
  renderer.toneMappingExposure=saved.exposure;renderer.toneMapping=saved.toneMapping;
  renderer.shadowMap.enabled=saved.shadow;sun.shadow.mapSize.copy(saved.shadowMapSize);
  sun.intensity=saved.sunIntensity;sun.color.copy(saved.sunColor);sun.position.copy(saved.sunPos);
  skyLight.intensity=saved.hemiIntensity;skyLight.color.copy(saved.hemiColor);
  camera.position.copy(saved.cameraPosition);camera.quaternion.copy(saved.cameraQuat);
  orbit.target.copy(saved.orbitTarget);orbit.enabled=saved.orbitEnabled;orbit.update();
  root.visible=saved.rootVisible;grid.visible=saved.gridVisible;axes.visible=saved.axesVisible;
  ground.visible=saved.groundVisible;
  transform.getHelper().visible=saved.helperVisible;
  if(saved.selection)transform.attach(saved.selection);
  saved=null;
 }
 function syncChoices(){
  $("renderWorldSelect").value=world;$("renderQualitySelect").value=quality;
  $("renderCameraSelect").value=mode;
  $("renderWorld").value=world;$("renderQuality").value=quality;$("renderCamera").value=mode;
  $("renderCameraTip").textContent=mode==="free"?"WASD flyttar kameran • dra för att rotera":mode==="follow"?"Följer objektet under test":mode==="cinematic"?"Automatisk filmkamera":"Dra eller zooma för att utforska";
 }
 async function applyQuality(value){
  quality=["low","medium","high"].includes(value)?value:"medium";
  const isPhone=window.matchMedia("(max-width: 600px)").matches;
  if(quality==="high"&&isPhone)notify("Hög kvalitet kan vara tung på mobilen. Välj Medium om bilden hackar.",4000);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==="low"?1:quality==="high"?1.6:1.35));
  renderer.shadowMap.enabled=quality!=="low";
  sun.shadow.mapSize.set(quality==="high"?2048:quality==="medium"?1024:512,quality==="high"?2048:quality==="medium"?1024:512);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=quality==="high"?1.25:quality==="low"?1.06:1.16;
  renderer.shadowMap.needsUpdate=true;
  composer?.dispose?.();composer=null;
  if(quality==="high"){
   try{
    // High-only deferred post processing: avoids download/GPU overhead by default.
    const [{EffectComposer},{RenderPass},{UnrealBloomPass},{OutputPass},{SSAOPass}]=await Promise.all([
     import("three/addons/postprocessing/EffectComposer.js"),
     import("three/addons/postprocessing/RenderPass.js"),
     import("three/addons/postprocessing/UnrealBloomPass.js"),
     import("three/addons/postprocessing/OutputPass.js"),
     import("three/addons/postprocessing/SSAOPass.js")
    ]);
    if(!active||quality!=="high")return;
    const w=Math.max(canvas.clientWidth,1),h=Math.max(canvas.clientHeight,1);
    composer=new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene,camera));
    const ao=new SSAOPass(scene,camera,w,h);
    ao.kernelRadius=8;ao.minDistance=.001;ao.maxDistance=.22;
    composer.addPass(ao);
    const bloom=new UnrealBloomPass(new THREE.Vector2(w,h),.23,.35,.86);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setSize(w,h);
   }catch(err){console.warn("Postprocessing unavailable",err);
    notify("Bloom/AO stöds inte på denna enhet – använder vanlig rendergrafik.",3900);}
  }
  syncChoices();
 }
 function chooseCamera(value){
  mode=viewOptions.some(x=>x.value===value)?value:"orbit";
  orbit.enabled=mode==="orbit"||mode==="free";
  if(mode==="orbit"||mode==="free"){const center=anchor?.position||tempV();
   orbit.target.copy(center).add(new THREE.Vector3(0,1.3,0));orbit.update();}
  syncChoices();
 }
 function modelSize(){
  const bounds=new THREE.Box3().setFromObject(anchor);
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  return {size,center,bounds};
 }
 function placeModel(){
  const obj=objectToPreview();
  if(!obj)throw Error("Skapa eller importera först ett 3D-objekt.");
  model=obj.clone(true);
  model.name=obj.name+" (testkopia)";
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  anchor=new THREE.Group();anchor.name="Render World preview character/vehicle";
  anchor.add(model);group.add(anchor);
  // Remove original scene placement from the preview clone only.
  anchor.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(anchor);
  if(box.isEmpty())throw Error("Det valda objektet har ingen synlig geometri.");
  let dim=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const maxSize=Math.max(dim.x,dim.y,dim.z);
  // Preserve real size for cars; scale down only huge scenery for showroom inspection.
  if(world==="showroom"&&maxSize>9){anchor.scale.setScalar(9/maxSize);}
  anchor.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(anchor);
  center=box.getCenter(new THREE.Vector3());
  anchor.position.x-=center.x;anchor.position.z-=center.z;
  const lift=world==="showroom"?.3:.018;
  anchor.position.y+=lift-box.min.y;
  anchor.updateMatrixWorld(true);
  const meta=obj.userData?.duoforgeLiving;
  const vehicle=meta?.type==="vehicle";
  if(vehicle){
   try{wheelRig=createWheelRig(model,{forwardSign:meta.forwardSign})}
   catch(err){console.warn("Wheel setup unavailable",err);wheelRig=null;}
  }
  const forward=wheelRig?.forwardSign===-1?Math.PI:0;
  simulation={kind:vehicle?"vehicle":"prop",state:{x:anchor.position.x,z:anchor.position.z,yaw:forward,speed:0,distance:0,steering:0,steerAngleDegrees:0},
   forward,vehicleConfig:vehicleConfig(meta||{}),speed:0};
  // Look down the playable road (±Z), not into a random part of the asset.
  orbit.target.set(0,Math.max(1.1,dim.y*.42),0);
  const radius=Math.max(5,Math.min(20,Math.max(dim.length(),5)*1.6));
  camera.position.set(radius*.66,radius*.46,radius*.95);
  camera.near=.015;camera.far=1300;camera.updateProjectionMatrix();
  orbit.update();
  $("previewAssetName").textContent=obj.name;
  $("renderDrivingControls").hidden=!vehicle;
  $("renderMissionKind").textContent=vehicle?"Fordonstest":"Objektvisning";
  return {vehicle,object:obj};
 }
 function makeEnvironment(){
  if(environment){group.remove(environment.group);environment.dispose();environment=null;}
  environment=createEnvironment({world,quality});
  group.add(environment.group);
  scene.background=environment.background;
  scene.fog=environment.fog;
  scene.environment=makePMREM()||null;
  skyLight.intensity=environment.hemisphere;
  sun.intensity=environment.sun;
  sun.color.set(environment.sunColor);
  sun.position.fromArray(environment.sunPosition);
  const night=world==="night";
  renderer.toneMappingExposure=night?.9:quality==="high"?1.23:1.13;
  createMission();
  $("renderMissionDescription").textContent=world==="showroom"?
   "Inspektera material, ljus och detaljer. Byt kameravinkel eller spara en bild.":
   "Kör eller utforska, ta dig genom ringarna och testa interaktiva föremål.";
 }
 function createMission(){
  for(const object of mission)group.remove(object);
  mission=[];
  nextGate=0;completed=false;sessionTime=0;gameTime=0;
  const sign=wheelRig?.forwardSign||1;
  if(world!=="showroom"){
   const positions=[12,25,40,55];
   const gold=new THREE.MeshStandardMaterial({color:0x49f3c4,emissive:0x30ad8c,emissiveIntensity:1.5,metalness:.28,roughness:.26,side:THREE.DoubleSide});
   for(const [i,z]of positions.entries()){
    const gate=new THREE.Group();gate.name="Målring "+(i+1);
    gate.userData.checkpoint=true;
    const arch=new THREE.Mesh(new THREE.TorusGeometry(2.5,.13,12,42),gold);
    arch.position.y=2.7;arch.castShadow=false;gate.add(arch);
    const marker=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.8,8),gold);
    marker.position.y=.4;gate.add(marker);
    gate.position.set((i%2?1:-1)*1.15,0,z*sign);
    gate.visible=i===0;
    group.add(gate);mission.push(gate);
   }
  }
  updateHUD();
 }
 function updateHUD(){
  $("renderCheckpointCount").textContent=nextGate+"/"+mission.length;
  $("renderSpeed").textContent=Math.round(Math.abs(simulation?.state?.speed||0)*3.6)+" km/h";
  $("renderTime").textContent=gameTime.toFixed(1)+" s";
  $("renderMissionStatus").textContent=completed?"Uppdrag slutfört!":mission.length?"Kör igenom de lysande ringarna":"Visa och granska modellen";
 }
 function checkpointUpdate(){
  if(!mission.length||completed||!anchor)return;
  const gate=mission[nextGate];
  if(!gate)return;
  const d=gate.position.distanceTo(new THREE.Vector3(anchor.position.x,0,anchor.position.z));
  if(d>3.4)return;
  gate.visible=false;nextGate++;
  if(nextGate===mission.length){completed=true;notify("Alla checkpoints klara! Bra kört.",4100);}
  else{mission[nextGate].visible=true;notify("Checkpoint "+nextGate+" av "+mission.length,1500);}
  updateHUD();
 }
 function checkInteract(input){
  const door=environment?.door;
  if(!door)return;
  const distance=anchor.position.distanceTo(door.position);
  const near=distance<5.5;
  $("renderInteractHint").textContent=near?(doorOpen?"E – stäng dörr":"E – öppna dörr"):"";
  if(input&&!interactionHeld&&near){doorOpen=!doorOpen;notify(doorOpen?"Dörr öppnad":"Dörr stängd",1400);}
  interactionHeld=input;
  if(door){const target=doorOpen?Math.PI*.48:0;door.rotation.y+=(target-door.rotation.y)*.14;}
 }
 function applyWorld(value){
  if(!worldNames.includes(value))return;
  world=value;
  if(active){
   // Replace only temporary preview environment, never the edited original.
   makeEnvironment();
  }
  syncChoices();
 }
 function readPad(){
  const gp=Array.from(navigator.getGamepads?.()||[]).find(x=>x&&x.connected);
  if(!gp)return null;
  const trigger=i=>gp.buttons?.[i]?.value||0;
  const pushed=i=>Boolean(gp.buttons?.[i]?.pressed);
  const x=gp.axes?.[0]||0,forward=gp.axes?.[1]||0;
  return {gas:Math.max(trigger(7),forward<-.2?-forward:0,pushed(0)?1:0),
   brake:Math.max(trigger(6),forward>.2?forward:0,pushed(1)?1:0),
   steer:Math.abs(x)>.13?x:0,handbrake:pushed(2),interact:pushed(3),connected:true};
 }
 function start(){
  if(active)return;
  if(!objectToPreview()){notify("Importera eller skapa ett objekt innan du öppnar Render World.",3700);return;}
  saved=capture();active=true;clearKeys();
  root.visible=false;grid.visible=false;axes.visible=false;ground.visible=false;
  transform.detach();transform.getHelper().visible=false;
  group.clear();doorOpen=false;interactionHeld=false;
  try{
   const {vehicle}=placeModel();
   makeEnvironment();applyQuality(quality);
   chooseCamera(mode==="follow"&&!vehicle?"orbit":mode);
   document.body.classList.add("render-world-active");
   previewPane.hidden=false;syncChoices();
   notify("Renderad värld redo. Objektet är en testkopia – dina originaländringar bevaras.",4400);
  }catch(err){console.error(err);stop();notify("Kan inte öppna Render World: "+err.message,5000);}
 }
 function stop(){
  if(!active)return;
  finishRecording();
  active=false;clearKeys();wheelRig?.dispose();wheelRig=null;
  composer?.dispose?.();composer=null;
  if(environment){environment.dispose();environment=null;}
  group.clear();model=null;anchor=null;simulation=null;mission=[];doorOpen=false;
  document.body.classList.remove("render-world-active");
  previewPane.hidden=true;
  restore();syncChoices();
  notify("Tillbaka i 3D-verkstaden. Originalobjektet är oförändrat.");
 }
 function resize(){
  if(composer)composer.setSize(Math.max(canvas.clientWidth,1),Math.max(canvas.clientHeight,1));
 }
 function render(){
  if(!active||!composer)return false;
  composer.render();return true;
 }
 function isActive(){return active;}
 function moveFreeCamera(dt){
  if(mode!=="free")return;
  const f=(freeMoving.forward?1:0)-(freeMoving.backward?1:0);
  const s=(freeMoving.right?1:0)-(freeMoving.left?1:0);
  const u=(freeMoving.up?1:0)-(freeMoving.down?1:0);
  if(!f&&!s&&!u)return;
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  dir.y=0;dir.normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize();
  const delta=dir.multiplyScalar(f).addScaledVector(right,s).add(new THREE.Vector3(0,u,0)).multiplyScalar(10*dt);
  camera.position.add(delta);orbit.target.add(delta);
 }
 function update(dt){
  if(!active||!anchor||!simulation)return;
  const step=Math.min(dt,.06);
  sessionTime+=step;gameTime+=step;
  const pad=readPad();
  $("renderInputType").textContent=pad?"🎮 Gamepad":"⌨️ Tangentbord · touch";
  const car=simulation.kind==="vehicle";
  const frozen=mode==="cinematic";
  if(car&&!frozen){
   const steer=clamp((controls.right?1:0)-(controls.left?1:0)+(pad?.steer||0),-1,1);
   const command={steer,throttle:Math.max(controls.gas?1:0,pad?.gas||0),
    brake:Math.max(controls.brake?1:0,pad?.brake||0),handbrake:controls.handbrake||pad?.handbrake};
   const next=driveStep(simulation.state,command,step,simulation.vehicleConfig);
   simulation.state=next;
   anchor.position.x=next.x;anchor.position.z=next.z;
   anchor.rotation.y=next.yaw-simulation.forward;
   wheelRig?.step({distance:next.speed*step,steerAngleDegrees:next.steerAngleDegrees,wheelRadius:simulation.vehicleConfig.wheelRadius});
  }else if(!car&&!frozen&&mode!=="free"){
   // Generic objects remain stationary. A proper character controller requires
   // rigging and collisions; the preview does NOT pretend otherwise.
  }
  if(mode==="follow"&&car){
   const yaw=simulation.state.yaw,dir=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
   const target=anchor.position.clone().add(new THREE.Vector3(0,1.25,0));
   const desired=target.clone().addScaledVector(dir,-8).add(new THREE.Vector3(0,4.1,0));
   const weight=1-Math.exp(-5*step);
   camera.position.lerp(desired,weight);
   orbit.target.lerp(target,weight);camera.lookAt(orbit.target);
  }else if(mode==="cinematic"){
   cinematicAngle+=step*.28;
   const center=anchor.position.clone().add(new THREE.Vector3(0,1.1,0));
   camera.position.set(center.x+Math.cos(cinematicAngle)*8,center.y+2.8,center.z+Math.sin(cinematicAngle)*8);
   camera.lookAt(center);
  }else{
   if(mode==="free")moveFreeCamera(step);
   orbit.update();
  }
  checkInteract(controls.interact||pad?.interact);
  if(car)checkpointUpdate();
  if(++frame%9===0)updateHUD();
  environment?.update?.(sessionTime,step);
 }
 function onKey(event,pressed){
  if(!active)return;
  if(event.target instanceof HTMLElement&&event.target.closest("input,textarea,select"))return;
  if(pressed&&event.code==="Escape"){event.preventDefault();stop();return;}
  if(pressed&&event.code==="KeyC"){chooseCamera(mode==="cinematic"?"orbit":"cinematic");return;}
  if(mode==="free"){
   const mapping={KeyW:"forward",ArrowUp:"forward",KeyS:"backward",ArrowDown:"backward",
    KeyA:"left",ArrowLeft:"left",KeyD:"right",ArrowRight:"right",KeyQ:"down",KeyE:"up"};
   const action=mapping[event.code];
   if(action){event.preventDefault();freeMoving[action]=pressed;}
   return;
  }
  const action=KEY_ACTIONS[event.code];
  if(action){event.preventDefault();controls[action]=pressed;}
 }
 window.addEventListener("keydown",e=>onKey(e,true),{capture:true});
 window.addEventListener("keyup",e=>onKey(e,false),{capture:true});
 window.addEventListener("blur",clearKeys);
 document.addEventListener("visibilitychange",()=>{if(document.hidden)clearKeys()});
 for(const button of document.querySelectorAll("[data-preview-drive]")){
  const key=button.dataset.previewDrive;
  button.addEventListener("pointerdown",event=>{
   if(!active)return;event.preventDefault();
   try{button.setPointerCapture(event.pointerId)}catch{}
   controls[key]=true;button.classList.add("held");
  });
  for(const e of ["pointerup","pointercancel","lostpointercapture"])
   button.addEventListener(e,()=>{controls[key]=false;button.classList.remove("held")});
 }
 function finishRecording(){
  if(!recording)return;
  clearTimeout(recordTimer);
  const recorder=recording;recording=null;
  $("renderRecord").textContent="🎥 Spela in";
  if(recorder.state!=="inactive")recorder.stop();
 }
 function recordClip(){
  if(recording){finishRecording();return;}
  if(!active)return notify("Öppna Render World innan du spelar in.");
  if(typeof MediaRecorder==="undefined"||!canvas.captureStream)
   return notify("Videoinspelning stöds inte i den här webbläsaren. Använd Bild i stället.",5000);
  try{
   const supported=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"].find(type=>MediaRecorder.isTypeSupported(type));
   const stream=canvas.captureStream(24),chunks=[];
   const recorder=new MediaRecorder(stream,supported?{mimeType:supported,videoBitsPerSecond:3200000}:undefined);
   recording=recorder;
   recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
   recorder.onerror=event=>notify("Videoinspelning avbröts. Testa PNG-bild i stället.",4500);
   recorder.onstop=()=>{
    for(const track of stream.getTracks())track.stop();
    if(!chunks.length)return notify("Ingen video kunde spelas in på enheten.");
    const extension=recorder.mimeType.includes("mp4")?"mp4":"webm";
    downloadBlob(new Blob(chunks,{type:recorder.mimeType}),filename()+"-"+world+"-renderworld."+extension);
    notify("Videoklippet har sparats på enheten.");
   };
   recorder.start(500);
   $("renderRecord").textContent="■ Stoppa";
   notify("Spelar in Render World lokalt. Tryck Stoppa för att ladda ner.",3700);
   recordTimer=setTimeout(finishRecording,12000);
  }catch(err){recording=null;console.warn("Recorder unsupported",err);
   notify("Den här webbläsaren tillåter inte inspelning. Prova PNG-bild.",4500);}
 }
 function exportScreenshot(){
  if(!active)return notify("Öppna Render World för att ta en bild.");
  if(composer)composer.render();else renderer.render(scene,camera);
  canvas.toBlob(blob=>{
   if(blob){downloadBlob(blob,filename()+"-"+world+".png");notify("Renderad bild sparad.");}
   else notify("Kunde inte skapa bilden på enheten.");
  },"image/png");
 }
 $("openRenderWorld").onclick=start;
 $("renderExit").onclick=stop;
 $("renderScreenshot").onclick=exportScreenshot;
 $("renderRecord").onclick=recordClip;
 $("renderScreenshotPanel").onclick=()=>active?exportScreenshot():start();
 $("renderCinematic").onclick=()=>chooseCamera(mode==="cinematic"?"orbit":"cinematic");
 $("renderResetMission").onclick=()=>{
  if(!active)return;
  if(simulation){
   simulation.state={...simulation.state,x:0,z:0,speed:0,distance:0,steering:0,steerAngleDegrees:0,yaw:simulation.forward};
   anchor.position.x=0;anchor.position.z=0;anchor.rotation.y=0;
  }
  createMission();notify("Testuppdraget startade om.");
 };
 for(const [id,handler] of [
  ["renderWorld",value=>applyWorld(value)],
  ["renderWorldSelect",value=>applyWorld(value)],
  ["renderQuality",value=>{if(active)applyQuality(value);else{quality=value;syncChoices()}}],
  ["renderQualitySelect",value=>{if(active)applyQuality(value);else{quality=value;syncChoices()}}],
  ["renderCamera",chooseCamera],
  ["renderCameraSelect",chooseCamera]
 ])$(id).onchange=event=>{handler(event.target.value);event.target.blur();};
 syncChoices();
 return {start,stop,update,isActive,resize,render};
}
