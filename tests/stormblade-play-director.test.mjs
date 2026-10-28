import test from "node:test";
import assert from "node:assert/strict";
import {computeDuelFraming,createDuoForgePlayDirector} from "../games/stormblade-duel/play-director.mjs";

test("cinematic framing keeps combatants in viewport on portrait, tablet and desktop",()=>{
 const left={x:-2.1,z:1},right={x:2.1,z:1};
 const widescreen=computeDuelFraming(left,right,16/9);
 const portrait=computeDuelFraming(left,right,390/844);
 for(const f of [widescreen,portrait]){
  for(const v of Object.values(f))assert.ok(Number.isFinite(v),"framing coordinates must be finite");
  assert.ok(f.eyeZ>10);
  assert.ok(f.fov>=45&&f.fov<=60);
 }
 assert.ok(portrait.eyeZ>widescreen.eyeZ);
 assert.ok(portrait.fov>widescreen.fov);
});

test("tracking follows moving fighters without jumping outside ship bounds",()=>{
 const target=computeDuelFraming({x:1.8,z:5.3},{x:2.1,z:5.4},1.6);
 assert.ok(target.lookZ<=3.1);
 assert.ok(target.eyeX<=1.55);
 assert.ok(target.lookX<target.eyeX+1);
});

test("impact camera shake decays and remains separate from game positions",()=>{
 const vectors={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};
 const camera={position:vectors,fov:47,lookAt(){},updateProjectionMatrix(){}};
 const fighterA={root:{position:{x:-2,z:0}}},fighterB={root:{position:{x:2,z:0}}};
 const director=createDuoForgePlayDirector({camera,world:{player:fighterA,opponent:fighterB},canvas:{clientWidth:900,clientHeight:600}});
 assert.equal(director.info().impact,0);
 director.hit({heavy:true});
 assert.ok(director.info().impact>.5);
 for(let i=0;i<120;i++)director.update(1/60);
 assert.equal(director.info().impact,0);
 assert.equal(fighterA.root.position.x,-2);
 assert.equal(fighterB.root.position.x,2);
 assert.ok(Math.abs(camera.fov-47)<1);
});

test("unreliable frame dt, aspect and input stay bounded",()=>{
 const result=computeDuelFraming({x:Infinity,z:NaN},{x:-Infinity,z:1},0,{impact:Infinity});
 assert.ok(Object.values(result).every(Number.isFinite));
 assert.ok(result.eyeZ<25);
});
