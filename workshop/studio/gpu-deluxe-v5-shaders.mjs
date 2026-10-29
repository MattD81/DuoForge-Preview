/**
 * GPU Deluxe V5 shaders: genuine triangle BVH traversal in GLSL ES 3.00.
 * First hit + hard sunlight shadow + one reflected hit + local AO sample.
 * No hardware RT acceleration, no arbitrary GLB textures or neural models.
 */
export const V5_RAYTRACE_SHADER={
 vertexShader:String.raw`
 in vec3 position;
 in vec2 uv;
 out vec2 vUv;
 void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}
`,
 fragmentShader:String.raw`
 precision highp float;
 precision highp int;
 in vec2 vUv;
 out vec4 outColor;
 uniform sampler2D uTriangles;
 uniform sampler2D uNodes;
 uniform int uNodeCount;
 uniform int uTriangleCount;
 uniform mat4 uCameraWorld;
 uniform mat4 uInvProjection;
 uniform vec2 uResolution;
 uniform float uFrame;
 uniform float uSampleCount;
 uniform float uExposure;
 float hash(vec2 p){
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);
 }
 vec3 sky(vec3 ray){
  float h=clamp(ray.y*.5+.5,0.,1.);
  vec3 horizon=vec3(.36,.54,.76),zenith=vec3(.026,.06,.15);
  vec3 base=mix(horizon,zenith,pow(h,1.45));
  float sun=pow(max(dot(ray,normalize(vec3(.48,.85,.26))),0.),350.);
  return base+vec3(1.7,1.25,.78)*sun;
 }
 vec3 vertexAt(int idx,int vert){
  return texelFetch(uTriangles,ivec2(idx*5+vert,0),0).xyz;
 }
 vec4 matAt(int idx){return texelFetch(uTriangles,ivec2(idx*5+3,0),0);}
 float roughAt(int idx){return texelFetch(uTriangles,ivec2(idx*5+4,0),0).x;}
 vec3 invSafe(vec3 d){
  return 1./vec3(
   abs(d.x)<1e-6?(d.x<0.?-1e-6:1e-6):d.x,
   abs(d.y)<1e-6?(d.y<0.?-1e-6:1e-6):d.y,
   abs(d.z)<1e-6?(d.z<0.?-1e-6:1e-6):d.z);
 }
 bool boxHit(vec3 ro,vec3 invDir,vec3 mn,vec3 mx,float closest){
  vec3 v0=(mn-ro)*invDir,v1=(mx-ro)*invDir;
  vec3 t0=min(v0,v1),t1=max(v0,v1);
  float nearT=max(max(t0.x,t0.y),t0.z);
  float farT=min(min(t1.x,t1.y),t1.z);
  return farT>=max(nearT,0.002)&&nearT<closest;
 }
 float triangleHit(vec3 ro,vec3 rd,int idx){
  vec3 a=vertexAt(idx,0),b=vertexAt(idx,1),c=vertexAt(idx,2);
  vec3 e1=b-a,e2=c-a,h=cross(rd,e2);
  float det=dot(e1,h);
  if(abs(det)<1e-7)return 1e20;
  float f=1./det;
  vec3 s=ro-a;
  float u=f*dot(s,h);
  if(u<0.||u>1.)return 1e20;
  vec3 q=cross(s,e1);
  float v=f*dot(rd,q);
  if(v<0.||u+v>1.)return 1e20;
  float t=f*dot(e2,q);
  return t>.003?t:1e20;
 }
 // Depth-first BVH traversal. Traversal budget is bounded for browser safety.
 vec2 trace(vec3 ro,vec3 rd){
  float nearest=1e20;
  float hitId=-2.;
  vec3 invDir=invSafe(rd);
  int stack[24];int top=0;stack[0]=0;
  for(int visit=0;visit<256;visit++){
   if(top<0||uNodeCount<=0)break;
   int index=stack[top];top--;
   if(index<0||index>=uNodeCount)continue;
   vec4 mn=texelFetch(uNodes,ivec2(index*2,0),0);
   vec4 mx=texelFetch(uNodes,ivec2(index*2+1,0),0);
   if(!boxHit(ro,invDir,mn.xyz,mx.xyz,nearest))continue;
   int left=int(round(mn.w)),right=int(round(mx.w));
   if(left<0){
    int first=-left-1;
    for(int i=0;i<4;i++){
     if(i>=right)break;
     int tri=first+i;
     if(tri<0||tri>=uTriangleCount)continue;
     float t=triangleHit(ro,rd,tri);
     if(t<nearest){nearest=t;hitId=float(tri);}
    }
   }else{
    if(top<21){
     stack[++top]=left;
     stack[++top]=right;
    }
   }
  }
  if(rd.y<-.000001){
   float t=-ro.y/rd.y;
   if(t>.003&&t<nearest){nearest=t;hitId=-1.;}
  }
  return vec2(nearest,hitId);
 }
 vec3 surfaceNormal(vec3 p,int id,vec3 rd){
  if(id<0)return vec3(0.,1.,0.);
  vec3 a=vertexAt(id,0),b=vertexAt(id,1),c=vertexAt(id,2);
  vec3 n=normalize(cross(b-a,c-a));
  return dot(n,rd)>0.?-n:n;
 }
 vec3 albedo(vec3 p,int id){
  if(id<0){
   float c=mod(floor(p.x)+floor(p.z),2.);
   return mix(vec3(.16,.18,.21),vec3(.22,.26,.29),c);
  }
  return matAt(id).rgb;
 }
 float roughness(int id){return id<0?.64:clamp(roughAt(id),.08,1.);}
 float metalness(int id){return id<0?.05:clamp(matAt(id).a,0.,1.);}
 vec3 shadeDirect(vec3 ro,vec3 rd,vec2 hit,float seed){
  if(hit.y< -1.5)return sky(rd);
  int id=int(hit.y+.01);
  vec3 p=ro+rd*hit.x;
  vec3 n=surfaceNormal(p,id,rd),v=-rd;
  vec3 lightDir=normalize(vec3(.48,.85,.26));
  vec2 blocker=trace(p+n*.02,lightDir);
  float visible=blocker.x<1e19?.17:1.;
  float ndl=max(dot(n,lightDir),0.);
  // One local ambient occlusion ray, sampled only in Cinematic/Extreme mode.
  float ao=1.;
  if(uSampleCount>1.5){
   float a=6.2831853*hash(p.xz+vec2(seed,seed*.3));
   vec3 helper=abs(n.y)<.92?vec3(0.,1.,0.):vec3(1.,0.,0.);
   vec3 tangent=normalize(cross(helper,n));
   vec3 bitangent=normalize(cross(n,tangent));
   vec3 hemi=normalize(n*.74+(tangent*cos(a)+bitangent*sin(a))*.67);
   vec2 occ=trace(p+n*.02,hemi);
   ao=occ.x<1.5?.47:1.;
  }
  vec3 base=albedo(p,id),halfDir=normalize(lightDir+v);
  float rough=roughness(id),metal=metalness(id);
  float ndh=max(dot(n,halfDir),0.);
  float specPower=mix(110.,8.,rough);
  vec3 fresnel=mix(vec3(.04),base,metal);
  fresnel+=(1.-fresnel)*pow(1.-max(dot(halfDir,v),0.),5.);
  vec3 spec=fresnel*pow(ndh,specPower)*(1.2-rough)*visible*ndl;
  vec3 diffuse=(base*(1.-metal))*ndl*visible*vec3(1.42,1.24,1.03);
  vec3 ambient=base*vec3(.10,.15,.21)*ao;
  return ambient+diffuse+spec;
 }
 void main(){
  // Subpixel jitter supplies progressive antialiasing when camera stops.
  vec2 jitter=vec2(hash(gl_FragCoord.xy+uFrame*.41),
   hash(gl_FragCoord.yx+uFrame*.73))-.5;
  vec2 uv=(gl_FragCoord.xy+jitter)/uResolution;
  vec4 projected=uInvProjection*vec4(uv*2.-1.,1.,1.);
  vec3 ray=normalize((uCameraWorld*vec4(normalize(projected.xyz/projected.w),0.)).xyz);
  vec3 ro=uCameraWorld[3].xyz;
  vec2 first=trace(ro,ray);
  vec3 color=shadeDirect(ro,ray,first,uFrame);
  if(first.y>=-1.){
   int id=int(first.y+.01);
   vec3 p=ro+ray*first.x;
   vec3 n=surfaceNormal(p,id,ray);
   vec3 reflected=normalize(reflect(ray,n));
   vec3 rstart=p+n*.025;
   float m=metalness(id),r=roughness(id);
   // Single reflected secondary ray; softened by surface roughness.
   vec2 second=trace(rstart,reflected);
   vec3 reflectedLight=shadeDirect(rstart,reflected,second,uFrame+11.);
   float strength=clamp(.12+m*.65-r*.13,.02,.83);
   color=mix(color,reflectedLight,strength);
  }
  // Bounded output. The accumulation target may be half-float or RGBA8.
  color=max(color*uExposure,vec3(0.));
  color=color/(color+vec3(1.));
  outColor=vec4(color,1.);
 }
`
};
export const V5_ACCUMULATE_SHADER={
 vertexShader:V5_RAYTRACE_SHADER.vertexShader,
 fragmentShader:String.raw`
 precision highp float;
 in vec2 vUv;
 out vec4 outColor;
 uniform sampler2D uCurrent;
 uniform sampler2D uHistory;
 uniform float uSamples;
 void main(){
  vec3 sampleColor=texture(uCurrent,vUv).rgb;
  vec3 historical=texture(uHistory,vUv).rgb;
  float amount=uSamples<=1.?0.:min(.97,(uSamples-1.)/uSamples);
  outColor=vec4(mix(sampleColor,historical,amount),1.);
 }
`
};
export const V5_PRESENT_SHADER={
 vertexShader:V5_RAYTRACE_SHADER.vertexShader,
 fragmentShader:String.raw`
 precision highp float;
 in vec2 vUv;
 out vec4 outColor;
 uniform sampler2D uSource;
 uniform vec2 uTexel;
 uniform float uDenoise;
 void main(){
  vec3 c=texture(uSource,vUv).rgb;
  vec3 x0=texture(uSource,vUv+vec2(uTexel.x,0.)).rgb;
  vec3 x1=texture(uSource,vUv-vec2(uTexel.x,0.)).rgb;
  vec3 y0=texture(uSource,vUv+vec2(0.,uTexel.y)).rgb;
  vec3 y1=texture(uSource,vUv-vec2(0.,uTexel.y)).rgb;
  // Edge-aware spatial denoising, not a neural denoiser.
  float w0=exp(-length(c-x0)*20.)*uDenoise;
  float w1=exp(-length(c-x1)*20.)*uDenoise;
  float w2=exp(-length(c-y0)*20.)*uDenoise;
  float w3=exp(-length(c-y1)*20.)*uDenoise;
  c=(c+x0*w0+x1*w1+y0*w2+y1*w3)/(1.+w0+w1+w2+w3);
  c=pow(max(c,vec3(0.)),vec3(1./2.2));
  // Small vignette for cinema look; never changes editable scene materials.
  vec2 p=vUv-.5;
  c*=1.-clamp(dot(p,p)*.38,0.,.25);
  outColor=vec4(c,1.);
 }
`
};
