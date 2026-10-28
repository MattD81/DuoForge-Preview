import test from "node:test";
import assert from "node:assert/strict";
import {
 FUSION_VERSION,sceneDNA,normalizeScene,sceneRole,projectedImportance,
 planDetailBudget,createTemporalBudgetGovernor,createCinemaPlan,cameraAt
} from "../workshop/studio/fusion-engine.mjs";

const scene=[
 {id:"hero",name:"Fighter",center:[0,0,-6],radius:1,triangles:100000,skinned:true,geometry:"humanoid",material:"skin"},
 {id:"forest",name:"Tree oak",center:[3,0,-9],radius:1.5,triangles:70000,geometry:"treeA",material:"leaf"},
 {id:"copied",name:"Tree oak copy",center:[6,0,-12],radius:1.5,triangles:70000,geometry:"treeA",material:"leaf"},
 {id:"off",name:"Rock",center:[0,0,20],radius:1,triangles:30000,geometry:"stone",material:"gray"}
];
const camera={position:[0,1,0],direction:[0,0,-1],heightPixels:900,fovDegrees:55,near:.1,far:100};
test("SceneDNA groups probable geometry reuse without declaring cryptographic identity",()=>{
 const copy=structuredClone(scene);
 const one=sceneDNA(copy),two=sceneDNA([...copy].reverse());
 assert.equal(one.sceneKey,two.sceneKey);
 assert.equal(one.approximateGeometryMatches.length,1);
 assert.equal(one.approximateGeometryMatches[0].items.length,2);
 assert.equal(one.precision,"heuristic-not-cryptographic");
 assert.deepEqual(scene,copy,"SceneDNA never mutates source");
});
test("classification protects rigged characters and moving vehicle parts",()=>{
 assert.equal(sceneRole("Kart front wheel"),"vehicle");
 assert.equal(sceneRole("some mesh",{skinned:true}),"actor");
 const normalized=normalizeScene(scene);
 assert.equal(normalized[0].critical,true);
 assert.equal(normalized[1].critical,false);
 assert.throws(()=>normalizeScene(new Array(1001).fill({})),/för stor/);
});
test("camera geometry importance is distance-sensitive and marks behind targets",()=>{
 const forward=projectedImportance(scene[0],camera),hidden=projectedImportance(scene[3],camera);
 assert.ok(forward.pixels>50);
 assert.ok(hidden.behind);
 assert.equal(hidden.importance,0);
});
test("budget planner protects hero, de-prioritizes invisible/distant props, stays analysis-only",()=>{
 const original=structuredClone(scene);
 const r=planDetailBudget(scene,camera,{triangleBudget:110000});
 assert.equal(r.mode,"analysis-only");
 assert.equal(r.budget,110000);
 assert.equal(r.decisions[0].critical,true);
 assert.equal(r.decisions[3].suggestedTriangles,0);
 assert.ok(r.estimatedSavings>0);
 assert.deepEqual(scene,original);
 const previous=r.decisions,again=planDetailBudget(scene,camera,{triangleBudget:110000,previous});
 assert.deepEqual(again.decisions,previous);
});
test("when critical models cannot fit, budget exceedance is transparently reported",()=>{
 const actors=[{id:"a",name:"Actor",triangles:20000,center:[0,0,-5],radius:1,skinned:true},
  {id:"b",name:"Actor 2",triangles:20000,center:[1,0,-6],radius:1,skinned:true}];
 const r=planDetailBudget(actors,camera,{triangleBudget:1000});
 assert.equal(r.overBudget,true);
 assert.ok(r.plannedTriangles>r.budget);
});
test("temporal governor does not immediately react to single frames, reduces quality under sustained load and recovers with hysteresis",()=>{
 const control=createTemporalBudgetGovernor({targetFps:60,minScale:.6,maxScale:1,windowFrames:12});
 for(let i=0;i<23;i++)control.sample(34);
 assert.equal(control.getState().scale,1);
 control.sample(34);
 assert.ok(control.getState().scale<1);
 const reduced=control.getState().scale;
 control.sample(300);assert.equal(control.getState().scale,reduced,"Invalid frame skipped");
 for(let i=0;i<200;i++)control.sample(7);
 assert.ok(control.getState().scale>reduced,"Recovery after sustained fast frames");
 control.reset();assert.equal(control.getState().scale,1);
});
test("automatic director constructs five editable film shots covering real scene bounds",()=>{
 const plan=createCinemaPlan(scene,{name:"3D experiment",aspect:16/9});
 assert.equal(plan.shots.length,5);
 assert.equal(plan.seconds,25);
 assert.equal(plan.hero,"Fighter");
 assert.equal(plan.format,"duoforge-cinema-fusion@1");
 assert.notDeepEqual(plan.shots[0].camera.position,plan.shots[1].camera.position);
 for(const t of [0,.5,5,9.2,15,24.99,25]){
  const pose=cameraAt(plan,t);
  assert.ok(pose.position.every(Number.isFinite));
  assert.ok(pose.target.every(Number.isFinite));
 }
 assert.deepEqual(cameraAt(plan,0).position,plan.shots[0].camera.position);
 assert.throws(()=>createCinemaPlan([]),/synlig/);
});
