/**
 * DuoForge DuoPad — browser Gamepad API adapter.
 * This module does NOT claim remote QR pairing or Bluetooth setup; it supports
 * already paired standard gamepads using the browser's built-in API.
 */
const blank=()=>Object.freeze({connected:false,left:false,right:false,up:false,down:false,block:false,attack:false,heavy:false,dodge:false});
const pressed=(pad,index)=>Boolean(pad?.buttons?.[index]?.pressed);
const axis=(pad,index)=>{const v=pad?.axes?.[index];return Number.isFinite(v)?v:0};
const DEADZONE=.26;
export function readStandardPad(pad){
 if(!pad||pad.connected===false)return blank();
 const lx=axis(pad,0),ly=axis(pad,1);
 return Object.freeze({
  connected:true,
  left:lx<-DEADZONE||pressed(pad,14),
  right:lx>DEADZONE||pressed(pad,15),
  up:ly<-DEADZONE||pressed(pad,12),
  down:ly>DEADZONE||pressed(pad,13),
  block:pressed(pad,4)||pressed(pad,5),
  attack:pressed(pad,0),
  heavy:pressed(pad,2),
  dodge:pressed(pad,1)
 });
}
export function createGamepadBridge({getGamepads=()=>globalThis.navigator?.getGamepads?.()||[]}={}){
 let last=blank(),wasConnected=false;
 function poll(){
  let device=null;
  try{device=Array.from(getGamepads()||[]).find(p=>p&&p.connected!==false)||null}catch{}
  const next=readStandardPad(device);
  const edges=Object.freeze({
   attack:next.attack&&!last.attack,
   heavy:next.heavy&&!last.heavy,
   dodge:next.dodge&&!last.dodge,
   connected:next.connected&&!wasConnected
  });
  last=next;wasConnected=next.connected;
  return Object.freeze({...next,edges});
 }
 function reset(){last=blank();wasConnected=false;}
 return Object.freeze({poll,reset,get connected(){return wasConnected}});
}
