import test from "node:test";
import assert from "node:assert/strict";
import {SPECTRUM,spectralHeight,spectralSlope,spectralGLSL,slopeGLSL,isStorm} from "../workshop/studio/ocean-spectrum.mjs";
test("7 directional swells are deterministic and never collapse into a repeated grid",()=>{
 assert.equal(SPECTRUM.length,7);
 const ts=[0,.2,2.4,17.3];
 const samples=ts.map(t=>spectralHeight(11.1,24.7,t,.58,1.1));
 assert.ok(samples.every(Number.isFinite));
 assert.equal(new Set(samples.map(v=>v.toFixed(6))).size,4);
 assert.ok(Math.abs(spectralHeight(10,20,3)-spectralHeight(510,520,3))>.1);
 assert.equal(isStorm("storm-sunset"),true);
 assert.equal(isStorm("sunset"),false);
});
test("exact analytic derivative matches CPU sampled finite differences",()=>{
 const x=12.8,z=-15.6,t=2.75,h=.94,v=1.25,eps=0.001;
 const s=spectralSlope(x,z,t,h,v);
 const dx=(spectralHeight(x+eps,z,t,h,v)-spectralHeight(x-eps,z,t,h,v))/(2*eps);
 const dz=(spectralHeight(x,z+eps,t,h,v)-spectralHeight(x,z-eps,t,h,v))/(2*eps);
 assert.ok(Math.abs(dx-s.dx)<1e-6);
 assert.ok(Math.abs(dz-s.dz)<1e-6);
 assert.equal((spectralGLSL.match(/sin\(/g)||[]).length,SPECTRUM.length);
 assert.equal((slopeGLSL.x.match(/cos\(/g)||[]).length,SPECTRUM.length);
});
