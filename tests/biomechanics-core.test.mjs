import test from "node:test";
import assert from "node:assert/strict";
import {
 ENGINE_VERSION,HUMAN_DOF,MUSCLE_GROUPS,ACTIONS,NeuromuscularEngine,
 getJoint,setTarget,poseForAction,blendPoses,muscleForce
} from "../games/rift-champions/character-forge/biomechanics-core.mjs";

test("anatomical channel catalog has comprehensive voluntary joint targets but is explicitly an approximation",()=>{
 assert.ok(HUMAN_DOF.length>=70);
 assert.equal(MUSCLE_GROUPS.length,HUMAN_DOF.length*2);
 assert.equal(new Set(HUMAN_DOF.map(x=>x.id)).size,HUMAN_DOF.length);
 assert.equal(new Set(MUSCLE_GROUPS.map(x=>x.id)).size,MUSCLE_GROUPS.length);
 assert.ok(ACTIONS.length>=25);
 for(const channel of HUMAN_DOF){
  assert.ok(channel.limit[1]>channel.limit[0],channel.id);
  assert.equal(channel.muscles.length,2);
  for(const name of channel.muscles)assert.ok(MUSCLE_GROUPS.some(x=>x.id===name));
 }
 assert.match(ENGINE_VERSION,/neuromuscular/);
});
test("force responds to activation and stretch with finite bounded values",()=>{
 const idle=muscleForce({activation:0,length:1,maxForceN:500});
 const contracted=muscleForce({activation:1,length:1,maxForceN:500});
 const stretched=muscleForce({activation:0,length:1.4,maxForceN:500});
 assert.equal(idle.activeN,0);
 assert.ok(contracted.totalN>idle.totalN);
 assert.ok(stretched.passiveN>0);
 assert.ok(Number.isFinite(muscleForce({activation:NaN,length:Infinity,velocity:-Infinity}).totalN));
});
test("all movement presets produce safe pose channels",()=>{
 for(const action of ACTIONS){
  const p=poseForAction(action,.38,.85);
  for(const [id,value] of Object.entries(p)){
   const def=getJoint(id);
   assert.ok(Number.isFinite(value),action+" / "+id);
   assert.ok(value>=def.limit[0]*Math.PI/180-1e-10,action+" "+id);
   assert.ok(value<=def.limit[1]*Math.PI/180+1e-10,action+" "+id);
  }
 }
 assert.ok(poseForAction("squat",0,1)["left.knee.flex"]>1);
 assert.ok(poseForAction("grab",0,1)["left.index.middle"]>1);
 assert.notEqual(poseForAction("walk",.1,1)["left.hip.flex"],
  poseForAction("walk",.1,1)["right.hip.flex"]);
 assert.throws(()=>poseForAction("teleport"));
});
test("joint limits and masked pose composition do not modify inputs",()=>{
 const input={};setTarget(input,"left.elbow.flex",300);
 assert.ok(Math.abs(input["left.elbow.flex"]-152*Math.PI/180)<1e-10);
 assert.throws(()=>setTarget(input,"non-existent",90));
 const idle=poseForAction("idle",0,1),wave=poseForAction("wave",0,1);
 const mixed=blendPoses(idle,wave,.5,["left.shoulder.abd"]);
 assert.equal(mixed["right.shoulder.flex"],idle["right.shoulder.flex"]);
 assert.equal(mixed["left.shoulder.abd"],wave["left.shoulder.abd"]*.5);
 assert.notDeepEqual(mixed,idle);
});
test("muscle simulation actuates antagonists, respects joints, and is deterministic at fixed dt",()=>{
 const a=new NeuromuscularEngine(),b=new NeuromuscularEngine();
 a.setMotion("squat");b.setMotion("squat");
 for(let i=0;i<300;i++){a.step(1/120);b.step(1/120);}
 const sa=a.snapshot(),sb=b.snapshot();
 assert.deepEqual(sa.joints,sb.joints);
 assert.ok(sa.joints["left.knee.flex"]>0.2);
 assert.ok(sa.joints["left.knee.flex"]<=148*Math.PI/180+1e-5);
 assert.ok(sa.muscles["left-hamstrings"].activation>0);
 assert.ok(sa.muscles["left-quadriceps"].activation>=0);
 for(const joint of Object.values(a.joints))
  assert.ok(Number.isFinite(joint.angle)&&Number.isFinite(joint.velocity));
 for(const muscle of Object.values(a.muscles))
  assert.ok(Number.isFinite(muscle.forceN)&&muscle.forceN>=0);
});
test("custom hand and finger poses work even when their GLB bone mapping is absent",()=>{
 const engine=new NeuromuscularEngine();
 engine.setCustomPose({"right.thumb.base":55,"right.index.middle":80,"spine.twist":15});
 for(let i=0;i<130;i++)engine.step(1/120);
 assert.equal(engine.motion,"custom");
 assert.ok(engine.joints["right.thumb.base"].angle>.01);
 assert.ok(engine.joints["right.index.middle"].angle>.01);
 assert.throws(()=>engine.setCustomPose({"right.thumb.base":NaN}));
 assert.throws(()=>engine.setCustomPose({"somewhere.flex":2}));
 assert.throws(()=>engine.setCustomPose(null));
});
test("simultaneous movement overlay modifies only target limb",()=>{
 const engine=new NeuromuscularEngine();
 engine.setMotion("walk");
 engine.setOverlay("wave",{weight:1,mask:["left.shoulder.abd","left.elbow.flex"]});
 const target=engine.targetPose();
 const walk=poseForAction("walk",0,1),wave=poseForAction("wave",0,1);
 assert.equal(target["left.shoulder.abd"],wave["left.shoulder.abd"]);
 assert.equal(target["right.hip.flex"],walk["right.hip.flex"]);
 engine.setOverlay(null);
 assert.throws(()=>engine.setOverlay("invalid"));
 assert.throws(()=>engine.setOverlay("wave",{mask:["unknown"]}));
});
test("large frame stalls, zero intensity, extreme signals and reset are stable",()=>{
 const s=new NeuromuscularEngine({massKg:NaN,intensity:999});
 s.setMotion("sprint");s.step(80);
 assert.ok(Number.isFinite(s.snapshot().time));
 for(let i=0;i<280;i++)s.step(1/30);
 assert.ok(Object.values(s.snapshot().joints).every(Number.isFinite));
 s.setIntensity(0);s.setMotion("idle");s.step(0);
 const state=s.reset();assert.equal(state.motion,"idle");
 assert.ok(Math.abs(state.joints["left.knee.flex"])<1e-6);
});
