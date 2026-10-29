import {VIEW,RELICS,createState,stepPhysics} from "../../services/duoforge-2d/physics.mjs";
import {createRenderer,ENGINE_VERSION} from "../../services/duoforge-2d/renderer.mjs";
import {paintLandscape,createLights} from "../../services/duoforge-2d/world.mjs";

const $=id=>document.getElementById(id);
const canvas=$("stage"),isMobile=matchMedia("(pointer:coarse), (max-width:700px)").matches;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let game=createState(),renderer=null,started=false,stopped=false,lastFrame=0,accumulated=0,renderTicks=0,notification=null;
let input={left:false,right:false,jump:false},audio=null,wasCount=0,mute=true,frameCount=0;
function announce(text){
 const node=$("toast");node.textContent=text;node.classList.add("visible");
 clearTimeout(notification);notification=setTimeout(()=>node.classList.remove("visible"),2300);
}
function audioReady(){
 if(audio)return audio;
 const AudioCtor=window.AudioContext||window.webkitAudioContext;
 if(!AudioCtor)return null;
 try{audio=new AudioCtor();return audio}catch(e){return null}
}
function blip(frequency=650){
 if(mute||!audio)return;
 const osc=audio.createOscillator(),gain=audio.createGain();
 osc.type="sine";osc.frequency.setValueAtTime(frequency,audio.currentTime);
 osc.frequency.exponentialRampToValueAtTime(frequency*1.75,audio.currentTime+.13);
 gain.gain.setValueAtTime(.0001,audio.currentTime);
 gain.gain.exponentialRampToValueAtTime(.085,audio.currentTime+.013);
 gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.22);
 osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.23);
}
function prepareRenderer(){
 const ratio=canvas.clientWidth/Math.max(1,canvas.clientHeight);
 const width=clamp(Math.round(VIEW.height*ratio),310,960);
 // Preserve the sprite aspect ratio by changing the amount of world visible.
 // No horizontally stretched sprites on portrait iPhones.
 if(renderer&&width===VIEW.width){renderer.resize(Math.min(devicePixelRatio||1,isMobile?1:1.3));return;}
 renderer?.dispose();
 VIEW.width=width;
 renderer=createRenderer(canvas,{width,height:VIEW.height,quality:isMobile?"low":"high"});
 renderer.resize(Math.min(devicePixelRatio||1,isMobile?1:1.3));
 $("engine").textContent=renderer.backend.toUpperCase();
 $("app").dataset.backend=renderer.backend.startsWith("WebGL2")?"webgl2":"canvas2d";
 $("app").dataset.viewport=String(width);
}
const keyMap={KeyA:"left",ArrowLeft:"left",KeyD:"right",ArrowRight:"right",KeyW:"jump",Space:"jump",ArrowUp:"jump"};
function bindControls(){
 addEventListener("keydown",event=>{
  const key=keyMap[event.code];if(!key)return;
  event.preventDefault();input[key]=true;
 });
 addEventListener("keyup",event=>{
  const key=keyMap[event.code];if(!key)return;
  event.preventDefault();input[key]=false;
 });
 addEventListener("blur",()=>{input={left:false,right:false,jump:false};});
 for(const id of ["left","right","jump"]){
  const el=$(id);
  function down(e){
   e.preventDefault();input[id]=true;
   el.classList.add("active");
   try{if(e.pointerId!==undefined)el.setPointerCapture(e.pointerId)}catch{}
  }
  function up(e){e.preventDefault();input[id]=false;el.classList.remove("active");}
  el.addEventListener("pointerdown",down);el.addEventListener("pointerup",up);
  el.addEventListener("pointercancel",up);el.addEventListener("lostpointercapture",up);
 }
 $("start").addEventListener("click",()=>{
  if(started)return;started=true;$("intro").hidden=true;audioReady();
  announce("HITTA DE FEM LJUSFRAGMENTEN ✦");
 });
 $("restart").addEventListener("click",()=>{
  game=createState();wasCount=0;started=true;$("finish").hidden=true;
  updateHud();announce("ETT NYTT ÄVENTYR TAR SIN BÖRJAN");
 });
 $("sound").addEventListener("click",()=>{
  audioReady();mute=!mute;
  if(!mute)audio?.resume?.().catch(()=>{});
  $("sound").textContent=mute?"♫ LJUD AV":"♫ LJUD PÅ";
  if(!mute)blip();
 });
}
function controlInput(){
 const pads=navigator.getGamepads?.()||[];
 const pad=Array.from(pads).find(p=>p&&p.connected);
 if(!pad)return input;
 return {
  left:input.left||(pad.axes[0]??0)<-.22||Boolean(pad.buttons[14]?.pressed),
  right:input.right||(pad.axes[0]??0)>.22||Boolean(pad.buttons[15]?.pressed),
  jump:input.jump||Boolean(pad.buttons[0]?.pressed)||Boolean(pad.buttons[1]?.pressed)
 };
}
function updateHud(){
 $("collected").textContent=game.count;
 $("deaths").textContent=game.deaths;
 $("time").textContent=String(Math.floor(game.elapsed/60)).padStart(2,"0")+":"+String(Math.floor(game.elapsed%60)).padStart(2,"0");
 $("progress").style.width=game.count/RELICS.length*100+"%";
 $("objective").textContent=game.count===RELICS.length?"NÅ DEN GAMLA HELGEDOMEN":"SAMLA DE FEM LJUSEN";
}
function tick(now){
 if(stopped)return;
 requestAnimationFrame(tick);
 const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000||0));lastFrame=now;
 if(started&&!game.won){
  accumulated=Math.min(.12,accumulated+dt);
  let iterations=0;
  while(accumulated>=1/60&&iterations++<6){
   const count=game.count;
   stepPhysics(game,controlInput(),1/60);accumulated-=1/60;
   if(game.count>count){
    blip(590+game.count*120);
    announce("✦ FRAGMENT "+game.count+" / "+RELICS.length+" HITTAT");
   }
   if(game.dead){blip(180);announce("FARLIG AVGRUND — ÅTERVÄNDE TILL START");}
   if(game.won){
    $("finalStats").textContent=RELICS.length+" FRAGMENT · "+Math.floor(game.elapsed)+" SEKUNDER · "+game.deaths+" ÅTERUPPSTÅNDNA";
    $("finish").hidden=false;blip(880);
    break;
   }
  }
 }
 if(!renderer)return;
 if(isMobile&&renderTicks++%2!==0)return; // 30 FPS mobile, 60 FPS desktop
 try{
  // Avoid accumulated world-camera drift on narrow portrait viewports.
  const lights=createLights(game,now*.001);
  renderer.paint(pass=>paintLandscape(pass,game),now*.001,lights);
  if(++frameCount%20===0)updateHud();
 }catch(error){
  console.error("DuoForge 2D renderer",error);
  $("engine").textContent="RENDERFEL";
  $("boot").hidden=false;$("boot").textContent="Ett fel inträffade i 2D-motorn: "+error.message;
  stopped=true;
 }
}
try{
 prepareRenderer();bindControls();updateHud();
 $("boot").hidden=true;
 addEventListener("resize",prepareRenderer);
 requestAnimationFrame(tick);
}catch(error){
 console.error(error);$("boot").textContent="Kunde inte starta DuoForge 2D: "+error.message;
}
addEventListener("pagehide",()=>{stopped=true;renderer?.dispose();audio?.close?.();});
