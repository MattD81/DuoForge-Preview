// DuoForge Cinema GPU Core V1.
// A genuinely independent WebGL2 shader pipeline for temporal film accumulation.
// It runs on the user's GPU, with float16 render targets and a CPU fallback.
// Existing Three.js still renders GLB scene geometry; this core owns the
// per-sample linear-light film accumulation pass and output colour transform.
import {TemporalFilmCompositor,validateRenderSize} from "./cinema-engine-core.mjs";
const VERT=`#version 300 es
precision highp float;
out vec2 vUv;
void main(){
 vec2 p=vec2(float((gl_VertexID & 1)*2),float((gl_VertexID & 2)));
 vUv=p*.5;gl_Position=vec4(p*2.-1.,0.,1.);
}`;
const COMMON=`
vec3 srgbToLinear(vec3 v){
 vec3 low=v/12.92;
 vec3 hi=pow((v+vec3(.055))/vec3(1.055),vec3(2.4));
 return mix(low,hi,step(vec3(.04045),v));
}
vec3 linearToSrgb(vec3 v){
 v=clamp(v,vec3(0.),vec3(1.));
 vec3 low=v*12.92;
 vec3 hi=1.055*pow(v,vec3(1./2.4))-.055;
 return mix(low,hi,step(vec3(.0031308),v));
}`;
const AVERAGE=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uInput,uAccum;
uniform float uCount;
out vec4 fragColor;
${COMMON}
void main(){
 vec3 sampleColor=srgbToLinear(texture(uInput,vUv).rgb);
 vec3 result=uCount<.5?sampleColor:mix(texture(uAccum,vUv).rgb,sampleColor,1./(uCount+1.));
 fragColor=vec4(result,1.);
}`;
const PRESENT=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uAccum;
out vec4 fragColor;
${COMMON}
void main(){fragColor=vec4(linearToSrgb(texture(uAccum,vUv).rgb),1.);}`;
function shader(gl,type,src){
 const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
  const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error("Cinema GLSL: "+error);
 }
 return s;
}
function program(gl,vs,fs){
 const p=gl.createProgram(),a=shader(gl,gl.VERTEX_SHADER,vs),b=shader(gl,gl.FRAGMENT_SHADER,fs);
 try{
  gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error("Cinema shader link: "+gl.getProgramInfoLog(p));
 }finally{gl.deleteShader(a);gl.deleteShader(b);}
 return p;
}
export class GPUFilmCompositor{
 constructor({width,height,platform="desktop"}={}){
  validateRenderSize(width,height,platform);
  this.surface=document.createElement("canvas");
  this.surface.width=width;this.surface.height=height;
  const gl=this.surface.getContext("webgl2",{
   alpha:false,antialias:false,depth:false,stencil:false,
   premultipliedAlpha:false,preserveDrawingBuffer:true
  });
  if(!gl||!gl.getExtension("EXT_color_buffer_float"))throw Error("WebGL2 float buffers not supported.");
  this.gl=gl;this.width=width;this.height=height;this.count=0;this.mode="webgl2-float16";
  const texture=(format,type)=>{
   const tx=gl.createTexture();
   gl.bindTexture(gl.TEXTURE_2D,tx);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,format,width,height,0,gl.RGBA,type,null);
   return tx;
  };
  this.input=texture(gl.RGBA8,gl.UNSIGNED_BYTE);
  this.buffers=[0,1].map(()=>{
   const tex=texture(gl.RGBA16F,gl.HALF_FLOAT);
   const frame=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,frame);
   gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)
    throw Error("GPU float framebuffer incomplete.");
   return {tex,frame};
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  this.avg=program(gl,VERT,AVERAGE);this.present=program(gl,VERT,PRESENT);
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
 }
 reset(){this.count=0}
 add(source){
  const gl=this.gl;
  if(!source||source.width!==this.width||source.height!==this.height)
   throw Error("Bildrutans upplösning stämmer inte.");
  const dst=this.buffers[this.count%2],prev=this.buffers[(this.count+1)%2];
  gl.viewport(0,0,this.width,this.height);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.input);
  gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,prev.tex);
  gl.bindFramebuffer(gl.FRAMEBUFFER,dst.frame);gl.useProgram(this.avg);
  gl.uniform1i(gl.getUniformLocation(this.avg,"uAccum"),0);
  gl.uniform1i(gl.getUniformLocation(this.avg,"uInput"),1);
  gl.uniform1f(gl.getUniformLocation(this.avg,"uCount"),this.count);
  gl.drawArrays(gl.TRIANGLES,0,3);
  this.count++;
 }
 finish(){
  if(!this.count)throw Error("Ingen bildruta finns att exportera.");
  const gl=this.gl,last=this.buffers[(this.count-1)%2];
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.viewport(0,0,this.width,this.height);
  gl.useProgram(this.present);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,last.tex);
  gl.uniform1i(gl.getUniformLocation(this.present,"uAccum"),0);
  gl.drawArrays(gl.TRIANGLES,0,3);
  gl.finish();
  return this.surface;
 }
 async png(){
  const image=this.finish();
  const blob=await new Promise(resolve=>image.toBlob(resolve,"image/png"));
  if(!blob?.size)throw Error("GPU-kärnan kunde inte skapa PNG.");
  return blob;
 }
 dispose(){
  const gl=this.gl;if(!gl)return;
  for(const b of this.buffers){gl.deleteFramebuffer(b.frame);gl.deleteTexture(b.tex)}
  gl.deleteTexture(this.input);gl.deleteProgram(this.avg);gl.deleteProgram(this.present);
  gl.deleteVertexArray(this.vao);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  this.surface.width=this.surface.height=0;this.gl=null;
 }
}
export function createCinemaCompositor(options){
 try{return new GPUFilmCompositor(options)}
 catch(e){
  console.warn("GPU Cinema Core -> local CPU fallback:",e.message);
  const fallback=new TemporalFilmCompositor(options);fallback.mode="cpu-linear";
  return fallback;
 }
}
