import * as THREE from "three";
import {LEVELS,PORTAL,startGame,step,advanceLevel} from "./logic.mjs";
import {buildWorld,animateWorld} from "./world.mjs";
import {
 sceneDNA,planDetailBudget,projectedImportance,
 createTemporalBudgetGovernor,createCinemaPlan,cameraAt,FUSION_VERSION
} from "./fusion-engine.mjs";

const $=id=>document.getElementById(id),canvas=$("stage"),mini=$("minimap");
const iconMessage={
 core:"ENERGIKÄRNA SÄKRAD",portal:"STJÄRNPORTALEN ÄR ÖPPEN",kill:"VÄKTARE BESEGRAD",
 level:"VÄRLD RENAD",victory:"HIMLEN ÄR RÄDDAD",dash:""
};
const keyState=new Set(),touchMove=new Set(),touchAction=new Set();
const inputActions=new Set(["attack","dash","jump","pulse"]);
let renderer,scene,camera,world,state,active=false,paused=false,clock=0,lastFrame=0;
let director=null,governor,sceneDescriptors=[],sceneDNAValue=null,qualityReport=null,lodNext=0;
let sounds=false,audio=null,announceTimer=0,governorBase=1,flashTimer=0;
let effects=[],lastHud=0,fxTime=0;
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const text=id=>$(id).textContent;

function showMessage(str,duration=2.3){
 if(!str)return;
 text("announcement");$("announcement").textContent=str;
 $("announcement").classList.add("visible");announceTimer=clock+duration;
}
function playTone(freq=420,seconds=.12,type="sine",gain=.08){
 if(!sounds)return;
 try{
  audio ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==="suspended")audio.resume();
  const oscillator=audio.createOscillator(),volume=audio.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(freq,audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.64),audio.currentTime+seconds);
  volume.gain.setValueAtTime(gain,audio.currentTime);
  volume.gain.exponentialRampToValueAtTime(.001,audio.currentTime+seconds);
  oscillator.connect(volume);volume.connect(audio.destination);
  oscillator.start();oscillator.stop(audio.currentTime+seconds+.01);
 }catch{}
}
function announceEvent(event){
 if(event.type==="hurt"){
  $("flash").classList.add("hurt");clearTimeout(flashTimer);
  flashTimer=setTimeout(()=>$("flash").classList.remove("hurt"),120);
  playTone(100,.24,"sawtooth",.1);
 }
 if(event.type==="slash"){playTone(event.hit?320:240,.07,"triangle",.055);}
 if(event.type==="pulse"){playTone(180,.36,"sawtooth",.10);}
 if(event.type==="core"){showMessage(iconMessage.core);playTone(800,.32,"sine",.12);}
 if(event.type==="portal"){showMessage(iconMessage.portal,3);playTone(600,.52,"sine",.11);}
 if(event.type==="kill"){playTone(180,.22,"triangle",.09);}
 if(event.type==="level-complete")showMessage(iconMessage.level);
 if(event.type==="victory")showMessage(iconMessage.victory,4);
 if(["pulse","slash","dash","core","kill"].includes(event.type))spawnEffect(event);
}
function spawnEffect(event){
 const color=event.type==="pulse"?0xb290ff:event.type==="dash"?0x71f6ff:
  event.type==="core"?0xffd087:event.type==="kill"?0xf76f9c:0x7ceeff;
 const ring=new THREE.Mesh(new THREE.TorusGeometry(event.type==="pulse"?1.1:.4,.07,6,48),
   new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,depthWrite:false,
     blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
 ring.position.set(event.x,.36,event.z);ring.rotation.x=-Math.PI/2;scene.add(ring);
 const life=event.type==="pulse"?.7:event.type==="core"?.85:.40;
 effects.push({object:ring,life,max:life});
 if(effects.length>30){const old=effects.shift();scene.remove(old.object);old.object.geometry.dispose();old.object.material.dispose();}
}
function clearEffects(){
 for(const e of effects){scene?.remove(e.object);e.object.geometry.dispose();e.object.material.dispose();}
 effects=[];
}
function initGraphics(){
 if(renderer)return;
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance",alpha:false});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.18;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 camera=new THREE.PerspectiveCamera(54,1,.05,600);
 camera.position.set(7,13,24);
 governorBase=Math.min(window.devicePixelRatio||1,matchMedia("(max-width:680px)").matches?1.35:1.65);
 renderer.setPixelRatio(governorBase);
 window.addEventListener("resize",resize,{passive:true});resize();
 canvas.addEventListener("webglcontextlost",event=>{event.preventDefault();stopRun();showError("Grafikkontexten förlorades. Ladda om för att återställa spelet.");});
}
function resize(){
 if(!renderer)return;
 const width=Math.max(canvas.clientWidth,1),height=Math.max(canvas.clientHeight,1);
 renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
}
function disposeWorld(){
 clearEffects();
 if(!world)return;
 for(const mesh of [world.world,world.sky]){
  mesh.traverse(obj=>{obj.geometry?.dispose?.();});
  mesh.parent?.remove(mesh);
 }
 world.water.dispose();
 world.sky.material.dispose();
 for(const item of [world.ambient,world.sun,world.fill]){
  scene.remove(item);item.dispose?.();
 }
 world=null;
}
function descriptors(){
 const objects=[
  {id:"hero",name:"Aether knight avatar",triangles:11000,center:[state.player.x,1,state.player.z],
   radius:2,skinned:true,geometry:"hero-v1",material:"armor"},
  ...state.enemies.map((e,i)=>({id:"enemy-"+i,name:"Void guardian "+i,
    triangles:3200,center:[e.x,1,e.z],radius:1.5,
    animated:true,geometry:"guardian-"+(i%3),material:"blue-violet"})),
  ...state.cores.map(c=>({id:"core-"+c.id,name:"Celestial core "+c.id,
    triangles:380,center:[c.x,1,c.z],radius:1,geometry:"core-v1",material:"cyan"})),
  ...world.hiDetail.map((entry,i)=>({id:"ruin-"+i,name:"Ancient ruin",triangles:entry.triangles,
    center:entry.center,radius:entry.radius,geometry:"ruin-v1",material:"stone"}))
 ];
 return objects;
}
function gameCamera(){
 const direction=new THREE.Vector3();camera.getWorldDirection(direction);
 return {position:camera.position.toArray(),direction:direction.toArray(),
  fovDegrees:camera.fov,near:camera.near,far:camera.far,
  aspect:camera.aspect,heightPixels:Math.max(canvas.clientHeight,200)};
}
function updateResearch(force=false){
 if(!world||!state)return;
 sceneDescriptors=descriptors();
 if(force){
  sceneDNAValue=sceneDNA(sceneDescriptors);
  text("dna");$("dna").textContent=sceneDNAValue.sceneKey.slice(0,7).toUpperCase();
 }
 const goal=matchMedia("(max-width:680px)").matches?65000:175000;
 qualityReport=planDetailBudget(sceneDescriptors,gameCamera(),{triangleBudget:goal,
  previous:qualityReport?.decisions});
 const map=new Map(qualityReport.decisions.map(d=>[d.id,d]));
 let visible=0;
 for(let i=0;i<world.hiDetail.length;i++){
  const item=world.hiDetail[i],d=map.get("ruin-"+i);
  const projection=projectedImportance({center:item.center,radius:item.radius,triangles:item.triangles},gameCamera());
  const show=(projection.pixels>19&&d?.quality!=="defer-detail");
  item.object.visible=show;if(show)visible++;
 }
 text("perf");$("perf").textContent="FUSION LoD "+visible+"/"+world.hiDetail.length+" · WEBGL";
}
function beginLevel(level=0,carry=null){
 state=startGame(level,carry);scene||=new THREE.Scene();
 disposeWorld();
 world=buildWorld(scene,level);
 sceneDNAValue=null;qualityReport=null;
 const base=governorBase;governor=createTemporalBudgetGovernor({
  targetFps:matchMedia("(pointer:coarse)").matches?30:60,minScale:.65,maxScale:1,initialScale:1,windowFrames:36
 });
 renderer.setPixelRatio(base);resize();
 camera.position.set(9,15,30);camera.lookAt(0,0,0);
 $("place").textContent=LEVELS[level].name;$("chapter").textContent=String(level+1).padStart(2,"0");
 $("objective").textContent=LEVELS[level].subtitle;
 text("crossObjective");$("crossObjective").textContent="HITTA 3 ENERGIKÄRNOR";
 document.getElementById("endScreen").classList.add("hidden");
 updateResearch(true);updateHUD(true);
 try{
  const plan=createCinemaPlan(sceneDescriptors,{name:"Aetherfall",aspect:camera.aspect});
  director={plan,elapsed:0,duration:2.4};
 }catch{director=null;}
 showMessage("VÄRLD "+(level+1)+" · "+LEVELS[level].name,2);
}
function updateHUD(force=false){
 if(!force&&clock-lastHud<.12)return;
 lastHud=clock;
 const p=state.player;
 $("health").style.width=p.hp+"%";text("healthNumber");$("healthNumber").textContent=Math.round(p.hp);
 $("energy").style.width=p.energy+"%";text("energyNumber");$("energyNumber").textContent=Math.round(p.energy);
 const got=state.cores.filter(c=>c.got).length;
 $("cores").textContent=got+" / 3";
 $("kills").textContent=state.kills+" / "+state.requiredKills;
 $("score").textContent="POÄNG "+String(state.score).padStart(6,"0");
 $("crossObjective").textContent=state.portalOpen?"✦ STJÄRNPORTALEN ÖPPEN!":got<3?
  "SAMLA LJUSKÄRNOR · "+got+" / 3":"BESEGRA VÄKTARE · "+state.kills+" / "+state.requiredKills;
 drawRadar();
}
function drawRadar(){
 const ctx=mini.getContext("2d");if(!ctx)return;
 const w=mini.width,h=mini.height,cx=w/2,cy=h/2,scale=2.42;
 ctx.clearRect(0,0,w,h);
 ctx.save();
 ctx.strokeStyle="#275c78";ctx.lineWidth=1;
 for(const r of [25,45,65]){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();}
 ctx.strokeStyle="#2f607a";ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,h);ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.stroke();
 const p=state.player;
 const dot=(x,z,color,r)=>{
  const px=cx+(x-p.x)*scale,py=cy+(z-p.z)*scale;
  if(Math.hypot(px-cx,py-cy)>69)return;
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
 };
 for(const core of state.cores)if(!core.got)dot(core.x,core.z,"#70fff1",4);
 for(const e of state.enemies)if(e.alive)dot(e.x,e.z,"#f47bb5",2.7);
 dot(PORTAL.x,PORTAL.z,state.portalOpen?"#fff0a2":"#6a6788",6);
 ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="#ffffff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+p.facingX*12,cy+p.facingZ*12);ctx.stroke();
 ctx.restore();
}
function readGamepad(){
 const pad=navigator.getGamepads?.()?.find(p=>p&&p.connected);
 if(!pad)return {x:0,z:0,attack:false,jump:false,dash:false,pulse:false};
 const axis=n=>Math.abs(pad.axes?.[n]||0)>.2?pad.axes[n]:0;
 return {x:axis(0),z:axis(1),jump:!!pad.buttons?.[0]?.pressed,
  attack:!!pad.buttons?.[2]?.pressed,dash:!!pad.buttons?.[1]?.pressed,
  pulse:!!pad.buttons?.[3]?.pressed};
}
function controls(){
 const pad=readGamepad();
 const axis=(positive,negative,one,two,gamepad)=>clamp(
  (keyState.has(positive)?1:0)-(keyState.has(negative)?1:0)+
  (touchMove.has(one)?1:0)-(touchMove.has(two)?1:0)+gamepad,-1,1);
 return {
  x:axis("KeyD","KeyA","right","left",pad.x)||(keyState.has("ArrowRight")?1:keyState.has("ArrowLeft")?-1:0),
  z:axis("KeyS","KeyW","down","up",pad.z)||(keyState.has("ArrowDown")?1:keyState.has("ArrowUp")?-1:0),
  attack:keyState.has("KeyJ")||touchAction.has("attack")||pad.attack,
  jump:keyState.has("Space")||touchAction.has("jump")||pad.jump,
  dash:keyState.has("ShiftLeft")||keyState.has("ShiftRight")||keyState.has("KeyK")||touchAction.has("dash")||pad.dash,
  pulse:keyState.has("KeyE")||keyState.has("KeyL")||touchAction.has("pulse")||pad.pulse
 };
}
function inputSetup(){
 window.addEventListener("keydown",e=>{
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();
  if(e.code==="Escape"||e.code==="KeyP"){
   if(active)togglePause();return;
  }
  keyState.add(e.code);
  if(director&&active&&!paused)director=null;
 });
 window.addEventListener("keyup",e=>keyState.delete(e.code));
 window.addEventListener("blur",()=>{keyState.clear();touchMove.clear();touchAction.clear();if(active&&!paused)togglePause();});
 for(const button of document.querySelectorAll("[data-move],[data-action]")){
  const isMove=button.hasAttribute("data-move"),key=button.dataset.move||button.dataset.action;
  const set=()=>{(isMove?touchMove:touchAction).add(key);button.classList.add("pressed");if(director)director=null;};
  const clear=()=>{(isMove?touchMove:touchAction).delete(key);button.classList.remove("pressed");};
  button.addEventListener("pointerdown",e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);set();});
  for(const type of ["pointerup","pointercancel","lostpointercapture"])button.addEventListener(type,clear);
 }
 canvas.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button===0&&!paused&&active){
  touchAction.add("attack");if(director)director=null;}});
 window.addEventListener("pointerup",()=>touchAction.delete("attack"));
}
function togglePause(force){
 if(!active)return;
 paused=typeof force==="boolean"?force:!paused;
 $("pauseScreen").classList.toggle("hidden",!paused);
 if(!paused){lastFrame=performance.now();}else{keyState.clear();touchMove.clear();touchAction.clear();}
}
function endState(){
 paused=true;active=false;director=null;clearEffects();
 $("endScreen").classList.remove("hidden");
 const status=state.status;
 $("endNext").hidden=status!=="level-complete";
 if(status==="level-complete"){
  $("endEyebrow").textContent="VÄRLD "+(state.level+1)+" AVKLARAD";
  $("endTitle").textContent="PORTALEN HAR ÖPPNATS";
  $("endText").textContent="Du har övervunnit "+LEVELS[state.level].name+". Poäng: "+state.score+". Nästa värld väntar.";
 }else if(status==="won"){
  $("endEyebrow").textContent="AETHERFALL / ÄVENTYRET SLUTFÖRT";
  $("endTitle").textContent="DU RÄDDADE HIMLEN";
  $("endText").textContent="Alla tre världar har återfått sitt ljus. Slutpoäng: "+state.score+".";
 }else{
  $("endEyebrow").textContent="HJÄLTEN HAR FALLIT";
  $("endTitle").textContent="ÅTERVÄND TILL LJUSETS KÄLLA";
  $("endText").textContent="Du nådde värld "+(state.level+1)+". Poäng: "+state.score+". Försök igen.";
 }
}
function stopRun(){active=false;paused=true;keyState.clear();touchMove.clear();touchAction.clear();}
function showError(message){
 stopRun();$("errorText").textContent=message;$("error").classList.remove("hidden");
}
function followCamera(dt){
 const p=state.player;
 const desired=v3(p.x+8.0,p.y+10.0,p.z+15.8);
 camera.position.lerp(desired,1-Math.exp(-5*dt));
 const target=v3(p.x,p.y+1.55,p.z-4.2);
 camera.lookAt(target);
}
function doCamera(dt){
 if(director){
  director.elapsed+=dt;
  const t=director.elapsed* (director.plan.seconds/director.duration);
  const pose=cameraAt(director.plan,Math.min(t,director.plan.seconds));
  camera.position.lerp(v3(...pose.position),clamp(dt*5,0,1));
  camera.lookAt(v3(...pose.target));
  if(director.elapsed>director.duration)director=null;
 }else followCamera(dt);
}
function frame(now){
 requestAnimationFrame(frame);
 if(!renderer||!world||!state)return;
 if(!lastFrame)lastFrame=now;
 const dt=clamp((now-lastFrame)/1000,.001,.05);lastFrame=now;
 if(!active||paused){renderer.render(scene,camera);return;}
 clock+=dt;
 if(announceTimer&&clock>announceTimer){$("announcement").classList.remove("visible");announceTimer=0;}
 if(!director){
  const input=controls();
  step(state,input,dt);
  for(const event of state.events)announceEvent(event);
  if(state.status!=="playing"){animateWorld(world,state,clock,dt);renderer.render(scene,camera);endState();return;}
 }
 doCamera(dt);
 animateWorld(world,state,clock,dt);
 for(let i=effects.length-1;i>=0;i--){
  const e=effects[i];e.life-=dt;
  const progress=1-e.life/e.max;
  e.object.scale.setScalar(1+progress* (e.max>.6?5:2.8));
  e.object.material.opacity=Math.max(0,(1-progress)*.9);
  if(e.life<=0){scene.remove(e.object);e.object.geometry.dispose();e.object.material.dispose();effects.splice(i,1);}
 }
 if(clock>lodNext){
  lodNext=clock+.6;updateResearch();
 }
 const perf=governor.sample(dt*1000);
 if(perf.changed){renderer.setPixelRatio(Math.max(.6,governorBase*perf.scale));resize();}
 if(Math.floor(clock)%2===0&&clock-fxTime>.55){
  $("fps").textContent=perf.averageMs?Math.round(1000/perf.averageMs)+" FPS":"AUTO FPS";
  fxTime=clock;
 }
 updateHUD();
 renderer.render(scene,camera);
}
function bind(){
 $("start").onclick=()=>{
  try{
   initGraphics();beginLevel(0);
   $("startScreen").classList.add("hidden");
   $("pauseScreen").classList.add("hidden");
   active=true;paused=false;lastFrame=performance.now();
   canvas.focus?.();
  }catch(err){console.error(err);showError(err.message||"WebGL kunde inte startas");}
 };
 $("pauseButton").onclick=()=>togglePause();
 $("resume").onclick=()=>togglePause(false);
 $("restart").onclick=()=>{togglePause(false);beginLevel(0);active=true;paused=false;};
 $("endRestart").onclick=()=>{beginLevel(0);active=true;paused=false;lastFrame=performance.now();};
 $("endNext").onclick=()=>{
  if(state?.status!=="level-complete")return;
  const next=advanceLevel(state);beginLevel(next.level,{score:next.score,hp:next.player.hp});
  active=true;paused=false;lastFrame=performance.now();
 };
 $("sound").onclick=()=>{
  sounds=!sounds;
  $("sound").textContent=sounds?"♫ LJUD PÅ":"♫ LJUD AV";
  if(sounds)playTone(700,.08);
 };
 $("retry").onclick=()=>window.location.reload();
 inputSetup();
}
bind();
requestAnimationFrame(frame);
