import * as THREE from "three";
import {createSurfaceLibrary} from "./procedural-materials.mjs";
import {buildOceanScene} from "./ocean-scene.mjs";
import {normalizeOceanSettings} from "./ocean-water.mjs";

export function getOceanSun(weather="clear"){
 if(weather==="storm-sunset"||weather==="sunset")
  return {position:[-22.4,5,32.8],color:0xffd6a3,power:2.65,hemisphere:1.5};
 if(weather==="storm")
  return {position:[-14,14,24],color:0xcbd9e8,power:1.65,hemisphere:1.25};
 return {position:[-15,24,16],color:0xffefd1,power:2.9,hemisphere:1.85};
}
export const worldNames=["showroom","racetrack","forest","city","night","ocean"];
const colors={
 showroom:{background:0x111e31,fog:0x263b51,ground:0x465d68,sunColor:0xfff4e9,hemisphere:2.2,sun:2.7},
 racetrack:{background:0x86b8df,fog:0x9fc9e9,ground:0x487b49,sunColor:0xffedc9,hemisphere:2.0,sun:3.0},
 forest:{background:0x80acc1,fog:0x9bbfb6,ground:0x4f7145,sunColor:0xffe9c0,hemisphere:1.65,sun:2.45},
 city:{background:0x9fbdd9,fog:0xadc4d3,ground:0x535d62,sunColor:0xfff2d6,hemisphere:1.9,sun:2.6},
 night:{background:0x071223,fog:0x10233b,ground:0x1f283c,sunColor:0x88aef7,hemisphere:.65,sun:.8},
 ocean:{background:0x92bfd6,fog:0x9abed0,ground:0x09576c,sunColor:0xffefd1,hemisphere:1.85,sun:2.9}
};
function seeded(seed){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
export function getWorldTheme(kind){
 return colors[worldNames.includes(kind)?kind:"showroom"];
}
export function createEnvironment({world="showroom",quality="medium",oceanSettings={}}={}){
 world=worldNames.includes(world)?world:"showroom";
 const theme=getWorldTheme(world),group=new THREE.Group();group.name="Procedural "+world+" (preview only)";
 const random=seeded(15799+worldNames.indexOf(world)*137);
 const materials=new Map(),owned=[];
 const surfaces=createSurfaceLibrary(quality);
 const surface=(type,options)=>surfaces.material(type,options);
 const mat=(color,roughness=.78,metalness=.03,emissive=0,emissiveIntensity=0)=>{
  const key=[color,roughness,metalness,emissive,emissiveIntensity].join("|");
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity}));
  return materials.get(key);
 };
 function add(geometry,material,x=0,y=0,z=0,rx=0,ry=0,rz=0,parent=group){
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);
  mesh.castShadow=quality!=="low";mesh.receiveShadow=quality!=="low";
  parent.add(mesh);owned.push(mesh);
  return mesh;
 }
 function areaFloor(color=theme.ground){
  const type=world==="showroom"?"brushed":world==="city"||world==="night"?"concrete":"grass";
  return add(new THREE.PlaneGeometry(500,500),surface(type,{
   color,repeat:[64,64],roughness:world==="showroom"?.34:.97,metalness:world==="showroom"?.38:0
  }),0,-.025,0,-Math.PI/2);
 }
 function asphalt(z=0,length=150,width=11){
  const road=add(new THREE.PlaneGeometry(width,length),surface("asphalt",{color:0x535b60,repeat:[width/3.2,length/3.2]}),0,.009,z,-Math.PI/2);
  road.receiveShadow=true;
  for(const x of [-width/2+.35,width/2-.35])add(new THREE.BoxGeometry(.14,.018,length),mat(0xe1e9e4,.66),x,.024,z);
  for(let zz=-length/2;zz<length/2;zz+=8){
   add(new THREE.BoxGeometry(.16,.019,3.1),mat(0xffd36a,.69),0,.032,z+zz);
  }
  return road;
 }
 function tree(x,z,height=3.5){
  add(new THREE.CylinderGeometry(.14,.2,height*.5,7),surface("bark",{color:0x8b6042,repeat:[1,3]}),x,height*.25,z);
  for(let i=0;i<3;i++){
   add(new THREE.ConeGeometry(height*(.25-i*.042),height*.6,7),
    surface("grass",{color:i===1?0x5d884d:0x3d7449,repeat:[2,2]}),x,height*(.52+i*.17),z);
  }
 }
 function building(x,z,h,w,d,night=false){
  const color=[0xa2adb8,0xbcb2ab,0x9baab8,0xbeb2a8][Math.floor(random()*4)];
  const base=surface(random()>.38?"concrete":"brick",{color,repeat:[2.4,Math.max(2,h/5)]});
  add(new THREE.BoxGeometry(w,h,d),base,x,h/2,z);
  const glass=night?mat(0xffd895,.18,.14,0xe9ae59,.85):surface("glass",{color:0x608fa5,opacity:.8});
  const pitch=w>4?1.35:1;
  for(const side of [-1,1])for(let y=1.3;y<h-1;y+=1.85){
   for(let zz=-d/2+.8;zz<d/2-.5;zz+=1.25){
    if(night&&random()<.35)continue;
    add(new THREE.BoxGeometry(.04,.8,.7),glass,x+side*(w/2+.028),y,z+zz);
   }
  }
  add(new THREE.BoxGeometry(w+.2,.16,d+.2),surface("brushed",{color:0x839199,repeat:[2,1]}),x,h+.09,z);
 }
 function hill(x,z,scale,color){
  add(new THREE.IcosahedronGeometry(scale,1),surface("stone",{color,repeat:[3,3]}),x,-scale*.46,z,0,random()*3);
 }
 function laneBarrier(x,z,len=6){
  add(new THREE.BoxGeometry(.3,.7,len),mat(0xb8c4c2,.66),x,.37,z);
  for(let i=-2;i<=2;i++)add(new THREE.BoxGeometry(.33,.23,.6),mat(0xdd6b4c,.6),x,.7,z+i*1.1);
 }
 const points=[],lights=[];
 let door=null,ocean=null;
 if(world!=="ocean")areaFloor();
 if(world==="ocean"){
  ocean=buildOceanScene({quality,settings:oceanSettings});
  group.add(ocean.group);
 }else if(world==="showroom"){
  // Polished studio, angled softboxes, emissive ceiling rings and circular podium.
  add(new THREE.CylinderGeometry(9.5,9.5,.12,96),surface("brushed",{color:0x344d5c,repeat:[5,5],roughness:.22,metalness:.7}),0,-.08,0);
  add(new THREE.CylinderGeometry(5.8,5.8,.33,96),surface("brushed",{color:0x788c98,repeat:[3,3],roughness:.2,metalness:.7}),0,.06,0);
  add(new THREE.TorusGeometry(5.79,.07,10,120),mat(0x4df7cc,.18,.47,0x39ddb3,1.8),0,.26,0,Math.PI/2);
  for(const n of [0,1,2,3,4,5]){
   const angle=n*Math.PI/3;
   const p=new THREE.PointLight(n%2?0xb9e2ff:0xffffff,quality==="low"?7:13,18,2);
   p.position.set(Math.cos(angle)*7,4.6,Math.sin(angle)*7);group.add(p);lights.push(p);
   const lightBox=add(new THREE.BoxGeometry(3.8,.1,1),mat(0xf3ffff,.17,.25,0xc8f9ff,2),
    Math.cos(angle)*8,6,Math.sin(angle)*8,0,-angle,0);
   lightBox.castShadow=false;
  }
  for(const x of [-12,12])add(new THREE.BoxGeometry(.17,11,30),surface("concrete",{color:0x445b69,repeat:[1,3]}),x,5.5,0);
  for(const z of [-13,13])add(new THREE.BoxGeometry(28,10,.18),surface("concrete",{color:0x3c576d,repeat:[4,3]}),0,5,z);
  // Vertical decorative panels.
  for(let x=-12;x<=12;x+=3)for(const z of [-12,12]){
   add(new THREE.BoxGeometry(1.7,5,.045),surface("brushed",{color:0x92b7bd,repeat:[1,2],roughness:.23,metalness:.5}),x,3,z+(z>0?-.14:.14));
  }
 }else if(world==="racetrack"){
  asphalt(0,190,13.5);
  for(let z=-82;z<84;z+=8){
   for(const x of [-7.3,7.3]){
    add(new THREE.BoxGeometry(.8,.12,3),surface("concrete",{color:Math.floor(z/8)%2?0xd2d8d4:0xc87864,repeat:[1,1]}),x,.072,z);
   }
  }
  for(let z=-86;z<85;z+=23){
   for(const x of [-9.1,9.1]){
    const grass=mat(0x4f874e,.95);
    add(new THREE.BoxGeometry(.5,.7,8),surface("concrete",{color:0xb8c5c4,repeat:[1,2]}),x,.35,z);
    if(quality!=="low")tree(x*1.7,z,2.2+random()*2.5);
   }
  }
  for(const z of [-85,88])for(const x of [-13,13]){
   add(new THREE.CylinderGeometry(.22,.24,11,8),mat(0xc0d0d9,.38,.62),x,5.5,z);
   add(new THREE.BoxGeometry(8,.25,.4),mat(0x83c9dd,.2,.5,0x27698b,.4),x>0?10:-10,10.5,z);
  }
  for(const z of [-55,0,55]){
   add(new THREE.BoxGeometry(18,.3,.75),mat(0xf1f5f8,.6),0,6.6,z);
   for(const x of [-7.6,7.6])add(new THREE.BoxGeometry(.45,6.6,.45),mat(0xa6b7c4,.33,.6),x,3.3,z);
  }
  for(let i=0;i<10;i++)hill((random()-.5)*120,(random()-.5)*160,15+random()*24,0x628461);
 }else if(world==="forest"){
  asphalt(0,190,8.5);
  for(let i=0;i<(quality==="low"?42:quality==="medium"?78:115);i++){
   const side=i%2===0?-1:1;
   const x=side*(7+random()*45),z=(random()-.5)*190;
   tree(x,z,2.4+random()*4.8);
  }
  for(let i=0;i<32;i++){
   const x=(random()-.5)*110,z=(random()-.5)*180;
   if(Math.abs(x)>6)add(new THREE.IcosahedronGeometry(.5+random()*.8,0),
    surface("stone",{color:0x929d8e}),x,.2,z);
  }
  for(let i=0;i<8;i++)hill((random()-.5)*240,(random()-.5)*240,24+random()*24,0x4a6745);
 }else if(world==="city"||world==="night"){
  asphalt(0,190,12);
  const night=world==="night";
  for(let z=-78;z<90;z+=17)for(const side of [-1,1]){
   const x=side*(12.7+random()*4),height=7+random()*17;
   building(x,z,height,7+random()*3,9+random()*4,night);
  }
  for(let z=-90;z<90;z+=12){
   for(const side of [-1,1]){
    const x=side*7.9;
    add(new THREE.BoxGeometry(3.7,.12,10),surface("concrete",{color:0xadb0ab,repeat:[2,3]}),x,.06,z);
    const post=add(new THREE.CylinderGeometry(.095,.12,5.5,8),mat(0x798b93,.48,.54),side*6.4,2.75,z);
    if(night||quality==="high"){
     const lamp=new THREE.PointLight(night?0xffcf82:0xffffff,night?18:5,12,2);
     lamp.position.set(side*6.4,5.5,z);group.add(lamp);lights.push(lamp);
     add(new THREE.SphereGeometry(.24,12,8),mat(0xffe2af,.22,.2,0xffb34a,1.7),side*6.4,5.5,z);
    }
   }
  }
  const doorFrame=add(new THREE.BoxGeometry(2.3,2.85,.3),surface("stone",{color:0x84949b,repeat:[2,3]}),8.9,1.4,5);
  const hinge=new THREE.Group();hinge.position.set(7.9,.1,4.87);group.add(hinge);
  const slab=add(new THREE.BoxGeometry(1.85,2.5,.15),surface("wood",{color:0xa37e5c,repeat:[2,2]}),.92,1.27,0,0,0,0,hinge);
  const handle=add(new THREE.SphereGeometry(.1,10,6),mat(0xcad6d4,.24,.78),1.65,1.17,.13,0,0,0,hinge);
  hinge.name="Interaktiv dörr (E)";door=hinge;points.push(hinge);
  if(night){
   // Stars (single Points draw call) and neon accent strips.
   const vertex=[];
   for(let i=0;i<650;i++)vertex.push((random()-.5)*310,50+random()*65,(random()-.5)*310);
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertex,3));
   const stars=new THREE.Points(geometry,new THREE.PointsMaterial({color:0x9cb9ee,size:.4,sizeAttenuation:true,fog:false}));
   group.add(stars);owned.push(stars);
   for(let z=-55;z<58;z+=28){
    add(new THREE.BoxGeometry(2.7,.12,.1),mat(0xff77ae,.18,.2,0xff3984,2.4),-8.5,3.6,z);
    add(new THREE.BoxGeometry(2.7,.12,.1),mat(0x72d9ff,.18,.2,0x2c9dff,2),8.5,4.6,z);
   }
  }
 }
 // A procedural sky hemisphere; uses no external assets or paid rendering.
 const skyColorTop=new THREE.Color(world==="night"?0x08132b:world==="showroom"?0x102132:world==="ocean"?0x4b93be:0x5e9dd9);
 const skyColorHorizon=new THREE.Color(theme.background);
 const sky=new THREE.Mesh(new THREE.SphereGeometry(470,28,14),
  new THREE.ShaderMaterial({
   side:THREE.BackSide,depthWrite:false,fog:false,
   uniforms:{top:{value:skyColorTop},bottom:{value:skyColorHorizon},
    uOcean:{value:world==="ocean"?1:0},
    uWeather:{value:world==="ocean"?normalizeOceanSettings(oceanSettings).weather==="storm-sunset"?3:
     normalizeOceanSettings(oceanSettings).weather==="storm"?2:
     normalizeOceanSettings(oceanSettings).weather==="sunset"?1:0:0},
    uTime:{value:0}},
   vertexShader:`varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`
    varying vec3 vPosition;
    uniform vec3 top,bottom;
    uniform float uOcean,uWeather,uTime;
    float hashSky(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noiseSky(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hashSky(i),hashSky(i+vec2(1.,0.)),f.x),
                 mix(hashSky(i+vec2(0.,1.)),hashSky(i+vec2(1.,1.)),f.x),f.y);
    }
    void main(){
      vec3 d=normalize(vPosition);
      float altitude=clamp(d.y*.7+.44,0.,1.);
      vec3 color=mix(bottom,top,altitude);
      if(uOcean>.5){
        vec2 uv=vec2(atan(d.x,d.z)*2.8,d.y*4.4);
        vec2 drift=vec2(uTime*.002,-uTime*.0006);
        float n=.56*noiseSky(uv*1.5+drift)+.28*noiseSky(uv*3.6-drift*.4)
           +.16*noiseSky(uv*8.6+drift*1.8);
        float storm=step(1.5,uWeather);
        float sunset=step(.5,uWeather)*(1.-step(1.5,uWeather))+
                     step(2.5,uWeather);
        float cover=smoothstep(.43,.63,n+storm*.065);
        cover*=1.-smoothstep(.63,.98,d.y);
        vec3 cloud=vec3(.24,.31,.40);
        cloud=mix(cloud,vec3(.10,.13,.21),storm);
        cloud=mix(cloud,vec3(.48,.29,.31),sunset*.30);
        color=mix(color,cloud,cover*(.44+storm*.46));
        vec3 sun=normalize(vec3(-.56,.125,.82));
        float facing=max(dot(d,sun),0.);
        float warm=pow(facing,24.)*(.40+.60*sunset);
        float disk=pow(facing,1550.)*(1.-cover*.8);
        color+=vec3(1.0,.39,.11)*warm*.32*sunset;
        color+=vec3(1.,.83,.51)*disk*(.52+.48*sunset);
        float rim=(smoothstep(.36,.50,n)-smoothstep(.54,.68,n));
        color+=rim*vec3(.27,.10,.045)*sunset*warm;
        float haze=(1.-smoothstep(-.035,.16,abs(d.y)))*.09;
        color+=vec3(.50,.31,.25)*haze*sunset;
      }
      gl_FragColor=vec4(max(color,vec3(0.)),1.);
    }`
  }));
 sky.castShadow=false;sky.receiveShadow=false;sky.renderOrder=-100;group.add(sky);owned.push(sky);
 const fog=new THREE.FogExp2(theme.fog,world==="night"?.007:world==="showroom"?.012:world==="forest"?.006:world==="ocean"?.0028:.003);
 const background=new THREE.Color(theme.background);
 if(ocean){
  const weather=normalizeOceanSettings(oceanSettings).weather;
  const palette=weather==="storm-sunset"?["#243550","#d69b87","#9c827f"]:
   weather==="storm"?["#36495b","#70889a","#748b9a"]:
   weather==="sunset"?["#34537d","#f1aa89","#d8a28e"]:["#4b93be","#92bfd6","#9abed0"];
  sky.material.uniforms.top.value.set(palette[0]);
  sky.material.uniforms.bottom.value.set(palette[1]);fog.color.set(palette[2]);background.set(palette[1]);
 }
 return {
  group,door,world,ocean,background,fog,
  hemisphere:world==="ocean"?getOceanSun(normalizeOceanSettings(oceanSettings).weather).hemisphere:theme.hemisphere,
  sun:world==="ocean"?getOceanSun(normalizeOceanSettings(oceanSettings).weather).power:theme.sun,
  sunColor:world==="ocean"?getOceanSun(normalizeOceanSettings(oceanSettings).weather).color:theme.sunColor,
  sunPosition:world==="ocean"?getOceanSun(normalizeOceanSettings(oceanSettings).weather).position:
   world==="night"?[4,9,-7]:[-15,24,16],
  setOceanSettings(next){
   if(!ocean)return null;
   const settings=ocean.setSettings(normalizeOceanSettings(next));
   const palette=settings.weather==="storm-sunset"?{top:"#243550",horizon:"#d69b87",fog:"#9c827f"}:
    settings.weather==="storm"?{top:"#36495b",horizon:"#70889a",fog:"#748b9a"}:
    settings.weather==="sunset"?{top:"#34537d",horizon:"#f1aa89",fog:"#d8a28e"}:
    {top:"#4b93be",horizon:"#92bfd6",fog:"#9abed0"};
   sky.material.uniforms.uWeather.value=
    settings.weather==="storm-sunset"?3:settings.weather==="storm"?2:settings.weather==="sunset"?1:0;
   sky.material.uniforms.top.value.set(palette.top);
   sky.material.uniforms.bottom.value.set(palette.horizon);
   fog.color.set(palette.fog);
   background.set(palette.horizon);
   return settings;
  },
  update(time,dt){
   sky.material.uniforms.uTime.value=time;
   ocean?.update(time);
   if(world==="showroom"){
    // Slow lighting motion demonstrates PBR surfaces without moving the model.
    for(let i=0;i<lights.length;i++)lights[i].intensity=9+2.2*Math.sin(time*.38+i);
   }
  },
  dispose(){
   const geometries=new Set(),textures=new Set(),materialsFound=new Set();
   group.traverse(obj=>{
    if(obj.geometry)geometries.add(obj.geometry);
    const list=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const m of list)if(m)materialsFound.add(m);
   });
   for(const geo of geometries)geo.dispose();
   for(const m of materialsFound)m.dispose();
   surfaces.dispose();
  }
 };
}
