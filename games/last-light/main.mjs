import * as THREE from "three";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";
import {createRescueShip} from "./ship.mjs";
import {createWorld} from "./world.mjs";
import {MISSIONS,createGameState,updateGame,compass,formatTime} from "./gameplay.mjs";
const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const isPhone=matchMedia("(max-width: 700px)").matches;
let game=createGameState(),ship,world,scene,renderer,camera;
let cameraMode="chase",quality=isPhone?"low":"high",elapsed=0,previous=0,slowFrames=0;
let audioCtx=null,soundGain=null,noise=null,rafId=null;
let keys={left:false,right:false,gas:false,brake:false};
let lastRescued=0,lastMessage=0,showFps=false,frames=0,fpsStart=performance.now();
let active=true;
function message(value,seconds=3){
 const el=$("toast");el.textContent=value;el.classList.add("visible");
 clearTimeout(lastMessage);lastMessage=setTimeout(()=>el.classList.remove("visible"),seconds*1000);
}
function updateButtons(){
 $("auto").classList.toggle("on",game.auto);$("auto").textContent=game.auto?"✦ AUTOPILOT PÅ":"✦ AUTOPILOT AV";
 $("view").textContent=cameraMode==="chase"?"◉ FÖLJKAMERA":cameraMode==="deck"?"◉ DÄCKSKAMERA":"◉ FILMKAMERA";
 $("weather").textContent=world.state.weather==="storm"?"⛈️ STORM":"🌅 SOLNEDGÅNG";
}
function setButtons(){
 const aliases={left:"left",right:"right",gas:"gas",brake:"brake"};
 for(const [id,key] of Object.entries(aliases)){
  const el=$(id);
  const down=e=>{
   e.preventDefault();if(e.pointerId!==undefined)el.setPointerCapture?.(e.pointerId);
   keys[key]=true;el.classList.add("pressed");
   if(game.auto){game.auto=false;updateButtons();}
  };
  const up=e=>{if(e?.preventDefault)e.preventDefault();keys[key]=false;el.classList.remove("pressed");};
  el.addEventListener("pointerdown",down);el.addEventListener("pointerup",up);
  el.addEventListener("pointercancel",up);el.addEventListener("lostpointercapture",up);
 }
 const keyMap={KeyW:"gas",ArrowUp:"gas",KeyS:"brake",ArrowDown:"brake",KeyA:"left",ArrowLeft:"left",KeyD:"right",ArrowRight:"right"};
 addEventListener("keydown",e=>{
  if(document.activeElement?.matches("button,input,textarea,select")&&e.key===" ")return;
  const key=keyMap[e.code];
  if(key){e.preventDefault();keys[key]=true;if(game.auto){game.auto=false;updateButtons();}}
  if(e.repeat)return;
  if(e.code==="KeyC")changeView();
  if(e.code==="KeyP")toggleAuto();
  if(e.code==="KeyM")toggleSound();
 });
 addEventListener("keyup",e=>{
  const key=keyMap[e.code];if(key){keys[key]=false;e.preventDefault();}
 });
 addEventListener("blur",()=>{for(const key of Object.keys(keys))keys[key]=false;});
 $("view").addEventListener("click",changeView);
 $("auto").addEventListener("click",toggleAuto);
 $("weather").addEventListener("click",()=>{
  world.setWeather(world.state.weather==="storm"?"storm-sunset":"storm");
  updateButtons();message(world.state.weather==="storm"?"Stormen tilltar – starkare vågor":"Solen bryter fram genom molnen");
 });
 $("sound").addEventListener("click",toggleSound);
 $("reset").addEventListener("click",reset);
 $("start").addEventListener("click",()=>{
  $("intro").hidden=true;game.started=true;
  startSound();message("NÖDSIGNAL ALPHA — följ markören i havet",4);
 });
 $("again").addEventListener("click",reset);
 $("exportShip").addEventListener("click",exportShip);
}
function changeView(){
 cameraMode=cameraMode==="chase"?"deck":cameraMode==="deck"?"cinema":"chase";
 updateButtons();
 message(cameraMode==="cinema"?"Filmisk flygkamera":cameraMode==="deck"?"Utsikt från kommandobryggan":"Tredjepersonskamera",2);
}
function toggleAuto(){
 if(!game.started||game.won||game.lost)return;
 game.auto=!game.auto;updateButtons();
 message(game.auto?"Autopilot mot nästa nödsignal aktiverad":"Manuell styrning — W A S D / touch",3);
}
function reset(){
 game=createGameState();game.started=true;game.auto=false;
 elapsed=0;lastRescued=0;cameraMode="chase";
 $("ending").hidden=true;$("intro").hidden=true;
 world.setWeather("storm-sunset");updateButtons();message("Nytt uppdrag – fyra nödsignaler väntar",3);
 startSound();
}
function playPing(){
 if(!audioCtx||!soundGain)return;
 const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
 osc.type="sine";osc.frequency.setValueAtTime(660,audioCtx.currentTime);
 osc.frequency.exponentialRampToValueAtTime(950,audioCtx.currentTime+.24);
 gain.gain.setValueAtTime(.0001,audioCtx.currentTime);
 gain.gain.exponentialRampToValueAtTime(.16,audioCtx.currentTime+.012);
 gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.56);
 osc.connect(gain).connect(soundGain);osc.start();osc.stop(audioCtx.currentTime+.57);
}
function startSound(){
 if(audioCtx){audioCtx.resume().catch(()=>{});return}
 try{
  const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
  audioCtx=new Context();
  soundGain=audioCtx.createGain();soundGain.gain.value=.28;soundGain.connect(audioCtx.destination);
  const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*2,audioCtx.sampleRate);
  const data=buffer.getChannelData(0),random=(()=>{let x=17;return()=>((x=Math.imul(x,1664525)+1013904223|0)>>>0)/4294967296;})();
  for(let i=0;i<data.length;i++)data[i]=(random()*2-1)*.6;
  const filter=audioCtx.createBiquadFilter();filter.type="lowpass";filter.frequency.value=260;
  const source=audioCtx.createBufferSource();source.buffer=buffer;source.loop=true;
  const wash=audioCtx.createGain();wash.gain.value=.24;
  source.connect(filter).connect(wash).connect(soundGain);source.start();noise=source;
  $("sound").textContent="♫ LJUD PÅ";
 }catch(e){console.warn("Optional local audio unavailable",e);$("sound").textContent="♫ LJUD EJ TILLGÄNGLIGT";}
}
function toggleSound(){
 startSound();if(!soundGain)return;
 const muted=soundGain.gain.value>.01;soundGain.gain.value=muted?0:.28;
 $("sound").textContent=muted?"♫ LJUD AV":"♫ LJUD PÅ";
}
async function exportShip(){
 const btn=$("exportShip");btn.disabled=true;btn.textContent="SKAPAR GLB…";
 try{
  const clone=ship.group.clone(true);
  // Light sources and labels are preview-only; geometry and PBR remain exportable.
  clone.traverse(obj=>{if(obj.isLight)obj.visible=false;});
  const buffer=await new GLTFExporter().parseAsync(clone,{binary:true,onlyVisible:true,maxTextureSize:1024});
  const blob=new Blob([buffer],{type:"model/gltf-binary"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="DuoForge_Aurora_Rescue_Cruiser.glb";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  message("Original 3D-fartyg exporterat som GLB",4);
 }catch(err){console.error(err);message("GLB-export misslyckades: "+err.message,6);}
 finally{btn.disabled=false;btn.textContent="⬇ HÄMTA FARTYG GLB";}
}
function finishGame(won){
 $("ending").hidden=false;
 $("endTag").textContent=won?"UPPDRAG SLUTFÖRT":"TIDEN ÄR UTE";
 $("endTitle").textContent=won?"Du räddade alla.":"Stormen vann den här gången.";
 $("endDescription").textContent=won?
  "Alla fyra besättningar är ombord. Aurora kan återvända genom gryningens ljus.":
  "Vänd tillbaka mot nödsignalerna och använd autopiloten när sikten blir för dålig.";
 $("endStats").textContent="RÄDDADE "+game.rescued+"/4 · POÄNG "+game.score.toLocaleString("sv-SE");
 playPing();
}
function drawRadar(){
 const canvas=$("radar"),ctx=canvas.getContext("2d");
 if(!ctx)return;
 const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=52;
 ctx.clearRect(0,0,w,h);
 ctx.strokeStyle="rgba(106,206,203,.42)";ctx.lineWidth=1.25;
 for(const frac of [.33,.67,1]){ctx.beginPath();ctx.arc(cx,cy,r*frac,0,Math.PI*2);ctx.stroke();}
 ctx.beginPath();ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.stroke();
 ctx.fillStyle="#a9e7d5";ctx.beginPath();ctx.moveTo(cx,cy-8);ctx.lineTo(cx-5,cy+6);ctx.lineTo(cx+5,cy+6);ctx.fill();
 const co=Math.cos(game.yaw),si=Math.sin(game.yaw);
 for(let i=0;i<MISSIONS.length;i++){
  if(i<game.rescued)continue;
  const m=MISSIONS[i],dx=m.x-game.x,dz=m.z-game.z;
  const across=dx*co+dz*si;
  const along=dx*si-dz*co;
  const scale=.42,posX=clamp(across*scale,-r+7,r-7),posY=clamp(-along*scale,-r+7,r-7);
  ctx.beginPath();ctx.arc(cx+posX,cy+posY,i===game.rescued?5:3,0,Math.PI*2);
  ctx.fillStyle=i===game.rescued?"#ffbe88":"#568b93";ctx.fill();
 }
}
function renderHud(){
 const dest=compass(game);
 $("speed").textContent=Math.round(game.speed*3.6);
 $("timer").textContent=formatTime(game.timeLimit-game.clock);
 $("rescues").textContent=game.rescued+" / "+MISSIONS.length;
 $("progressFill").style.width=(100*game.rescued/MISSIONS.length)+"%";
 const item=MISSIONS[game.rescued];
 $("missionName").textContent=item?item.name:"ALLA RÄDDADE";
 $("missionText").textContent=item?item.call:"Återvänd till hamnen.";
 $("distance").textContent=Math.round(dest.distance)+" m";
 $("direction").textContent=(Math.round(dest.difference*180/Math.PI)>0?"↗":"↖")+" "+Math.abs(Math.round(dest.difference*180/Math.PI))+"°";
 $("gear").textContent=game.auto?"AUTO":"MANUELL";
 drawRadar();
}
function prepare(){
 const canvas=$("scene"),gl=canvas.getContext("webgl2",{antialias:!isPhone,alpha:false})||canvas.getContext("webgl",{antialias:!isPhone,alpha:false});
 if(!gl)throw Error("WebGL saknas. Öppna i en webbläsare med 3D-grafik.");
 // The existing engine is WebGL. WebGPU is not represented as active.
 const debug=gl.getExtension("WEBGL_debug_renderer_info");
 const gpuName=String(debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
 const software=/swiftshader|llvmpipe|software/i.test(gpuName);
 if(software)quality="low";
 renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:!isPhone,powerPreference:"high-performance"});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=!isPhone&&quality!=="low";renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.setPixelRatio(software?.6:Math.min(devicePixelRatio||1,isPhone?1.2:1.5));
 scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(isPhone?66:61,1,.1,1250);
 camera.position.set(10,12,29);
 // Lightweight local reflection probe improves PBR without any cloud/AI API.
 try{
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const result=pmrem.fromScene(room,.04);
  scene.environment=result.texture;room.dispose();pmrem.dispose();
 }catch(err){console.warn("PBR reflection fallback",err);}
 world=createWorld({scene,quality});
 ship=createRescueShip();scene.add(ship.group);
 const resize=()=>{
  const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
  renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.fov=isPhone&&width<height?68:59;camera.updateProjectionMatrix();
 };
 new ResizeObserver(resize).observe(canvas);resize();
 window.addEventListener("resize",resize);
 setButtons();updateButtons();renderHud();
 $("boot").hidden=true;
 const now=performance.now();previous=now;fpsStart=now;rafId=requestAnimationFrame(frame);
}
function frame(now){
 if(!active)return;
 rafId=requestAnimationFrame(frame);
 const dt=clamp((now-previous)/1000,0,.055);previous=now;elapsed+=dt;frames++;
 const controls={gas:keys.gas,brake:keys.brake,steer:Number(keys.right)-Number(keys.left)};
 const wasRescued=game.rescued;
 game=updateGame(game,controls,dt);
 if(game.rescued>wasRescued){
  playPing();message("✔ "+MISSIONS[wasRescued].name+" — besättning räddad!",4);
  if(game.won)finishGame(true);
 }
 if(game.lost&&$("ending").hidden)finishGame(false);
 const waterLevel=world.ocean.heightAt(game.x,game.z,elapsed);
 const slope=world.ocean.slopeAt(game.x,game.z,elapsed);
 ship.group.position.set(game.x,waterLevel+.11,game.z);
 ship.group.rotation.set(
  clamp(slope.dz*.6,-.15,.15)+Math.sin(elapsed*1.2)*.012,
  -game.yaw,
  clamp(-slope.dx*.7,-.16,.16)+Math.cos(elapsed*1.45)*.013,"YXZ"
 );
 ship.update(elapsed,game.speed);
 world.update(elapsed,dt,game,game.rescued);
 const target=new THREE.Vector3();
 const offset=new THREE.Vector3();
 if(cameraMode==="deck"){
  target.set(0,3.25,-17);offset.set(0,4.6,-1.9);
 }else if(cameraMode==="cinema"){
  const a=elapsed*.12;
  target.set(0,1.7,0);offset.set(Math.sin(a)*19,7+Math.sin(a*.63)*4,Math.cos(a)*21);
 }else{
  target.set(0,2,-7.6);offset.set(0,9+game.speed*.13,19+game.speed*.42);
 }
 const rot=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-game.yaw);
 if(cameraMode!=="cinema")offset.applyQuaternion(rot);
 const aim=target.applyQuaternion(rot).add(ship.group.position);
 const desired=offset.add(ship.group.position);
 camera.position.lerp(desired,Math.min(1,dt*(cameraMode==="deck"?5:2.1)));
 camera.lookAt(aim);
 renderer.render(scene,camera);
 if(frames%2===0)renderHud();
 if(now-fpsStart>1500){
  const fps=frames*1000/(now-fpsStart);frames=0;fpsStart=now;
  $("fps").textContent=Math.round(fps)+" FPS";
  // Adaptive device pixel ratio: prioritize touch responsiveness on weak phones.
  if(game.started&&fps<27)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
  if(slowFrames>=3&&renderer.getPixelRatio()>0.81){
   renderer.setPixelRatio(Math.max(.8,renderer.getPixelRatio()*.83));
   const c=$("scene");renderer.setSize(c.clientWidth,c.clientHeight,false);
   slowFrames=0;message("Grafiken anpassades för jämnare spel på din enhet",3);
  }
 }
}
try{prepare()}catch(error){
 console.error(error);
 $("boot").hidden=false;$("bootMessage").textContent="Kunde inte starta 3D-motorn: "+error.message;
 $("start").disabled=true;
}
addEventListener("pagehide",()=>{active=false;cancelAnimationFrame(rafId);noise?.stop?.();audioCtx?.close?.();renderer?.dispose?.();});
