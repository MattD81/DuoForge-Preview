// DuoForge Animation Rig Bridge: preserved glTF skeletal clips, skinned clones,
// exact-timestamp animation sampling and per-joint pose overlays.
// No attempt to falsely skin an arbitrary unrigged GLB.
import * as THREE from "three";
import {clone as cloneSkeleton} from "three/addons/utils/SkeletonUtils.js";
const CLIPS=new WeakMap();
export function registerRigClips(root,clips){
 if(root&&Array.isArray(clips)){
  // Three.AnimationClip does not expose isAnimationClip in every Three release.
  const valid=clips.filter(c=>c instanceof THREE.AnimationClip||
   (c&&typeof c.name==="string"&&Array.isArray(c.tracks)&&Number.isFinite(c.duration)));
  CLIPS.set(root,valid);
  root.userData.duoforgeClipNames=valid.map(c=>c.name);
 }
}
export function getRigClips(root){return CLIPS.get(root)||[]}
export function cloneRiggedModel(root){
 if(!root)return null;
 let skinned=false;root.traverse(o=>{if(o.isSkinnedMesh)skinned=true});
 const copy=skinned?cloneSkeleton(root):root.clone(true);
 registerRigClips(copy,getRigClips(root));
 return copy;
}
export function makeRigDirector(root){
 let mixer=null,active="",time=0;
 const clips=getRigClips(root);
 const bones=[];
 root.traverse(o=>{if(o.isBone)bones.push(o)});
 const starting=new Map(bones.map(b=>[b,b.quaternion.clone()]));
 const posed=new Map();
 const names=[...new Set(bones.map(b=>b.name).filter(Boolean))];
 function start(name=""){
  active=clips.some(c=>c.name===name)?name:"";
  if(mixer){mixer.stopAllAction();mixer=null;}
  if(active){
   mixer=new THREE.AnimationMixer(root);
   const clip=clips.find(c=>c.name===active);
   mixer.clipAction(clip).reset().play();
   mixer.setTime(0);
  }else for(const [bone,quaternion] of starting)bone.quaternion.copy(quaternion);
  sample(time);
 }
 function pose(name,xyz=[0,0,0]){
  if(!names.includes(name))return false;
  if(!Array.isArray(xyz)||xyz.length!==3||xyz.some(v=>!Number.isFinite(v)||Math.abs(v)>Math.PI))return false;
  posed.set(name,xyz.slice());sample(time);return true;
 }
 function sample(seconds=0){
  time=Math.max(0,Number(seconds)||0);
  if(mixer){
   // Absolute time ensures offline rendering does not depend on screen refresh rate.
   const clip=clips.find(c=>c.name===active);
   mixer.setTime(clip?.duration?time%clip.duration:time);
  }else for(const [bone,quat] of starting)bone.quaternion.copy(quat);
  for(const bone of bones){
   const angles=posed.get(bone.name);if(!angles)continue;
   const rot=new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles));
   bone.quaternion.multiply(rot);
  }
  root.updateMatrixWorld(true);
 }
 function release(){
  if(mixer){mixer.stopAllAction();mixer.uncacheRoot(root);mixer=null;}
  for(const [b,q]of starting)b.quaternion.copy(q);
  posed.clear();root.updateMatrixWorld(true);
 }
 return {
  clips:clips.map(c=>({name:c.name,duration:c.duration})),
  bones:names,hasSkin:bones.length>0,
  start,pose,sample,release,
  active:()=>active,
  poses:()=>Object.fromEntries(posed)
 };
}
