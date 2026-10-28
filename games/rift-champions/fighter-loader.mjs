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
  let triangles=0,meshes=0,vertices=0,materials=0;
  const materialSet=new Set();
  root.traverse(n=>{
    if(n.isMesh){
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
  if(meshes<20||triangles<10000)throw Error('Detailed fighter model did not contain enough real geometry');
  const aura=new THREE.Group();root.add(aura);
  const auraMaterial=new THREE.MeshBasicMaterial({color:index===0?0x16f0cc:0xff577a,transparent:true,opacity:.75});
  const auraGeo=new THREE.OctahedronGeometry(.07,0);
  for(let i=0;i<8;i++){const mote=new THREE.Mesh(auraGeo,auraMaterial);aura.add(mote);}
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.70,32),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.30,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;root.add(shadow);
  root.userData.riftModel={format:'GLB 2.0',model: index===0?'KAEL':'VEX',triangles,meshes,vertices,materials,source:url};
  return {root,index,body,head,arms,legs,aura,shadow,materials:null,modelStats:root.userData.riftModel};
}