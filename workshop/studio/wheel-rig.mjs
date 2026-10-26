// DuoForge wheel rig — transient runtime pivots for GLB meshes whose
// vertices are baked in vehicle coordinates. No model re-export required.
import * as THREE from "three";

const WHEEL_PART=/(?:\bwheel\b|wheel[_-]|\btire\b|\btyre\b|sidewall|rim|\bhub\b|forged|rotor|brake disc|center lock|centre lock|\blug\b|\bgroove\b)/i;
const FIXED_PART=/caliper|insignia|fender|wheel arch|mirror|steering wheel|intake|wing|bumper|cooling|suspension|strut/i;
const TIRE_PART=/\btire\b|\btyre\b|sidewall|wheel[_-]/i;

export function classifyWheelName(name){
 const n=String(name||"");
 if(!WHEEL_PART.test(n)||FIXED_PART.test(n))return null;
 let side=null,axle=null;
 if(/\bleft\b/i.test(n))side="left";
 else if(/\bright\b/i.test(n))side="right";
 else if(/(?:^|[_\s-])l(?:[_\s-]|$)/i.test(n)&&/wheel/i.test(n))side="left";
 else if(/(?:^|[_\s-])r(?:[_\s-]|$)/i.test(n)&&/wheel/i.test(n))side="right";
 if(/\bfront\b|[_-]front[_-]/i.test(n))axle="front";
 else if(/\brear\b|[_-]rear[_-]/i.test(n))axle="rear";
 return {side,axle,preferTire:TIRE_PART.test(n)&&!/groove/i.test(n)};
}
// Some GLB exporters put the descriptive wheel name on an Object3D/Group
// wrapper and leave the actual Mesh named just "Mesh". Walk ancestors, but
// reject brake-caliper branches before collecting any animated parts.
export function classifyWheelMesh(mesh,vehicle){
 let node=mesh;
 let merged=null;
 while(node&&node!==vehicle){
  if(FIXED_PART.test(node.name||""))return null;
  const part=classifyWheelName(node.name);
  if(part){
   merged={
    side:merged?.side||part.side,
    axle:merged?.axle||part.axle,
    preferTire:Boolean(merged?.preferTire||part.preferTire)
   };
  }
  node=node.parent;
 }
 return merged;
}
function wheelMeshData(vehicle){
 vehicle.updateMatrixWorld(true);
 const body=new THREE.Box3().setFromObject(vehicle);
 const bodyCenter=vehicle.worldToLocal(body.getCenter(new THREE.Vector3()));
 const candidates=[];
 vehicle.traverse(obj=>{
  if(!obj.isMesh||obj.isSkinnedMesh||!obj.visible||!obj.geometry)return;
  const label=classifyWheelMesh(obj,vehicle);
  if(!label)return;
  const box=new THREE.Box3().setFromObject(obj);
  if(box.isEmpty())return;
  const center=vehicle.worldToLocal(box.getCenter(new THREE.Vector3()));
  const side=label.side||(center.x<bodyCenter.x?"left":"right");
  const axle=label.axle||(center.z<bodyCenter.z?"rear":"front");
  const group=side+"-"+axle;
  candidates.push({mesh:obj,center,group,side,axle,preferTire:label.preferTire,box});
 });
 return candidates;
}
export function inspectWheels(vehicle){
 const entries=wheelMeshData(vehicle);
 const grouped=new Map();
 for(const entry of entries){
  if(!grouped.has(entry.group))grouped.set(entry.group,[]);
  grouped.get(entry.group).push(entry);
 }
 const wheels=[];
 for(const [key,parts]of grouped){
  const preferred=parts.filter(p=>p.preferTire);
  const sources=preferred.length?preferred:parts;
  const center=new THREE.Vector3();
  for(const p of sources)center.add(p.center);
  center.multiplyScalar(1/sources.length);
  const sample=sources.reduce((best,curr)=>{
   const volume=p=>p.box.getSize(new THREE.Vector3()).length();
   return !best||volume(curr)>volume(best)?curr:best;
  },null);
  const dimensions=sample.box.getSize(new THREE.Vector3());
  const candidates={x:dimensions.x,y:dimensions.y,z:dimensions.z};
  const axis=Object.entries(candidates).sort((a,b)=>a[1]-b[1])[0][0];
  const [side,axle]=key.split("-");
  wheels.push({key,side,axle,center,axis,parts});
 }
 // Prefer declared front/rear part positions over assumptions about model orientation.
 const front=wheels.filter(w=>w.axle==="front");
 const rear=wheels.filter(w=>w.axle==="rear");
 const averageZ=values=>values.reduce((sum,w)=>sum+w.center.z,0)/values.length;
 const forwardSign=front.length&&rear.length&&Math.abs(averageZ(front)-averageZ(rear))>.05?
  (averageZ(front)<averageZ(rear)?-1:1):1;
 return {wheels,forwardSign,partCount:entries.length};
}
export function createWheelRig(vehicle,{forwardSign}={}){
 const analysis=inspectWheels(vehicle);
 const orientation=forwardSign===-1||forwardSign===1?forwardSign:analysis.forwardSign;
 const rigs=[];
 // Store each original transform and hierarchy, so exiting Play leaves the model intact.
 for(const wheel of analysis.wheels){
  const steer=new THREE.Group();
  steer.name="Temporary steering pivot "+wheel.key;
  steer.userData.duoforgeRuntimeOnly=true;
  steer.position.copy(wheel.center);
  vehicle.add(steer);
  const spin=new THREE.Group();
  spin.name="Temporary rolling pivot "+wheel.key;
  steer.add(spin);
  vehicle.updateMatrixWorld(true);
  const originals=[];
  for(const {mesh}of wheel.parts){
   const parent=mesh.parent;
   if(!parent)continue;
   originals.push({
    mesh,parent,index:parent.children.indexOf(mesh),
    position:mesh.position.clone(),quaternion:mesh.quaternion.clone(),
    scale:mesh.scale.clone()
   });
   spin.attach(mesh); // preserves world geometry, including baked GLB coordinates
  }
  rigs.push({...wheel,steer,spin,originals,angle:0});
 }
 let disposed=false;
 return {
  wheels:rigs,
  forwardSign:orientation,
  count:rigs.length,
  partCount:analysis.partCount,
  step({distance,steerInput=0,steerDegrees=28,steerAngleDegrees=null,wheelRadius=.42}){
   if(disposed)return;
   // Steering input is DRIVER-relative (+ means right). Three.js Y
   // rotation has opposite handedness: negative Y points the nose to
   // driver's right for BOTH +Z and -Z forward vehicles.
   // forwardSign applies to rolling only, not steering.
   const steeringDeg=Number.isFinite(steerAngleDegrees)?steerAngleDegrees:
    steerDegrees*Math.max(-1,Math.min(1,steerInput));
   const steerAngle=-THREE.MathUtils.degToRad(steeringDeg);
   const roll=(Number(distance)||0)/Math.max(.05,wheelRadius)*orientation;
   for(const wheel of rigs){
    if(wheel.axle==="front")wheel.steer.rotation.y=steerAngle;
    // A car wheel must roll about its axle, not around world Y.
    // Vortex GTR wheel cross-sections are in Y/Z, so axle is local X.
    const axis=wheel.axis;
    wheel.spin.rotation[axis]+=roll;
   }
  },
  dispose(){
   if(disposed)return;
   disposed=true;
   for(const wheel of rigs){
    wheel.steer.rotation.set(0,0,0);
    wheel.spin.rotation.set(0,0,0);
    vehicle.updateMatrixWorld(true);
    for(const original of wheel.originals){
     const {mesh,parent,index,position,quaternion,scale}=original;
     parent.add(mesh);
     mesh.position.copy(position);mesh.quaternion.copy(quaternion);mesh.scale.copy(scale);
     const at=parent.children.indexOf(mesh);
     if(at>=0){parent.children.splice(at,1);parent.children.splice(Math.min(index,parent.children.length),0,mesh);}
    }
    vehicle.remove(wheel.steer);
   }
   vehicle.updateMatrixWorld(true);
  }
 };
}
