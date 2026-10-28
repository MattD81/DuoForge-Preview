import test from "node:test";
import assert from "node:assert/strict";
import {filmClock,validateRenderSize,ENGINE_PROFILES,ENGINE_VERSION} from "../workshop/studio/cinema-engine-core.mjs";

test("exactly 20 seconds means 480 at 24fps and 600 at 30fps, not 1.5 seconds",()=>{
 const a=filmClock({duration:20,fps:24,startFrame:0,samples:4,shutterAngle:180});
 const b=filmClock({duration:20,fps:30,startFrame:0,samples:2,shutterAngle:90});
 assert.equal(a.frames,480);assert.equal(b.frames,600);
 assert.equal(a.timeAt(24),1);
 assert.equal(a.timeAt(479),479/24);
 assert.ok(a.shutterTimes(479).every(t=>t<=479/24));
 assert.ok(a.shutterTimes(0).every(t=>t>=0));
 assert.equal(a.shutterTimes(10).length,4);
 assert.ok(a.shutterTimes(10).every((v,i,arr)=>i===0||v>=arr[i-1]));
 assert.ok(ENGINE_VERSION.includes("duoforge-cinema-core"));
});
test("failed validation protects mobile memory and invalid movie formats",()=>{
 assert.throws(()=>filmClock({duration:0}),/filmlängd/);
 assert.throws(()=>filmClock({duration:1.01,fps:24}),/hela bildrutor/);
 assert.throws(()=>filmClock({duration:20,fps:17}),/fps/);
 assert.throws(()=>filmClock({duration:20,fps:24,samples:3,platform:"mobile"}),/prover/);
 assert.throws(()=>filmClock({duration:20,fps:24,startFrame:480}),/Startbildruta/);
 assert.equal(validateRenderSize(1280,720,"mobile").bytes,1280*720*4);
 assert.throws(()=>validateRenderSize(3840,2160,"mobile"),/för stor/);
 assert.equal(ENGINE_PROFILES.desktop.maxWidth,3840);
});
test("causal shutter keeps cut transitions on the intended frame",()=>{
 const a=filmClock({duration:20,fps:24,startFrame:0,samples:4,shutterAngle:360});
 const seconds=a.shutterTimes(96); // frame 96 = exact 4-second cut
 assert.equal(seconds.length,4);
 assert.ok(seconds.every(x=>x<=4+1/48));
 assert.ok(seconds.some(x=>x<4));
 assert.ok(seconds.some(x=>x>4));
});
