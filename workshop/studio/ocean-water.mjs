// DuoForge Ocean V5: coherent 7-band directional spectrum, GGX sky/sun reflection,
// non-periodic breaking foam and camera-adaptive capillary normal detail.
// Deterministic and local; not an FFT hydrodynamic simulation or full raytracing.
import * as THREE from "three";
import {spectralHeight,spectralSlope,spectralGLSL,slopeGLSL,isStorm} from "./ocean-spectrum.mjs";
export const OCEAN_DEFAULTS=Object.freeze({height:.58,speed:1,weather:"clear"});
export const OCEAN_WEATHER=Object.freeze(["clear","sunset","storm","storm-sunset"]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function normalizeOceanSettings(value={}){
 return {height:clamp(Number.isFinite(Number(value.height))?Number(value.height):.58,.05,1.8),
 speed:clamp(Number.isFinite(Number(value.speed))?Number(value.speed):1,.15,3),
 weather:OCEAN_WEATHER.includes(value.weather)?value.weather:"clear"};
}
export function oceanHeight(x,z,time,settings=OCEAN_DEFAULTS){
 const s=normalizeOceanSettings(settings);
 return -.38+spectralHeight(x,z,time,s.height*(isStorm(s.weather)?1.48:1),s.speed);
}
export function oceanSlope(x,z,time,settings=OCEAN_DEFAULTS){
 const s=normalizeOceanSettings(settings);
 return spectralSlope(x,z,time,s.height*(isStorm(s.weather)?1.48:1),s.speed);
}
const vertex=[
 "uniform float uTime,uHeight,uSpeed,uStorm;",
 "varying vec3 vWorld,vNormalWater; varying float vWave;",
 "float ocean(vec2 p,float t){return uHeight*uStorm*("+spectralGLSL+");}",
 "vec2 oceanSlope(vec2 p,float t){return uHeight*uStorm*vec2("+slopeGLSL.x+","+slopeGLSL.z+");}",
 "void main(){",
 " float t=uTime*uSpeed;vec3 p=position;",
 " float h=ocean(p.xz,t);p.y+=h;",
 " vec2 slope=oceanSlope(p.xz,t);",
 " vNormalWater=normalize(mat3(modelMatrix)*normalize(vec3(-slope.x,1.,-slope.y)));",
 " vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vWave=h;",
 " gl_Position=projectionMatrix*viewMatrix*world;}"
].join("\n");
const fragment=[
 "precision highp float;",
 "uniform float uHeight,uStorm,uTime,uSpeed,uHaze,uDetail,uRoughness;",
 "uniform vec3 uDeep,uShallow,uSky,uSun,uSunDir;",
 "varying vec3 vWorld,vNormalWater;varying float vWave;",
 "const float PI=3.141592653589793;",
 // Smooth pseudo-random value noise, no hard sin-grid sparkle mask.
 "float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
 "float noiset(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
 " return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),",
 " mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);}",
 "float fbm(vec2 p){return .56*noiset(p)+.30*noiset(p*2.07+vec2(17.1,9.7))+",
 " .14*noiset(p*4.17+vec2(29.2,14.5));}",
 "float ggxD(float nDotH,float rough){float a=rough*rough,a2=a*a;",
 " float v=nDotH*nDotH*(a2-1.)+1.;return a2/max(.0005,PI*v*v);}",
 "float smithG(float nDotV,float nDotL,float rough){",
 " float k=pow(rough+1.,2.)/8.;",
 " return (nDotV/max(.0001,nDotV*(1.-k)+k))*(nDotL/max(.0001,nDotL*(1.-k)+k));}",
 "void main(){",
 " vec3 V=normalize(cameraPosition-vWorld);",
 " float distanceFromCamera=distance(cameraPosition,vWorld);",
 " float microFade=(1.-smoothstep(35.,210.,distanceFromCamera))*uDetail;",
 // Micro-normals are continuous, wind oriented and fade out before aliasing.
 " vec2 fine=vWorld.xz;",
 " vec2 bump=.013*vec2(cos(dot(fine,vec2(1.83,.62))+uTime*uSpeed*4.2),",
 " sin(dot(fine,vec2(-.57,1.64))-uTime*uSpeed*4.8));",
 " bump+=.008*vec2(sin(dot(fine,vec2(3.1,-1.27))-uTime*6.5),",
 " cos(dot(fine,vec2(.92,2.94))+uTime*6.9));",
 " vec3 N=normalize(vNormalWater+vec3(bump.x,0.,bump.y)*microFade);",
 " vec3 L=normalize(uSunDir);",
 " float ndv=max(dot(N,V),.001),ndl=max(dot(N,L),0.);",
 " vec3 H=normalize(L+V);float ndh=max(dot(N,H),0.),vdh=max(dot(V,H),0.);",
 // Fresnel F0 ~2% for seawater, rising towards grazing angles.
 " float fresnel=.0204+.9796*pow(1.-ndv,5.);",
 " float ff=.0204+.9796*pow(1.-vdh,5.);",
 " float specular=ggxD(ndh,uRoughness)*smithG(ndv,ndl,uRoughness)*ff*ndl/max(.08,4.*ndv*ndl);",
 " specular=clamp(specular,0.,.85);",
 // Reflection of the procedural atmosphere in the normal direction.
 " vec3 R=reflect(-V,N);",
 " float altitude=smoothstep(-.15,.72,R.y);",
 " vec3 reflectedSky=mix(uSky,uSky*.42+vec3(.018,.035,.067),altitude);",
 " float cloud=fbm(R.xz*5.8+R.y*4.2+vec2(uTime*.009,-uTime*.006));",
 " reflectedSky*=mix(.78,1.10,smoothstep(.30,.80,cloud));",
 // Albedo stays dark and absorbs light at normal incidence, unlike metallic paint.
 " float level=clamp(.48+vWave/max(.2,uHeight*uStorm*2.0),0.,1.);",
 " vec3 base=mix(uDeep,uShallow,level*.39);",
 " vec3 water=mix(base,reflectedSky,clamp(fresnel*.92+.095,0.,.85));",
 " water+=uSun*specular*1.75;",
 // Breaking whitewater requires both a crest and sufficiently steep face;
 // deterministic low-frequency value noise breaks foam into organic fragments.
 " float crest=vWave/max(.03,uHeight*uStorm);",
 " float slope=sqrt(max(0.,1.-N.y*N.y));",
 " float breaker=smoothstep(.57,.89,crest)*smoothstep(.055,.18,slope);",
 " float foamPatch=fbm(vWorld.xz*.13+vec2(uTime*uSpeed*.18,-uTime*.09));",
 " float foam=breaker*smoothstep(.45,.68,foamPatch)*(uStorm>1.1?.63:.14);",
 " water=mix(water,vec3(.69,.83,.84),clamp(foam,0.,.7));",
 // The reflected sky and water converge in mist without a hard horizon line.
 " float haze=1.-exp(-distanceFromCamera*uHaze);",
 " water=mix(water,uSky,haze*.55);",
 " gl_FragColor=vec4(max(water,vec3(0.)),1.);",
 " #include <tonemapping_fragment>",
 " #include <colorspace_fragment>",
 "}"
].join("\n");
export function createOceanSurface({quality="medium",settings=OCEAN_DEFAULTS}={}){
 const initial=normalizeOceanSettings(settings);
 const divisions=quality==="low"?66:quality==="high"?190:118;
 const geometry=new THREE.PlaneGeometry(720,720,divisions,divisions);
 geometry.rotateX(-Math.PI/2);
 const uniforms={
  uTime:{value:0},uHeight:{value:initial.height},uSpeed:{value:initial.speed},
  uStorm:{value:isStorm(initial.weather)?1.48:1},
  uDeep:{value:new THREE.Color("#06415a")},
  uShallow:{value:new THREE.Color("#209aa6")},
  uSky:{value:new THREE.Color("#80bfd7")},
  uSun:{value:new THREE.Color("#ffe1a0")},
  uSunDir:{value:new THREE.Vector3(-.56,.125,.82).normalize()},
  uRoughness:{value:.25},
  uDetail:{value:quality==="low"?.35:quality==="high"?1:.72},
  uHaze:{value:.0035}
 };
 const material=new THREE.ShaderMaterial({
  name:"DuoForge Ocean V5 – directional swell and microfacet sky",
  uniforms,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide
 });
 material.toneMapped=true;
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name="GPU Ocean V5 – coherent wind-driven wave spectrum";
 mesh.position.y=-.38;mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.frustumCulled=false;mesh.renderOrder=0;
 mesh.userData.oceanPreview=true;
 let current=initial;
 function setSettings(raw){
  current=normalizeOceanSettings(raw);
  uniforms.uHeight.value=current.height;uniforms.uSpeed.value=current.speed;
  uniforms.uStorm.value=isStorm(current.weather)?1.48:1;
  if(current.weather==="storm-sunset"){
   uniforms.uDeep.value.set("#071a29");uniforms.uShallow.value.set("#1c485b");
   uniforms.uSky.value.set("#bd847e");uniforms.uSun.value.set("#ffd69f");
   uniforms.uSunDir.value.set(-.56,.125,.82).normalize();
   uniforms.uRoughness.value=.29;uniforms.uHaze.value=.006;
  }else if(current.weather==="storm"){
   uniforms.uDeep.value.set("#061925");uniforms.uShallow.value.set("#245366");
   uniforms.uSky.value.set("#667d92");uniforms.uSun.value.set("#d6dcdf");
   uniforms.uSunDir.value.set(-.44,.42,.78).normalize();
   uniforms.uRoughness.value=.34;uniforms.uHaze.value=.007;
  }else if(current.weather==="sunset"){
   uniforms.uDeep.value.set("#082239");uniforms.uShallow.value.set("#205f68");
   uniforms.uSky.value.set("#d29e89");uniforms.uSun.value.set("#ffd5a0");
   uniforms.uSunDir.value.set(-.56,.125,.82).normalize();
   uniforms.uRoughness.value=.23;uniforms.uHaze.value=.0045;
  }else{
   uniforms.uDeep.value.set("#073448");uniforms.uShallow.value.set("#206a7e");
   uniforms.uSky.value.set("#8dbccf");uniforms.uSun.value.set("#fff1d7");
   uniforms.uSunDir.value.set(-.44,.73,.53).normalize();
   uniforms.uRoughness.value=.25;uniforms.uHaze.value=.0035;
  }
  return current;
 }
 setSettings(initial);
 return {mesh,settings:()=>({...current}),setSettings,
  update(time){uniforms.uTime.value=time;},
  heightAt(x,z,time){return oceanHeight(x,z,time,current)},
  slopeAt(x,z,time){return oceanSlope(x,z,time,current)},
  dispose(){geometry.dispose();material.dispose();}
 };
}
