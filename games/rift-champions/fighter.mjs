import * as THREE from 'three';
import {MOVES,getPosePhase} from './combat.mjs';
const G={sphere:new THREE.SphereGeometry(1,24,16),box:new THREE.BoxGeometry(1,1,1),cyl:new THREE.CylinderGeometry(1,1,1,12),torus:new THREE.TorusGeometry(1,.12,8,24),cone:new THREE.ConeGeometry(1,1,9)};
const mat=(c,metal=0,rough=.5,emissive=0)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough,emissive:c,emissiveIntensity:emissive});
function ell(parent,m,x,y,z,sx,sy,sz){const o=new THREE.Mesh(G.sphere,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(parent,m,x,y,z,sx,sy,sz){const o=new THREE.Mesh(G.box,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function cyl(parent,m,x,y,z,rt,rb,h,rot=0){const g=new THREE.CylinderGeometry(rt,rb,h,12);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.rotation.z=rot;o.castShadow=true;parent.add(o);return o;}
function torus(parent,m,x,y,z,r,tube=.07,rotX=0){const o=new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,24),m);o.position.set(x,y,z);o.rotation.x=rotX;parent.add(o);return o;}
function plate(parent,m,x,y,z,w,h,d=.055){const p=box(parent,m,x,y,z,w,h,d);p.rotation.z=0;return p;}
function joint(parent,x,y,z){const j=new THREE.Group();j.position.set(x,y,z);parent.add(j);return j;}
function stripe(parent,m,x,y,z,w,h){const o=box(parent,m,x,y,z,w,h,.018);o.rotation.z=.17;return o;}
function cord(parent,m,pts,r=.025){const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));const o=new THREE.Mesh(new THREE.TubeGeometry(curve,24,r,6,false),m);parent.add(o);return o;}
function makeLeg(root,side,p){
  const hip=joint(root,side*.29,1.08,0);ell(hip,p.pants,0,-.24,0,.235,.39,.225);
  const thighPlate=ell(hip,p.armor,.03,-.24,.13,.18,.27,.085);ell(hip,p.trim,.025,-.54,.10,.18,.12,.16);
  const knee=joint(hip,0,-.55,0);ell(knee,p.dark,0,-.03,0,.19,.2,.20);plate(knee,p.plate,0,-.018,.19,.27,.19);
  const shin=joint(knee,0,-.17,0);ell(shin,p.armor,0,-.22,0,.17,.31,.19);ell(shin,p.trim,0,-.33,.14,.16,.17,.07);
  const foot=joint(shin,0,-.48,0);ell(foot,p.dark,.10,-.035,.08,.28,.16,.28);ell(foot,p.plate,.13,-.01,.21,.25,.09,.14);stripe(foot,p.glow,.13,.05,.32,.2,.018);
  for(let i=0;i<4;i++)stripe(shin,p.trim,0,-.08-i*.09,.16,.17,.014);
  return {hip,knee,shin,foot};
}
function makeArm(root,side,p){
  const shoulder=joint(root,side*.63,2.12,0);
  ell(shoulder,p.skin,0,-.18,0,.225,.36,.21);ell(shoulder,p.armor,side*.035,-.12,.07,.29,.21,.28);
  ell(shoulder,p.plate,side*.055,-.05,.25,.225,.12,.055);
  for(let j=0;j<3;j++)stripe(shoulder,p.glow,side*.02,-.10-j*.075,.312,.21,.012);
  const elbow=joint(shoulder,0,-.51,0);ell(elbow,p.dark,0,0,0,.16,.15,.16);
  ell(elbow,p.armor,0,-.21,0,.18,.29,.18);ell(elbow,p.trim,0,-.31,.14,.175,.17,.085);
  const fist=joint(elbow,0,-.43,.01);ell(fist,p.plate,.012,-.075,.065,.225,.21,.22);
  for(let i=0;i<4;i++)ell(fist,p.trim,-.11+i*.074,-.16,.22,.041,.055,.045);
  stripe(fist,p.glow,0,-.012,.255,.26,.03);
  return {shoulder,elbow,fist};
}
/** Original procedural fighters; no remote GLBs, reused local Three engine and PBR surfaces. */
export function createFighter({index=0}={}){
  const blue=index===0;
  const p={
    skin:mat(blue?0x99654c:0x8e665b,0,.85),
    armor:mat(blue?0x164351:0x493245,.65,.32),
    pants:mat(blue?0x1b222d:0x202029,.15,.7),
    dark:mat(blue?0x121b25:0x17151e,.45,.42),
    plate:mat(blue?0x70b6b4:0xd7a176,.65,.3),
    trim:mat(blue?0xc5f0dd:0xf2d2bf,.5,.22),
    glow:mat(blue?0x15eacb:0xff596f,.32,.18,2.1),
    eye:mat(blue?0xffe6c0:0xff564f,.1,.1,2.6),
    hair:mat(blue?0x182434:0x1b0e15,.12,.8),
  };
  const world=joint(new THREE.Group(),0,0,0);const root=world.parent;
  const body=joint(world,0,0,0);
  // Waist, torso, layered chest plates, musculature and glowing seams.
  ell(body,p.pants,0,1.11,0,.44,.34,.265);
  ell(body,p.skin,0,1.65,0,.52,.55,.29);
  ell(body,p.armor,0,1.83,-.04,.58,.52,.32);
  ell(body,p.armor,-.245,1.94,.23,.255,.27,.095);ell(body,p.armor,.245,1.94,.23,.255,.27,.095);
  ell(body,p.plate,0,1.85,.303,.115,.20,.04);
  ell(body,p.dark,0,1.48,.235,.36,.18,.075);ell(body,p.glow,0,1.55,.31,.22,.035,.024);
  stripe(body,p.glow,-.24,1.75,.311,.16,.026);stripe(body,p.glow,.23,1.75,.311,.16,.026);
  for(let i=0;i<3;i++)ell(body,p.plate,-.3+i*.3,1.35,.257,.11,.085,.057);
  // Ornamental layered belt and front tabard.
  box(body,p.dark,0,1.11,.01,.88,.19,.49);box(body,p.trim,0,1.11,.282,.19,.13,.05);box(body,p.glow,0,1.12,.324,.085,.05,.019);
  box(body,p.armor,0,.77,.29,.26,.45,.09);stripe(body,p.plate,0,.72,.344,.17,.05);
  for(let i=0;i<5;i++){box(body,p.trim,-.35+i*.175,1.12,.286,.09,.032,.025);}
  // Neck and bespoke face with eyes, brow, nose, cheekbones and hair/headgear.
  ell(body,p.skin,0,2.39,0,.17,.26,.16);
  const head=joint(body,0,2.55,0);ell(head,p.skin,0,.12,0,.275,.345,.245);
  ell(head,p.skin,0,-.07,.19,.2,.12,.115);ell(head,p.skin,0,.03,.27,.085,.14,.06);
  for(const s of [-1,1]){
    ell(head,p.dark,s*.126,.16,.225,.11,.056,.035);ell(head,p.eye,s*.13,.17,.263,.064,.022,.018);
    ell(head,p.skin,s*.22,.05,.092,.07,.15,.07);
    stripe(head,p.plate,s*.18,.285,.18,.12,.026);
  }
  if(blue){ // sculpted cyber samurai crest/hair, back ponytail ribbon
    ell(head,p.hair,0,.36,-.035,.28,.14,.26);
    for(let i=0;i<6;i++){const cone=new THREE.Mesh(new THREE.ConeGeometry(.075,.33,7),p.hair);cone.position.set(-.19+i*.077,.48-i*.014,-.055);cone.rotation.z=-.38;head.add(cone);}
    cord(head,p.trim,[[0,.39,-.17],[-.05,.43,-.29],[-.19,.28,-.37],[-.24,.05,-.42]],.044);
    ell(head,p.glow,0,.27,.245,.08,.035,.027);
  }else{ // asymmetric spiked mask with red oni sigil
    ell(head,p.dark,0,.35,-.06,.28,.135,.25);
    for(let i=0;i<5;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.075,.25+i*.03,8),p.hair);spike.position.set((i-2)*.11,.45,-.03);spike.rotation.z=(i-2)*-.11;head.add(spike);}
    ell(head,p.plate,0,-.025,.255,.21,.09,.052);stripe(head,p.glow,0,.01,.302,.18,.027);
    for(const s of [-1,1]){const horn=new THREE.Mesh(new THREE.ConeGeometry(.09,.28,8),p.plate);horn.position.set(s*.24,.47,.01);horn.rotation.z=-s*.3;head.add(horn);}
  }
  // Arm rig and leg rig: real articulated limbs, independently animated.
  const arms=[makeArm(body,-1,p),makeArm(body,1,p)];const legs=[makeLeg(body,-1,p),makeLeg(body,1,p)];
  // Cloth belts/dangling straps and accent cords add readable surface complexity.
  for(const s of [-1,1]){cord(body,p.trim,[[s*.35,1.35,-.05],[s*.44,1.02,-.12],[s*.48,.73,-.20]],.035);}
  // Material detail: braided forearm energy coils.
  for(const arm of arms){for(let i=0;i<3;i++)torus(arm.elbow,p.glow,0,-.19+i*.12,0,.178,.015,Math.PI/2);}
  const aura=new THREE.Group();root.add(aura);for(let i=0;i<8;i++){
    const m=new THREE.Mesh(new THREE.OctahedronGeometry(.04+i*.008),p.glow);m.userData.phase=i*Math.PI/4;aura.add(m);
  }
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.72,28),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.3,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;root.add(shadow);
  root.userData={body,head,arms,legs,aura,shadow,materials:p,index};
  return {root,index,materials:p,arms,legs,body,head,aura,shadow};
}
const lerp=(a,b,t)=>a+(b-a)*t;
export function updateFighterPose(rig,state,time,dt=1/60){
  const {root,body,head,arms,legs,aura,shadow}=rig;
  root.position.x=state.x;root.rotation.y=state.face===1?0:Math.PI;
  body.position.y=state.y+(Math.sin(time*3+rig.index)*.026);
  const hurt=state.hitstun>0;const blocking=state.blockstun>0;
  const phase=getPosePhase(state);const m=MOVES[state.move];const prog=m?Math.min(1,state.t/(m.startup+m.active+m.recovery)):0;
  const active=m&&phase==='active';const travel=m?Math.min(1,state.t/m.startup):0;
  const pulse=Math.sin(time*2.1+rig.index*.8);
  let torsoAngle=0,headAngle=0;
  let armL=.15+Math.sin(time*2.8)*.045, armR=-.17-Math.sin(time*2.8)*.04, elbowL=-.18,elbowR=.19;
  let legL=.03,legR=-.04,kneeL=.09,kneeR=.06;
  const forwardBias=state.face===1?1:-1;
  if(state.move==='jab'){armL=lerp(.14,1.44,travel);elbowL=lerp(-.15,-.04,travel);torsoAngle=.12*travel;}
  if(state.move==='heavy'){armR=lerp(-.15,1.5,travel);elbowR=lerp(.18,.05,travel);torsoAngle=.2*travel;}
  if(state.move==='kick'){legR=lerp(-.05,1.35,travel);kneeR=lerp(.1,.03,travel);armL=.5;torsoAngle=-.15*travel;}
  if(state.move==='special'){armL=lerp(.2,1.1,travel);armR=lerp(-.2,1.1,travel);torsoAngle=-.07;}
  if(m&&phase==='recovery'){const decay=1-(state.t-m.startup-m.active)/m.recovery;armL*=decay;armR*=decay;legR*=decay;}
  if(hurt){torsoAngle=-.22;headAngle=-.24;armL=-.65;armR=-.9;}
  if(blocking){armL=1.05;armR=1.12;}
  if(state.move==='idle'&&!hurt&&!blocking){const walking=Math.abs(state.x-(rig.prevX??state.x))>.008;const walk=walking?Math.sin(time*12)*.33:0;
    legL=walk;legR=-walk;armL+=-walk*.4;armR+=walk*.4;}
  const smoothing=Math.min(1,dt*16);
  function approach(obj,key,target){obj.rotation[key]=lerp(obj.rotation[key],target,smoothing);}
  approach(body,'z',torsoAngle);approach(head,'z',headAngle);
  approach(arms[0].shoulder,'z',armL);approach(arms[1].shoulder,'z',armR);
  approach(arms[0].elbow,'z',elbowL);approach(arms[1].elbow,'z',elbowR);
  approach(legs[0].hip,'z',legL);approach(legs[1].hip,'z',legR);
  approach(legs[0].knee,'z',kneeL);approach(legs[1].knee,'z',kneeR);
  head.position.y=2.55+Math.sin(time*2)*.012;
  shadow.scale.setScalar(Math.max(.56,1-state.y*.24));shadow.material.opacity=Math.max(.08,.32-state.y*.09);
  aura.visible=state.move==='special'||state.meter>72;
  aura.children.forEach((m,i)=>{const a=time*(i%2?2:-2)+i*Math.PI/4;m.position.set(Math.cos(a)*(.66+Math.sin(time*4+i)*.08),1+((time*.6+i*.17)%1)*1.5,Math.sin(a)*.43);m.scale.setScalar(1+Math.sin(time*8+i)*.35);});
  rig.prevX=state.x;
}
