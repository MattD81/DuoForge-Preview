// DuoForge Ocean: procedural GPU waves, deterministic CPU sampler, no external APIs.
import * as THREE from "three";
export const OCEAN_DEFAULTS=Object.freeze({height:.58,speed:1,weather:"clear"});
export const OCEAN_WEATHER=Object.freeze(["clear","sunset","storm"]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function normalizeOceanSettings(value={}){
 return {height:clamp(Number.isFinite(Number(value.height))?Number(value.height):.58,.05,1.8),
 speed:clamp(Number.isFinite(Number(value.speed))?Number(value.speed):1,.15,3),
 weather:OCEAN_WEATHER.includes(value.weather)?value.weather:"clear"};
}
export function oceanHeight(x,z,time,settings=OCEAN_DEFAULTS){
 const s=normalizeOceanSettings(settings),t=time*s.speed,w=s.height*(s.weather==="storm"?1.48:1);
 return -.38+w*(.38*Math.sin(x*.105+z*.037+t*.91)
  +.26*Math.cos(z*.16-x*.065-t*1.25)
  +.16*Math.sin(x*.32+z*.24+t*1.83)
  +.13*Math.cos(Math.hypot(x*.7,z*.7)*.18-t*.75));
}
const vertex=[
 "uniform float uTime,uHeight,uSpeed,uStorm;",
 "varying vec3 vWorld,vNormalWater; varying float vWave;",
 "float ocean(vec2 p,float t){return uHeight*uStorm*(.38*sin(p.x*.105+p.y*.037+t*.91)+.26*cos(p.y*.16-p.x*.065-t*1.25)+.16*sin(p.x*.32+p.y*.24+t*1.83)+.13*cos(length(p*.7)*.18-t*.75));}",
 "void main(){",
 " float t=uTime*uSpeed; vec3 p=position; float h=ocean(p.xz,t); p.y+=h;",
 " float dx=(ocean(p.xz+vec2(.22,0.),t)-ocean(p.xz-vec2(.22,0.),t))/.44;",
 " float dz=(ocean(p.xz+vec2(0.,.22),t)-ocean(p.xz-vec2(0.,.22),t))/.44;",
 " vNormalWater=normalize(mat3(modelMatrix)*normalize(vec3(-dx,1.,-dz)));",
 " vec4 world=modelMatrix*vec4(p,1.); vWorld=world.xyz;vWave=h;",
 " gl_Position=projectionMatrix*viewMatrix*world;}"
].join("\n");
const fragment=[
 "precision highp float;",
 "uniform float uHeight,uStorm,uTime,uSpeed,uHaze;",
 "uniform vec3 uDeep,uShallow,uSky,uSun;",
 "varying vec3 vWorld,vNormalWater; varying float vWave;",
 "void main(){",
 " vec3 N=normalize(vNormalWater),V=normalize(cameraPosition-vWorld);",
 " vec3 L=normalize(vec3(.34,.88,-.35)); float ndv=max(dot(N,V),0.);",
 " float fresnel=pow(1.-ndv,4.5); float light=max(dot(N,L),0.);",
 " vec3 H=normalize(L+V);float spec=pow(max(dot(N,H),0.),uStorm>1.1?120.:220.);",
 " float level=clamp(.50+vWave/max(.18,uHeight*1.4),0.,1.);",
 " vec3 water=mix(uDeep,uShallow,level*.67);",
 " water=mix(water,uSky,.13+fresnel*.67);water+=uSun*spec*2.2;",
 " water+=uSun*pow(light,8.)*.085;",
 " float crest=smoothstep(uHeight*.37,uHeight*.69,vWave);",
 " float micro=.5+.5*sin(vWorld.x*2.2+uTime*uSpeed*2.1)*sin(vWorld.z*1.9-uTime*1.7);",
 " float foam=crest*micro*(uStorm>1.1?.71:.18);",
 " water=mix(water,vec3(.79,.95,.94),foam);",
 " float distanceFromCamera=distance(cameraPosition,vWorld);",
 " float haze=1.-exp(-distanceFromCamera*uHaze);",
 " water=mix(water,uSky,haze*.86);",
 " gl_FragColor=vec4(water,1.);",
 " #include <tonemapping_fragment>",
 " #include <colorspace_fragment>",
 "}"
].join("\n");
export function createOceanSurface({quality="medium",settings=OCEAN_DEFAULTS}={}){
 const initial=normalizeOceanSettings(settings);
 const divisions=quality==="low"?66:quality==="high"?166:112;
 const geometry=new THREE.PlaneGeometry(720,720,divisions,divisions);
 geometry.rotateX(-Math.PI/2);
 const uniforms={
  uTime:{value:0},uHeight:{value:initial.height},uSpeed:{value:initial.speed},
  uStorm:{value:initial.weather==="storm"?1.48:1},
  uDeep:{value:new THREE.Color("#06415a")},
  uShallow:{value:new THREE.Color("#209aa6")},
  uSky:{value:new THREE.Color("#80bfd7")},
  uSun:{value:new THREE.Color("#ffe1a0")},
  uHaze:{value:.0035}
 };
 const material=new THREE.ShaderMaterial({name:"DuoForge animated ocean",uniforms,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide});
 material.toneMapped=true;
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name="GPU Ocean - four moving wave layers";
 mesh.position.y=-.38;
 mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.frustumCulled=false;mesh.renderOrder=0;
 mesh.userData.oceanPreview=true;
 let current=initial;
 function setSettings(raw){
  current=normalizeOceanSettings(raw);
  uniforms.uHeight.value=current.height;uniforms.uSpeed.value=current.speed;
  uniforms.uStorm.value=current.weather==="storm"?1.48:1;
  if(current.weather==="storm"){
   uniforms.uDeep.value.set("#071b2c");uniforms.uShallow.value.set("#276674");
   uniforms.uSky.value.set("#586f84");uniforms.uSun.value.set("#cad8f0");uniforms.uHaze.value=.007;
  }else if(current.weather==="sunset"){
   uniforms.uDeep.value.set("#122e51");uniforms.uShallow.value.set("#408f9c");
   uniforms.uSky.value.set("#ebad92");uniforms.uSun.value.set("#ffbf70");uniforms.uHaze.value=.0045;
  }else{
   uniforms.uDeep.value.set("#06415a");uniforms.uShallow.value.set("#209aa6");
   uniforms.uSky.value.set("#80bfd7");uniforms.uSun.value.set("#ffe1a0");uniforms.uHaze.value=.0035;
  }
  return current;
 }
 setSettings(initial);
 return {mesh,settings:()=>({...current}),setSettings,
  update(time){uniforms.uTime.value=time;},
  heightAt(x,z,time){return oceanHeight(x,z,time,current)},
  dispose(){geometry.dispose();material.dispose();}
 };
}
