/** GLB placement adapter used by preview and standalone ZIP games. */
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {assertSafeGlb,cleanPlacement} from "./safe-assets.mjs";

export async function createPlacedModel(asset,root){
 const buffer=asset.bytes?asset.bytes:await (async()=>{
  if(typeof asset.url!=="string"||!/^\.\/assets\/[a-z0-9-]+\.glb$/i.test(asset.url))
   throw Error("Modellen måste laddas från den lokala spel-ZIP-filen.");
  const response=await fetch(asset.url);
  if(!response.ok)throw Error("GLB saknas i spelarkivet.");
  return new Uint8Array(await response.arrayBuffer());
 })();
 const {bytes}=assertSafeGlb(buffer);
 const clean=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const parsed=await new GLTFLoader().parseAsync(clean,"");
 const model=parsed.scene;
 const originalBounds=new THREE.Box3().setFromObject(model);
 const dims=originalBounds.getSize(new THREE.Vector3());
 const maxDim=Math.max(dims.x,dims.y,dims.z);
 if(!Number.isFinite(maxDim)||maxDim<.0001)throw Error("GLB-modellen har ingen synlig geometri.");
 const norm=Math.min(20,2.2/maxDim);
 const mixer=parsed.animations?.length?new THREE.AnimationMixer(model):null;
 if(mixer)mixer.clipAction(parsed.animations[0]).play();
 function applyPlacement(p){
  const safe=cleanPlacement(p);
  model.scale.setScalar(norm*safe.scale);
  model.rotation.y=safe.rotation*Math.PI/180;
  model.position.set(0,0,0);
  model.updateMatrixWorld(true);
  const bound=new THREE.Box3().setFromObject(model);
  model.position.set(safe.x,-bound.min.y,safe.z);
 }
 applyPlacement(asset.placement);
 root.add(model);
 return {
  model,applyPlacement,update:dt=>mixer?.update(dt),
  dispose:()=>{
   root.remove(model);
   model.traverse(node=>{
    node.geometry?.dispose?.();
    for(const material of Array.isArray(node.material)?node.material:[node.material]){
     if(!material)continue;
     for(const key of ["map","normalMap","roughnessMap","metalnessMap","emissiveMap","aoMap"])
      material[key]?.dispose?.();
     material.dispose?.();
    }
   });
  }
 };
}
