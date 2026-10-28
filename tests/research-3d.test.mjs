import test from "node:test";
import assert from "node:assert/strict";
import {sunDirection,sunElevationFor,atmosphereState,henyeyGreensteinPhase,rayleighPhase} from "../workshop/studio/atmosphere-scattering.mjs";
import {auditScene,exportProfile,checkWebGPU} from "../workshop/studio/research-performance.mjs";

test("solar model stays normalized, moves with elevation and matches weather presets",()=>{
 assert.equal(sunElevationFor("sunset"),7);
 const low=sunDirection(7),high=sunDirection(72);
 assert.ok(Math.abs(Math.hypot(...low)-1)<1e-9);
 assert.ok(high[1]>low[1]);
 assert.ok(henyeyGreensteinPhase(1)>henyeyGreensteinPhase(-1));
 assert.equal(rayleighPhase(1),rayleighPhase(-1));
 assert.equal(atmosphereState("storm-sunset",7).direction[1],low[1]);
 assert.deepEqual(atmosphereState("invalid",100).position.map(Number.isFinite),[true,true,true]);
});
test("geometry audit reports true triangle and resource counts without changing scene",()=>{
 const geo={index:{count:300009},attributes:{position:{count:95000}}};
 const tex={};
 const material={map:tex,normalMap:tex};
 const node={isMesh:true,isSkinnedMesh:true,geometry:geo,material};
 const root={traverse(fn){fn(node);fn(node)}};
 const before=JSON.stringify(geo);
 const report=auditScene(root);
 assert.equal(report.triangles,200006);
 assert.equal(report.textureCount,1);
 assert.equal(report.skinned,2);
 assert.equal(report.geometryResources,1);
 assert.equal(report.overBudget,true);
 assert.equal(JSON.stringify(geo),before);
 assert.equal(exportProfile("mobile").maxTextureSize,1024);
 assert.equal(exportProfile("unknown").maxTextureSize,2048);
});
test("WebGPU is capability detection, never mislabeled as active renderer",async()=>{
 assert.deepEqual(await checkWebGPU({}),{available:false,renderer:"WebGL",detail:"WebGPU API saknas här"});
 const r=await checkWebGPU({gpu:{requestAdapter:async()=>({})}});
 assert.equal(r.available,true);assert.equal(r.renderer,"WebGL");
});
