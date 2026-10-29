/**
 * DuoForge 2D Deluxe Renderer — standalone WebGL2 forward 2D lighting.
 * Dynamic normal-mapped sprites, 6 real point lights, screen-space occlusion,
 * GGX-inspired highlights and atmospheric tone. Canvas2D fallback. MIT-free
 * original shaders and code; no Phaser/PixiJS dependency.
 */
export const ENGINE_VERSION="DuoForge 2D Deluxe 1.0";
const VS=`#version 300 es
precision highp float;
out vec2 vUV;
void main(){
 vec2 uv=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
 vUV=uv;
 gl_Position=vec4(uv*2.-1.,0.,1.);
}`;
const FS=`#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uAlbedo,uNormal,uOccluder;
uniform vec2 uResolution;
uniform int uCount;
uniform vec4 uLights[6]; // x/y normalized bottom-left, range normalized to height, strength
uniform vec4 uColors[6]; // light RGB, color exposure
uniform float uTime,uDarkness,uShadows;
float traceShadow(vec2 uv,vec2 target){
 float blocked=0.;
 float start=texture(uOccluder,uv).a;
 for(int j=1;j<=8;j++){
  float t=float(j)/9.;
  vec2 p=mix(uv,target,t);
  blocked=max(blocked,step(.4,texture(uOccluder,p).a));
 }
 return mix(1.,1.-blocked*.84,uShadows*(1.-step(.4,start)));
}
void main(){
 vec2 uv=clamp(vUV,0.,1.);
 vec4 surface=texture(uAlbedo,uv);
 vec3 n=normalize(texture(uNormal,uv).rgb*2.-1.);
 // Preserve painterly albedo; avoid turning solid backgrounds pitch black.
 vec3 radiance=vec3(.19,.26,.37)*(1.-uDarkness*.44);
 vec3 V=vec3(0.,0.,1.);
 vec3 glow=vec3(0.);
 for(int i=0;i<6;i++){
  if(i>=uCount)break;
  vec2 to=uLights[i].xy-uv;
  float distancePx=length(to*vec2(uResolution.x/uResolution.y,1.));
  float range=max(.001,uLights[i].z);
  float falloff=pow(max(0.,1.-distancePx/range),2.);
  if(falloff<.0001)continue;
  vec3 L=normalize(vec3(to*vec2(uResolution.x/uResolution.y,1.),range*.35));
  float diffuse=max(.0,dot(n,L))*.79+.21;
  float shadow=1.;
  if(i<2)shadow=traceShadow(uv,uLights[i].xy);
  vec3 H=normalize(L+V);
  float spec=pow(max(.0,dot(n,H)),33.)*.22;
  vec3 emitted=uColors[i].rgb*uColors[i].a*uLights[i].w*falloff*shadow;
  radiance+=emitted*diffuse;
  glow+=emitted*spec*.35;
 }
 vec3 c=surface.rgb*radiance+glow;
 // Silhouette detail and atmospheric blue-purple color grade.
 c=mix(c,c*vec3(1.06,1.02,.96),.16);
 c=c/(1.+c*.17);
 outColor=vec4(pow(max(c,vec3(0.)),vec3(.92)),1.);
}`;
const clamp=(a,l,h)=>Math.max(l,Math.min(h,a));
function shader(gl,type,source){
 const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
 if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){
  const error=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw Error("DuoForge 2D shader: "+error);
 }
 return sh;
}
export function createRenderer(target,{width=960,height=540,quality="high"}={}){
 const albedo=document.createElement("canvas"),normal=document.createElement("canvas"),occluder=document.createElement("canvas");
 for(const c of [albedo,normal,occluder]){c.width=width;c.height=height;}
 const ctx=albedo.getContext("2d"),nctx=normal.getContext("2d"),octx=occluder.getContext("2d");
 if(!ctx||!nctx||!octx)throw Error("2D drawing context required");
 const gl=target.getContext("webgl2",{alpha:false,antialias:false,preserveDrawingBuffer:false});
 let fallback=null,program=null,vao=null,textures=[],uniform={};
 const init=()=>{
  if(!gl){fallback=target.getContext("2d");if(!fallback)throw Error("Canvas 2D not supported");return;}
  const vert=shader(gl,gl.VERTEX_SHADER,VS),frag=shader(gl,gl.FRAGMENT_SHADER,FS);
  program=gl.createProgram();gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
  gl.deleteShader(vert);gl.deleteShader(frag);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("2D shader link: "+gl.getProgramInfoLog(program));
  vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.useProgram(program);
  for(let i=0;i<3;i++){
   const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   textures.push(tex);
  }
  for(const name of ["uAlbedo","uNormal","uOccluder","uResolution","uCount","uLights","uColors","uTime","uDarkness","uShadows"])
   uniform[name]=gl.getUniformLocation(program,name);
  gl.uniform1i(uniform.uAlbedo,0);gl.uniform1i(uniform.uNormal,1);gl.uniform1i(uniform.uOccluder,2);
  gl.uniform2f(uniform.uResolution,width,height);
  gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
 };
 init();
 function paint(draw,time,lights,options={}){
  ctx.setTransform(1,0,0,1,0,0);nctx.setTransform(1,0,0,1,0,0);octx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,width,height);
  nctx.fillStyle="rgb(128,128,255)";nctx.fillRect(0,0,width,height);
  octx.clearRect(0,0,width,height);
  draw({ctx,normal:nctx,occlusion:octx,width,height,time});
  if(fallback){
   fallback.clearRect(0,0,target.width,target.height);
   fallback.drawImage(albedo,0,0,target.width,target.height);
   // Two-dimensional lantern lighting still visible in fallback.
   fallback.save();fallback.globalCompositeOperation="screen";
   for(const l of lights.slice(0,6)){
    const x=l.x/width*target.width,y=l.y/height*target.height;
    const radius=l.radius/height*target.height;
    const gradient=fallback.createRadialGradient(x,y,0,x,y,radius);
    const [r,g,b]=l.color.map(v=>Math.round(v*255));
    gradient.addColorStop(0,`rgba(${r},${g},${b},${clamp(l.intensity*.19,0,.48)})`);
    gradient.addColorStop(1,"rgba(0,0,0,0)");
    fallback.fillStyle=gradient;fallback.fillRect(x-radius,y-radius,radius*2,radius*2);
   }
   fallback.restore();return;
  }
  gl.viewport(0,0,target.width,target.height);
  gl.useProgram(program);gl.bindVertexArray(vao);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  for(let i=0;i<3;i++){
   gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,[albedo,normal,occluder][i]);
  }
  const lp=new Float32Array(24),lc=new Float32Array(24);
  for(let i=0;i<Math.min(lights.length,6);i++){
   const light=lights[i];lp.set([light.x/width,1-light.y/height,light.radius/height,light.intensity],i*4);
   lc.set([...light.color,light.exposure??1],i*4);
  }
  gl.uniform1i(uniform.uCount,Math.min(6,lights.length));
  gl.uniform4fv(uniform.uLights,lp);gl.uniform4fv(uniform.uColors,lc);
  gl.uniform1f(uniform.uTime,time);gl.uniform1f(uniform.uDarkness,options.darkness??.24);
  gl.uniform1f(uniform.uShadows,quality==="low"?.0:1.0);
  gl.drawArrays(gl.TRIANGLES,0,3);
 }
 function resize(pixelRatio=1){
  const rect=target.getBoundingClientRect(),scale=clamp(pixelRatio,.5,1.5);
  target.width=Math.max(1,Math.round(rect.width*scale));target.height=Math.max(1,Math.round(rect.height*scale));
 }
 function dispose(){if(gl){for(const t of textures)gl.deleteTexture(t);gl.deleteVertexArray(vao);gl.deleteProgram(program);}}
 return {paint,resize,dispose,width,height,backend:gl?"WebGL2 dynamic normal-mapped lighting":"Canvas2D fallback"};
}
