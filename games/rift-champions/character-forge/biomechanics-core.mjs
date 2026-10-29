/**
 * DuoForge Neuromuscular Motion V1
 *
 * Research-inspired *stylized*, joint-space simulation for game characters:
 * motor intentions -> antagonistic activation -> force-length-velocity proxy ->
 * torque + inertia + damping + soft tissue proxies -> skeletal channels.
 * NOT OpenSim, full-body biomechanics, anatomy-grade muscle attachments,
 * medical simulation, neural motion synthesis, or a claim of every human movement.
 * No imported research code or third-party runtime dependencies.
 */

export const ENGINE_VERSION="duoforge-neuromuscular-motion@1";
const TAU=2*Math.PI, RAD=Math.PI/180;
const clamp=(x,min,max)=>Math.max(min,Math.min(max,Number.isFinite(x)?x:min));
const f=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const wave=(t,phase=0)=>Math.sin(TAU*t+phase);
const p=(d)=>d*RAD;
const segments=[
 ["pelvis", "tilt",[-35,45],.75,["iliopsoas-group","gluteus-group"]],
 ["pelvis", "roll",[-22,22],.65,["oblique-right","oblique-left"]],
 ["pelvis", "turn",[-46,46],.72,["rotator-right","rotator-left"]],
 ["spine", "flex",[-40,45],.65,["rectus-abdominis","erector-spinae"]],
 ["spine", "side",[-30,30],.5,["obliques-left","obliques-right"]],
 ["spine", "twist",[-42,42],.58,["external-oblique-left","external-oblique-right"]],
 ["chest", "flex",[-30,35],.6,["upper-abdominals","thoracic-erectors"]],
 ["chest", "twist",[-45,45],.55,["internal-oblique-right","internal-oblique-left"]],
 ["neck", "pitch",[-46,65],.12,["deep-neck-flexors","splenius-cervicis"]],
 ["neck", "yaw",[-70,70],.12,["sternocleidomastoid-left","sternocleidomastoid-right"]],
 ["neck", "roll",[-32,32],.12,["scalenes-right","scalenes-left"]],
 ["jaw", "open",[0,32],.055,["digastric-group","masseter-group"]]
];
const sideSegments=[
 ["clavicle","elev",[-20,35],.19,["upper-trapezius","lower-trapezius"]],
 ["shoulder","flex",[-80,170],.27,["anterior-deltoid","posterior-deltoid"]],
 ["shoulder","abd",[-35,170],.26,["middle-deltoid","latissimus-dorsi"]],
 ["shoulder","rotate",[-85,100],.22,["infraspinatus","subscapularis"]],
 ["elbow","flex",[0,152],.12,["biceps-brachii","triceps-brachii"]],
 ["forearm","pronate",[-85,85],.10,["pronator-teres","supinator"]],
 ["wrist","flex",[-75,75],.045,["flexor-carpi-radialis","extensor-carpi-radialis"]],
 ["wrist","deviate",[-25,38],.045,["flexor-carpi-ulnaris","extensor-carpi-ulnaris"]],
 ["hip","flex",[-38,125],.9,["iliopsoas","gluteus-maximus"]],
 ["hip","abd",[-34,55],.8,["gluteus-medius","adductor-longus"]],
 ["hip","turn",[-52,55],.8,["deep-hip-rotators","hip-internal-rotators"]],
 ["knee","flex",[0,148],.43,["hamstrings","quadriceps"]],
 ["ankle","dorsi",[-50,32],.14,["tibialis-anterior","gastrocnemius-soleus"]],
 ["ankle","roll",[-32,32],.13,["peroneals","tibialis-posterior"]],
 ["toe","flex",[-40,58],.045,["flexor-hallucis-longus","extensor-hallucis-longus"]]
];
const fingers=["thumb","index","middle","ring","little"];
const degrees=[
 ...segments.map(([part,dof,limit,inertia,muscles])=>({id:part+"."+dof,part,dof,limit,inertia,muscles})),
 ...["left","right"].flatMap(side=>[
  ...sideSegments.map(([part,dof,limit,inertia,muscles])=>({
   id:side+"."+part+"."+dof,side,part,dof,limit,inertia,
   muscles:muscles.map(n=>side+"-"+n)
  })),
  ...fingers.flatMap(finger=>["base","middle","tip"].map((joint,index)=>({
   id:side+"."+finger+"."+joint,side,part:finger,dof:joint,
   limit:finger==="thumb"?[-18,55]:[0,index===0?85:115],
   inertia:.015,muscles:[side+"-"+finger+"-flexor-"+joint,side+"-"+finger+"-extensor-"+joint]
  })))
 ])
];
export const HUMAN_DOF=Object.freeze(degrees.map(x=>Object.freeze({
 ...x,limit:Object.freeze([...x.limit]),muscles:Object.freeze([...x.muscles])
})));
export const MUSCLE_GROUPS=Object.freeze(degrees.flatMap(x=>x.muscles.map((name,idx)=>Object.freeze({
 id:name,channel:x.id,action:idx===0?"positive":"negative",
 maxForceN:Math.round((x.inertia/.14+1)*240),
 leverArmM:x.inertia>.3?.045:x.inertia>.1?.033:.012,
 optimalFiberLengthM:x.inertia>.3?.14:x.inertia>.1?.11:.045,
 tendonSlackM:.12,
 activationTau:.035,deactivationTau:.080
}))));
export const ACTIONS=Object.freeze([
 "idle","walk","run","sprint","squat","sit","stand","jump","land","reach",
 "lift","push","pull","punch","kick","block","wave","climb","crawl",
 "turn","dance","bow","stretch","balance","grab","point","breathe","custom"
]);
const anatomy=new Map(HUMAN_DOF.map(x=>[x.id,x]));
const zero=()=>Object.fromEntries(HUMAN_DOF.map(x=>[x.id,0]));
const eased=(a,b,t)=>a+(b-a)*clamp(t,0,1);
export function setTarget(pose,channel,degrees){
 if(!anatomy.has(channel))throw Error("Okänd ledkanal: "+channel);
 pose[channel]=clamp(degrees,anatomy.get(channel).limit[0],anatomy.get(channel).limit[1])*RAD;
 return pose;
}
export function getJoint(id){return anatomy.get(id)||null;}
export function muscleForce({activation=0,length=1,velocity=0,maxForceN=600}={}){
 const a=clamp(activation,0,1),l=clamp(length,.35,1.9),v=clamp(velocity,-5,5),max=clamp(maxForceN,0,6000);
 // Compact normalized Hill-inspired force-length/velocity with passive stretch.
 // Intentionally omits pennation, nonlinear tendon equilibrium and 3D attachments.
 const activeLength=Math.exp(-Math.pow((l-1)/.52,2));
 const forceVelocity=v<0?1/(1+.28*-v):1+.28*v/(1+Math.abs(v));
 const passive=Math.max(0,l-1.06)**2*2.4;
 return {
  activeN:max*a*activeLength*forceVelocity,
  passiveN:max*passive,
  totalN:max*(a*activeLength*forceVelocity+passive),
  normalizedLength:l
 };
}
export function poseForAction(action,t=0,intensity=1){
 if(!ACTIONS.includes(action))throw Error("Okänt rörelsemönster: "+action);
 const pose=zero(),q=clamp(intensity,0,1),s=(id,n)=>setTarget(pose,id,n*q);
 const g=wave(Math.max(0,f(t))* (action==="sprint"?2.65:action==="run"?1.85:1.03));
 const left=(id,n)=>s("left."+id,n),right=(id,n)=>s("right."+id,n);
 const legs=(hipL,hipR,kneeL,kneeR,ankleL,ankleR)=>{
  left("hip.flex",hipL);right("hip.flex",hipR);
  left("knee.flex",kneeL);right("knee.flex",kneeR);
  left("ankle.dorsi",ankleL);right("ankle.dorsi",ankleR);
 };
 const arms=(l,r)=>{left("shoulder.flex",l);right("shoulder.flex",r);};
 switch(action){
 case "custom":break;
 case "idle":case "breathe":
  s("chest.flex",-1.5+1.5*wave(t*.22));s("spine.flex",1.2*wave(t*.22+.15));
  s("neck.yaw",3*wave(t*.09));arms(2,-2);break;
 case "walk":case "run":case "sprint":{
  const fast=action!=="walk",amp=fast?53:28;
  legs(g*amp,-g*amp,Math.max(0,-g)* (fast?78:38),Math.max(0,g)*(fast?78:38),
   -g* (fast?21:14),g*(fast?21:14));
  arms(-g*(fast?40:20),g*(fast?40:20));
  left("elbow.flex",fast?75:30);right("elbow.flex",fast?75:30);
  s("spine.twist",-g*12);s("pelvis.turn",g*10);s("chest.flex",fast?12:3);
  break;
 }
 case "squat":{
  const d=60;legs(d,d,95,95,18,18);s("pelvis.tilt",24);s("spine.flex",22);
  arms(50,50);break;
 }
 case "sit":legs(90,90,95,95,0,0);s("pelvis.tilt",10);s("spine.flex",8);break;
 case "stand":s("spine.flex",-2);break;
 case "jump":case "land":{
  const crouch=action==="jump"?Math.max(0,1-(t%1)*3):1;
  legs(20+18*crouch,20+18*crouch,28+38*crouch,28+38*crouch,-22,-22);
  arms(125,125);s("spine.flex",8+12*crouch);break;
 }
 case "reach":arms(155,145);left("shoulder.abd",12);right("shoulder.abd",-10);
  s("spine.flex",-10);s("neck.pitch",-15);break;
 case "lift":legs(38,38,60,60,7,7);arms(82,82);
  left("elbow.flex",110);right("elbow.flex",110);s("spine.flex",14);break;
 case "push":arms(83,83);left("elbow.flex",15);right("elbow.flex",15);
  s("chest.flex",8);break;
 case "pull":arms(25,25);left("elbow.flex",128);right("elbow.flex",128);
  s("spine.flex",-12);break;
 case "punch":{
  const e=Math.max(0,Math.sin(Math.min(1,(t%1)) *Math.PI));
  right("shoulder.flex",55+34*e);right("elbow.flex",110*(1-e));
  left("elbow.flex",95);left("shoulder.flex",36);
  s("chest.twist",16*e);s("pelvis.turn",-12*e);break;
 }
 case "kick":left("hip.flex",85);left("knee.flex",Math.max(5,70*(1-Math.abs(g))));
  right("knee.flex",16);s("pelvis.roll",9);arms(30,-20);break;
 case "block":left("shoulder.flex",90);right("shoulder.flex",90);
  left("elbow.flex",125);right("elbow.flex",125);s("spine.flex",12);break;
 case "wave":left("shoulder.abd",145);left("elbow.flex",55+18*g);
  left("wrist.flex",20*g);s("neck.yaw",13);break;
 case "climb":arms(140+25*g,140-25*g);left("elbow.flex",40+20*g);
  right("elbow.flex",40-20*g);legs(55*g,-55*g,Math.max(0,50*g),Math.max(0,-50*g),0,0);break;
 case "crawl":s("spine.flex",28);s("pelvis.tilt",20);
  arms(95+30*g,95-30*g);legs(56*g,-56*g,42,42,0,0);break;
 case "turn":s("pelvis.turn",38);s("spine.twist",35);s("chest.twist",28);
  s("neck.yaw",30);break;
 case "dance":s("pelvis.roll",16*g);s("spine.twist",-25*g);
  arms(55+35*g,55-35*g);legs(20*g,-20*g,18,18,0,0);break;
 case "bow":s("pelvis.tilt",29);s("spine.flex",36);s("neck.pitch",19);break;
 case "stretch":arms(160,160);s("spine.flex",-22);s("chest.flex",-13);
  s("neck.pitch",-9);break;
 case "balance":arms(75,75);left("shoulder.abd",85);right("shoulder.abd",85);
  left("hip.abd",31);left("knee.flex",60);s("pelvis.roll",8);break;
 case "grab":arms(58,58);left("elbow.flex",70);right("elbow.flex",70);
  for(const side of ["left","right"])for(const finger of fingers)
   for(const phalanx of ["base","middle","tip"])s(side+"."+finger+"."+phalanx,68);
  break;
 case "point":right("shoulder.flex",82);right("elbow.flex",7);
  for(const finger of ["middle","ring","little"]){
   for(const phalanx of ["base","middle","tip"])right(finger+"."+phalanx,66);
  }break;
 }
 return pose;
}
export function blendPoses(base,overlay,weight=1,mask=null){
 const out={...base},w=clamp(weight,0,1);
 for(const def of HUMAN_DOF)if(!mask||mask.includes(def.id)){
  const id=def.id;out[id]=eased(f(base[id]),f(overlay[id]),w);
 }
 return out;
}
export class NeuromuscularEngine{
 constructor({massKg=75,intensity=1,stiffness=18,damping=5.5}={}){
  this.massKg=clamp(massKg,20,250);this.intensity=clamp(intensity,0,1);
  this.stiffness=clamp(stiffness,5,65);this.damping=clamp(damping,1,25);
  this.motion="idle";this.time=0;this.transition=1;this.fromPose=zero();
  this.customPose=zero();this.overlay=null;
  this.joints=Object.fromEntries(HUMAN_DOF.map(d=>[d.id,{angle:0,velocity:0,target:0}]));
  this.muscles=Object.fromEntries(MUSCLE_GROUPS.map(m=>[m.id,{activation:0,excitation:0,
   length:1,velocity:0,forceN:0,tendonForceN:0}]));
  this.muscleDefs=new Map(MUSCLE_GROUPS.map(m=>[m.id,m]));
  this.accumulator=0;this.expression="neutral";this.face={jawOpen:0,blinkLeft:0,blinkRight:0,browAngry:0,smile:0,pain:0,snarl:0,surprise:0};
  this.footContact={left:true,right:true};
 }
 setMotion(motion,{crossfade=.30}={}){
  if(!ACTIONS.includes(motion))throw Error("Rörelsemönstret saknas: "+motion);
  if(motion===this.motion)return;
  this.fromPose=this.currentPose();this.motion=motion;this.time=0;
  this.fadeDuration=clamp(crossfade,.05,2);this.transition=0;
 }
 setIntensity(value){this.intensity=clamp(value,0,1);}
 setCustomPose(input,{crossfade=.3}={}){
  if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Ange målposition per ledkanal.");
  const pose=zero();
  for(const [id,value] of Object.entries(input)){
   if(!Number.isFinite(value))throw Error("Ogiltig ledvinkel: "+id);
   setTarget(pose,id,value);
  }
  this.customPose=pose;
  if(this.motion==="custom"){
   this.fromPose=this.currentPose();this.transition=0;this.fadeDuration=clamp(crossfade,.05,2);
  }else this.setMotion("custom",{crossfade});
 }
 setOverlay(action,{weight=.5,mask=null}={}){
  if(action===null){this.overlay=null;return;}
  if(!ACTIONS.includes(action)||action==="custom")throw Error("Ogiltig överlagring.");
  if(mask!==null&&(!Array.isArray(mask)||mask.some(x=>!anatomy.has(x))))throw Error("Ogiltig ledmask.");
  this.overlay={action,weight:clamp(weight,0,1),mask};
 }
 currentPose(){return Object.fromEntries(Object.entries(this.joints).map(([k,v])=>[k,v.angle]));}
 targetPose(){
  let to=this.motion==="custom"?this.customPose:poseForAction(this.motion,this.time,this.intensity);
  if(this.overlay)to=blendPoses(to,poseForAction(this.overlay.action,this.time,this.intensity),
   this.overlay.weight,this.overlay.mask);
  return this.transition<1?blendPoses(this.fromPose,to,this.transition):to;
 }
 step(dt){
  // Deterministic bounded fixed sub-steps: supports 30/60/120fps but caps stalls.
  const elapsed=clamp(dt,0,.05);this.accumulator=Math.min(.15,this.accumulator+elapsed);
  let n=0;
  while(this.accumulator>=1/120-1e-10&&n<8){
   this.substep(1/120);this.accumulator-=1/120;n++;
  }
  return this.snapshot();
 }
 substep(h){
  this.time+=h;this.transition=clamp(this.transition+h/(this.fadeDuration||.3),0,1);
  const targets=this.targetPose();
  for(const def of HUMAN_DOF){
   const joint=this.joints[def.id],target=clamp(f(targets[def.id])/RAD,def.limit[0],def.limit[1])*RAD;
   joint.target=target;
   const angularError=target-joint.angle;
   // Commanded restorative torque. Antagonistic muscles receive separate excitation.
   const command=clamp(this.stiffness*angularError-this.damping*joint.velocity,
    -28,28);
   let torque=0;
   for(let side=0;side<2;side++){
    const name=def.muscles[side],muscle=this.muscles[name],config=this.muscleDefs.get(name);
    const direction=side===0?1:-1;
    muscle.excitation=clamp(.025+direction*command/25,0,1);
    const tau=muscle.excitation>muscle.activation?config.activationTau:config.deactivationTau;
    muscle.activation+= (muscle.excitation-muscle.activation)*(1-Math.exp(-h/tau));
    const range=Math.max(.20,(def.limit[1]-def.limit[0])*RAD);
    const length=clamp(1-direction*joint.angle/range*.45,.55,1.65);
    const velocity=(length-muscle.length)/h;
    muscle.length=length;muscle.velocity=velocity;
    const fs=muscleForce({activation:muscle.activation,length,
      velocity:velocity/2,maxForceN:config.maxForceN});
    muscle.forceN=fs.totalN;
    muscle.tendonForceN=fs.totalN*.97; // visual proxy; no solved tendon equilibrium
    torque+=direction*(fs.activeN*.045+fs.passiveN*.015);
   }
   const inertia=def.inertia*(this.massKg/75);
   const accel=clamp((torque-joint.velocity*(1.4+def.inertia*3)
     -joint.angle*.8)/inertia,-170,170);
   joint.velocity=clamp(joint.velocity+accel*h,-13,13);
   joint.angle+=joint.velocity*h;
   const lo=def.limit[0]*RAD,hi=def.limit[1]*RAD;
   if(joint.angle<lo){joint.angle=lo;joint.velocity=Math.max(0,joint.velocity)*.15;}
   if(joint.angle>hi){joint.angle=hi;joint.velocity=Math.min(0,joint.velocity)*.15;}
  }
  // Joint-space foot contact proxy for animation: not real inverse dynamics or terrain IK.
  const phase=wave(this.time*(this.motion==="sprint"?2.65:this.motion==="run"?1.85:1.03));
  this.footContact.left=!["walk","run","sprint","climb"].includes(this.motion)||phase<.35;
  this.footContact.right=!["walk","run","sprint","climb"].includes(this.motion)||phase>-.35;
  const eyebrow=["punch","kick","lift"].includes(this.motion)?.55:0;
  const blink=Math.pow(Math.max(0,wave(this.time*.34)),16);
  this.face.browAngry=eased(this.face.browAngry,eyebrow,.13);
  this.face.blinkLeft=eased(this.face.blinkLeft,blink,.28);
  this.face.blinkRight=eased(this.face.blinkRight,blink,.28);
  this.face.jawOpen=eased(this.face.jawOpen,this.motion==="breathe"?.09:0,.12);
  this.face.smile=eased(this.face.smile,this.motion==="dance"?.35:0,.09);
 }
 snapshot(){
  const live=Object.entries(this.muscles).sort((a,b)=>b[1].activation-a[1].activation).slice(0,8);
  return {
   version:ENGINE_VERSION,motion:this.motion,time:this.time,
   joints:Object.fromEntries(Object.entries(this.joints).map(([k,v])=>[k,Number(v.angle.toFixed(5))])),
   muscles:this.muscles,face:{...this.face},footContact:{...this.footContact},
   strongest:live.map(([name,m])=>({name,activation:Number(m.activation.toFixed(3)),
    forceN:Math.round(m.forceN)}))
  };
 }
 reset(){
  const model=new NeuromuscularEngine({massKg:this.massKg,intensity:this.intensity,
   stiffness:this.stiffness,damping:this.damping});
  Object.assign(this,model);return this.snapshot();
 }
}
