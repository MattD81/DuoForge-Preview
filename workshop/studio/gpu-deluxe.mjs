/**
 * DuoForge GPU Deluxe V1 — cross-vendor browser graphics governor.
 * Inspired by vendor research, not DLSS/FSR/XeSS code or a virtual GPU.
 * Reuses the existing Three.js WebGL renderer; no new GPU contexts/APIs.
 */
export const GPU_DELUXE_VERSION="duoforge-gpu-deluxe@1";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f)=>Number.isFinite(v)?v:f;
const MODES=new Set(["off","auto","quality","performance"]);
export function detectGraphicsCapabilities(renderer,env=globalThis){
 const gl=renderer?.getContext?.();
 const safe=(name,fallback=0)=>{try{return gl?.getParameter?.(name)??fallback}catch{return fallback}};
 return Object.freeze({
  backend:renderer?.capabilities?.isWebGL2?"WebGL2":gl?"WebGL":"none",
  webgpuAvailable:!!(env.isSecureContext&&env.navigator?.gpu),
  floatRenderTargets:!!(renderer?.capabilities?.isWebGL2&&gl?.getExtension?.("EXT_color_buffer_float")),
  maxTextureSize:clamp(finite(safe(gl?.MAX_TEXTURE_SIZE),0),0,16384),
  vendor:"cross-vendor" // No identifying renderer/vendor extension read.
 });
}
/** rAF wall-clock timing, not a true GPU timing query; ignores background pauses. */
export function createGPUDeluxeGovernor(options={}){
 const mode=MODES.has(options.mode)?options.mode:"off";
 const targetFps=clamp(finite(options.targetFps,60),24,120);
 const baseDpr=clamp(finite(options.baseDpr,1),.5,3);
 const minDpr=clamp(finite(options.minDpr,.7),.5,baseDpr);
 let scale=clamp(finite(options.initialScale,mode==="performance"?.85:1),minDpr/baseDpr,1);
 let ema=null,frames=0,bucket=[];
 function snapshot(){
  const sorted=bucket.slice().sort((a,b)=>a-b);
  const p95=sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(.95*sorted.length)-1)]:null;
  return Object.freeze({mode,targetFps,scale,
   pixelRatio:Number((baseDpr*scale).toFixed(3)),
   fps:ema===null?null:Math.round(1000/ema),
   frameMs:ema===null?null:Number(ema.toFixed(2)),
   p95Ms:p95===null?null:Number(p95.toFixed(2)),samples:frames});
 }
 return Object.freeze({
  sample(frameSeconds){
   const ms=frameSeconds*1000;
   if(!Number.isFinite(ms)||ms<=0||ms>250)return snapshot();
   ema=ema===null?ms:ema*.90+ms*.10;
   bucket.push(ms);if(bucket.length>120)bucket.shift();frames++;
   if(frames%48===0&&(mode==="auto"||mode==="performance")){
    const budget=1000/targetFps;
    if(ema>budget*1.20)scale=Math.max(minDpr/baseDpr,Math.round((scale-.07)*100)/100);
    else if(ema<budget*.78)scale=Math.min(1,Math.round((scale+.035)*1000)/1000);
   }
   return snapshot();
  },snapshot,get mode(){return mode}
 });
}
// Original, bounded 5-tap spatial detail filter; this is NOT neural upscaling.
export const DELUXE_SHARPEN_SHADER=Object.freeze({
 uniforms:{tDiffuse:{value:null},uTexel:{value:{x:1/1024,y:1/1024}},uStrength:{value:.18}},
 vertexShader:[
 'varying vec2 vUv;',
 'void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'
 ].join('\n'),
 fragmentShader:[
 'uniform sampler2D tDiffuse;',
 'uniform vec2 uTexel;',
 'uniform float uStrength;',
 'varying vec2 vUv;',
 'void main(){',
 'vec4 center=texture2D(tDiffuse,vUv);',
 'vec3 near4=(',
 'texture2D(tDiffuse,vUv+vec2(uTexel.x,0.)).rgb+',
 'texture2D(tDiffuse,vUv-vec2(uTexel.x,0.)).rgb+',
 'texture2D(tDiffuse,vUv+vec2(0.,uTexel.y)).rgb+',
 'texture2D(tDiffuse,vUv-vec2(0.,uTexel.y)).rgb)*.25;',
 'vec3 detail=center.rgb-near4;',
 'float edge=abs(dot(detail,vec3(.2126,.7152,.0722)));',
 'float haloGate=1.-smoothstep(.10,.32,edge);',
 'vec3 result=max(center.rgb+detail*uStrength*haloGate,vec3(0.));',
 'gl_FragColor=vec4(result,center.a);',
 '}'
 ].join('\n')
});
/** Only affects Render World preview; film output is locked to its export size. */
export function createGPUDeluxe({renderer,canvas,env=globalThis}={}){
 if(!renderer||!canvas)throw Error("GPU Deluxe behöver 3D-renderaren och canvas.");
 const capabilities=detectGraphicsCapabilities(renderer,env);
 let settings={mode:"auto",quality:"medium"};
 let governor=null,actualRatio=null,elapsed=0,sharpen=false;
 const isMobile=()=>!!env.matchMedia?.("(max-width:700px)")?.matches;
 function configure({mode=settings.mode,quality=settings.quality}={}){
  settings={mode:MODES.has(mode)?mode:"off",
   quality:["low","medium","high"].includes(quality)?quality:"medium"};
  const baseDpr=Math.min(env.devicePixelRatio||1,
   settings.quality==="high"?2:settings.quality==="medium"?1.5:1);
  governor=createGPUDeluxeGovernor({
   mode:settings.mode,baseDpr,
   minDpr:Math.max(.6,baseDpr*(isMobile()?.6:.65)),
   targetFps:isMobile()?30:60
  });
  elapsed=0;actualRatio=null;
  return info();
 }
 function info(){return Object.freeze({
  ...governor.snapshot(),capabilities,
  enhancement:sharpen?"spatial-edge-aware":"none"
 });}
 function tick(dt,{recording=false,onResize}={}){
  if(recording||settings.mode==="off")return info();
  const state=governor.sample(dt);
  elapsed++;
  if(elapsed%48===0&&(actualRatio===null||Math.abs(state.pixelRatio-actualRatio)>.02)){
   renderer.setPixelRatio(state.pixelRatio);
   actualRatio=state.pixelRatio;
   if(typeof onResize==="function")onResize();
  }
  return info();
 }
 configure();
 return Object.freeze({configure,tick,info,
  setSharpen(value){sharpen=Boolean(value)},
  get mode(){return settings.mode}
 });
}
