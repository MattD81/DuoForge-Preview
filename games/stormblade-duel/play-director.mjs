/**
 * DuoForge Play Director V1 — camera logic shared by any arena-style game.
 * Device-independent, deterministic framing: game rules do not depend on
 * render FPS, and no position/physics is modified by the camera.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;

/** Pure framing solver; coordinates use local ship X/Z with the ship along Z. */
export function computeDuelFraming(a={},b={},aspect=16/9,{impact=0,cinematic=true}={}){
 const ax=finite(a.x),az=finite(a.z),bx=finite(b.x),bz=finite(b.z);
 const midpointX=(ax+bx)*.5,midpointZ=(az+bz)*.5;
 const separation=Math.hypot(ax-bx,az-bz);
 const portrait=finite(aspect,1)<.82;
 const narrow=finite(aspect,1)<1.2;
 const leadZ=clamp(midpointZ,-4.8,4.8);
 const distance=clamp(separation,1.0,7.0);
 const base=narrow?(portrait?18.6:16.2):13.8;
 const zoom=cinematic?clamp((distance-3.2)*.25,-.6,1.1):0;
 return Object.freeze({
  eyeX:clamp(midpointX*.48,-1.55,1.55),
  eyeY:portrait?7.7:narrow?7.0:6.35,
  eyeZ:base+zoom+leadZ*.72,
  lookX:midpointX*.37,
  lookY:portrait?1.52:1.60,
  lookZ:leadZ*.63,
  fov:portrait?58:narrow?53:47,
  impact:clamp(finite(impact),0,1)
 });
}
export function createDuoForgePlayDirector({camera,world,canvas,env=globalThis}){
 if(!camera||!world?.player||!world?.opponent)throw Error("Play Director needs a camera and two fighters");
 let impact=0,phase=0,enabled=true,visible=true,lastFov=null;
 const target=()=>computeDuelFraming(
  world.player.root.position,world.opponent.root.position,
  Math.max(.3,(canvas?.clientWidth||1)/(canvas?.clientHeight||1)),{impact,cinematic:enabled}
 );
 function hit({heavy=false,blocked=false}={}){
  impact=Math.max(impact,blocked?.16:heavy?.82:.45);
 }
 function reset(){
  impact=0;phase=0;
  const p=target();
  camera.position.set(p.eyeX,p.eyeY,p.eyeZ);
  camera.lookAt(p.lookX,p.lookY,p.lookZ);
  camera.fov=p.fov;
  camera.updateProjectionMatrix();
  lastFov=p.fov;
 }
 function update(dt){
  if(!visible)return;
  const step=clamp(finite(dt),0,.08);
  phase+=step;
  impact*=Math.exp(-step*10);
  if(impact<.003)impact=0;
  const p=target();
  const alpha=1-Math.exp(-step*3.3);
  const shake=impact*impact*.16;
  // Smooth deterministic vibration, no Math.random camera teleportation.
  const dx=shake*Math.sin(phase*47.5);
  const dy=shake*.48*Math.sin(phase*61.7);
  camera.position.x+=(p.eyeX+dx-camera.position.x)*alpha;
  camera.position.y+=(p.eyeY+dy-camera.position.y)*alpha;
  camera.position.z+=(p.eyeZ-impact*.32-camera.position.z)*alpha;
  camera.lookAt(p.lookX,p.lookY,p.lookZ);
  const targetFov=p.fov-impact*1.8;
  camera.fov+=(targetFov-camera.fov)*alpha;
  if(lastFov===null||Math.abs(lastFov-camera.fov)>.09){
   camera.updateProjectionMatrix();
   lastFov=camera.fov;
  }
 }
 function setEnabled(value){enabled=Boolean(value);return enabled;}
 function info(){return Object.freeze({version:"DuoForge Play Director V1",enabled,impact:Math.round(impact*100)/100});}
 reset();
 return Object.freeze({hit,reset,update,setEnabled,info});
}
