import * as THREE from 'three';
import {newMatch,stepMatch,makeAI,getPosePhase} from './combat.mjs';
import {createFighter,updateFighterPose} from './fighter.mjs';
import {createArena} from './arena.mjs';
import {createEffects,makeAudio} from './fx.mjs';
const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const canvas=$('stage'),scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(40,window.innerWidth/window.innerHeight,.1,120);
const arena=createArena(scene),rigs=[createFighter({index:0}),createFighter({index:1})];rigs.forEach(r=>scene.add(r.root));
const fx=createEffects(scene),audio=makeAudio(),keys=new Set(),touched=new Set(),oneShot=new Set();
let match=newMatch(),ai=makeAI('normal'),started=false,paused=false,pvp=false,soundOn=true,quality='high',composer=null,bloomPass=null;
let eventTimer=0,comboTimer=0,lastTime=performance.now(),accumulator=0,shake=0,frame=0;
const GAMEPAD_BUTTONS={0:'jump',1:'kick',2:'jab',3:'heavy',4:'block',5:'special'};
const prevPads=[{},{}];
function displayMessage(text,cls='',duration=1.0){const el=$('eventText');el.textContent=text;el.className='event-text show '+cls;eventTimer=duration;}
function canvasSize(){const dpr=Math.min(devicePixelRatio||1,quality==='low'?1:quality==='medium'?1.35:2);renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/Math.max(1,innerHeight);camera.updateProjectionMatrix();
  if(composer)composer.setSize(innerWidth*dpr,innerHeight*dpr);
}
window.addEventListener('resize',canvasSize,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(canvasSize,150));canvasSize();
async function configureBloom(){
  if(quality!=='high'||innerWidth<620||composer)return;
  try{
    const [{EffectComposer},{RenderPass},{UnrealBloomPass},{OutputPass}]=await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),import('three/addons/postprocessing/OutputPass.js')]);
    if(quality!=='high')return;
    const comp=new EffectComposer(renderer);comp.addPass(new RenderPass(scene,camera));
    bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.42,.52,.86);comp.addPass(bloomPass);comp.addPass(new OutputPass());composer=comp;canvasSize();
  }catch(e){console.warn('Optional bloom unavailable; standard renderer remains playable',e);}
}
function bindKeys(){
  const actions={KeyA:'left',KeyD:'right',KeyW:'jump',KeyS:'block',KeyJ:'jab',KeyK:'heavy',KeyL:'kick',KeyU:'special',
    ArrowLeft:'p2-left',ArrowRight:'p2-right',ArrowUp:'p2-jump',ArrowDown:'p2-block',Numpad1:'p2-jab',Numpad2:'p2-heavy',Numpad3:'p2-kick',Numpad0:'p2-special'};
  const instant=new Set(['jump','jab','heavy','kick','special','p2-jump','p2-jab','p2-heavy','p2-kick','p2-special']);
  window.addEventListener('keydown',e=>{
    if(e.code==='Escape'){e.preventDefault();if(started)toggleSettings();return;}
    const act=actions[e.code];if(!act)return;
    if(e.target?.tagName==='SELECT')return;
    e.preventDefault();if(!keys.has(act)&&instant.has(act))oneShot.add(act);
    keys.add(act);
  },{passive:false});
  window.addEventListener('keyup',e=>{const act=actions[e.code];if(act){keys.delete(act);e.preventDefault();}},{passive:false});
  window.addEventListener('blur',()=>{keys.clear();oneShot.clear();touched.clear();});
  for(const b of document.querySelectorAll('#touchpad button')){
    const act=b.dataset.action;
    b.addEventListener('pointerdown',e=>{e.preventDefault();audio.activate();b.setPointerCapture(e.pointerId);if(!touched.has(act))oneShot.add(act);touched.add(act);b.classList.add('pressed');},{passive:false});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{e.preventDefault();touched.delete(act);b.classList.remove('pressed');},{passive:false});
  }
}
bindKeys();
function collectGamepad(index){const gp=navigator.getGamepads?.()?.[index];if(!gp)return {};
  const current={};const prev=prevPads[index];const lx=gp.axes?.[0]||0,ly=gp.axes?.[1]||0;
  current.left=lx<-.25;current.right=lx>.25;
  for(const [button,act] of Object.entries(GAMEPAD_BUTTONS)){
    const pressed=!!gp.buttons?.[Number(button)]?.pressed;
    if(pressed&&(act==='block'||!prev[act]))current[act]=true;
    prev[act]=pressed;
  }
  if(ly<-.65&&!prev.jumpAxis)current.jump=true;prev.jumpAxis=ly<-.65;
  return current;
}
function mergeInput(index){const prefix=index?'p2-':'';const pad=collectGamepad(index),out={...pad};
  for(const act of ['left','right','block'])if(keys.has(prefix+act)||(index===0&&touched.has(act)))out[act]=true;
  for(const act of ['jump','jab','heavy','kick','special']){
    if(oneShot.has(prefix+act)){out[act]=true;oneShot.delete(prefix+act);}
  }
  if(index===0&&touched.has('block'))out.block=true;
  return out;
}
function syncUI(){
  for(let i=0;i<2;i++){
    const f=match.fighters[i];$('health'+(i+1)).style.width=f.hp+'%';$('meter'+(i+1)).style.width=f.meter+'%';
    const dots=$('roundwins'+(i+1)).children;for(let j=0;j<dots.length;j++)dots[j].classList.toggle('won',j<f.roundWins);
  }
  $('clock').textContent=String(Math.ceil(match.clock)).padStart(2,'0');$('round').textContent=String(match.round).padStart(2,'0');
  $('modeLabel').textContent=(pvp?'LOCAL VERSUS':'ARCADE / VS CPU')+' · '+(quality==='high'?'HIGH':quality.toUpperCase());
}
function takeEvents(){for(const e of match.events){if(e.type==='move'){
      if(e.move==='special'){audio.sound('special');fx.shockwave(match.fighters[e.fighter].x+match.fighters[e.fighter].face*.65,1.55,0,e.fighter===0);}else if(e.move==='heavy')audio.sound('move');
    } else if(['hit','block','guardbreak'].includes(e.type)){
      fx.sparkBurst(e.x,e.y,0,e.type,e.move==='special'?80:32);audio.sound(e.type==='hit'?'hit':'block');shake=e.type==='hit'?.18:e.type==='guardbreak'?.28:.075;
      if(e.move==='special')fx.shockwave(e.x,e.y,0,e.fighter===0);
      if(e.combo>=2&&e.fighter===0&&e.type==='hit'){$('combo').textContent=e.combo+' HIT COMBO';$('combo').classList.add('visible');comboTimer=1.1;}
      if(e.type==='guardbreak')displayMessage('GUARD BREAK','impact',.7);
    } else if(e.type==='ko'){audio.sound('ko');fx.sparkBurst(match.fighters[e.loser].x,1.55,0,'ko',100);displayMessage('K.O.','impact',2.1);shake=.43;
    } else if(e.type==='fight'){audio.sound('fight');displayMessage('FIGHT!','',.6);
    } else if(e.type==='round')displayMessage('ROUND '+e.round,'',1.4);
    else if(e.type==='matchover')displayMessage(e.winner===0?'KAEL WINS':'VEX WINS','impact',4.5);
    else if(e.type==='timeout')displayMessage('TIME UP','impact',1.7);
  }}
function updateCamera(dt,time){
  const [a,b]=match.fighters,center=(a.x+b.x)/2,dist=Math.abs(a.x-b.x);
  const aspect=innerWidth/Math.max(1,innerHeight);
  const base=aspect<.76?17.2:aspect<1.25?12.1:8.7;
  const separation=clamp((dist-3.1)*.65,0,3.3);
  const tz=base+separation;
  const amount=Math.min(1,dt*2.8);
  camera.position.x+=(center*.43-camera.position.x)*amount;
  camera.position.y+=((aspect<.76?4.1:3.22)-camera.position.y)*amount;
  camera.position.z+=(tz-camera.position.z)*amount;
  const sx=shake>0?(Math.random()-.5)*shake:0,sy=shake>0?(Math.random()-.5)*shake*.7:0;
  camera.position.x+=sx;camera.position.y+=sy;shake*=Math.pow(.82,dt*60);if(shake<.005)shake=0;
  camera.lookAt(camera.position.x*.18,aspect<.76?1.75:1.53,0);
}
function renderLoop(now){requestAnimationFrame(renderLoop);
  const dt=clamp((now-lastTime)/1000,0,.045);lastTime=now;
  const time=now/1000;
  if(started&&!paused){accumulator=Math.min(.15,accumulator+dt);let ticks=0;
    while(accumulator>=1/60&&ticks++<4){const a=mergeInput(0),b=pvp?mergeInput(1):ai(match,1/60);stepMatch(match,[a,b],1/60);takeEvents();accumulator-=1/60;}
  }
  if(!paused){arena.update(time,dt);fx.update(dt);}
  for(let i=0;i<2;i++)updateFighterPose(rigs[i],match.fighters[i],time,dt);
  updateCamera(dt,time);syncUI();
  if(eventTimer>0){eventTimer-=dt;if(eventTimer<=0)$('eventText').classList.remove('show');}
  if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)$('combo').classList.remove('visible');}
  if(composer){try{composer.render();}catch(err){console.warn('Bloom disabled after render failure:',err);composer=null;renderer.render(scene,camera);}}
  else renderer.render(scene,camera);
}
function startGame(){
  pvp=$('gameMode').value==='pvp';quality=$('quality').value;
  match=newMatch();ai=makeAI($('difficulty').value);started=true;paused=false;accumulator=0;lastTime=performance.now();
  $('startScreen').classList.add('hidden');$('settingsDialog').classList.add('hidden');$('combo').classList.remove('visible');$('eventText').classList.remove('show');
  if(soundOn)audio.activate();canvasSize();configureBloom();displayMessage('ROUND 1','',1.3);
}
function toggleSettings(force){if(!started)return;paused=typeof force==='boolean'?force:!paused;$('settingsDialog').classList.toggle('hidden',!paused);}
$('startBtn').addEventListener('click',startGame);
$('settings').addEventListener('click',()=>toggleSettings());
$('fullscreen').addEventListener('click',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();});
$('resume').addEventListener('click',()=>toggleSettings(false));
$('restart').addEventListener('click',startGame);
$('quit').addEventListener('click',()=>{paused=false;started=false;match=newMatch();$('settingsDialog').classList.add('hidden');$('startScreen').classList.remove('hidden');});
$('soundToggle').addEventListener('click',()=>{soundOn=!soundOn;$('soundToggle').textContent='Ljud: '+(soundOn?'På':'Av');if(soundOn)audio.activate();else audio.mute();});
window.addEventListener('error',e=>{console.error(e.message);});
window.__duoforgeRift={getState:()=>({state:match.state,round:match.round,players:match.fighters.map(f=>({hp:f.hp,x:f.x,move:f.move,meter:f.meter})),rendered:renderer.info.render.calls,activeEffects:fx.active}),start:startGame,step:(p1={},p2={},n=1)=>{for(let i=0;i<n;i++)stepMatch(match,[p1,p2]);}};
requestAnimationFrame(renderLoop);
