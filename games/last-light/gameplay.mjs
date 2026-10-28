// DuoForge LAST LIGHT — deterministic rescue navigation/gameplay, independent of rendering.
export const MISSIONS=Object.freeze([
 Object.freeze({x:-38,z:-75,name:"SIGNAL ALPHA",call:"Hitta den försvunna fiskebåten"}),
 Object.freeze({x:54,z:-150,name:"SIGNAL BRAVO",call:"Hämta besättningen vid reven"}),
 Object.freeze({x:-72,z:-224,name:"SIGNAL CHARLIE",call:"Följ nödsignalen genom stormen"}),
 Object.freeze({x:46,z:-300,name:"SIGNAL DELTA",call:"Sista räddningen före mörkret"})
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function distanceToTarget(state){
 const m=MISSIONS[state.rescued]||MISSIONS.at(-1);
 return Math.hypot(m.x-state.x,m.z-state.z);
}
export function createGameState(){
 return {x:0,z:26,yaw:0,speed:0,rescued:0,clock:0,timeLimit:290,started:false,
  won:false,lost:false,auto:false,score:0};
}
export function updateGame(state,input,seconds){
 if(!state.started||state.won||state.lost)return state;
 const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.05);
 const next={...state,clock:state.clock+dt};
 if(next.clock>=next.timeLimit){next.clock=next.timeLimit;next.lost=true;return next;}
 const target=MISSIONS[next.rescued];
 const distance=Math.hypot(target.x-next.x,target.z-next.z);
 let gas=!!input.gas,brake=!!input.brake,steer=clamp(Number(input.steer)||0,-1,1);
 if(next.auto){
  const ideal=Math.atan2(target.x-next.x,-(target.z-next.z));
  const difference=wrapAngle(ideal-next.yaw);
  steer=clamp(difference*1.9,-1,1);
  gas=distance>18; brake=distance<18&&next.speed>5;
 }
 const acceleration=gas?8.1:brake?-16:-3.1;
 next.speed=clamp(next.speed+acceleration*dt,0,19.5);
 next.yaw=wrapAngle(next.yaw+steer*dt*(.22+next.speed*.037));
 next.x+=Math.sin(next.yaw)*next.speed*dt;
 next.z-=Math.cos(next.yaw)*next.speed*dt;
 const arrival=Math.hypot(target.x-next.x,target.z-next.z);
 if(arrival<12&&next.speed<11){
  next.rescued++;
  next.score+=Math.round(1200+Math.max(0,next.timeLimit-next.clock)*3);
  if(next.rescued===MISSIONS.length){next.won=true;next.speed=0;}
 }
 return next;
}
export function compass(state){
 const target=MISSIONS[state.rescued];
 if(!target)return {bearing:0,distance:0,difference:0};
 const bearing=Math.atan2(target.x-state.x,-(target.z-state.z));
 return {bearing,distance:Math.hypot(target.x-state.x,target.z-state.z),difference:wrapAngle(bearing-state.yaw)};
}
export function formatTime(seconds){
 const s=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
}
