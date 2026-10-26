import test from "node:test";
import assert from "node:assert/strict";
import {driveStep,vehicleConfig,clamp} from "../workshop/studio/living-physics.mjs";

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
 assert.ok(state.yaw>0&&state.x>0);
 const reversing=driveStep({...origin,speed:-3},{steer:1},.05);
 assert.ok(reversing.yaw<0&&reversing.z<0);
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
