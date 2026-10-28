import * as THREE from "three";
import {LEVELS,PORTAL} from "./logic.mjs";

const PI=Math.PI;
const basic=(color,emissive=0,emissiveIntensity=0)=>new THREE.MeshStandardMaterial({
 color,roughness:.38,metalness:.62,emissive,emissiveIntensity
});
const materials={
 armor:basic(0x263952,0x0a2545,.22),silver:basic(0x91c1d6,0x193449,.27),
 brass:basic(0xe6ad63,0x432610,.25),dark:basic(0x141c32,0x141b33,.3),
 cyan:basic(0x65f9f0,0x17d6ed,2.2),blue:basic(0x7ab8ff,0x326bff,1.8),
 violet:basic(0xada1ff,0x8261ff,1.7),rose:basic(0xfa6ea1,0xf84086,2.1),
 rock:basic(0x293347,0x10131c,.15),stone:basic(0x5b6d75,0x132a38,.08),
 glass:new THREE.MeshPhysicalMaterial({color:0x92fffb,metalness:.18,roughness:.13,
  transparent:true,opacity:.82,transmission:0,side:THREE.DoubleSide,
  emissive:0x26e6e2,emissiveIntensity:.6}),
};
function add(parent,geometry,material,position=[0,0,0],rotation=null){
 const object=new THREE.Mesh(geometry,material);
 object.position.set(...position);
 if(rotation)object.rotation.set(...rotation);
 parent.add(object);object.castShadow=true;object.receiveShadow=true;
 return object;
}
const box=(a,b,c)=>new THREE.BoxGeometry(a,b,c);
const ball=(r,segments=20)=>new THREE.SphereGeometry(r,segments,Math.max(10,Math.floor(segments*.65)));
const cyl=(a,b,h,segments=12)=>new THREE.CylinderGeometry(a,b,h,segments);
function randGen(seed=1741){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function makeBlade(parent,arm){
 const weapon=new THREE.Group();weapon.position.set(.04,-.66,.09);arm.add(weapon);
 add(weapon,cyl(.075,.085,1.12,8),materials.dark,[0,-.52,0]);
 add(weapon,cyl(.15,.09,.18,8),materials.brass,[0,-1.14,0]);
 const blade=add(weapon,new THREE.ConeGeometry(.19,1.65,5),materials.cyan,[0,-2.02,0]);
 blade.rotation.z=Math.PI;
 add(weapon,new THREE.TorusGeometry(.23,.045,6,18),materials.cyan,[0,-1.17,0],[Math.PI/2,0,0]);
 return weapon;
}
export function makeHero(){
 const root=new THREE.Group();root.name="AETHER KNIGHT — GAMEPLAY";
 const rig=new THREE.Group();root.add(rig);
 const torso=add(rig,cyl(.56,.41,1.3,10),materials.armor,[0,1.6,0]);
 const chest=add(rig,box(.95,.63,.30),materials.silver,[0,1.85,-.37]);
 chest.rotation.z=-.04;
 add(rig,box(.57,.16,.08),materials.cyan,[0,1.83,-.57]);
 add(rig,cyl(.45,.51,.32,9),materials.dark,[0,.96,0]);
 const head=new THREE.Group();head.position.set(0,2.49,0);rig.add(head);
 add(head,new THREE.IcosahedronGeometry(.42,1),materials.silver);
 add(head,box(.74,.23,.14),materials.dark,[0,.04,-.35]);
 add(head,box(.6,.085,.07),materials.cyan,[0,.04,-.43]);
 add(head,new THREE.ConeGeometry(.21,.55,5),materials.brass,[0,.51,-.06]);
 for(const side of [-1,1]){
  add(rig,ball(.22,12),materials.brass,[side*.42,1.94,-.30]);
  const arm=new THREE.Group();arm.position.set(side*.72,2.03,0);rig.add(arm);
  add(arm,ball(.27,12),materials.silver);
  add(arm,cyl(.16,.21,.79,8),materials.armor,[side*.05,-.42,0]);
  add(arm,box(.36,.29,.30),materials.brass,[side*.08,-.65,-.04]);
  const leg=new THREE.Group();leg.position.set(side*.28,.93,0);rig.add(leg);
  add(leg,cyl(.20,.23,.9,9),materials.armor,[0,-.43,.01]);
  add(leg,box(.40,.42,.44),materials.silver,[0,-.91,-.13]);
  if(side===1)makeBlade(rig,arm);
  if(side===-1){
   const shield=add(arm,new THREE.CylinderGeometry(.48,.48,.10,6),materials.brass,[-.25,-.48,-.28],[Math.PI/2,0,Math.PI/6]);
   shield.castShadow=true;
  }
  if(side<0){rig.userData.leftArm=arm;rig.userData.leftLeg=leg;}
  else{rig.userData.rightArm=arm;rig.userData.rightLeg=leg;}
 }
 add(rig,new THREE.TorusGeometry(.52,.045,6,24),materials.cyan,[0,.25,0],[Math.PI/2,0,0]);
 root.userData.rig=rig;root.userData.head=head;
 return root;
}
export function makeEnemy(kind=0){
 const body=new THREE.Group();body.name="Void Sentinel";
 const mat=kind===2?materials.rose:kind===1?materials.violet:materials.blue;
 add(body,new THREE.IcosahedronGeometry(.63,1),materials.dark,[0,1.55,0]);
 for(const s of [-1,1]){
  add(body,new THREE.IcosahedronGeometry(.33,0),materials.armor,[s*.6,1.5,0]);
  add(body,new THREE.ConeGeometry(.23,.85,5),mat,[s*.83,1.05,0],[0,0,s*-.35]);
  add(body,new THREE.TorusGeometry(.24,.08,6,12),mat,[s*.44,1.95,0],[0,0,Math.PI/2]);
 }
 const mask=add(body,new THREE.IcosahedronGeometry(.40,1),mat,[0,2.33,-.03]);
 mask.scale.set(1,.68,.85);
 add(body,box(.52,.095,.08),materials.dark,[0,2.34,-.34]);
 add(body,box(.39,.06,.11),materials.cyan,[0,2.34,-.42]);
 add(body,new THREE.ConeGeometry(.31,.9,7),materials.dark,[0,.8,.06],[Math.PI,0,0]);
 const ring=add(body,new THREE.TorusGeometry(.84,.037,6,32),mat,[0,1.65,.2],[Math.PI/2,0,0]);
 body.userData.ring=ring;
 return body;
}
export function makeCore(id){
 const core=new THREE.Group();core.name="Celestial Core "+id;
 const crystal=add(core,new THREE.OctahedronGeometry(.75,1),materials.cyan,[0,1.45,0]);
 crystal.scale.set(.8,1.45,.8);
 const ring=add(core,new THREE.TorusGeometry(1.05,.06,6,30),materials.brass,[0,1.45,0],[.32,0,.65]);
 const ring2=add(core,new THREE.TorusGeometry(.93,.035,6,32),materials.cyan,[0,1.45,0],[Math.PI/2,0,.4]);
 core.userData={crystal,ring,ring2};return core;
}
function glyph(parent,x,z,i){
 const g=new THREE.Group();g.position.set(x,.15,z);parent.add(g);
 add(g,cyl(.58,.68,.23,7),materials.dark);
 const torus=add(g,new THREE.TorusGeometry(.38,.05,6,24),i%3===0?materials.cyan:materials.brass,[0,.15,0],[Math.PI/2,0,0]);
 add(g,new THREE.OctahedronGeometry(.12,0),materials.glass,[0,.3,0]);
 return g;
}
function createCliff(group,rng){
 // Outer floating stone island: double-sided dark underside and a detailed surface.
 const radial=96,levels=6,positions=[],indices=[];
 for(let j=0;j<=levels;j++){
  const depth=j===0?0:j===1?-.45:-(j-1)*.94;
  const radius=j===0?25:j===1?25.4:j===levels?7:25.2-(j-1)*4.0;
  for(let i=0;i<=radial;i++){
   const a=i/radial*2*PI,noise=(Math.sin(a*7.1)+Math.sin(a*13.7+1)+Math.sin(a*23.8))*.20;
   positions.push(Math.cos(a)*(radius+noise),depth+Math.sin(a*9+j)*.24,Math.sin(a)*(radius+noise));
   if(i<radial&&j<levels){
    const v=j*(radial+1)+i,w=v+radial+1;
    indices.push(v,w,v+1,w,w+1,v+1);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
 add(group,geo,materials.rock);
 const top=add(group,new THREE.CylinderGeometry(24.95,24.95,.12,96),materials.stone,[0,.04,0]);
 top.receiveShadow=true;
 const inner=add(group,new THREE.CylinderGeometry(20,20,.15,64),materials.rock,[0,.12,0]);
 inner.receiveShadow=true;
 add(group,new THREE.TorusGeometry(20.5,.11,8,110),materials.brass,[0,.22,0],[Math.PI/2,0,0]);
 for(let i=0;i<50;i++){
  const a=rng()*2*PI,r=5+Math.sqrt(rng())*16,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const stone=add(group,new THREE.DodecahedronGeometry(.14+rng()*.22,0),i%5===0?materials.brass:materials.stone,[x,.21,z]);
  stone.rotation.y=a;stone.scale.y=.15;
 }
}
function createRuins(group,rng,level){
 const high=[];
 for(let i=0;i<12;i++){
  const a=i/12*2*PI+.18,r=17+rng()*3,x=Math.sin(a)*r,z=Math.cos(a)*r;
  const ruin=new THREE.Group();ruin.position.set(x,.1,z);ruin.rotation.y=a;
  group.add(ruin);
  const h=3+rng()*4;
  add(ruin,box(1.45,.43,1.55),materials.dark,[0,.18,0]);
  const pillar=add(ruin,cyl(.50,.63,h,10),materials.stone,[0,h/2+.24,0]);
  pillar.rotation.z=(rng()-.5)*.11;
  add(ruin,cyl(.75,.55,.35,10),materials.brass,[0,h+.12,0]);
  add(ruin,new THREE.OctahedronGeometry(.22,0),level===2?materials.rose:materials.cyan,[0,h+.62,0]);
  const detail=new THREE.Group();ruin.add(detail);
  for(let j=0;j<5;j++){
   const spike=add(detail,box(.66,.07,.07),materials.brass,[0,.7+j*.62,-.55]);
   spike.rotation.z=(j%2?-.09:.09);
  }
  high.push({object:detail,center:[x,h/2,z],radius:h,triangles:120});
 }
 for(let i=0;i<8;i++){
  const a=i/8*PI*2,r=9.1,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const ob=add(group,new THREE.OctahedronGeometry(.5+rng()*.5,1),materials.stone,[x,.34,z]);
  ob.scale.y=.38;
 }
 return high;
}
function makePortal(parent){
 const portal=new THREE.Group();portal.position.set(PORTAL.x,.20,PORTAL.z);
 parent.add(portal);portal.name="Star Gate";
 for(const side of [-1,1]){
  add(portal,cyl(.65,.90,4.8,8),materials.stone,[side*2,2.4,0]);
  add(portal,cyl(.9,.75,.43,8),materials.brass,[side*2,5.0,0]);
 }
 add(portal,box(5.1,.65,.87),materials.stone,[0,5.22,0]);
 add(portal,new THREE.TorusGeometry(1.95,.21,12,48),materials.brass,[0,2.58,0]);
 const shimmer=add(portal,new THREE.CircleGeometry(1.76,64),
  new THREE.MeshBasicMaterial({color:0x2cdbea,side:THREE.DoubleSide,transparent:true,opacity:.1,depthWrite:false}),[0,2.58,0]);
 const inner=add(portal,new THREE.TorusGeometry(1.65,.07,8,48),materials.cyan,[0,2.58,0]);
 add(portal,new THREE.OctahedronGeometry(.36,0),materials.violet,[0,5.65,0]);
 return {portal,inner,shimmer};
}
function makeWater(parent,level){
 const vertex=`uniform float uTime;varying vec3 vWorld;varying float vWave;
 void main(){vec3 p=position;
 p.z+=.1*sin(p.x*.03+uTime*.14);
 float w=sin(p.x*.06+uTime*.55)*.5+sin(p.y*.075-uTime*.4)*.4;
 p.z+=w;vWave=w;vec4 wp=modelMatrix*vec4(p,1.);vWorld=wp.xyz;
 gl_Position=projectionMatrix*viewMatrix*wp;}`;
 const fragment=`uniform float uTime;uniform vec3 uBase;varying vec3 vWorld;varying float vWave;
 void main(){float v=.5+.5*sin(vWorld.x*.16+vWorld.z*.1+uTime*.9);
 float foam=pow(max(0.,sin(vWorld.x*.26-uTime+vWorld.z*.19)) ,16.)*.20;
 vec3 c=mix(uBase,vec3(.12,.37,.49),clamp(v*.30+vWave*.1,0.,1.));
 c+=foam;gl_FragColor=vec4(c,1.);}`;
 const mat=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,
  uniforms:{uTime:{value:0},uBase:{value:new THREE.Color(level===0?0x0e4b61:level===1?0x162e55:0x24173f)}}});
 const sea=add(parent,new THREE.PlaneGeometry(450,450,72,72),mat,[0,-17,0],[-PI/2,0,0]);
 sea.castShadow=false;sea.receiveShadow=false;
 return mat;
}
function distantIslands(group,rng){
 for(let i=0;i<18;i++){
  const a=i/18*2*PI,r=44+rng()*110,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const satellite=new THREE.Group();satellite.position.set(x,-2-rng()*9,z);group.add(satellite);
  const scale=2+rng()*7;
  const rock=add(satellite,new THREE.DodecahedronGeometry(scale,1),materials.rock);
  rock.scale.set(1.4,.6,1.2);
  add(satellite,new THREE.ConeGeometry(scale*.4,scale*2,7),materials.stone,[0,scale*.9,0]);
  add(satellite,new THREE.OctahedronGeometry(scale*.14,0),materials.cyan,[0,scale*2.2,0]);
 }
}
function makeSky(scene,level){
 const gradient=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,
  uniforms:{top:{value:new THREE.Color(level===0?0x061225:level===1?0x030716:0x080619)},
   horizon:{value:new THREE.Color(level===0?0x86575a:level===1?0x34466f:0x4d3158)}},
  vertexShader:"varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader:"varying vec3 p;uniform vec3 top;uniform vec3 horizon;void main(){float h=clamp(normalize(p).y*.5+.5,0.,1.);gl_FragColor=vec4(mix(horizon,top,pow(h,.85)),1.);}"
 });
 const dome=new THREE.Mesh(new THREE.SphereGeometry(320,32,20),gradient);
 dome.name="SKY ATMOSPHERE";scene.add(dome);return dome;
}
export function buildWorld(scene,level=0){
 const cfg=LEVELS[level],rng=randGen(9261+level*117);
 scene.background=new THREE.Color(cfg.sky);
 scene.fog=new THREE.FogExp2(cfg.sky,level===0?.007:.011);
 const world=new THREE.Group();world.name="AETHERFALL WORLD "+cfg.name;scene.add(world);
 const sky=makeSky(scene,level);
 const ambient=new THREE.HemisphereLight(0xb9dbff,0x1c1e35,level===0?2.3:1.65);scene.add(ambient);
 const sun=new THREE.DirectionalLight(level===0?0xffd49c:level===1?0x91b3ff:0xedb3fa,level===0?3.8:2.9);
 sun.position.set(level===0?35:-20,52,28);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);
 sun.shadow.camera.left=-45;sun.shadow.camera.right=45;
 sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.normalBias=.03;
 scene.add(sun);
 const fill=new THREE.PointLight(0x22d9ef,68,24,2);fill.position.set(0,6,-16);scene.add(fill);
 createCliff(world,rng);
 const hiDetail=createRuins(world,rng,level);
 distantIslands(world,rng);
 const water=makeWater(world,level);
 const decorations=[];
 for(let i=0;i<24;i++){
  const x=(rng()-.5)*37,z=(rng()-.5)*37;
  if(Math.hypot(x,z)>21||Math.hypot(x,z-12)<3||Math.hypot(x,z+20)<4)continue;
  const g=glyph(world,x,z,i);decorations.push(g);
 }
 const hero=makeHero();world.add(hero);
 const enemies=cfg.enemies.map((entry,i)=>{const ob=makeEnemy(i%3);world.add(ob);return ob;});
 const cores=cfg.cores.map((entry,i)=>{const ob=makeCore(i);world.add(ob);return ob;});
 const gate=makePortal(world);
 // Particles and floating ash are decorative only; no external images, GLB or textures.
 const count=level===0?150:260;
 const points=new Float32Array(count*3);
 for(let i=0;i<count;i++){const a=rng()*PI*2,r=3+rng()*85;
  points[3*i]=Math.sin(a)*r;points[3*i+1]=1+rng()*37;points[3*i+2]=Math.cos(a)*r;}
 const particlesGeo=new THREE.BufferGeometry();particlesGeo.setAttribute("position",new THREE.BufferAttribute(points,3));
 const particles=new THREE.Points(particlesGeo,new THREE.PointsMaterial({
  size:level===0?.09:.11,color:level===2?0xe49dff:0x8eeeff,transparent:true,opacity:.6,
  blending:THREE.AdditiveBlending,depthWrite:false
 }));world.add(particles);
 const data={world,hero,enemies,cores,gate,hiDetail,ambient,sun,sky,water,fill,particles};
 return data;
}
export function animateWorld(view,state,t,dt=0){
 view.water.uniforms.uTime.value=t;
 const p=state.player,rig=view.hero.userData.rig;
 view.hero.position.set(p.x,p.y+.18,p.z);
 view.hero.rotation.y=Math.atan2(-p.facingX,-p.facingZ);
 const moving=Math.hypot(p.facingX,p.facingZ);
 const walk=p.dashTime>0?.9:Math.min(1,(state.time%2)*3);
 rig.userData.leftArm.rotation.x=Math.sin(t*10)*.32*walk;
 rig.userData.rightArm.rotation.x=p.attackFlash>0?-1.0:Math.sin(t*10+PI)*.34*walk;
 rig.userData.leftLeg.rotation.x=Math.sin(t*10+PI)*.38*walk;
 rig.userData.rightLeg.rotation.x=Math.sin(t*10)*.38*walk;
 rig.position.y=Math.sin(t*3.3)*.035;
 for(let i=0;i<view.enemies.length;i++){
  const e=state.enemies[i],object=view.enemies[i];object.visible=e.alive;
  if(!e.alive)continue;
  object.position.set(e.x,Math.sin(t*2.4+e.phase)*.13+.05,e.z);
  object.rotation.y=Math.atan2(p.x-e.x,p.z-e.z);
  object.userData.ring.rotation.z=t*.8+i*.8;
  object.scale.setScalar(e.hitFlash>0?1.13:1);
 }
 for(let i=0;i<view.cores.length;i++){
  const c=state.cores[i],ob=view.cores[i];ob.visible=!c.got;
  ob.position.set(c.x,Math.sin(t*1.9+i*2)*.26,c.z);
  ob.userData.crystal.rotation.y=t*1.2+i;
  ob.userData.ring.rotation.z=t*.68;
  ob.userData.ring2.rotation.y=t*.56;
 }
 const ready=state.portalOpen;
 view.gate.shimmer.material.opacity=ready?.43:.035;
 view.gate.shimmer.material.color.setHex(ready?0x39ffe8:0x5b6b95);
 view.gate.inner.rotation.z=t*(ready?1.6:.17);
 view.gate.portal.scale.setScalar(ready?1+.018*Math.sin(t*5):1);
 view.particles.rotation.y=t*.003;
}
