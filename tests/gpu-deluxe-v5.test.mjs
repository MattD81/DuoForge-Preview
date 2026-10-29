import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GPU_DELUXE_V5_VERSION,V5_MAX_TRIANGLES,buildTriangleBVH,v5QualityProfile,v5CameraSignature,v5DetailPbrProfile}
 from "../workshop/studio/gpu-deluxe-v5-core.mjs";
import {V5_RAYTRACE_SHADER,V5_ACCUMULATE_SHADER,V5_PRESENT_SHADER}
 from "../workshop/studio/gpu-deluxe-v5-shaders.mjs";
const tri=(x=0)=>({a:[x,0,0],b:[x+1,0,0],c:[x,1,0],color:[1,.5,.25],
 metalness:.35,roughness:.4});
test("V5 is a new version, preserving V2 fallback and bounding resources",()=>{
 assert.equal(GPU_DELUXE_V5_VERSION,"duoforge-gpu-deluxe@5");
 assert.equal(V5_MAX_TRIANGLES,768);
 const p=v5QualityProfile({width:3840,height:2160,preset:"extreme"});
 assert.equal(p.preset,"extreme");
 assert.equal(p.usesNeuralModel,false);
 assert.ok(p.width*p.height<=p.maxPixels+1000);
 assert.ok(p.maxTriangles<=768);
 const m=v5QualityProfile({width:390,height:844,mobile:true,preset:"extreme"});
 assert.ok(m.maxPixels<=22000);
 assert.ok(m.maxTriangles<=192);
});
test("V5 full-detail PBR retains geometry, textures and animation with bounded DPR",()=>{
 const high=v5DetailPbrProfile({preset:"extreme",devicePixelRatio:3});
 assert.equal(high.mode,"full-detail-pbr");
 assert.equal(high.pixelRatio,2);
 assert.equal(high.preservesGeometry,true);
 assert.equal(high.preservesTextures,true);
 assert.equal(high.preservesSkinning,true);
 assert.equal(high.usesNeuralModel,false);
 const mobile=v5DetailPbrProfile({preset:"extreme",mobile:true,devicePixelRatio:3,adaptiveScale:.6});
 assert.equal(mobile.pixelRatio,.9);
 assert.equal(v5DetailPbrProfile({preset:"unrecognized",devicePixelRatio:2}).pixelRatio,1);
 assert.equal(v5DetailPbrProfile({devicePixelRatio:Infinity}).pixelRatio,1);
});
test("BVH encodes actual triangles, bounds, colors and material roughness",()=>{
 const b=buildTriangleBVH([tri(0),tri(3),tri(6),tri(9),tri(12)],{leafSize:2});
 assert.equal(b.triangles,5);
 assert.ok(b.nodes>=5);
 assert.equal(b.triangleTextureWidth,25);
 assert.equal(b.nodeTextureWidth,b.nodes*2);
 assert.equal(b.triData.length,100);
 assert.equal(b.nodeData[0],0);
 assert.equal(b.nodeData[1],0);
 assert.equal(b.nodeData[2],0);
 assert.ok(b.nodeData[3]>=0,"root is internal node");
 assert.equal(b.nodeData[4],13);
 const first=b.triData.slice(0,20);
 assert.ok(Math.abs(first[15]-.35)<1e-6);
 assert.ok(Math.abs(first[16]-.4)<1e-6);
 // Every vertex coordinate stays available for true ray–triangle GLSL.
 assert.equal(first[3],0);
 assert.equal(first[7],0);
 assert.equal(first[11],0);
});
test("BVH tree leaves address contiguous reordered triangles without invalid pointers",()=>{
 const b=buildTriangleBVH(Array.from({length:59},(_,i)=>tri(i*1.5)),{leafSize:4});
 const leaves=[],stack=[0],visited=new Set();
 while(stack.length){
  const index=stack.pop();
  assert.ok(index>=0&&index<b.nodes);
  assert.ok(!visited.has(index),"BVH must be acyclic");
  visited.add(index);
  const left=b.nodeData[index*8+3],right=b.nodeData[index*8+7];
  if(left<0){
   const first=-left-1;assert.ok(right>=1&&right<=4);
   assert.ok(first>=0&&first+right<=b.triangles);
   for(let n=first;n<first+right;n++)leaves.push(n);
  }else{stack.push(left,right)}
 }
 assert.deepEqual(leaves.sort((a,b)=>a-b),Array.from({length:b.triangles},(_,i)=>i));
});
test("unsafe and degenerate faces are rejected and empty scenes stay safe",()=>{
 const b=buildTriangleBVH([tri(),{a:[0,0,0],b:[0,0,0],c:[0,0,0]},
  {a:[Infinity,0,0],b:[1,0,0],c:[0,1,0]},null]);
 assert.equal(b.triangles,1);
 assert.equal(buildTriangleBVH([]).nodes,0);
 assert.throws(()=>buildTriangleBVH(null),/lista/);
 const huge=buildTriangleBVH(Array.from({length:800},(_,i)=>tri(i)),{limit:999999});
 assert.equal(huge.triangles,768);
});
test("camera signature reacts to projection and position changes",()=>{
 const camera={matrixWorld:{elements:Array(16).fill(0)},
  projectionMatrix:{elements:Array(16).fill(1)}};
 const a=v5CameraSignature(camera);
 camera.matrixWorld.elements[12]=1;
 assert.notEqual(v5CameraSignature(camera),a);
 assert.equal(v5CameraSignature(null),null);
});
test("ray shader traverses BVH and real triangle vertices, plus shadows/reflection",()=>{
 const code=V5_RAYTRACE_SHADER.fragmentShader;
 for(const token of ["texelFetch(uTriangles","texelFetch(uNodes","triangleHit(",
  "cross(rd,e2)","boxHit(","uNodeCount","vec2 blocker=trace(",
  "vec3 reflected=normalize(reflect(","vec2 second=trace(","vec2 occ=trace(",
  "outColor=vec4("])assert.ok(code.includes(token),token);
 assert.match(code,/precision highp float/);
 assert.match(V5_ACCUMULATE_SHADER.fragmentShader,/mix\(sampleColor,historical,amount\)/);
 assert.match(V5_PRESENT_SHADER.fragmentShader,/exp\(-length\(c-x0\)\*20\.\)/);
 assert.doesNotMatch(code,/NVDA|NVIDIA|DLSS|TensorRT/);
});
test("V5 panel is added into existing 3D Studio and retains V2",()=>{
 const studio=readFileSync(new URL("../workshop/studio/studio.mjs",import.meta.url),"utf8");
 const adapter=readFileSync(new URL("../workshop/studio/gpu-deluxe-v5-studio.mjs",import.meta.url),"utf8");
 assert.match(studio,/initGpuDeluxeV2Studio/);
 assert.match(studio,/initGpuDeluxeV5Studio/);
 assert.match(studio,/gpuV5\?\.render\(\)/);
 assert.match(adapter,/buildTriangleBVH\(src\.triangles/);
 assert.match(adapter,/renderer\.setRenderTarget\(rayTarget\)/);
 assert.match(adapter,/gpuV5Capture/);
 assert.match(adapter,/gpuV5Detail/);
 assert.match(adapter,/renderer\.render\(scene,camera\)/);
 assert.match(adapter,/stopPbr\(\)/);
 assert.match(studio,/canvas,scene,root,camera/);
 assert.match(adapter,/getGpuTime=\(\)=>null/);
});
