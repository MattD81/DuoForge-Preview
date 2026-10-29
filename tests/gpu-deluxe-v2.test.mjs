import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createGpuTimer,reconstructionPolicy,GPU_DELUXE_V2_VERSION}
 from "../workshop/studio/gpu-deluxe-v2.mjs";
import {TEMPORAL_RECONSTRUCT_SHADER,PROXY_RAYTRACE_SHADER}
 from "../workshop/studio/gpu-deluxe-v2-effects.mjs";

function createMock({supported=true}={}){
 const queries=[],deleted=[],begun=[],ended=[];
 let active=null,disjoint=false,lost=false;
 const ext={TIME_ELAPSED_EXT:99,GPU_DISJOINT_EXT:98};
 const gl={
  CURRENT_QUERY:100,QUERY_RESULT_AVAILABLE:101,QUERY_RESULT:102,
  getExtension(name){return supported&&name==="EXT_disjoint_timer_query_webgl2"?ext:null},
  getQuery(){return active},
  createQuery(){const q={id:queries.length+1,ready:false,nanos:8_500_000};queries.push(q);return q},
  beginQuery(target,q){assert.equal(target,99);assert.equal(active,null);active=q;begun.push(q)},
  endQuery(target){assert.equal(target,99);assert.ok(active);ended.push(active);active=null},
  getQueryParameter(q,p){return p===101?q.ready:q.nanos},
  getParameter(p){return p===98?disjoint:null},
  deleteQuery(q){deleted.push(q)},
  isContextLost(){return lost}
 };
 return {renderer:{getContext:()=>gl,capabilities:{isWebGL2:true}},
  queries,deleted,begun,ended,setDisjoint:x=>disjoint=x,
  setLost:x=>lost=x,get active(){return active}};
}
test("GPU Deluxe V2 is explicitly vendor neutral",()=>{
 assert.equal(GPU_DELUXE_V2_VERSION,"duoforge-gpu-deluxe@2");
 assert.equal(createGpuTimer(null).snapshot().supported,false);
 assert.equal(createGpuTimer({getContext:()=>({}),capabilities:{isWebGL2:false}}).begin(),false);
 assert.equal(createGpuTimer(createMock({supported:false}).renderer).snapshot().source,"unavailable");
});
test("elapsed GPU queries are real, nonblocking, and eventually report milliseconds",()=>{
 const mock=createMock(),timer=createGpuTimer(mock.renderer);
 assert.equal(timer.supported,true);
 assert.equal(timer.begin(),true);
 assert.equal(timer.begin(),false,"nested queries not allowed");
 assert.equal(timer.snapshot().active,true);
 assert.equal(timer.end(),true);
 assert.equal(mock.ended.length,1);
 assert.equal(timer.poll().gpuMs,null,"do not read unavailable query");
 mock.queries[0].ready=true;
 const sample=timer.poll();
 assert.equal(sample.gpuMs,8.5);
 assert.equal(sample.samples,1);
 assert.equal(sample.pending,0);
 assert.deepEqual(mock.deleted,mock.queries);
 timer.dispose();
 assert.equal(timer.begin(),false);
});
test("query pool is capped and disjoint invalidates stale measurements",()=>{
 const mock=createMock(),timer=createGpuTimer(mock.renderer,{maxPending:2});
 assert.ok(timer.begin());assert.ok(timer.end());
 assert.ok(timer.begin());assert.ok(timer.end());
 assert.equal(timer.begin(),false);
 mock.setDisjoint(true);
 assert.equal(timer.poll().gpuMs,null);
 assert.equal(timer.snapshot().disjointCount,1);
 assert.equal(mock.deleted.length,2);
 mock.setDisjoint(false);
 assert.ok(timer.begin());assert.ok(timer.end());
 mock.queries.at(-1).ready=true;
 assert.equal(timer.poll().gpuMs,8.5);
 mock.setLost(true);
 assert.equal(timer.poll().gpuMs,null);
 timer.dispose();
});
test("disposing during an active measurement correctly ends and frees the query",()=>{
 const mock=createMock(),timer=createGpuTimer(mock.renderer);
 assert.ok(timer.begin());timer.dispose();
 assert.equal(mock.ended.length,1);
 assert.equal(mock.deleted.length,1);
 assert.equal(mock.active,null);
 assert.equal(timer.snapshot().active,false);
});
test("reconstruction scales low-resolution rendering and caps pixels on devices",()=>{
 const mobile=reconstructionPolicy({width:1170,height:2532,scale:.72,mobile:true});
 assert.equal(mobile.neural,false);
 assert.equal(mobile.usesMotionVectors,false);
 assert.ok(mobile.renderWidth*mobile.renderHeight<=1_500_000+5000);
 assert.ok(mobile.renderWidth<mobile.outputWidth);
 const tv=reconstructionPolicy({width:3840,height:2160,scale:.72});
 assert.ok(tv.renderWidth*tv.renderHeight<=3_000_000+6000);
 const tiny=reconstructionPolicy({width:1,height:1,scale:0});
 assert.equal(tiny.renderWidth,1);
 assert.ok(tiny.scale>=.5);
});
test("temporal shader clamps history and does not falsely claim neural inference",()=>{
 const code=TEMPORAL_RECONSTRUCT_SHADER.fragmentShader;
 assert.match(code,/uniform sampler2D tHistory/);
 assert.match(code,/clamp\(texture2D\(tHistory,vUv\)/);
 assert.match(code,/uHistoryWeight/);
 assert.match(code,/gl_FragColor/);
 assert.doesNotMatch(code,/neural|DLSS|tensor/i);
});
test("own analytic ray tracer intersects real rays, casts shadow rays and reflects",()=>{
 const code=PROXY_RAYTRACE_SHADER.fragmentShader;
 assert.equal(PROXY_RAYTRACE_SHADER.maxSpheres,12);
 assert.match(code,/float hitSphere/);
 assert.match(code,/vec2 trace/);
 assert.match(code,/vec2 obstacle=trace/);
 assert.match(code,/reflect\(rd,n\)/);
 assert.match(code,/uCameraWorld/);
 assert.match(code,/gl_FragColor/);
});
test("V2 is wired into existing Studio and two actual games; no parallel platform",()=>{
 const studio=readFileSync(new URL("../workshop/studio/studio.mjs",import.meta.url),"utf8");
 const adapter=readFileSync(new URL("../workshop/studio/gpu-deluxe-v2-studio.mjs",import.meta.url),"utf8");
 const storm=readFileSync(new URL("../games/stormblade-duel/game.mjs",import.meta.url),"utf8");
 const builder=readFileSync(new URL("../game-builder/runtime.mjs",import.meta.url),"utf8");
 assert.match(studio,/initGpuDeluxeV2Studio\(/);
 assert.match(studio,/timer\?\.begin\(\)/);
 assert.match(studio,/timer\?\.end\(\)/);
 assert.match(adapter,/createGpuTimer\(renderer\)/);
 assert.match(adapter,/collectRayProxies/);
 assert.match(adapter,/renderer\.setRenderTarget\(low\)/);
 assert.match(adapter,/renderer\.setRenderTarget\(rayTarget\)/);
 assert.match(storm,/gpuTimer\?\.begin\(\)/);
 assert.match(builder,/gpuTimer\?\.dispose\(\)/);
});
