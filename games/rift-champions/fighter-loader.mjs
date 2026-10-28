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
  return {root,index,body,head,arms,legs,aura,shadow,materials:null,facialMesh,clips:gltf.animations,modelStats:root.userData.riftModel};
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
  for(const [name,target] of Object.entries(desired)){
    const index=mesh.morphTargetDictionary[name];
    if(index===undefined)continue;
    mesh.morphTargetInfluences[index]+=(target-mesh.morphTargetInfluences[index])*factor;
  }
}
