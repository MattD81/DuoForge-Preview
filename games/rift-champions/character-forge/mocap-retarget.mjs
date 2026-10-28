
import * as THREE from 'three';
import {BVHLoader} from 'three/addons/loaders/BVHLoader.js';

const aliases={
 body:['Hips'],pelvis:['Hips'],spine:['Spine','Spine1','abdomen'],
 chest:['Spine2','Chest','upperback'],neck:['Neck'],head:['Head'],
 shoulder_left:['LeftShoulder','LeftArm','LeftUpArm'],elbow_left:['LeftForeArm','LeftLowArm'],
 fist_left:['LeftHand'],hip_left:['LeftUpLeg','LeftThigh'],knee_left:['LeftLeg'],
 shin_left:['LeftLeg'],foot_left:['LeftFoot'],
 shoulder_right:['RightShoulder','RightArm','RightUpArm'],elbow_right:['RightForeArm','RightLowArm'],
 fist_right:['RightHand'],hip_right:['RightUpLeg','RightThigh'],knee_right:['RightLeg'],
 shin_right:['RightLeg'],foot_right:['RightFoot']
};
const key=s=>String(s).replace(/[^a-z0-9]/gi,'').toLowerCase();
export function createBVHRetargeter(text,{root},{speed=1}={}){
  if(typeof text!=='string'||text.length<50||text.length>10_000_000)throw Error('BVH ska vara 50 byte–10 MB');
  if(!root?.getObjectByName('head'))throw Error('Ladda först en V3-karaktär');
  const {skeleton,clip}=new BVHLoader().parse(text);
  const sources=new Map(skeleton.bones.map(b=>[key(b.name),b]));
  const pairs=[];
  for(const [name,names] of Object.entries(aliases)){
    const target=root.getObjectByName(name);
    const source=names.map(n=>sources.get(key(n))).find(Boolean);
    if(source&&target)pairs.push({target,source,baseline:target.quaternion.clone()});
  }
  if(pairs.length<6)throw Error('För få matchade leder i BVH: '+pairs.length);
  const helper=new THREE.SkeletonHelper(skeleton.bones[0]);
  const mixer=new THREE.AnimationMixer(helper);
  const action=mixer.clipAction(clip);action.setLoop(THREE.LoopRepeat,Infinity).play();
  mixer.setTime(0);
  pairs.forEach(p=>p.origin=p.source.quaternion.clone());
  const inv=new THREE.Quaternion();
  return {
    duration:clip.duration,matched:pairs.map(p=>p.target.name),
    update(dt){
      mixer.update(Math.max(0,Math.min(.08,dt))*Math.max(.1,Math.min(3,speed)));
      for(const p of pairs){
        inv.copy(p.origin).invert();
        p.target.quaternion.copy(p.baseline).multiply(inv).multiply(p.source.quaternion).normalize();
      }
    },
    stop(){
      action.stop();mixer.stopAllAction();
      pairs.forEach(p=>p.target.quaternion.copy(p.baseline));
    }
  };
}
