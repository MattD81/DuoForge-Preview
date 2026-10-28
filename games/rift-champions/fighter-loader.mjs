import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const bones={
  arms: ['left','right'].map(side=>({shoulder:'shoulder_'+side,elbow:'elbow_'+side,fist:'fist_'+side})),
  legs: ['left','right'].map(side=>({hip:'hip_'+side,knee:'knee_'+side,shin:'shin_'+side,foot:'foot_'+side})),
};

/** Load a real glTF 2.0 PBR asset and map its articulated joints to the existing combat engine.
 * Failure is non-fatal: main.mjs keeps the procedural original instead.
 */
export async function loadDetailedFighter(url,index=0,{onProgress}={}){
  const gltf=await new GLTFLoader().loadAsync(url,onProgress);
  const root=gltf.scene;
  const get=(name)=>{const node=root.getObjectByName(name);if(!node)throw Error('Fighter GLB missing animation joint: '+name);return node;};
  const body=get('body'),head=get('head');
  const arms=bones.arms.map(parts=>Object.fromEntries(Object.entries(parts).map(([key,val])=>[key,get(val)])));
  const legs=bones.legs.map(parts=>Object.fromEntries(Object.entries(parts).map(([key,val])=>[key,get(val)])));
  let triangles=0,meshes=0,vertices=0,materials=0,skinned=0,morphTargets=0,facialMesh=null;
  const materialSet=new Set();
  root.traverse(n=>{
    if(n.isMesh){
      if(n.isSkinnedMesh)skinned++;
      if(n.morphTargetInfluences?.length){morphTargets=Math.max(morphTargets,n.morphTargetInfluences.length);if(!facialMesh)facialMesh=n;}
      meshes++; vertices+=n.geometry?.attributes?.position?.count||0;
      triangles+=(n.geometry?.index?.count||0)/3;
      n.castShadow=true;n.receiveShadow=true;
      for(const m of (Array.isArray(n.material)?n.material:[n.material])){
        if(!m)continue; materialSet.add(m);
        if(m.normalMap){m.normalMap.anisotropy=Math.min(8,THREE.MathUtils.floorPowerOfTwo(8));}
      }
    }
  });
  materials=materialSet.size;
  if(skinned && (morphTargets<8 || triangles<20000))throw Error('Skinned fighter lacks 8 morph targets or detailed geometry');
  if(!skinned && (meshes<20||triangles<10000))throw Error('Fallback fighter geometry invalid');
  const aura=new THREE.Group();root.add(aura);
  const auraMaterial=new THREE.MeshBasicMaterial({color:index===0?0x16f0cc:0xff577a,transparent:true,opacity:.75});
  const auraGeo=new THREE.OctahedronGeometry(.07,0);
  for(let i=0;i<8;i++){const mote=new THREE.Mesh(auraGeo,auraMaterial);aura.add(mote);}
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.70,32),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.30,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;root.add(shadow);
  root.userData.riftModel={format:'GLB 2.0',model: index===0?'KAEL':'VEX',triangles,meshes,vertices,materials,skinned,morphTargets,animations:gltf.animations.map(a=>a.name),source:url};
  return {root,index,body,head,arms,legs,aura,shadow,materials:null,facialMesh,clips:gltf.animations,restHeadY:head.position.y,modelStats:root.userData.riftModel};
}
/** Expression blend shapes driven by actual combat events; stable on mobile and desktop. */
export function updateFacialRig(rig,state,time,dt=1/60){
  const mesh=rig?.facialMesh;
  if(!mesh?.morphTargetInfluences || !mesh.morphTargetDictionary) return;
  const hurt=state.hitstun>0,blocking=state.blockstun>0;
  const blink=Math.max(0,Math.sin(time*2.1+rig.index*1.41)**34);
  const desired={
    browAngry:hurt?.62:state.move==='special'?.94:state.move==='heavy'?.69:.23,
    blinkLeft:blink,blinkRight:blink,
    jawOpen:hurt?.50:state.move==='special'?.75:state.move==='kick'?.25:.035,
    smile:state.move==='idle'?.07:0,
    pain:hurt?.91:blocking?.38:0,
    snarl:state.move==='heavy'?.59:state.move==='special'?.93:0,
    surprise:hurt?.27:0
  };
  const factor=Math.min(1,Math.max(0,dt)*19);
  // Preserve existing 8 morphs; support standard 34 MakeHuman / ARKit blend shapes.
  const remap={browAngry:['browDownLeft','browDownRight'],blinkLeft:['eyeBlinkLeft'],
    blinkRight:['eyeBlinkRight'],jawOpen:['jawOpen'],smile:['mouthSmile'],
    pain:['mouthFrown','eyeSquintLeft','eyeSquintRight'],
    snarl:['noseSneerLeft','noseSneerRight','mouthUpperUp'],
    surprise:['eyeWideLeft','eyeWideRight','browInnerUp']};
  for(const [name,target] of Object.entries(desired)){
    const keys=mesh.morphTargetDictionary[name]!==undefined?[name]:(remap[name]||[]);
    for(const key of keys){
      const idx=mesh.morphTargetDictionary[key];
      if(idx!==undefined)mesh.morphTargetInfluences[idx]+=(target-mesh.morphTargetInfluences[idx])*factor;
    }
  }
}

/** Read an actual, licensed MakeHuman/Ara skinned GLB and adapt its Mixamo game rig. */
export async function loadAraFighter(url,index=0,{onProgress}={}){
  const gltf=await new GLTFLoader().loadAsync(url,onProgress);
  const source=gltf.scene,byName=new Map();
  const norm=n=>String(n).split(':').pop().replace(/[^a-z0-9]/gi,'').toLowerCase();
  source.traverse(n=>{if(n.isBone)byName.set(norm(n.name),n);});
  const bone=(...names)=>{
    for(const n of names){const hit=byName.get(norm(n));if(hit)return hit;}
    throw Error('Ara humanoid missing bone '+names[0]);
  };
  const head=bone('Head');
  const arms=['Left','Right'].map(s=>({shoulder:bone(s+'Arm',s+'UpperArm'),
    elbow:bone(s+'ForeArm',s+'LowerArm'),fist:bone(s+'Hand')}));
  const legs=['Left','Right'].map(s=>({hip:bone(s+'UpLeg',s+'Thigh'),
    knee:bone(s+'Leg',s+'Calf'),shin:bone(s+'Leg',s+'Calf'),foot:bone(s+'Foot')}));
  let triangles=0,skinned=0,meshes=0,morphTargets=0,facialMesh=null;
  const materials=new Set();
  source.traverse(n=>{
    if(!n.isMesh)return;
    meshes++;if(n.isSkinnedMesh)skinned++;
    triangles+=(n.geometry?.index?.count||n.geometry?.attributes?.position?.count||0)/3;
    if(n.morphTargetInfluences?.length>morphTargets){morphTargets=n.morphTargetInfluences.length;facialMesh=n;}
    n.castShadow=true;n.receiveShadow=true;
    for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)materials.add(m);
  });
  if(skinned<1||triangles<4500)throw Error('Ara GLB has no valid skinned humanoid geometry');
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);body.add(source);
  source.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(source);
  if(box.isEmpty()||!Number.isFinite(box.max.y)||box.max.y<=box.min.y)throw Error('Invalid MakeHuman bounds');
  const scale=3.1/(box.max.y-box.min.y);
  source.scale.setScalar(scale);source.position.y=-box.min.y*scale;
  const aura=new THREE.Group();root.add(aura);
  const glow=new THREE.MeshBasicMaterial({color:index===0?0x16f0cc:0xff577a,transparent:true,opacity:.65});
  const geo=new THREE.OctahedronGeometry(.055,0);
  for(let i=0;i<8;i++)aura.add(new THREE.Mesh(geo,glow));
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.72,32),
    new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.3,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;root.add(shadow);
  const modelStats={source:url,provider:'Ara 3D Gen + CC0 MakeHuman',format:'GLB 2.0',
    model:index===0?'KAEL':'VEX',triangles:Math.round(triangles),skinned,meshes,
    morphTargets,materials:materials.size,animations:(gltf.animations||[]).map(a=>a.name)};
  root.userData.riftModel=modelStats;
  return {root,index,body,head,arms,legs,aura,shadow,facialMesh,
    restHeadY:head.position.y,clips:gltf.animations,modelStats};
}
