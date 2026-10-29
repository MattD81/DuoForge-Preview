import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evolveSurface,inspectMeshData,proposeSeeds,morphology,normalizeSettings} from "../workshop/studio/shape-dna-core.mjs";

function sphere(lat=24,lon=32){
 const pts=[],normal=[],uv=[],idx=[];
 for(let y=0;y<=lat;y++)for(let x=0;x<=lon;x++){
  const a=x/lon*2*Math.PI,b=y/lat*Math.PI;
  const v=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];
  pts.push(...v);normal.push(...v);uv.push(x/lon,y/lat);
 }
 for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){
  const a=y*(lon+1)+x,b=a+lon+1;
  idx.push(a,b,a+1,a+1,b,b+1);
 }
 return {positions:new Float32Array(pts),normals:new Float32Array(normal),uv:new Float32Array(uv),indices:new Uint32Array(idx)};
}
test("all surface types are deterministic, finite and materially distinct",()=>{
 const vals=["stone","bark","organic","scales"].map(kind=>morphology(.2,.4,.5,kind,9123));
 assert.ok(vals.every(Number.isFinite));
 assert.equal(new Set(vals.map(x=>x.toFixed(5))).size,4);
 assert.equal(morphology(.2,.4,.5,"bark",9123),vals[1]);
 assert.equal(normalizeSettings({kind:"bad",seed:-2}).kind,"organic");
});
test("candidate generation preserves original data and UV/index topology",()=>{
 const mesh=sphere(),orig=new Float32Array(mesh.positions);
 const first=evolveSurface({...mesh,kind:"stone",seed:103,intensity:.72});
 const second=evolveSurface({...mesh,kind:"stone",seed:103,intensity:.72});
 assert.deepEqual(first.positions,second.positions);
 assert.deepEqual(mesh.positions,orig);
 assert.equal(first.positions.length,mesh.positions.length);
 assert.equal(first.report.vertices,mesh.positions.length/3);
 assert.equal(first.report.triangles,mesh.indices.length/3);
 assert.equal(first.report.hasUV,true);
 assert.ok(first.report.safe);
 assert.ok(first.report.maxShift>0);
 assert.ok(first.report.relativeShift<.021);
 assert.ok(first.report.flipFraction<.006);
 assert.ok(first.positions.every(Number.isFinite));
 assert.notDeepEqual(first.positions,orig);
});
test("DNA seeds vary shape while conserving base silhouette and geometry",()=>{
 const mesh=sphere(),seeds=proposeSeeds(200);
 assert.equal(new Set(seeds).size,3);
 const outputs=seeds.map(seed=>evolveSurface({...mesh,seed,kind:"bark",intensity:.8}));
 assert.ok(outputs.every(x=>x.report.safe));
 assert.notDeepEqual(outputs[0].positions,outputs[1].positions);
 assert.ok(outputs.every(o=>o.report.relativeShift<.021));
});
test("without normals, triangulation computes normals and surface changes remain bounded",()=>{
 const mesh=sphere();
 const result=evolveSurface({positions:mesh.positions,indices:mesh.indices,kind:"scales",seed:17,intensity:1});
 assert.ok(result.report.safe&&result.positions.every(Number.isFinite));
 assert.ok(result.report.fitness>=0&&result.report.fitness<=100);
});
test("reject nonfinite vertices, malformed indices and excessive mesh sizes",()=>{
 const mesh=sphere();
 const bad=new Float32Array(mesh.positions);bad[1]=NaN;
 assert.throws(()=>inspectMeshData(bad),/Icke-finit/);
 assert.throws(()=>inspectMeshData(new Float32Array(8)),/minst tre/);
 assert.throws(()=>inspectMeshData(mesh.positions,new Uint32Array([0,1,999999])),/Felaktigt mesh-index/);
 assert.throws(()=>inspectMeshData(new Float32Array(250001*3)),/Max 250/);
});
test("thin surfaces are honestly identified; no fake camera rendering claim",()=>{
 const plane=new Float32Array([0,0,0,1,0,0,0,1,0,1,0,0,1,1,0,0,1,0]);
 const data=inspectMeshData(plane);
 assert.ok(data.depthRatio<.001);
 const src=readFileSync("workshop/studio/shape-dna-studio.mjs","utf8");
 assert.match(src,/inte 6 renderade kamerabilder/);
 assert.match(src,/ingen extern AI|Ingen extern AI/i);
});
