import test from "node:test";
import assert from "node:assert/strict";
import {driveStep,vehicleConfig,clamp,steeringLimit} from "../workshop/studio/living-physics.mjs";

const origin={x:0,z:0,yaw:0,speed:0,distance:0};
test("forward throttle accelerates in the vehicle's +Z axis",()=>{
 let state=origin;
 for(let i=0;i<100;i++)state=driveStep(state,{throttle:1},.016);
 assert.ok(state.speed>5&&state.speed<19);
 assert.ok(state.z>5,"car moves forward");assert.equal(state.x,0);
});
test("steering changes heading, reversing changes direction",()=>{
 let state={...origin,speed:8};
 state=driveStep(state,{steer:1},.05);
 assert.ok(state.yaw<0&&state.x<0,"right steering moves +Z car toward -X");
 const reversing=driveStep({...origin,speed:-3},{steer:1},.05);
 assert.ok(reversing.yaw>0&&reversing.z<0,"reverse gear yaws opposite to forward");
});
test("brakes reduce speed and allow reverse at rest",()=>{
 const braking=driveStep({...origin,speed:8},{brake:1},.3);
 assert.ok(braking.speed<8&&braking.speed>=0);
 const reverse=driveStep(origin,{brake:1},.3);
 assert.ok(reverse.speed<0);
});
test("no input applies drag, handbrake applies stronger drag",()=>{
 const coasting=driveStep({...origin,speed:10},{},.05);
 const locked=driveStep({...origin,speed:10},{handbrake:true},.05);
 assert.ok(coasting.speed<10);
 assert.ok(locked.speed<coasting.speed);
});
test("untrusted configuration and delta time are bounded",()=>{
 const c=vehicleConfig({maxSpeed:9999,steeringDegrees:-50,wheelBase:0,acceleration:"NaN"});
 assert.equal(c.maxSpeed,60);
 assert.equal(c.steeringDegrees,5);
 assert.equal(c.wheelBase,.5);
 assert.equal(c.acceleration,9);
 assert.equal(clamp(999,0,1),1);
 assert.equal(driveStep(origin,{throttle:1},10,c).speed,.06*c.acceleration);
});
test("simulation is deterministic for identical inputs",()=>{
 const inputs=[{throttle:1},{throttle:1,steer:.5},{brake:1},{steer:-1}];
 const run=()=>inputs.reduce((state,i)=>driveStep(state,i,.025),{...origin});
 assert.deepEqual(run(),run());
});

test("Vortex GTR facing -Z steers right toward +X and left toward -X",()=>{
 const vortex={...origin,yaw:Math.PI,speed:8,steering:0};
 const right=driveStep(vortex,{steer:1},.05);
 const left=driveStep(vortex,{steer:-1},.05);
 assert.ok(right.x>0&&right.z<0,"D/right means driver's right (+X) on -Z car");
 assert.ok(left.x<0&&left.z<0,"A/left means driver's left (-X) on -Z car");
 assert.ok(right.yaw<Math.PI);
 assert.ok(left.yaw>Math.PI);
 assert.ok(right.steerAngleDegrees>0&&left.steerAngleDegrees<0);
});
test("steering wheels react while stationary but body does not rotate in place",()=>{
 const state=driveStep(origin,{steer:1},.05);
 assert.ok(state.steerAngleDegrees>0);
 assert.equal(state.yaw,0);
 assert.equal(state.x,0);
 assert.equal(state.z,0);
});
test("reverse gear turns opposite direction with the same steering input",()=>{
 const forward=driveStep({...origin,speed:5},{steer:1},.05);
 const reverse=driveStep({...origin,speed:-5},{steer:1},.05);
 assert.ok(forward.yaw<0);
 assert.ok(reverse.yaw>0);
 assert.ok(forward.steerAngleDegrees>0&&reverse.steerAngleDegrees>0);
});
test("high-speed steering assist reduces front wheel angle",()=>{
 const low=driveStep({...origin,speed:2,steering:1},{steer:1},.05);
 const high=driveStep({...origin,speed:19,steering:1},{steer:1},.05);
 assert.ok(low.steerAngleDegrees>high.steerAngleDegrees);
 assert.ok(steeringLimit(19)<steeringLimit(2));
 assert.ok(high.steerAngleDegrees>0);
});
test("steering is smoothed, centered on release, and independent of frame rate",()=>{
 const one=driveStep(origin,{steer:1},.016);
 assert.ok(one.steering>0&&one.steering<1,"full wheel lock is not instantaneous");
 let state={...origin};
 for(let i=0;i<60;i++)state=driveStep(state,{steer:1},1/60);
 assert.ok(state.steering>.99);
 for(let i=0;i<60;i++)state=driveStep(state,{steer:0},1/60);
 assert.ok(Math.abs(state.steering)<.01);
 const run=(n,dt)=>{
  let vehicle={...origin};
  for(let i=0;i<n;i++)vehicle=driveStep(vehicle,{steer:1},dt);
  return vehicle.steering;
 };
 assert.ok(Math.abs(run(60,1/60)-run(120,1/120))<1e-10);
});
