// DuoForge Render World draw-call batching (preview only).
// Collapses meshes sharing the SAME PBR material into GPU-friendly batches.
// Excludes movable wheel rigs and transparent windows; never mutates the
// user's editable original or exported model source.
import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";

const IDENTITY=new THREE.Matrix4();
function compatible(mesh){
 if(!mesh.isMesh||!mesh.geometry||!mesh.visible||mesh.isSkinnedMesh||mesh.isInstancedMesh)return false;
 if(Array.isArray(mesh.material)||!mesh.material||mesh.material.transparent)return false;
 const attributes=mesh.geometry.attributes;
 return Boolean(attributes?.position&&attributes?.normal&&attributes?.uv);
}
function meshList(holder,excluded){
 const selected=[];
 holder.traverse(node=>{
  if(compatible(node)&&!excluded.has(node))selected.push(node);
 });
 return selected;
}
function preparedGeometry(mesh,inverseWorld){
 let geometry=mesh.geometry.clone();
 const matrix=new THREE.Matrix4().multiplyMatrices(inverseWorld,mesh.matrixWorld);
 geometry.applyMatrix4(matrix);
 // Keep only attributes accepted by GLTF and BufferGeometryUtils. This avoids
 // combining incompatible extra channels from different imported GLBs.
 for(const name of Object.keys(geometry.attributes)){
  if(!["position","normal","uv"].includes(name))geometry.deleteAttribute(name);
 }
 if(geometry.index){
  const expanded=geometry.toNonIndexed();
  geometry.dispose();
  geometry=expanded;
 }
 return geometry;
}
export function batchMeshes(holder,{excluded=new Set(),minimum=3}={}){
 holder.updateMatrixWorld(true);
 const inverse=new THREE.Matrix4().copy(holder.matrixWorld).invert();
 const groups=new Map();
 const items=meshList(holder,excluded);
 for(const mesh of items){
  const key=mesh.material.uuid;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(mesh);
 }
 const created=[],hidden=[];
 let originalMeshes=0,drawsSaved=0;
 for(const [key,meshes]of groups){
  if(meshes.length<minimum)continue;
  const geometries=[];
  try{
   for(const mesh of meshes)geometries.push(preparedGeometry(mesh,inverse));
   const merged=mergeGeometries(geometries,false);
   if(!merged)continue;
   const batch=new THREE.Mesh(merged,meshes[0].material);
   batch.name="Render preview batch ("+meshes.length+" parts)";
   batch.castShadow=meshes.some(m=>m.castShadow);
   batch.receiveShadow=meshes.some(m=>m.receiveShadow);
   batch.frustumCulled=false;
   batch.userData.duoforgePreviewBatch=true;
   holder.add(batch);created.push(batch);
   for(const mesh of meshes){mesh.visible=false;hidden.push(mesh);}
   originalMeshes+=meshes.length;
   drawsSaved+=meshes.length-1;
  }catch(error){
   console.warn("Nonfatal preview batching error:",error);
  }finally{
   for(const g of geometries)g.dispose();
  }
 }
 return {
  originalMeshes,drawsSaved,batches:created.length,
  dispose(){
   for(const mesh of hidden)mesh.visible=true;
   for(const mesh of created){
    mesh.parent?.remove(mesh);
    mesh.geometry.dispose();
   }
  }
 };
}
export function optimizeRenderPreview({model,environment,wheelRig,quality="medium"}){
 if(quality==="high"){
  return {drawsSaved:0,detail:"full",dispose(){}};
 }
 const parts=[],blocked=new Set();
 if(wheelRig)for(const wheel of wheelRig.wheels){
  for(const original of wheel.originals)blocked.add(original.mesh);
 }
 if(model){
  const batch=batchMeshes(model,{excluded:blocked,minimum:3});
  parts.push(batch);
  if(wheelRig)for(const wheel of wheelRig.wheels){
   // Merge tire tread, rim and bolts into a handful of draw calls per wheel,
   // without moving them out of the animated rolling pivot.
   parts.push(batchMeshes(wheel.spin,{minimum:3}));
  }
 }
 if(environment?.group)parts.push(batchMeshes(environment.group,{minimum:3}));
 return {
  drawsSaved:parts.reduce((n,p)=>n+p.drawsSaved,0),
  detail:quality,
  dispose(){for(const p of parts.reverse())p.dispose();}
 };
}
