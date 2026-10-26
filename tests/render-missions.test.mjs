import test from "node:test";
import assert from "node:assert/strict";
import {checkpointReached,checkpointProgress} from "../workshop/studio/render-missions.mjs";

test("checkpoint radius includes the ring, excludes distant vehicles",()=>{
 assert.equal(checkpointReached(0,12,-1.15,12),true);
 assert.equal(checkpointReached(0,0,-1.15,12),false);
 assert.equal(checkpointReached(-1.15,12,-1.15,12),true);
 assert.equal(checkpointReached(NaN,0,0,0),false);
});
test("driving through all four gates in +Z completes the challenge",()=>{
 const points=[12,25,40,55].map((z,i)=>({x:i%2?1.15:-1.15,z}));
 let index=0,completed=false;
 for(const position of points){
  const result=checkpointProgress(index,points.length,points,position.x,position.z);
  assert.equal(result.advanced,true);
  index=result.next;completed=result.completed;
 }
 assert.equal(index,4);assert.equal(completed,true);
});
test("Vortex -Z-facing cars pass the same route in reverse Z",()=>{
 const points=[-12,-25,-40,-55].map((z,i)=>({x:i%2?1.15:-1.15,z}));
 assert.equal(checkpointProgress(0,4,points,0,-12).next,1);
 assert.equal(checkpointProgress(1,4,points,0,-12).advanced,false);
 assert.equal(checkpointProgress(1,4,points,1,-25).next,2);
});
test("validates index and never skips checkpoints",()=>{
 const positions=[{x:0,z:12},{x:0,z:25}];
 assert.deepEqual(checkpointProgress(0,2,positions,0,25),{next:0,completed:false,advanced:false});
 assert.deepEqual(checkpointProgress(9,2,positions,0,25),{next:2,completed:true,advanced:false});
});
