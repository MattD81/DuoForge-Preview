// AETHERFALL gameplay — deterministic, platform-independent simulation.
// No 3D library dependency: testable without GPU, browser or paid services.
export const LEVELS=Object.freeze([
 {name:"SOLTEMPLET",subtitle:"Den första gnistan",sky:0x172b46,haze:0xa06d52,
  cores:[[-14,-7],[15,-3],[0,-16]],enemies:[[-7,3],[8,-6],[-3,-13],[12,9]],requiredKills:2,enemySpeed:2.4},
 {name:"ÅSKKLYFTAN",subtitle:"Stormens hjärta",sky:0x090e26,haze:0x445b83,
  cores:[[-16,-10],[14,9],[2,-17]],enemies:[[-8,-2],[6,-8],[13,-12],[-12,9],[4,5],[-3,-16]],requiredKills:3,enemySpeed:3.1},
 {name:"NATTKRONAN",subtitle:"Försvara världarnas ljus",sky:0x100b27,haze:0x67426b,
  cores:[[-16,-14],[15,-14],[0,8]],enemies:[[-8,-5],[9,-4],[-14,5],[14,4],[0,-13],[5,-18],[-5,-17]],requiredKills:4,enemySpeed:3.5}
]);
export const PORTAL=Object.freeze({x:0,z:-20});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const norm=(x,z)=>{const l=Math.hypot(x,z)||1;return {x:x/l,z:z/l}};
const enemy=(id,x,z,level)=>({id,x,z,hp:level===2?85:level===1?70:55,phase:id*.73,
  cooldown:.7+(id%3)*.4,hitFlash:0,alive:true,kind:id%3});
export function startGame(level=0,carry=null){
 const safe=clamp(Math.floor(Number.isFinite(level)?level:0),0,LEVELS.length-1);
 const cfg=LEVELS[safe];
 return {
  level:safe,status:"playing",time:0,score:carry?.score||0,kills:0,combo:0,
  player:{x:0,z:12,y:0,vy:0,hp:carry?.hp?Math.max(70,carry.hp):100,energy:100,
   invuln:0,dashTime:0,dashCooldown:0,attackCooldown:0,attackFlash:0,
   facingX:0,facingZ:-1,healCount:0},
  cores:cfg.cores.map(([x,z],id)=>({id,x,z,got:false})),
  enemies:cfg.enemies.map(([x,z],id)=>enemy(id,x,z,safe)),
  requiredKills:cfg.requiredKills,
  portalOpen:false,transition:0,events:[]
 };
}
export function canOpenPortal(state){
 return state.cores.every(c=>c.got)&&state.kills>=state.requiredKills;
}
function enemyHit(state,e,damage,events){
 if(!e.alive)return;
 e.hp-=damage;e.hitFlash=.24;
 events.push({type:"hit",x:e.x,z:e.z,damage});
 if(e.hp<=0){
  e.alive=false;state.kills++;state.combo++;state.score+=120*state.combo;
  state.player.energy=clamp(state.player.energy+13,0,100);
  events.push({type:"kill",x:e.x,z:e.z});
  if(state.kills%2===0){state.player.hp=clamp(state.player.hp+16,0,100);events.push({type:"heal",x:e.x,z:e.z});}
 }
}
export function step(state,rawInput={},dt=.016){
 if(state.status!=="playing")return state;
 const dtSafe=clamp(Number.isFinite(dt)?dt:.016,0,.05);
 if(!dtSafe)return state;
 const input={
  x:clamp(Number(rawInput.x)||0,-1,1),z:clamp(Number(rawInput.z)||0,-1,1),
  jump:!!rawInput.jump,attack:!!rawInput.attack,dash:!!rawInput.dash,pulse:!!rawInput.pulse
 };
 const p=state.player,events=[],cfg=LEVELS[state.level];
 state.time+=dtSafe;
 for(const key of ["invuln","dashTime","dashCooldown","attackCooldown","attackFlash"])
  p[key]=Math.max(0,p[key]-dtSafe);
 p.energy=clamp(p.energy+dtSafe*6,0,100);
 let mx=input.x,mz=input.z,mag=Math.hypot(mx,mz);
 if(mag>1){mx/=mag;mz/=mag;mag=1;}
 if(mag>.1){const d=norm(mx,mz);p.facingX=d.x;p.facingZ=d.z;}
 if(input.dash&&p.dashCooldown<=0&&p.energy>=20){
  p.dashTime=.21;p.dashCooldown=.8;p.energy-=20;p.invuln=Math.max(p.invuln,.26);
  events.push({type:"dash",x:p.x,z:p.z});
 }
 const speed=p.dashTime>0?21:6.9;
 p.x=clamp(p.x+((p.dashTime>0?p.facingX:mx)*speed*dtSafe),-24.4,24.4);
 p.z=clamp(p.z+((p.dashTime>0?p.facingZ:mz)*speed*dtSafe),-24.4,24.4);
 // Arena: round, no walking through the cliff edge.
 const r=Math.hypot(p.x,p.z);
 if(r>24.2){p.x*=24.2/r;p.z*=24.2/r;}
 if(input.jump&&p.y<.01){p.vy=9.6;events.push({type:"jump",x:p.x,z:p.z});}
 p.y=Math.max(0,p.y+p.vy*dtSafe);
 p.vy=p.y===0?0:p.vy-24*dtSafe;
 if(input.attack&&p.attackCooldown<=0){
  p.attackCooldown=.34;p.attackFlash=.25;
  const victims=state.enemies.filter(e=>e.alive&&distance(e,p)<3.7&&
   ((e.x-p.x)*p.facingX+(e.z-p.z)*p.facingZ)>-1.7);
  for(const e of victims)enemyHit(state,e,33,events);
  events.push({type:"slash",x:p.x,z:p.z,hit:victims.length>0});
 }
 if(input.pulse&&p.energy>=42&&p.attackCooldown<=0){
  p.energy-=42;p.attackCooldown=.7;p.attackFlash=.38;
  const victims=state.enemies.filter(e=>e.alive&&distance(e,p)<6.8);
  for(const e of victims)enemyHit(state,e,55,events);
  events.push({type:"pulse",x:p.x,z:p.z,hit:victims.length>0});
 }
 for(const c of state.cores){
  if(c.got||distance(c,p)>=2.1)continue;
  c.got=true;state.score+=250;p.energy=clamp(p.energy+25,0,100);
  events.push({type:"core",x:c.x,z:c.z});
 }
 for(const e of state.enemies){
  if(!e.alive)continue;
  e.hitFlash=Math.max(0,e.hitFlash-dtSafe);
  e.phase+=dtSafe;
  const d=distance(e,p);
  if(d>1.7&&d<23){
   const direction=norm(p.x-e.x,p.z-e.z),stride=(cfg.enemySpeed+(e.kind===2?.5:0))*dtSafe;
   e.x+=direction.x*stride;e.z+=direction.z*stride;
  }
  e.cooldown-=dtSafe;
  if(d<2.8&&e.cooldown<=0){
   e.cooldown=.8+(e.id%3)*.28;
   if(p.invuln<=0){
    p.hp=clamp(p.hp-(state.level===2?17:state.level===1?13:10),0,100);
    p.invuln=.7;state.combo=0;
    events.push({type:"hurt",x:p.x,z:p.z});
   }
  }
 }
 const previousOpen=state.portalOpen;
 state.portalOpen=canOpenPortal(state);
 if(!previousOpen&&state.portalOpen)events.push({type:"portal",x:PORTAL.x,z:PORTAL.z});
 if(state.portalOpen&&distance(p,PORTAL)<3.2){
  if(state.level===LEVELS.length-1){
   state.status="won";events.push({type:"victory",x:p.x,z:p.z});
  }else{
   state.status="level-complete";state.transition=1.7;
   events.push({type:"level-complete",x:p.x,z:p.z});
  }
 }
 if(p.hp<=0){state.status="dead";events.push({type:"dead",x:p.x,z:p.z});}
 state.events=events;
 return state;
}
export function advanceLevel(state){
 if(state.status!=="level-complete")throw Error("Nivån är inte avklarad.");
 return startGame(state.level+1,{score:state.score+500,hp:state.player.hp});
}
