// Temporary, non-destructive cinematic lighting for DuoForge Render World.
// Changes preview clones only; imported GLB textures, meshes and project files stay intact.
import * as THREE from "three";

export const FILM_LOOKS = Object.freeze(["off","golden","studio","noir","natural"]);
const LOOKS = {
 golden:{key:0xffd4a0,fill:0xa7caff,rim:0xffe6b8,keyPower:2.5,fillPower:.65,rimPower:1.6,exposure:1.03},
 studio:{key:0xffffff,fill:0xb7dfff,rim:0xe0ebff,keyPower:2.9,fillPower:1.1,rimPower:2,exposure:1},
 noir:{key:0x93c8ff,fill:0x243e83,rim:0xffd0a8,keyPower:2.3,fillPower:.2,rimPower:2.45,exposure:.83},
 natural:{key:0xffedd2,fill:0xdde8ff,rim:0xffffff,keyPower:1.35,fillPower:.8,rimPower:.8,exposure:1}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createCinematicLighting({scene,renderer,getAnchor,getQuality}){
 const rig=new THREE.Group();
 rig.name="DuoForge cinematic lights (temporary preview only)";
 rig.userData.previewOnly=true;
 let originalExposure=null;
 let current="off";
 let enhanced=false;
 const materials=new Map();
 function restoreMaterials(){
  for(const [mesh,old] of materials){
   const newer=mesh.material;
   mesh.material=old;
   for(const m of Array.isArray(newer)?newer:[newer])if(m&&!((Array.isArray(old)?old:[old]).includes(m)))m.dispose?.();
  }
  materials.clear();
 }
 function clear(){
  if(originalExposure!==null){renderer.toneMappingExposure=originalExposure;originalExposure=null;}
  restoreMaterials();
  rig.clear();
  rig.removeFromParent();
  current="off";enhanced=false;
 }
 function enhanceMaterials(anchor){
  if(!anchor)return;
  anchor.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.material)return;
   const original=mesh.material;
   const modify=mat=>{
    if(!mat?.isMeshStandardMaterial)return mat;
    const copy=mat.clone();
    // Retain ALL supplied albedo/normal/metalness/roughness/texture maps.
    // Only help untextured fallback materials and increase existing IBL response.
    copy.envMapIntensity=Math.max(copy.envMapIntensity||1,1.45);
    if(!copy.roughnessMap)copy.roughness=clamp(copy.roughness,.16,.86);
    copy.needsUpdate=true;
    return copy;
   };
   mesh.material=Array.isArray(original)?original.map(modify):modify(original);
   if(mesh.material!==original)materials.set(mesh,original);
  });
 }
 function directional(color,power,position,target,shadow=false,extent=5){
  const light=new THREE.DirectionalLight(color,power);
  light.position.copy(target).add(position);
  light.target.position.copy(target);
  light.castShadow=shadow;
  if(shadow){
   const range=Math.max(extent*1.3,3);
   light.shadow.camera.left=-range;light.shadow.camera.right=range;
   light.shadow.camera.top=range;light.shadow.camera.bottom=-range;
   light.shadow.camera.near=.1;light.shadow.camera.far=Math.max(extent*8,24);
   const resolution=getQuality()==="high"?2048:1024;
   light.shadow.mapSize.set(resolution,resolution);
   light.shadow.bias=-.0002;
   light.shadow.normalBias=.025;
   light.shadow.radius=2.5;
  }
  rig.add(light,light.target);
 }
 function apply(look="golden",finish=true){
  clear();
  if(!FILM_LOOKS.includes(look)||look==="off")return;
  const anchor=getAnchor();
  if(!anchor)return;
  const bounds=new THREE.Box3().setFromObject(anchor);
  if(bounds.isEmpty())return;
  const target=bounds.getCenter(new THREE.Vector3());
  const size=bounds.getSize(new THREE.Vector3());
  const extent=Math.max(2,size.x,size.y,size.z);
  const p=LOOKS[look];
  originalExposure=renderer.toneMappingExposure;
  renderer.toneMappingExposure=clamp(originalExposure*p.exposure,.58,1.5);
  const r=Math.max(4,extent*1.6);
  directional(p.key,p.keyPower,new THREE.Vector3(-r,r*1.25,r*.8),target,true,extent);
  directional(p.fill,p.fillPower,new THREE.Vector3(r*.8,r*.55,r*.65),target);
  directional(p.rim,p.rimPower,new THREE.Vector3(r*.45,r*.8,-r),target);
  scene.add(rig);
  current=look;enhanced=Boolean(finish);
  if(enhanced)enhanceMaterials(anchor);
 }
 return {apply,clear,active:()=>current!=="off",settings:()=>({look:current,finish:enhanced})};
}
