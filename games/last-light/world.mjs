import * as THREE from "three";
import {createOceanSurface} from "../../workshop/studio/ocean-water.mjs?v=research-3d-v1";
import {atmosphereState} from "../../workshop/studio/atmosphere-scattering.mjs";
import {MISSIONS} from "./gameplay.mjs";
import {ISLAND_SITES,terrainHeight} from "./coastal-terrain.mjs";
import {buildCoastalWorld,enhanceLighthouse} from "./coastal-world.mjs";
import {createWakeTrails} from "./wake-trails.mjs";

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rand=(()=>{let s=740331;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}})();

// Shared spectral ocean geometry/physics, with an affordable fragment lighting
// path for mobile/software GPUs (no dozens of noise evaluations per pixel).
function useLowPowerSeaShader(ocean){
 const material=ocean.mesh.material;
 material.fragmentShader=[
  "precision highp float;",
  "uniform float uHeight,uStorm,uTime,uSpeed,uHaze,uDetail,uRoughness,uWhitecaps;",
  "uniform vec3 uDeep,uShallow,uSky,uSun,uSunDir;",
  "varying vec3 vWorld,vNormalWater;varying float vWave;",
  "void main(){",
  " vec3 N=normalize(vNormalWater),V=normalize(cameraPosition-vWorld);",
  " float ndv=clamp(dot(N,V),.0,1.);",
  " float fresnel=.0204+.9796*pow(1.-ndv,5.);",
  " vec3 R=reflect(-V,N);float atmosphere=smoothstep(-.2,.75,R.y);",
  " vec3 sky=mix(uSky,uSky*.42+vec3(.019,.03,.05),atmosphere);",
  " vec3 water=mix(mix(uDeep,uShallow,.24),sky,clamp(fresnel*.9+.12,0.,.88));",
  " vec3 H=normalize(V+normalize(uSunDir));",
  " water+=uSun*pow(max(dot(N,H),0.),58.)*.17;",
  " float crest=clamp(vWave/max(.05,uHeight*uStorm),-1.,1.);",
  " float foam=smoothstep(.72,.96,crest)*uWhitecaps*.17;",
  " water=mix(water,vec3(.38,.53,.58),foam);",
  " float haze=1.-exp(-distance(vWorld,cameraPosition)*uHaze);",
  " water=mix(water,uSky,haze*.5);",
  " gl_FragColor=vec4(max(water,vec3(0.)),1.);",
  " #include <tonemapping_fragment>",
  " #include <colorspace_fragment>",
  "}"
 ].join("\n");
 material.needsUpdate=true;
}

export function createWorld({scene,quality="medium"}){
 const world=new THREE.Group();world.name="LAST LIGHT – dynamic world";scene.add(world);
 const ocean=createOceanSurface({quality,settings:{height:.93,speed:1.07,weather:"storm-sunset",whitecaps:.21,sunElevation:7}});
 if(quality==="low")useLowPowerSeaShader(ocean);
 world.add(ocean.mesh);
 const state={weather:"storm-sunset",elevation:7};
 const atmosphere=atmosphereState(state.weather,state.elevation);
 const hemi=new THREE.HemisphereLight(0xf2d3bb,0x0b2f44,atmosphere.hemisphere);
 scene.add(hemi);
 const key=new THREE.DirectionalLight(atmosphere.sunColor,atmosphere.power);
 key.position.fromArray(atmosphere.position);key.castShadow=quality!=="low";
 key.shadow.mapSize.set(quality==="high"?2048:1024,quality==="high"?2048:1024);
 key.shadow.camera.left=-50;key.shadow.camera.right=50;key.shadow.camera.top=50;key.shadow.camera.bottom=-50;
 key.shadow.normalBias=.035;scene.add(key);
 const sky=new THREE.Mesh(new THREE.SphereGeometry(465,48,28),new THREE.ShaderMaterial({
  name:"LAST LIGHT scattering and storm-cloud sky",side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{
   uSun:{value:new THREE.Vector3(...atmosphere.direction)},
   uTop:{value:new THREE.Color(atmosphere.skyTop)},
   uHorizon:{value:new THREE.Color(atmosphere.skyHorizon)},
   uTime:{value:0},uStorm:{value:1}
  },
  vertexShader:`varying vec3 vRay;void main(){vRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`
   precision highp float;
   varying vec3 vRay;uniform vec3 uSun,uTop,uHorizon;uniform float uTime,uStorm;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
   float fbm(vec2 p){return .52*noise(p)+.31*noise(p*2.07+vec2(17.3,3.7))+.17*noise(p*4.51);}
   void main(){
    vec3 d=normalize(vRay),sun=normalize(uSun);
    float horizon=clamp(d.y*.93+.49,0.,1.);
    vec3 col=mix(uHorizon,uTop,smoothstep(0.,.92,horizon));
    float facing=max(dot(d,sun),0.);
    float rayleigh=3.*(1.+facing*facing)/(16.*3.14159265);
    float g=.76,mie=(1.-g*g)/(4.*3.14159265*pow(max(.03,1.+g*g-2.*g*facing),1.5));
    col+=vec3(.13,.25,.45)*rayleigh*.24;
    col+=vec3(.95,.55,.27)*min(.31,mie*.057);
    vec2 uv=vec2(atan(d.x,d.z)*3.8,d.y*3.8);
    float n=fbm(uv*1.47+vec2(uTime*.0034,-uTime*.0018));
    n=.62*n+.38*fbm(uv*3.18+vec2(-uTime*.002,uTime*.001));
    float coverage=smoothstep(.43,.59,n+uStorm*.07);
    coverage*=1.-smoothstep(.42,.83,d.y);
    vec3 shadow=vec3(.055,.075,.13);
    vec3 lit=vec3(.49,.31,.32)*(1.-uStorm*.28);
    vec3 cloud=mix(shadow,lit,clamp(facing*.65+.16,0.,1.));
    float rim=smoothstep(.49,.62,n)-smoothstep(.61,.75,n);
    col=mix(col,cloud,coverage*(.35+uStorm*.55));
    col+=rim*coverage*vec3(.18,.067,.038)*pow(facing,8.);
    float disk=pow(facing,1800.)*(1.-coverage*.8);
    col+=vec3(1.,.84,.53)*disk*.77;
    gl_FragColor=vec4(max(col,vec3(0.)),1.);
   }`
 }));
 if(quality==="low"){
  // Affordable scattering/cloud approximation for mobile and software WebGL.
  // Film mode retains the original multi-octave sky shader.
  sky.material.fragmentShader=`
   precision mediump float;
   varying vec3 vRay;
   uniform vec3 uSun,uTop,uHorizon;
   uniform float uTime,uStorm;
   void main(){
    vec3 d=normalize(vRay),sun=normalize(uSun);
    float level=smoothstep(-.03,.73,d.y);
    vec3 color=mix(uHorizon,uTop,level);
    float facing=max(dot(d,sun),0.);
    float band=.5+.29*sin(d.x*14.+d.z*7.+uTime*.003)+.2*sin(d.z*24.-d.x*9.);
    float cloud=smoothstep(.65,.83,band)*(.42+.4*uStorm);
    color=mix(color,vec3(.13,.17,.23),cloud*(1.-level*.65));
    color+=vec3(1.,.55,.25)*pow(facing,65.)*.16;
    color+=vec3(1.,.77,.46)*pow(facing,750.)*.65;
    gl_FragColor=vec4(color,1.);
   }`;
  sky.material.needsUpdate=true;
 }
 sky.name="Atmospheric single-scattering and storm sky";
 sky.renderOrder=-100;world.add(sky);
 scene.fog=new THREE.FogExp2(atmosphere.fog,.0019);
 // Physical island silhouettes and slanted lighthouse constructions.
 const stone=new THREE.MeshStandardMaterial({color:0x38474c,roughness:.94,metalness:.06});
 const rockFace=new THREE.MeshStandardMaterial({color:0x66716c,roughness:.94});
 const fir=new THREE.MeshStandardMaterial({color:0x1c423e,roughness:1});
 const pale=new THREE.MeshStandardMaterial({color:0xe2ded1,roughness:.67});
 const gold=new THREE.MeshStandardMaterial({color:0xeecf94,roughness:.39,metalness:.15,emissive:0xe49a48,emissiveIntensity:.36});
 // A reusable, deterministic terrain system replaces the previous faceted island balls.
 // It generates genuine triangulated heightfields, instanced granite/trees and a harbor.
 const coast=buildCoastalWorld({world,quality});
 const islands=coast.islands;
 const put=(geo,mat,name,x,y,z,parent=world)=>{
  const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.position.set(x,y,z);
  mesh.castShadow=quality!=="low";mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const lighthouse=groupPos=>{
  const {x,z}=groupPos;
  const site=ISLAND_SITES.find(s=>s.x===x&&s.z===z);
  const terrain=site?terrainHeight(0,0,site.r,site.seed):0;
  const tower=new THREE.Group();tower.position.set(x,terrain+10.35,z);
  tower.name="Lighthouse – rotating navigation light";world.add(tower);
  put(new THREE.CylinderGeometry(2,3.35,21,14),pale,"Lighthouse tapered stone",0,0,0,tower);
  for(let k=0;k<4;k++)put(new THREE.CylinderGeometry(3.36,3.36,.4,18),stone,"Lighthouse band",0,-7+k*4.2,0,tower);
  put(new THREE.CylinderGeometry(3.1,3.1,.45,16),stone,"Lighthouse lantern balcony",0,10.8,0,tower);
  put(new THREE.CylinderGeometry(2,2,3,16),gold,"Lighthouse lantern glazing",0,12.1,0,tower);
  put(new THREE.ConeGeometry(2.7,2,16),stone,"Lighthouse metal roof",0,14.6,0,tower);
  const bulb=new THREE.PointLight(0xffd48d,quality==="low"?45:90,95,2);
  bulb.position.set(0,12.7,0);tower.add(bulb);
  const axis=new THREE.Group();axis.position.set(0,12.4,0);tower.add(axis);
  const beam=new THREE.SpotLight(0xffe3af,quality==="low"?80:180,175,.23,.75,1.2);
  beam.position.set(0,0,0);axis.add(beam);
  const target=new THREE.Object3D();target.position.set(0,-14,-100);axis.add(target);beam.target=target;
  enhanceLighthouse(tower,quality);
  return axis;
 };
 const lightAxes=[lighthouse({x:119,z:-185}),lighthouse({x:-145,z:-88})];
 // Rescue craft + glTF-friendly signal buoys: no flat card as ship.
 const raftMat=new THREE.MeshStandardMaterial({color:0xeb754c,roughness:.46,metalness:.05});
 const lampMat=new THREE.MeshStandardMaterial({color:0xffdda0,emissive:0xffad58,emissiveIntensity:3,roughness:.25});
 const inactive=new THREE.MeshStandardMaterial({color:0x4d8793,emissive:0x1f6078,emissiveIntensity:.7,roughness:.34});
 const beacons=MISSIONS.map((m,i)=>{
  const g=new THREE.Group();g.name="SOS rescue flare "+(i+1);g.position.set(m.x,0,m.z);world.add(g);
  put(new THREE.CylinderGeometry(.68,.89,.7,14),raftMat,"Liferaft signal base",0,0,0,g);
  const ring=put(new THREE.TorusGeometry(1.45,.20,10,48),raftMat,"Inflatable rescue ring",0,.11,0,g);ring.rotation.x=Math.PI/2;
  const stem=put(new THREE.CylinderGeometry(.07,.09,2.7,10),pale,"Emergency flare mast",0,1.4,0,g);
  const flare=put(new THREE.SphereGeometry(.4,16,12),lampMat,"Animated SOS flare light",0,2.95,0,g);
  const halo=put(new THREE.TorusGeometry(3.2,.11,8,64),lampMat,"Rescue beacon pulse",0,.17,0,g);halo.rotation.x=Math.PI/2;
  const light=new THREE.PointLight(0xffa86c,50,55,2);light.position.y=3;g.add(light);
  const meshText=document.createElement("canvas");meshText.width=512;meshText.height=128;
  const ctx=meshText.getContext("2d");ctx.fillStyle="#ffe9b9";ctx.font="bold 48px system-ui";ctx.textAlign="center";
  ctx.fillText(m.name,256,77);
  const texture=new THREE.CanvasTexture(meshText);texture.colorSpace=THREE.SRGBColorSpace;
  const label=put(new THREE.PlaneGeometry(6.2,1.55),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}),"Signal caption",0,5.2,0,g);
  return {g,halo,flare,light,label,raft:stem,index:i};
 });
 const wake=createWakeTrails({world,ocean,quality});
 const maxSpray=quality==="low"?24:92;
 const sprayPos=new Float32Array(maxSpray*3),ages=new Float32Array(maxSpray).fill(99);
 sprayPos.fill(-10000);
 const sprayGeo=new THREE.BufferGeometry();sprayGeo.setAttribute("position",new THREE.BufferAttribute(sprayPos,3));
 const spray=new THREE.Points(sprayGeo,new THREE.PointsMaterial({color:0xb0d1d0,size:quality==="low"?.7:1.1,sizeAttenuation:true,transparent:true,opacity:.21,depthWrite:false}));
 spray.name="World-space wake spray";world.add(spray);
 let nextParticle=0,simulationTime=0;
 function update(time,dt,shipState,rescued){
  simulationTime=time;ocean.update(time);sky.material.uniforms.uTime.value=time;
  wake.update(time,dt,shipState);
  for(let i=0;i<lightAxes.length;i++)lightAxes[i].rotation.y=time*.52+i*2;
  beacons.forEach((b,i)=>{
   const active=i===rescued,finished=i<rescued;
   b.g.visible=!finished;
   const wave=ocean.heightAt(b.g.position.x,b.g.position.z,time);
   b.g.position.y=wave+.2+Math.sin(time*.75+i)*.09;
   b.halo.scale.setScalar(1+.18*Math.sin(time*2.1+i));
   b.halo.material=active?lampMat:inactive;
   b.light.intensity=active?48+12*Math.sin(time*4):8;
   b.flare.scale.setScalar(1+.13*Math.sin(time*6+i));
   b.label.lookAt(shipState.x,b.g.position.y+3,shipState.z);
   b.label.material.opacity=active?1:.45;
  });
  const steer=shipState.yaw;
  if(shipState.speed>3&&rand()<Math.min(.92,dt*shipState.speed*3)){
   const i=nextParticle++%maxSpray,side=(rand()-.5)*2;
   sprayPos[i*3]=shipState.x+Math.cos(steer)*side*1.7-Math.sin(steer)*4.7;
   sprayPos[i*3+2]=shipState.z+Math.sin(steer)*side*1.7+Math.cos(steer)*4.7;
   sprayPos[i*3+1]=ocean.heightAt(sprayPos[i*3],sprayPos[i*3+2],time)+.26;
   ages[i]=0;
  }
  for(let i=0;i<maxSpray;i++){
   if(ages[i]>=1.4)continue;
   ages[i]+=dt;const age=ages[i];
   if(age>=1.4){sprayPos[i*3+1]=-10000;continue}
   sprayPos[i*3+1]=ocean.heightAt(sprayPos[i*3],sprayPos[i*3+2],time)+.17+Math.sin(age*5)*.21*(1-age/1.4);
  }
  sprayGeo.attributes.position.needsUpdate=true;
 }
 function setWeather(weather){
  const target=weather==="storm"?"storm":"storm-sunset";
  state.weather=target;state.elevation=target==="storm"?25:7;
  const air=atmosphereState(target,state.elevation);
  ocean.setSettings({height:target==="storm"?1.16:.93,speed:target==="storm"?1.35:1.07,
   weather:target,whitecaps:target==="storm"?.24:.21,sunElevation:state.elevation});
  sky.material.uniforms.uSun.value.fromArray(air.direction);
  sky.material.uniforms.uTop.value.set(air.skyTop);
  sky.material.uniforms.uHorizon.value.set(air.skyHorizon);
  sky.material.uniforms.uStorm.value=1;
  key.position.fromArray(air.position);key.color.setHex(air.sunColor);key.intensity=air.power;hemi.intensity=air.hemisphere;
  scene.fog.color.set(air.fog);
  return target;
 }
 return {world,ocean,update,setWeather,state,beacons,lightAxes,sky,scene,coast,wake};
}
