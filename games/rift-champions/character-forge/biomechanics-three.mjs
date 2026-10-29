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
function findTarget(index,side,part,dof){
 const pref=side?alias[side][part]:alias[part];
 if(pref){for(const n of pref){const item=index.get(normalize(n));if(item)return item;}}
 if(!side){return null;}
 const sideWord=side==="left"?"left":"right",which=side==="left"?"l":"r";
 const tails={thumb:["thumb"],index:["index","finger1"],middle:["middle","finger2"],
  ring:["ring","finger3"],little:["little","pinky","finger4"]}[part];
 if(!tails)return null;
 const candidates=[...index.values()];
 const digit={base:"1",middle:"2",tip:"3"}[dof];
 const suffix={base:["proximal","metacarpal"],middle:["intermediate","middle"],tip:["distal","tip"]}[dof]||[];
 return candidates.find(b=>{
  if(!b.isBone)return false;
  const n=normalize(b.name);
  const fingerMatch=tails.some(t=>n.includes(t));
  const sideMatch=n.includes(sideWord)||n.startsWith(which)||n.endsWith(which);
  const segmentMatch=n.endsWith(digit)||suffix.some(s=>n.endsWith(s));
  return fingerMatch&&sideMatch&&segmentMatch;
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
/** Inspect actual GLB skin vertex weights, without pretending to create missing anatomy.
 * Sampled vertex-weight sum is a diagnostics proxy, not a complete mesh validator.
 */
export function auditGLBAnatomy(root,{maxVertexSamples=2200}={}){
 if(!root?.traverse)throw Error("Använd en riktig importerad 3D-scen.");
 const info={skinnedMeshes:0,bones:0,skinnedVertices:0,
  morphTargets:0,sampledVertices:0,weightIssues:0,
  missingSkinWeights:0,nonNormalizedSamples:0,zeroWeightSamples:0,
  faceMorphNames:[],warnings:[]};
 const names=new Set(),bones=new Set();
 root.traverse(node=>{
  if(node.isBone)bones.add(node);
  if(!node.isSkinnedMesh)return;
  info.skinnedMeshes++;
  const geometry=node.geometry,vertices=geometry?.getAttribute?.("position")?.count||0;
  info.skinnedVertices+=vertices;
  const morphs=node.morphTargetDictionary||{};
  info.morphTargets=Math.max(info.morphTargets,Object.keys(morphs).length);
  for(const n of Object.keys(morphs))names.add(n);
  for(const b of node.skeleton?.bones||[])bones.add(b);
  const index=geometry?.getAttribute?.("skinIndex"),weight=geometry?.getAttribute?.("skinWeight");
  if(!index||!weight||weight.count!==vertices){info.missingSkinWeights++;return;}
  const total=Math.min(Math.floor(maxVertexSamples),vertices),stride=Math.max(1,Math.floor(vertices/Math.max(total,1)));
  const channels=Math.min(weight.itemSize||0,4);
  for(let i=0,seen=0;i<vertices&&seen<total;i+=stride,seen++){
   let sum=0;
   for(let j=0;j<channels;j++){
    const value=weight[["getX","getY","getZ","getW"][j]](i); // handles normalized integer glTF attributes
    if(!Number.isFinite(value)||value<0)info.weightIssues++;
    else sum+=value;
   }
   info.sampledVertices++;
   if(sum<.001)info.zeroWeightSamples++;
   else if(Math.abs(sum-1)>.075)info.nonNormalizedSamples++;
  }
 });
 info.bones=bones.size;info.faceMorphNames=[...names].slice(0,80);
 if(info.missingSkinWeights)info.warnings.push("En eller flera SkinnedMesh saknar skinWeight/skinIndex.");
 if(info.zeroWeightSamples)info.warnings.push("Flera vertex-samples har inga aktiva skinnvikter.");
 if(info.nonNormalizedSamples)info.warnings.push("Skinnvikter behöver normaliseras.");
 if(info.bones<60)info.warnings.push("Färre än 60 ben: fingrar, tår och fina ansiktsleder är sannolikt ofullständiga.");
 if(!info.morphTargets)info.warnings.push("Inga ansikts- eller muskelmorphs kunde påvisas.");
 return info;
}

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
  const bone=findTarget(index,d.side,d.part,d.dof);
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
 const audit=auditGLBAnatomy(root);
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
   engine:ENGINE_VERSION,skinnedMeshes:skinned.length,anatomy:audit,
   mappedChannels:mapped.size,totalChannels:HUMAN_DOF.length,
   unmapped:missed,matched:activeNames,
   facialTargets:[...new Set(morphs.flatMap(m=>Object.keys(m.morphTargetDictionary||{})))],
   muscleGroups:muscle.muscles?Object.keys(muscle.muscles).length:0,
   note:"Led- och muskelvärden är schematiska. Ej full muskelvolym, fysiologi eller verifierad kraftmätning."
  })
 };
}
