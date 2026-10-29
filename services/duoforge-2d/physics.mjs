/**
 * DuoForge 2D Deluxe: deterministic fixed-step platform physics.
 * Pure ES module, no dependencies or paid packages.
 * Coordinates: x rightward, y downward, actor.x = center, actor.y = feet.
 */
export const VIEW={width:960,height:540,worldWidth:2400,ground:432};
export const SOLIDS=Object.freeze([
 {x:0,y:432,w:530,h:120,type:"earth"},
 {x:620,y:432,w:520,h:120,type:"earth"},
 {x:1225,y:432,w:435,h:120,type:"earth"},
 {x:1745,y:432,w:655,h:120,type:"earth"},
 {x:270,y:354,w:154,h:19,type:"stone"},
 {x:762,y:344,w:167,h:20,type:"stone"},
 {x:1332,y:349,w:167,h:20,type:"stone"},
 {x:1895,y:349,w:153,h:19,type:"stone"},
 {x:1000,y:388,w:87,h:15,type:"stone"}
]);
export const RELICS=Object.freeze([
 {x:355,y:298},
 {x:828,y:288},
 {x:1268,y:383},
 {x:1424,y:293},
 {x:1968,y:294}
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const intersects=(x,y,w,h,b)=>x<b.x+b.w&&x+w>b.x&&y<b.y+b.h&&y+h>b.y;
export function createState(){
 return {
  player:{x:80,y:431,vx:0,vy:0,width:23,height:46,facing:1,onGround:true,coyote:.1,jumpBuffer:0,pose:0},
  collected:RELICS.map(()=>false),count:0,won:false,dead:false,deaths:0,elapsed:0,checkpoint:{x:80,y:431},
  cameraX:0,jumps:0,particles:[]
 };
}
export function stepPhysics(state,input={},dt=1/60){
 const p=state.player;
 const frame=clamp(dt,0,.04);
 if(state.won)return state;
 const left=Boolean(input.left),right=Boolean(input.right),jump=Boolean(input.jump);
 const steer=Number(right)-Number(left);
 state.elapsed+=frame;
 p.vx+=(steer*245-p.vx)*Math.min(1,frame*(p.onGround?12:7.2));
 if(steer!==0)p.facing=steer;
 p.coyote=p.onGround?.105:Math.max(0,p.coyote-frame);
 p.jumpBuffer=jump?.13:Math.max(0,p.jumpBuffer-frame);
 if(p.jumpBuffer>0&&p.coyote>0){
  p.vy=-505;p.onGround=false;p.coyote=0;p.jumpBuffer=0;state.jumps++;
 }
 // Variable-height jump: release early for fine-grained mobile control.
 if(!jump&&p.vy<-150)p.vy+=(p.vy+505)*-frame*.1+frame*810;
 p.vy=clamp(p.vy+1400*frame,-850,790);
 const oldX=p.x;
 p.x=clamp(p.x+p.vx*frame,p.width/2,VIEW.worldWidth-p.width/2);
 for(const b of SOLIDS){
  if(!intersects(p.x-p.width/2,p.y-p.height,p.width,p.height,b))continue;
  if(p.vx>0&&oldX+p.width/2<=b.x+.01)p.x=b.x-p.width/2;
  else if(p.vx<0&&oldX-p.width/2>=b.x+b.w-.01)p.x=b.x+b.w+p.width/2;
 }
 const previousFeet=p.y,previousTop=p.y-p.height;
 p.y+=p.vy*frame;p.onGround=false;
 for(const b of SOLIDS){
  if(!intersects(p.x-p.width/2,p.y-p.height,p.width,p.height,b))continue;
  if(p.vy>=0&&previousFeet<=b.y+.02){
   p.y=b.y;p.vy=0;p.onGround=true;
  }else if(p.vy<0&&previousTop>=b.y+b.h-.02){
   p.y=b.y+b.h+p.height;p.vy=0;
  }
 }
 p.pose+=Math.abs(p.vx)*frame/18;
 for(let i=0;i<RELICS.length;i++){
  if(state.collected[i])continue;
  const r=RELICS[i];
  if(Math.hypot(p.x-r.x,p.y-25-r.y)<35){
   state.collected[i]=true;state.count++;
   state.particles.push({x:r.x,y:r.y,time:0,life:.85,kind:"relic"});
  }
 }
 for(const e of state.particles)e.time+=frame;
 state.particles=state.particles.filter(e=>e.time<e.life);
 if(p.y>VIEW.height+130){
  state.deaths++;state.dead=true;p.x=state.checkpoint.x;p.y=state.checkpoint.y;p.vx=0;p.vy=0;p.onGround=false;
 }else state.dead=false;
 if(p.x>=2250&&state.count===RELICS.length){state.won=true;p.vx=0;p.vy=0;}
 state.cameraX=clamp(state.cameraX+(clamp(p.x-340,0,VIEW.worldWidth-VIEW.width)-state.cameraX)*Math.min(1,frame*6),0,VIEW.worldWidth-VIEW.width);
 return state;
}
export function simulate(inputs=[],state=createState()){
 for(const [input,frames] of inputs)for(let i=0;i<frames;i++)stepPhysics(state,input);
 return state;
}
