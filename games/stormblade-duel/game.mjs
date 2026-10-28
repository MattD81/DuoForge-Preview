import * as THREE from "three";
import {createWorld} from "./world.mjs";
import {createGPUDeluxe,DELUXE_SHARPEN_SHADER} from "../../workshop/studio/gpu-deluxe.mjs";

const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const host=$("sceneHost");
let renderer,scene,camera,world,gpu,composer=null,sharp=null;
let running=false,finished=false,round=90,last=0,now=0,screenFlash=0,frame=0,noticeTime=0;
let mode="auto",soundEnabled=false,audio=null;
const held={up:false,down:false,left:false,right:false,block:false};
const player={hp:100,attack:null,cool:0,invuln:0,stun:0,dodge:0,combo:0,comboTime:0};
const enemy={hp:100,attack:null,cool:1.3,invuln:0,stun:0,dodge:0};
let perfState={frameMs:null,fps:null,p95Ms:null,pixelRatio:1};
function initRenderer(){
 scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(49,1,.1,1000);
 camera.position.set(0,6.7,15.9);camera.lookAt(0,1.6,0);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.3;
 renderer.shadowMap.enabled=false; // mobile-friendly and stable; scene remains truly lit.
 host.appendChild(renderer.domElement);
 gpu=createGPUDeluxe({renderer,canvas:renderer.domElement});
 gpu.configure({mode,quality:"high"});
 world=createWorld(scene,camera,renderer);
 resize();addEventListener("resize",resize,{passive:true});
 document.addEventListener("visibilitychange",()=>{last=performance.now()*.001;});
 setupPost();
}
async function setupPost(){
 try{
  const [{EffectComposer},{RenderPass},{ShaderPass},{OutputPass}]=await Promise.all([
   import("three/addons/postprocessing/EffectComposer.js"),
   import("three/addons/postprocessing/RenderPass.js"),
   import("three/addons/postprocessing/ShaderPass.js"),
   import("three/addons/postprocessing/OutputPass.js")
  ]);
  if(!renderer)return;
  const pass=new EffectComposer(renderer);
  pass.addPass(new RenderPass(scene,camera));
  sharp=new ShaderPass(DELUXE_SHARPEN_SHADER);
  sharp.uniforms.uStrength.value=.14;
  pass.addPass(sharp);pass.addPass(new OutputPass());
  pass.setPixelRatio(renderer.getPixelRatio());
  pass.setSize(host.clientWidth||1,host.clientHeight||1);
  composer=pass;
 }catch(err){console.warn("GPU Deluxe enhancement unavailable; using normal WebGL:",err);}
}
function resize(){
 if(!renderer)return;
 const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
 camera.aspect=w/h;
 const portrait=w<h;
 const aspect=clamp(w/h,.42,2);
 camera.fov=portrait?55:49;
 camera.position.set(portrait?0:0,portrait?8.3:6.7,portrait?22:15.9);
 camera.lookAt(0,1.7,0);camera.updateProjectionMatrix();
 renderer.setSize(w,h,false);
 composer?.setSize(w,h);
}
function setNotice(text,duration=2.1){
 $("notice").textContent=text;noticeTime=duration;
}
function playTone(freq=170,length=.09,type="triangle",gain=.07){
 if(!soundEnabled||!audio)return;
 try{
  const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;
  o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(45,freq*.46),t+length);
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+length);
  o.connect(g);g.connect(audio.destination);o.start();o.stop(t+length+.01);
 }catch{}
}
function toggleSound(){
 soundEnabled=!soundEnabled;
 if(soundEnabled&&!audio)try{audio=new (window.AudioContext||window.webkitAudioContext)();}catch{soundEnabled=false;}
 if(soundEnabled)audio?.resume?.();
 $("sound").textContent=soundEnabled?"♪ Ljud på":"♪ Ljud av";
 if(soundEnabled)playTone(290,.15,"sine",.03);
}
function resetState(){
 for(const h of [player,enemy]){
  h.hp=100;h.attack=null;h.cool=0;h.invuln=0;h.stun=0;h.dodge=0;
 }
 player.combo=0;player.comboTime=0;
 player.cool=.15;enemy.cool=1.4;
 world.player.root.position.set(-2.2,.57,1.2);
 world.opponent.root.position.set(2.2,.57,1.2);
 world.player.root.rotation.y=-Math.PI/2;
 world.opponent.root.rotation.y=Math.PI/2;
 round=90;finished=false;running=true;now=0;frame=0;screenFlash=0;last=performance.now()*.001;
 $("modal").hidden=true;$("endModal").hidden=true;
 syncHUD();setNotice("⚡ RUNDA 1 — KÄMPA FÖR SKEPPET!",2.8);
}
function startDemo(){
 if(!renderer)return;
 resetState();
}
function syncHUD(){
 $("pHealth").style.width=clamp(player.hp,0,100)+"%";
 $("eHealth").style.width=clamp(enemy.hp,0,100)+"%";
 $("pHp").textContent=Math.max(0,Math.ceil(player.hp))+" HP";
 $("eHp").textContent=Math.max(0,Math.ceil(enemy.hp))+" HP";
 const secs=Math.ceil(Math.max(0,round));
 $("timer").textContent=String(Math.floor(secs/60)).padStart(2,"0")+":"+String(secs%60).padStart(2,"0");
}
function attack(who,heavy=false){
 if(!running||finished||who.attack||who.cool>0||who.stun>0)return false;
 const total=heavy?.86:.48;
 who.attack={remaining:total,total,hit:false,heavy};
 who.cool=heavy?1.02:.55;
 if(who===player)setNotice(heavy?"⚡ STORMHUGG!":"⚔ HUGG!",.65);
 playTone(heavy?175:280,.16,heavy?"sawtooth":"triangle",.04);
 return true;
}
function dodge(){
 if(!running||player.cool>0||player.stun>0)return;
 player.invuln=.35;player.cool=.74;player.dodge=.35;
 const me=world.player.root.position,foe=world.opponent.root.position;
 const dir=me.x<=foe.x?-1:1;
 me.x=clamp(me.x+dir*.92,-2.22,2.22);
 setNotice("↯ UNDVIK!",.6);playTone(550,.1,"triangle",.035);
}
function applyHit(attacker,defender,from,to,heavy){
 const dx=to.root.position.x-from.root.position.x;
 const dz=to.root.position.z-from.root.position.z;
 const dist=Math.hypot(dx,dz);
 if(dist>(heavy?2.7:2.25))return;
 const hurt=attacker===player?enemy:player;
 if(hurt.invuln>0)return;
 const blocking=defender===world.player&&held.block;
 const raw=heavy?27:15;
 const amount=blocking?Math.round(raw*.23):raw;
 hurt.hp=clamp(hurt.hp-amount,0,100);
 hurt.stun=blocking?.04:heavy?.32:.17;
 hurt.invuln=.12;
 hurt.attack=null;
 const impact=to.root.position.clone().lerp(from.root.position,.26).add(new THREE.Vector3(0,1.58,0));
 world.spark(impact,blocking?0x7ef2f4:heavy?0xffd16f:0xf4a168);
 screenFlash=blocking?.05:heavy?.20:.11;
 playTone(blocking?540:heavy?72:120,heavy?.24:.12,blocking?"sine":"sawtooth",.055);
 if(attacker===player){
  player.combo=player.comboTime>0?player.combo+1:1;player.comboTime=2.6;
  setNotice(blocking?"◆ BLOCKERAT":heavy?"⚡ FULLTRÄFF! -27 HP":"✦ TRÄFF! -15 HP",.9);
 }else{
  setNotice(blocking?"◆ DU BLOCKERADE!":"⚠ SKADI TRÄFFADE DIG!",1);
 }
 // No knockback through the ship rail.
 to.root.position.x=clamp(to.root.position.x+(dx/dist||1)*(blocking?.035:.19),-2.18,2.18);
 syncHUD();
 if(hurt.hp<=0)end(attacker===player?"victory":"defeat");
}
function updateAttack(h,actor,target,dt){
 if(!h.attack)return;
 const a=h.attack;a.remaining=Math.max(0,a.remaining-dt);
 const progress=1-a.remaining/a.total;
 if(!a.hit&&progress>=.48){
  a.hit=true;applyHit(h,actor===world.player?world.player:world.opponent,actor,target,a.heavy);
 }
 if(a.remaining<=0)h.attack=null;
}
function end(outcome){
 if(finished)return;
 finished=true;running=false;
 let title,body;
 if(outcome==="victory"){title="SEGER!";body="Ragnar besegrade Skadi. Stormen kan inte kuva dig.";}
 else if(outcome==="defeat"){title="DU FÖLL I STRID";body="Skadi tog segern. Res dig och försök igen.";}
 else{title=player.hp>=enemy.hp?"SEGER PÅ POÄNG!":"TIDEN ÄR UTE";body="Nittio sekunder har gått. Försök vinna snabbare nästa gång.";}
 $("endTitle").textContent=title;$("endBody").textContent=body;
 $("endModal").hidden=false;
 playTone(outcome==="victory"?490:120,.45,"sine",.06);
}
function movePlayer(dt){
 const root=world.player.root;
 if(player.stun>0||player.attack?.heavy)return 0;
 let x=(held.right?1:0)-(held.left?1:0),z=(held.down?1:0)-(held.up?1:0);
 const l=Math.hypot(x,z);if(!l)return 0;
 x/=l;z/=l;
 const speed=held.block?1.22:3.08;
 root.position.x=clamp(root.position.x+x*speed*dt,-2.17,2.17);
 root.position.z=clamp(root.position.z+z*speed*dt,-5.8,5.8);
 return 1;
}
function moveEnemy(dt){
 const a=world.opponent.root.position,b=world.player.root.position;
 const dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz)||.01;
 if(enemy.stun>0)return 0;
 if(dist>1.58&&(!enemy.attack||enemy.attack.heavy)){
  const speed=enemy.attack?1:1.65;
  a.x=clamp(a.x+dx/dist*dt*speed,-2.17,2.17);
  a.z=clamp(a.z+dz/dist*dt*speed,-5.8,5.8);
  return 1;
 }
 if(dist<1.2){a.x=clamp(a.x-dx/dist*dt*.62,-2.17,2.17);}
 return 0;
}
function tick(dt){
 const real=dt;
 dt=Math.min(Math.max(0,dt),.05);
 now+=dt;const burst=world.update(now,dt);
 if(!running||finished)return;
 round-=dt;
 if(round<=0){end("time");return;}
 for(const h of [player,enemy]){
  h.cool=Math.max(0,h.cool-dt);
  h.invuln=Math.max(0,h.invuln-dt);
  h.stun=Math.max(0,h.stun-dt);
  h.dodge=Math.max(0,h.dodge-dt);
 }
 player.comboTime=Math.max(0,player.comboTime-dt);
 if(player.comboTime===0)player.combo=0;
 let walk=movePlayer(dt),enemyWalk=moveEnemy(dt);
 const me=world.player.root,foe=world.opponent.root;
 // Local fighter -Z faces toward the opponent.
 me.rotation.y=Math.atan2(-(foe.position.x-me.position.x),-(foe.position.z-me.position.z));
 foe.rotation.y=Math.atan2(-(me.position.x-foe.position.x),-(me.position.z-foe.position.z));
 const d=Math.hypot(foe.position.x-me.position.x,foe.position.z-me.position.z);
 if(enemy.cool<=0&&!enemy.attack&&d<2.55){
  attack(enemy,Math.random()<.22);
 }
 updateAttack(player,world.player,world.opponent,dt);
 updateAttack(enemy,world.opponent,world.player,dt);
 world.player.animate(now,{walk,block:held.block?1:0,swing:player.attack?1-player.attack.remaining/player.attack.total:0,hurt:player.stun,groundY:.57});
 world.opponent.animate(now+.47,{walk:enemyWalk,swing:enemy.attack?1-enemy.attack.remaining/enemy.attack.total:0,hurt:enemy.stun,groundY:.57});
 if(frame%13===0)syncHUD();
 if(noticeTime>0){noticeTime-=dt;if(noticeTime<=0)$("notice").textContent="⚔ STORMBLADE / THE LAST LONGSHIP";}
}
function renderFrame(timeMs){
 requestAnimationFrame(renderFrame);
 const seconds=timeMs*.001,elapsed=last?clamp(seconds-last,0,.12):1/60;last=seconds;
 if(document.hidden)return;
 tick(elapsed);
 if(screenFlash>0){
  screenFlash=Math.max(0,screenFlash-elapsed);
  renderer.toneMappingExposure=1.3+screenFlash*1.3;
 }else renderer.toneMappingExposure=1.3;
 if(gpu&&running&&frame%1===0){
  perfState=gpu.tick(elapsed,{onResize:()=>{composer?.setPixelRatio(renderer.getPixelRatio());composer?.setSize(host.clientWidth||1,host.clientHeight||1);}});
 }
 if(frame++%30===0){
  const state=gpu.info();
  $("perf").textContent="◈ "+mode.toUpperCase()+" / "+(state.fps??"…")+" FPS / "+state.capabilities.backend;
 }
 if(composer&&mode==="quality"){
  if(sharp){
   sharp.uniforms.uStrength.value=mode==="quality"?.20:.12;
   sharp.uniforms.uTexel.value.x=1/Math.max(renderer.domElement.width,1);
   sharp.uniforms.uTexel.value.y=1/Math.max(renderer.domElement.height,1);
  }
  composer.render();
 }else renderer.render(scene,camera);
}
const codeMap={KeyW:"up",ArrowUp:"up",KeyS:"down",ArrowDown:"down",KeyA:"left",ArrowLeft:"left",KeyD:"right",ArrowRight:"right",Space:"block"};
addEventListener("keydown",e=>{
 if(codeMap[e.code]){held[codeMap[e.code]]=true;e.preventDefault();}
 if(e.repeat)return;
 if(e.code==="KeyJ"){attack(player,false);e.preventDefault();}
 if(e.code==="KeyK"){attack(player,true);e.preventDefault();}
 if(e.code==="ShiftLeft"||e.code==="ShiftRight"){dodge();e.preventDefault();}
});
addEventListener("keyup",e=>{if(codeMap[e.code]){held[codeMap[e.code]]=false;e.preventDefault()}});
addEventListener("blur",()=>Object.keys(held).forEach(key=>held[key]=false));
for(const el of document.querySelectorAll("[data-move],[data-action]")){
 const code=el.dataset.move||el.dataset.action;
 const press=ev=>{
  ev.preventDefault();
  el.classList.add("pressed");
  if(code in held)held[code]=true;
  if(code==="attack")attack(player,false);
  if(code==="heavy")attack(player,true);
  if(code==="dodge")dodge();
 };
 const release=ev=>{ev.preventDefault();el.classList.remove("pressed");if(code in held)held[code]=false;};
 el.addEventListener("pointerdown",press);
 for(const event of ["pointerup","pointercancel","pointerleave","lostpointercapture"])el.addEventListener(event,release);
}
$("start").onclick=startDemo;$("restart").onclick=resetState;$("endRestart").onclick=resetState;
$("sound").onclick=toggleSound;
$("quality").onclick=()=>{
 const modes=["auto","quality","performance","off"];
 mode=modes[(modes.indexOf(mode)+1)%modes.length];
 gpu.configure({mode,quality:"high"});
 const label={auto:"AUTO",quality:"KVALITET",performance:"PRESTANDA",off:"AV"}[mode];
 $("quality").textContent="◈ "+label;
 setNotice("GPU Deluxe: "+label,1.2);
};
try{
 initRenderer();
 const qa=Object.freeze({
  start:startDemo,
  state:()=>({playerHp:player.hp,enemyHp:enemy.hp,running,finished,round,mode,
   playerX:world?.player.root.position.x,enemyX:world?.opponent.root.position.x,
   backend:gpu?.info().capabilities.backend}),
  restart:resetState
 });
 Object.defineProperty(window,"__stormblade",{value:qa,configurable:false});
 requestAnimationFrame(renderFrame);
}catch(err){
 console.error("Stormblade 3D renderer startup",err);
 $("modal").hidden=true;$("fatal").hidden=false;
 $("fatal").textContent="3D-motorn kunde inte starta: "+String(err.message||err).slice(0,250);
}
