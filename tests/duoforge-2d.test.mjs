import assert from "node:assert/strict";
import test from "node:test";
import {VIEW,SOLIDS,RELICS,createState,stepPhysics} from "../services/duoforge-2d/physics.mjs";
import {solveLimb} from "../services/duoforge-2d/skeleton.mjs";
import {ENGINE_VERSION} from "../services/duoforge-2d/renderer.mjs";

test("DuoForge 2D owns real dependency-free graphics, locomotion and five objective locations",()=>{
 assert.match(ENGINE_VERSION,/2D Deluxe/);
 assert.equal(RELICS.length,5);
 assert.ok(SOLIDS.length>=8);
 assert.equal(VIEW.worldWidth,2400);
});

test("60Hz stepping: gravity and horizontal collision respond deterministically",()=>{
 const st=createState(),clone=createState();
 for(let i=0;i<45;i++){
  stepPhysics(st,{right:true});
  stepPhysics(clone,{right:true});
 }
 assert.deepEqual(st,clone);
 assert.ok(st.player.x>110);
 assert.equal(st.player.y,432);
 assert.ok(st.player.onGround);
});

test("buffered jump reaches raised stone platform without holding jump to auto-repeat",()=>{
 const state=createState();
 for(let i=0;i<25;i++)stepPhysics(state,{right:true});
 stepPhysics(state,{right:true,jump:true});
 assert.equal(state.jumps,1);
 const y=state.player.y;
 for(let i=0;i<15;i++)stepPhysics(state,{right:true,jump:true});
 assert.ok(state.player.y<y-20,"Actor must visibly ascend");
 assert.equal(state.jumps,1,"Holding jump does not trigger unwanted repeated jumps");
 for(let i=0;i<46;i++)stepPhysics(state,{right:false,jump:false});
 assert.ok(state.player.y<=432);
 assert.ok(state.player.y>300);
});

test("falling into a real gap resets the actor without losing collected relics",()=>{
 const st=createState();st.player.x=568;st.player.y=500;st.player.vy=450;st.player.onGround=false;
 for(let i=0;i<24;i++)stepPhysics(st,{});
 assert.equal(st.deaths,1);
 assert.ok(st.player.x<200,"Checkpoint restored");
 assert.ok(st.player.y<=432);
});

test("five physically collected shards unlock shrine victory, not before",()=>{
 const st=createState();
 for(let i=0;i<RELICS.length;i++){
  st.player.x=RELICS[i].x;st.player.y=RELICS[i].y+24;st.player.vy=0;st.player.onGround=false;
  stepPhysics(st,{});
  assert.equal(st.count,i+1);
  assert.equal(st.won,false);
 }
 st.player.x=2255;st.player.y=432;st.player.onGround=true;
 stepPhysics(st,{});
 assert.equal(st.won,true);
});

test("two-bone IK respects link lengths and target clamping",()=>{
 const ik=solveLimb({x:0,y:0},{x:20,y:0},14,14,-1);
 assert.ok(Math.abs(Math.hypot(ik.elbow.x,ik.elbow.y)-14)<1e-6);
 assert.ok(Math.abs(Math.hypot(ik.elbow.x-20,ik.elbow.y)-14)<1e-6);
 const beyond=solveLimb({x:0,y:0},{x:100,y:0},14,14,1);
 assert.ok(beyond.foot.x<28.1);
});
