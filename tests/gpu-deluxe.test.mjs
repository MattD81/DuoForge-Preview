import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 GPU_DELUXE_VERSION,createGPUDeluxeGovernor,createGPUDeluxe,
 detectGraphicsCapabilities,DELUXE_SHARPEN_SHADER
} from "../workshop/studio/gpu-deluxe.mjs";

test("capabilities are vendor-neutral and bounded",()=>{
 assert.equal(GPU_DELUXE_VERSION,"duoforge-gpu-deluxe@1");
 const calls=[];
 const renderer={capabilities:{isWebGL2:true},getContext(){return {
  MAX_TEXTURE_SIZE:10,getParameter(n){calls.push(n);return 8000},
  getExtension(x){calls.push(x);return x==="EXT_color_buffer_float"?{}:null}
 }}};
 const c=detectGraphicsCapabilities(renderer,{isSecureContext:true,navigator:{gpu:{}}});
 assert.equal(c.backend,"WebGL2");assert.equal(c.webgpuAvailable,true);
 assert.equal(c.maxTextureSize,8000);assert.equal(c.floatRenderTargets,true);
 assert.equal(c.vendor,"cross-vendor");
 assert.ok(!calls.some(x=>String(x).includes("RENDERER")||String(x).includes("VENDOR")));
 assert.equal(detectGraphicsCapabilities(null,{}).backend,"none");
});
test("auto/performance lowers device pixel ratio on sustained misses and recovers",()=>{
 const auto=createGPUDeluxeGovernor({mode:"auto",baseDpr:2,minDpr:1,targetFps:60});
 for(let i=0;i<192;i++)auto.sample(.041);
 const slow=auto.snapshot();
 assert.ok(slow.pixelRatio>=1&&slow.pixelRatio<2,JSON.stringify(slow));
 assert.ok(slow.p95Ms>=40&&slow.frameMs>=40);
 for(let i=0;i<600;i++)auto.sample(.005);
 assert.ok(auto.snapshot().pixelRatio>slow.pixelRatio);
 assert.ok(auto.snapshot().pixelRatio<=2);
 const fast=createGPUDeluxeGovernor({mode:"performance",baseDpr:2,minDpr:.8});
 assert.ok(fast.snapshot().pixelRatio<2);
});
test("off and quality never silently lower resolution",()=>{
 for(const mode of ["off","quality"]){
  const g=createGPUDeluxeGovernor({mode,baseDpr:2,minDpr:.8});
  for(let i=0;i<300;i++)g.sample(.08);
  assert.equal(g.snapshot().pixelRatio,2);
 }
 const g=createGPUDeluxeGovernor({mode:"auto"});
 assert.equal(g.sample(NaN).samples,0);
 assert.equal(g.sample(3).samples,0);
});
test("Render World device controller respects recording and avoids per-frame reallocations",()=>{
 const changes=[],renderer={
  getContext(){return null},getPixelRatio(){return changes.at(-1)||1},
  setPixelRatio(v){changes.push(v)},
  capabilities:{isWebGL2:false}
 };
 const env={devicePixelRatio:2,matchMedia(){return {matches:false}},navigator:{}};
 const d=createGPUDeluxe({renderer,canvas:{},env});
 assert.equal(d.info().mode,"auto");
 for(let i=0;i<48;i++)d.tick(.034,{recording:true,onResize(){throw Error("recording must not resize")}});
 assert.equal(changes.length,0);
 let resizes=0;
 for(let i=0;i<48;i++)d.tick(.034,{onResize(){resizes++}});
 assert.equal(changes.length,1);
 assert.equal(resizes,1);
 assert.ok(d.info().fps>0);
 d.configure({mode:"off",quality:"high"});
 for(let i=0;i<96;i++)d.tick(.05);
 assert.equal(changes.length,1);
 d.configure({mode:"quality",quality:"high"});
 assert.equal(d.info().mode,"quality");
 d.setSharpen(true);
 assert.equal(d.info().enhancement,"spatial-edge-aware");
});
test("five tap shader has bounded sample count and safe valid GLSL",()=>{
 const frag=DELUXE_SHARPEN_SHADER.fragmentShader;
 assert.equal((frag.match(/texture2D\(/g)||[]).length,5);
 assert.match(frag,/haloGate/);
 assert.match(frag,/max\(center\.rgb\+detail\*uStrength\*haloGate,vec3\(0\.\)\)/);
 assert.doesNotMatch(frag,/clamp\(center\.rgb.*0\.,1\./);
 assert.match(frag,/gl_FragColor/);
 assert.match(DELUXE_SHARPEN_SHADER.vertexShader,/gl_Position/);
});
test("GPU Deluxe is wired to the original playable Stormblade game",()=>{
 const html=readFileSync(new URL("../games/stormblade-duel/index.html",import.meta.url),"utf8");
 const game=readFileSync(new URL("../games/stormblade-duel/game.mjs",import.meta.url),"utf8");
 const world=readFileSync(new URL("../games/stormblade-duel/world.mjs",import.meta.url),"utf8");
 assert.match(html,/id="sceneHost"/);
 assert.match(html,/id="quality"/);
 assert.match(game,/import \{createGPUDeluxe,DELUXE_SHARPEN_SHADER\}/);
 assert.match(game,/gpu\.tick/);
 assert.match(game,/new ShaderPass\(DELUXE_SHARPEN_SHADER\)/);
 assert.match(world,/import \{createOceanSurface\} from "\.\.\/\.\.\/workshop\/studio\/ocean-water\.mjs"/);
 assert.match(world,/ocean\.heightAt\(0,0,time\)/);
 assert.match(world,/ocean\.slopeAt\(0,0,time\)/);
 const ocean=readFileSync(new URL("../workshop/studio/ocean-water.mjs",import.meta.url),"utf8");
 assert.match(ocean,/spectralGLSL/);
 assert.match(world,/makeWarrior/);
});


test("viewport budget remains bounded on portrait, landscape and 4K TV",async()=>{
 const {graphicsProfile}=await import('../workshop/studio/gpu-deluxe.mjs');
 for(const [width,height,mobile] of [[390,844,true],[844,390,true],[3840,2160,false]]){
  const p=graphicsProfile({clientWidth:width,clientHeight:height},{devicePixelRatio:3},'high');
  assert.equal(p.mobile,mobile);
  assert.ok(width*height*p.baseDpr**2<=p.maxPixels+1);
  assert.equal(p.targetFps,mobile?30:60);
 }
});
test("repeated configuration preserves learned budget and resize respects recording",()=>{
 const canvas={clientWidth:1280,clientHeight:800};
 let ratio=1.5,changes=0;
 const renderer={getContext:()=>null,getPixelRatio:()=>ratio,setPixelRatio:v=>{ratio=v;changes++}};
 const d=createGPUDeluxe({renderer,canvas,env:{devicePixelRatio:2}});
 d.configure({mode:'auto',quality:'high'});
 for(let i=0;i<192;i++)d.tick(.045);
 const learned=d.info();
 d.configure({mode:'auto',quality:'high'});
 assert.equal(d.info().pixelRatio,learned.pixelRatio);
 assert.equal(d.info().samples,learned.samples);
 canvas.clientWidth=3840;canvas.clientHeight=2160;
 const count=changes;
 for(let i=0;i<96;i++)d.tick(.04,{recording:true});
 assert.equal(changes,count);
 for(let i=0;i<48;i++)d.tick(.04);
 const p=d.info().profile;
 assert.equal(p.width,3840);
 assert.ok(ratio**2*p.width*p.height<=p.maxPixels+10000);
 assert.ok(d.info().pixelRatio<=learned.pixelRatio);
});
test("background pauses cannot allocate a new drawing buffer",()=>{
 let changes=0;
 const d=createGPUDeluxe({renderer:{getContext:()=>null,setPixelRatio:()=>changes++},canvas:{}});
 for(let i=0;i<96;i++)d.tick(2);
 assert.equal(changes,0);assert.equal(d.info().samples,0);
});
