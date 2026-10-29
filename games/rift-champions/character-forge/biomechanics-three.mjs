import * as THREE from "three";
import {HUMAN_DOF,NeuromuscularEngine,ENGINE_VERSION} from "./biomechanics-core.mjs";

// Keep aliasing explicit: glTF rigs differ in bone naming and local coordinate frames.
// V3 uses left/right suffixes, ARK/Mixamo importers may use other conventions.
const normalize=s=>String(s).split(":").pop().toLowerCase().replace(/[^a-z0-9]/g,"");
const alias={
 pelvis:["pelvis","hips","hip","body"],spine:["spine","spine1","abdomen"],
 chest:["chest","spine2","upperchest"],neck:["neck"],jaw:["jaw","jawbone"],
 left:{
  clavicle:["clavicle_left","leftshoulder","shoulder_l","leftclavicle"],
  shoulder:["shoulder_left","leftarm","leftupperarm","upperarm_l","leftupperarmbone"],
  elbow:["elbow_left","leftforearm","leftlowerarm","lowerarm_l"],
  forearm:["elbow_left","leftforearm","leftlowerarm"],
  wrist:["fist_left","lefthand","hand_l","leftwrist"],
  hip:["hip_left","leftupleg","leftthigh","thigh_l"],
  knee:["knee_left","leftleg","leftcalf","calf_l"],
  ankle:["foot_left","leftfoot","foot_l"],
  toe:["toe_left","lefttoebase","lefttoe"]
 },
 right:{
  clavicle:["clavicle_right","rightshoulder","shoulder_r","rightclavicle"],
  shoulder:["shoulder_right","rightarm","rightupperarm","upperarm_r"],
  elbow:["elbow_right","rightforearm","rightlowerarm","lowerarm_r"],
  forearm:["elbow_right","rightforearm","rightlowerarm"],
  wrist:["fist_right","righthand","hand_r","rightwrist"],
  hip:["hip_right","rightupleg","rightthigh","thigh_r"],
  knee:["knee_right","rightleg","rightcalf","calf_r"],
  ankle:["foot_right","rightfoot","foot_r"],
  toe:["toe_right","righttoebase","righttoe"]
 }
};
function findTarget(index,side,part){
 const pref=side?alias[side][part]:alias[part];
 if(pref){for(const n of pref){const item=index.get(normalize(n));if(item)return item;}}
 if(!side){return null;}
 const sideWord=side==="left"?"left":"right",which=side==="left"?"l":"r";
 const tails={thumb:["thumb"],index:["index","finger1"],middle:["middle","finger2"],
  ring:["ring","finger3"],little:["little","pinky","finger4"]}[part];
 if(!tails)return null;
 const candidates=[...index.values()];
 return candidates.find(b=>{
  const n=normalize(b.name);return tails.some(t=>n.includes(t))&&
  (n.includes(sideWord)||n.endsWith(which));
 })||null;
}
const orientation={
 pelvis:{tilt:["x",1],roll:["z",1],turn:["y",1]},
 spine:{flex:["x",1],side:["z",1],twist:["y",1]},
 chest:{flex:["x",1],twist:["y",1]},
 neck:{pitch:["x",1],yaw:["y",1],roll:["z",1]},
 clavicle:{elev:["z",1]},shoulder:{flex:["x",1],abd:["z",1],rotate:["y",1]},
 elbow:{flex:["z",1]},forearm:{pronate:["y",1]},
 wrist:{flex:["z",1],deviate:["x",1]},
 hip:{flex:["x",1],abd:["z",1],turn:["y",1]},
 knee:{flex:["x",1]},ankle:{dorsi:["x",1],roll:["z",1]},
 toe:{flex:["x",1]}
};
const faceKeys={
 jawOpen:["jawOpen"],blinkLeft:["blinkLeft","eyeBlinkLeft"],
 blinkRight:["blinkRight","eyeBlinkRight"],
 browAngry:["browAngry","browDownLeft","browDownRight"],
 smile:["smile","mouthSmileLeft","mouthSmileRight"],
 pain:["pain","mouthFrownLeft","mouthFrownRight"],
 snarl:["snarl","noseSneerLeft","noseSneerRight"],
 surprise:["surprise","eyeWideLeft","eyeWideRight"]
};
export function createBiomechanicsAdapter(root,{massKg=75,intensity=1}={}){
 if(!root?.traverse)throw Error("Importera en GLB med skelett först.");
 const index=new Map(),skinned=[],morphs=[];
 root.traverse(o=>{
  if(o.isBone||o.isObject3D){const n=normalize(o.name);if(n&&!index.has(n))index.set(n,o);}
  if(o.isSkinnedMesh)skinned.push(o);
  if(o.morphTargetInfluences?.length&&o.morphTargetDictionary)morphs.push(o);
 });
 if(skinned.length<1)throw Error("Modellen saknar en riktig SkinnedMesh. En dekorationsmodell räcker inte.");
 const mapped=new Map(),missed=[];
 const bones=new Map();
 for(const d of HUMAN_DOF){
  if(d.part==="jaw")continue;
  const bone=findTarget(index,d.side,d.part);
  if(!bone){missed.push(d.id);continue;}
  const setting=orientation[d.part]?.[d.dof]||(
   ["thumb","index","middle","ring","little"].includes(d.part)?{base:["z",1],middle:["z",1],tip:["z",1]}[d.dof]:null);
  if(!setting){missed.push(d.id);continue;}
  const [axis,sign]=setting;
  const factor=(d.side==="right"&&axis==="z")?-1:1;
  mapped.set(d.id,{bone,axis,sign:sign*factor});
  if(!bones.has(bone))bones.set(bone,{rotation:bone.quaternion.clone(),scale:bone.scale.clone()});
 }
 if(mapped.size<10)throw Error("För få ledmatchningar i GLB. Krav: minst tio stödda ledkanaler.");
 const muscle=new NeuromuscularEngine({massKg,intensity});
 const q=new THREE.Quaternion(),euler=new THREE.Euler(0,0,0,"XYZ");
 let running=true;
 const lastAngles=new Map(),matrices=new Map();
 for(const [bone] of bones)matrices.set(bone,{x:0,y:0,z:0});
 const animFrame=dt=>{
  if(!running)return null;
  const report=muscle.step(dt);
  for(const [bone,angles] of matrices){angles.x=angles.y=angles.z=0;}
  for(const [id,mapping] of mapped){
   const value=report.joints[id]||0;
   matrices.get(mapping.bone)[mapping.axis]+=value*mapping.sign;
  }
  for(const [bone,base] of bones){
   const a=matrices.get(bone);
   euler.set(a.x,a.y,a.z,"XYZ");
   q.setFromEuler(euler);
   bone.quaternion.copy(base.rotation).multiply(q).normalize();
  }
  for(const mesh of morphs){
   const dict=mesh.morphTargetDictionary,values=mesh.morphTargetInfluences;
   for(const [key,names] of Object.entries(faceKeys)){
    const target=report.face[key]||0;
    for(const name of names){const idx=dict[name];if(idx!==undefined)
     values[idx]+= (target-values[idx])*(1-Math.exp(-clampDt(dt)*12));}
   }
   // Optional muscle-volume blendshapes, only when real target geometry exists.
   for(const side of ["left","right"]){
    const channel=report.joints[side+".elbow.flex"]||0;
    const activation=muscle.muscles[side+"-biceps-brachii"]?.activation||0;
    for(const key of ["bicepsBulge"+side[0].toUpperCase()+side.slice(1),
     "biceps_"+side,"muscleFlex_"+side]){
     const idx=dict[key];
     if(idx!==undefined)values[idx]=Math.max(0,Math.min(1,activation*.7+Math.max(0,channel)*.15));
    }
   }
  }
  return report;
 };
 function clampDt(dt){return Math.max(0,Math.min(.08,Number.isFinite(dt)?dt:0));}
 function stop(){
  if(!running)return;
  running=false;
  for(const [bone,base] of bones){bone.quaternion.copy(base.rotation);bone.scale.copy(base.scale);}
  // Do not reset all facial morphs: other controls own them.
 }
 const activeNames=[...mapped.keys()];
 return {
  engine:muscle,update:animFrame,stop,setMotion:(name,params)=>muscle.setMotion(name,params),
  diagnostics:()=>({
   engine:ENGINE_VERSION,skinnedMeshes:skinned.length,
   mappedChannels:mapped.size,totalChannels:HUMAN_DOF.length,
   unmapped:missed,matched:activeNames,
   facialTargets:[...new Set(morphs.flatMap(m=>Object.keys(m.morphTargetDictionary||{})))],
   muscleGroups:muscle.muscles?Object.keys(muscle.muscles).length:0,
   note:"Led- och muskelvärden är schematiska. Ej full muskelvolym, fysiologi eller verifierad kraftmätning."
  })
 };
}
