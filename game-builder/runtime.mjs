/**
 * DuoForge Intelligent Game Builder – Play Runtime V1.
 * Real playable third-person WebGL 3D: enemies, collectibles, level progression.
 * Reuses the existing Studio Ocean V5 and GPU Deluxe, no paid AI/API calls.
 * Deliberately independent of ChatGPT Sites credentials or its database.
 */
import * as THREE from "three";
import {createOceanSurface} from "../workshop/studio/ocean-water.mjs";
import {createGPUDeluxe} from "../workshop/studio/gpu-deluxe.mjs";
import {createGpuTimer} from "../workshop/studio/gpu-deluxe-v2.mjs";
import {normalizeConfig,levelEnemyCount} from "./planner.mjs";

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const EPS=.00001;
function seeded(seed){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
function mesh(geometry,material){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;return m;}
const basic=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:.68,metalness:.12});
function disposeTree(obj){
 obj.traverse?.(node=>{
  node.geometry?.dispose?.();
  const mats=Array.isArray(node.material)?node.material:[node.material];
  for(const m of mats)if(m){m.map?.dispose?.();m.dispose?.();}
 });
}
function createActor(color,hero=false){
 const root=new THREE.Group();
 const armor=basic(color),skin=basic(0xc3987a),metal=basic(0xc4c7d0),boots=basic(0x172434);
 const body=mesh(new THREE.CapsuleGeometry(.36,.83,5,10),armor);body.position.y=1.05;root.add(body);
 const head=mesh(new THREE.SphereGeometry(.30,12,8),skin);head.position.y=1.96;root.add(head);
 const helmet=mesh(new THREE.CylinderGeometry(.19,.33,.24,9),metal);helmet.position.y=2.22;root.add(helmet);
 const joints=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.48,1.54,0);root.add(arm);
  const limb=mesh(new THREE.CapsuleGeometry(.12,.47,4,7),armor);limb.position.y=-.30;arm.add(limb);joints.push(arm);
  const leg=new THREE.Group();leg.position.set(side*.23,.72,0);root.add(leg);
  const boot=mesh(new THREE.CapsuleGeometry(.14,.54,4,7),boots);boot.position.y=-.32;leg.add(boot);joints.push(leg);
 }
 const weapon=mesh(hero?new THREE.BoxGeometry(.12,1,.12):new THREE.BoxGeometry(.06,.75,.16),metal);
 weapon.position.set(.66,.85,.12);root.add(weapon);
 return {root,joints,body,materials:[armor,skin,metal,boots]};
}
export function startBuilderGame({host,config,onState=()=>{},controls=document,env=globalThis}={}){
 if(!host?.appendChild)throw Error("Game Builder needs a DOM host");
 const project=normalizeConfig(config),rand=seeded(project.seed);
 let renderer,scene,camera,gpu,gpuTimer=null,water=null,player=null,foes=[],relics=[],portal=null,decor=[],worldRoot=null;
 let frameHandle=0,disposed=false,started=true,stage=1,life=100,score=0,kills=0,seen=0;
 let last=0,frames=0,invuln=0,dash=0,jump=0,jumpVel=0,attackCD=0,hitFlash=0,stageNotice="Spela!";
 let elapsedTime=0,lookAhead=0,levelEnemies=0,levelItems=0;
 const pressed=new Set(),pointerMap=new Map(),audioOff=true;
 const input={up:false,down:false,left:false,right:false,attack:false,dash:false,jump:false};
 const keyMap={KeyW:"up",ArrowUp:"up",KeyS:"down",ArrowDown:"down",KeyA:"left",ArrowLeft:"left",
  KeyD:"right",ArrowRight:"right",KeyJ:"attack",KeyK:"dash",Space:"jump"};
 const onKeyDown=e=>{if(e.target?.matches?.("input,textarea,select,[contenteditable=true]"))return;
  const action=keyMap[e.code];if(!action)return;e.preventDefault();pressed.add(action);
  if(["attack","dash","jump"].includes(action)&&!e.repeat)input[action]=true;};
 const onKeyUp=e=>{const act=keyMap[e.code];if(act){pressed.delete(act);e.preventDefault();}};
 const onPointerDown=e=>{
  const b=e.target.closest?.("[data-move],[data-action]");if(!b||!controls.contains(b))return;
  e.preventDefault();const act=b.dataset.move||b.dataset.action;
  if(!(act in input))return;
  pointerMap.set(e.pointerId,act);b.classList.add("pressed");
  try{b.setPointerCapture(e.pointerId);}catch{}
  if(["attack","dash","jump"].includes(act))input[act]=true;
 };
 const onPointerUp=e=>{
  const act=pointerMap.get(e.pointerId);if(!act)return;pointerMap.delete(e.pointerId);
  const b=e.target.closest?.("[data-move],[data-action]");
  if(b)b.classList.remove("pressed");
 };
 const onBlur=()=>{pressed.clear();pointerMap.clear();Object.keys(input).forEach(k=>input[k]=false);
  for(const button of controls.querySelectorAll?.("[data-move],[data-action]")||[])button.classList.remove("pressed");};
 env.addEventListener("keydown",onKeyDown,{passive:false});
 env.addEventListener("keyup",onKeyUp,{passive:false});
 env.addEventListener("blur",onBlur);
 controls.addEventListener("pointerdown",onPointerDown,{passive:false});
 for(const event of ["pointerup","pointercancel","lostpointercapture"])controls.addEventListener(event,onPointerUp,{passive:false});
 let padLast={attack:false,dash:false,jump:false};
 function pollPad(){
  let pad=null;
  try{pad=Array.from(env.navigator?.getGamepads?.()||[]).find(p=>p&&p.connected!==false);}catch{}
  const buttons=pad?.buttons||[],axes=pad?.axes||[];
  const active=n=>!!buttons[n]?.pressed;
  const x=Number(axes[0])||0,y=Number(axes[1])||0;
  const now={attack:active(2),dash:active(1),jump:active(0)};
  for(const key of ["attack","dash","jump"])if(now[key]&&!padLast[key])input[key]=true;
  padLast=now;
  return {
   up:y<-.26||active(12),down:y>.26||active(13),
   left:x<-.26||active(14),right:x>.26||active(15)
  };
 }
 function actives(pad){
  const pointer=key=>[...pointerMap.values()].includes(key);
  const hold=key=>pressed.has(key)||pointer(key)||pad[key];
  return {up:hold("up"),down:hold("down"),left:hold("left"),right:hold("right")};
 }
 function send(force=false){
  if(disposed||!force&&frames%9!==0)return;
  onState(Object.freeze({title:project.title,revision:project.revision,stage,levels:project.levels,
   life:Math.round(life),score,kills,remaining:foes.filter(f=>!f.dead).length,
   collected:seen,target:levelItems,notice:stageNotice,won:stage>project.levels,
   backend:renderer?.capabilities?.isWebGL2?"WebGL2":"WebGL",
   fps:gpu?.info().fps??null,world:project.world,quality:project.quality}));
 }
 function buildLevel(){
  if(worldRoot){scene.remove(worldRoot);disposeTree(worldRoot);}
  if(water){scene.remove(water.mesh);water.dispose();water=null;}
  worldRoot=new THREE.Group();scene.add(worldRoot);
  foes=[];relics=[];decor=[];portal=null;seen=0;
  levelEnemies=levelEnemyCount(project,stage);
  levelItems=project.genre==="arena"?0:project.collectibles;
  stageNotice="Bana "+stage+" / "+project.levels+" • samla kristaller och besegra fiender";
  const ground=basic(project.world==="ocean"?0x64462f:project.world==="city"?0x344353:
    project.world==="ruins"?0x6d6652:0x2f614d);
  const center=mesh(new THREE.CylinderGeometry(11.9,11.9,.7,36),ground);center.position.y=-.55;
  worldRoot.add(center);
  const floorLines=basic(project.world==="ocean"?0xa08356:0x738585);
  if(project.world==="ocean"){
   water=createOceanSurface({quality:project.quality==="performance"?"low":"medium",
    settings:{weather:project.weather==="storm"?"storm":project.weather==="sunset"?"sunset":"clear",
     height:project.weather==="storm"?.82:.45,speed:1.1,whitecaps:.1}});
   water.mesh.position.y=-1.65;scene.add(water.mesh);
   for(let i=-9;i<=9;i+=1.4){
    const plank=mesh(new THREE.BoxGeometry(20,.055,.13),floorLines);
    plank.position.set(0,-.16,i);worldRoot.add(plank);
   }
   for(const side of [-1,1]){
    const rail=mesh(new THREE.BoxGeometry(.18,.58,21),floorLines);rail.position.set(side*9.6,.14,0);worldRoot.add(rail);
    for(let z=-8;z<=8;z+=4){
     const shield=mesh(new THREE.CylinderGeometry(.57,.57,.12,12),basic(z%3===0?0xb44f44:0x375e77));
     shield.rotation.z=Math.PI/2;shield.position.set(side*9.45,.65,z);worldRoot.add(shield);
    }
   }
  }
  const objMat=basic(project.world==="city"?0x536576:project.world==="forest"?0x285b3d:0x8d745a);
  const topMat=basic(project.world==="city"?0x8cacc7:project.world==="forest"?0x23523b:0x8c8b72);
  for(let i=0;i<18;i++){
   const a=i/18*Math.PI*2,r=10.4+rand()*.45,x=Math.sin(a)*r,z=Math.cos(a)*r;
   if(project.world==="forest"){
    const trunk=mesh(new THREE.CylinderGeometry(.20,.35,2.1,7),basic(0x66503d));trunk.position.set(x,1.1,z);worldRoot.add(trunk);
    const crown=mesh(new THREE.ConeGeometry(1.25,3.7,8),topMat);crown.position.set(x,3.65,z);worldRoot.add(crown);
   }else{
    const h=project.world==="city"?2+rand()*6:1.3+rand()*2;
    const block=mesh(new THREE.BoxGeometry(1.1+rand()*.8,h,1.1+rand()*.8),objMat);
    block.position.set(x,h/2-.12,z);block.rotation.y=a;worldRoot.add(block);
    if(project.world==="city"){
     const antenna=mesh(new THREE.BoxGeometry(.05,.65,.05),topMat);antenna.position.set(x,h+.2,z);worldRoot.add(antenna);
    }
   }
  }
  const spawn=()=>{const a=rand()*Math.PI*2,r=2.5+rand()*6.1;return [Math.sin(a)*r,Math.cos(a)*r];};
  player=createActor(project.hero==="viking"?0x6a354a:project.hero==="explorer"?0x3d8193:0x405aba,true);
  player.root.position.set(0,0,0);worldRoot.add(player.root);
  for(let i=0;i<levelEnemies;i++){
   const foe=createActor(0x9d483b);const [x,z]=spawn();
   foe.root.position.set(x,0,z);worldRoot.add(foe.root);
   foes.push({...foe,life:2,dead:false,cool:1+rand(),phase:rand()*6.28});
  }
  for(let i=0;i<levelItems;i++){
   const [x,z]=spawn();
   const obj=mesh(new THREE.OctahedronGeometry(.35,0),new THREE.MeshStandardMaterial({
    color:0x72f3db,emissive:0x20bda2,emissiveIntensity:1.4,roughness:.2,metalness:.45}));
   obj.position.set(x,.76,z);obj.userData.y=.76;worldRoot.add(obj);
   relics.push({obj,claimed:false});
  }
  portal=new THREE.Group();portal.position.set(0,0,-8.7);worldRoot.add(portal);
  const ring=mesh(new THREE.TorusGeometry(1.45,.17,12,32),new THREE.MeshStandardMaterial({
   color:0x569de5,emissive:0x176add,emissiveIntensity:1.4,roughness:.3}));
  ring.position.y=1.7;portal.add(ring);
  const disk=mesh(new THREE.CircleGeometry(1.24,32),new THREE.MeshBasicMaterial({
   color:0x53d7e7,transparent:true,opacity:.23,side:THREE.DoubleSide,depthWrite:false}));
  disk.position.y=1.7;portal.add(disk);
  portal.userData.ring=ring;portal.userData.disk=disk;
  if(stage===1){life=100;score=0;kills=0;}
  send(true);
 }
 function isClear(){return seen>=levelItems&&foes.every(f=>f.dead);}
 function attack(){
  if(attackCD>0)return;
  attackCD=.38;
  let target=null,distance=2.35;
  for(const f of foes){
   if(f.dead)continue;
   const d=f.root.position.distanceTo(player.root.position);
   if(d<distance){target=f;distance=d;}
  }
  if(target){
   target.life--;
   target.body.material.emissive.setHex(0xf24b1b);
   hitFlash=.12;
   score+=15;
   stageNotice="TRÄFF!";
   if(target.life<=0){target.dead=true;target.root.visible=false;kills++;score+=85;
    stageNotice=isClear()?"Portalen är öppen!":"Fienden besegrad!";}
  }else stageNotice="Närmare fienden för att träffa";
  send(true);
 }
 function step(dt,time){
  if(disposed||!started||stage>project.levels)return;
  elapsedTime+=dt;
  invuln=Math.max(0,invuln-dt);attackCD=Math.max(0,attackCD-dt);
  dash=Math.max(0,dash-dt);hitFlash=Math.max(0,hitFlash-dt);
  const pad=pollPad(),move=actives(pad);
  let vx=Number(move.right)-Number(move.left),vz=Number(move.down)-Number(move.up);
  const n=Math.hypot(vx,vz);if(n>0){vx/=n;vz/=n;}
  if(input.dash){dash=.25;input.dash=false;}
  if(input.jump&&jump===0){jumpVel=5.7;input.jump=false;}
  if(input.attack){attack();input.attack=false;}
  const speed=dash>0?9:4.0;
  player.root.position.x=clamp(player.root.position.x+vx*speed*dt,-8.5,8.5);
  player.root.position.z=clamp(player.root.position.z+vz*speed*dt,-8.5,8.5);
  if(n>0)player.root.rotation.y=Math.atan2(-vx,-vz);
  jump=Math.max(0,jump+jumpVel*dt);
  if(jump>0)jumpVel-=14*dt;else{jump=0;jumpVel=0;}
  player.root.position.y=jump;
  const t=elapsedTime*11;
  player.joints[1].rotation.x=n?Math.sin(t)*.65:0;
  player.joints[3].rotation.x=n?-Math.sin(t)*.65:0;
  for(const f of foes){
   if(f.dead)continue;
   const dx=player.root.position.x-f.root.position.x,dz=player.root.position.z-f.root.position.z,
    d=Math.hypot(dx,dz);
   if(d>1.35&&d<10){f.root.position.x+=dx/Math.max(d,EPS)*dt*(1.0+stage*.11);
    f.root.position.z+=dz/Math.max(d,EPS)*dt*(1.0+stage*.11);}
   if(d>EPS)f.root.rotation.y=Math.atan2(-dx,-dz);
   f.cool-=dt;
   f.joints[1].rotation.x=Math.sin(time*4+f.phase)*.32;
   f.joints[3].rotation.x=-f.joints[1].rotation.x;
   if(d<1.55&&f.cool<=0&&invuln<=0&&jump<.5){
    life=Math.max(0,life-9);invuln=.9;f.cool=1.2;
    stageNotice=life>0?"Du blev träffad!":"Förlorat – försök igen";
    if(life===0){started=false;}send(true);
   }
  }
  for(const c of relics){
   if(c.claimed)continue;
   const p=c.obj.position;
   p.y=c.obj.userData.y+Math.sin(time*3+p.x)*.2;
   c.obj.rotation.y+=dt*2;
   if(Math.hypot(p.x-player.root.position.x,p.z-player.root.position.z)<.75){
    c.claimed=true;c.obj.visible=false;seen++;score+=50;
    stageNotice=isClear()?"Portalen är öppen!":"Kristall samlad!";send(true);
   }
  }
  const clear=isClear();
  portal.userData.ring.material.color.setHex(clear?0x52f9a8:0x647288);
  portal.userData.ring.material.emissive.setHex(clear?0x26c699:0x182744);
  portal.userData.ring.rotation.z+=dt*.55;
  if(clear&&Math.hypot(player.root.position.x,player.root.position.z+8.7)<1.7){
   score+=200;stage++;
   if(stage>project.levels){stageNotice="GRATTIS! Alla banor avklarade.";started=false;}
   else buildLevel();
   send(true);
  }
  water?.update(time);
 }
 function resize(){
  if(disposed||!renderer)return;
  const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;
  camera.fov=w<h?61:54;camera.updateProjectionMatrix();
 }
 function tick(timestamp){
  if(disposed)return;
  frameHandle=env.requestAnimationFrame(tick);
  if(env.document?.hidden){last=timestamp;return;}
  const dt=last?clamp((timestamp-last)/1000,0,.065):1/60;last=timestamp;
  if(started)step(dt,timestamp*.001);
  const focus=player?.root.position||new THREE.Vector3();
  const portrait=host.clientWidth<host.clientHeight;
  const desiredX=focus.x*.58,desiredZ=focus.z+ (portrait?17.6:13.3),desiredY=portrait?11.6:9.8;
  const ease=1-Math.exp(-dt*3.2);
  camera.position.lerp(new THREE.Vector3(desiredX,desiredY,desiredZ),ease);
  camera.lookAt(focus.x*.75,1.1,focus.z-1.4);
  if(hitFlash>0)renderer.toneMappingExposure=1.25+hitFlash*2;
  else renderer.toneMappingExposure=1.23;
  if(gpu&&frames%1===0)gpu.tick(dt,{onResize:resize});
  gpuTimer?.poll();
  if(frames%4===0)gpuTimer?.begin();
  try{renderer.render(scene,camera)}finally{gpuTimer?.end()}
  frames++;send();
 }
 function restart(){stage=1;started=true;last=0;life=100;buildLevel();}
 function destroy(){
  if(disposed)return;disposed=true;env.cancelAnimationFrame(frameHandle);
  env.removeEventListener("keydown",onKeyDown);env.removeEventListener("keyup",onKeyUp);env.removeEventListener("blur",onBlur);
  controls.removeEventListener("pointerdown",onPointerDown);
  for(const event of ["pointerup","pointercancel","lostpointercapture"])controls.removeEventListener(event,onPointerUp);
  env.removeEventListener("resize",resize);
  if(worldRoot){scene.remove(worldRoot);disposeTree(worldRoot);}
  if(water){scene.remove(water.mesh);water.dispose();}
  gpuTimer?.dispose();renderer?.dispose();renderer?.domElement?.remove();
 }
 try{
  scene=new THREE.Scene();
  scene.background=new THREE.Color(project.weather==="night"?0x071025:project.weather==="storm"?0x192c3f:
   project.weather==="sunset"?0xb07667:0x78a2c3);
  scene.fog=new THREE.FogExp2(scene.background,.018);
  camera=new THREE.PerspectiveCamera(54,1,.1,700);
  camera.position.set(0,10,13);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.23;
  renderer.setPixelRatio(Math.min(env.devicePixelRatio||1,1.65));
  host.appendChild(renderer.domElement);
  const ambient=new THREE.HemisphereLight(0xe7efff,0x1a2a36,2.1);scene.add(ambient);
  const sunlight=new THREE.DirectionalLight(project.weather==="sunset"?0xffd1a7:0xf1f5ff,2.9);
  sunlight.position.set(-12,24,16);scene.add(sunlight);
  gpu=createGPUDeluxe({renderer,canvas:renderer.domElement,env});
  gpuTimer=createGpuTimer(renderer);
  gpu.configure({mode:project.quality,quality:"high"});
  env.addEventListener("resize",resize,{passive:true});
  buildLevel();resize();
  frameHandle=env.requestAnimationFrame(tick);
 }catch(error){destroy();throw error;}
 return Object.freeze({restart,destroy,get state(){return Object.freeze({stage,life,score,active:started})},
  get config(){return project}});
}
