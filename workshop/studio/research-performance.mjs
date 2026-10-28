// DuoForge 3D Research – deterministic geometry audit and non-destructive export presets.
// No paid model calls, automatic topology edits, or unsupported WebGPU claims.
export const EXPORT_PROFILES=Object.freeze({
 original:Object.freeze({maxTextureSize:2048,description:"Original, upp till 2048 px per textur"}),
 mobile:Object.freeze({maxTextureSize:1024,description:"Mobil, upp till 1024 px per textur"})
});
export function exportProfile(name){
 return EXPORT_PROFILES[name]||EXPORT_PROFILES.original;
}
export function auditScene(root,triangleBudget=100000){
 const budget=Number.isFinite(triangleBudget)&&triangleBudget>0?triangleBudget:100000;
 let triangles=0,meshes=0,skinned=0,materials=0,textureCount=0,vertices=0;
 const uniqueMaterials=new Set(),textures=new Set(),seenGeometry=new Set();
 const issues=[];
 root?.traverse?.(node=>{
  if(!node?.isMesh||!node.geometry)return;
  meshes++;if(node.isSkinnedMesh)skinned++;
  const geo=node.geometry;
  const count=geo.index?.count??geo.attributes?.position?.count??0;
  triangles+=Math.floor(count/3);
  vertices+=geo.attributes?.position?.count||0;
  seenGeometry.add(geo);
  for(const mat of (Array.isArray(node.material)?node.material:[node.material])){
   if(!mat||uniqueMaterials.has(mat))continue;
   uniqueMaterials.add(mat);
   for(const key of ["map","normalMap","roughnessMap","metalnessMap","emissiveMap","aoMap","alphaMap","bumpMap","displacementMap"]){
    if(mat[key])textures.add(mat[key]);
   }
  }
 });
 materials=uniqueMaterials.size;textureCount=textures.size;
 if(triangles>budget)issues.push("Geometrin överstiger vald mobilbudget – använd LOD eller meshoptimering innan publicering.");
 if(skinned>0)issues.push("Riggat mesh: förenkla inte benvikter eller animationer automatiskt.");
 if(textureCount>12)issues.push("Många texturer: testa mobilprofilen och mät faktisk GLB-storlek.");
 return {meshes,triangles,vertices,skinned,materials,textureCount,geometryResources:seenGeometry.size,budget,overBudget:triangles>budget,issues};
}
export async function checkWebGPU(navigatorObject=globalThis.navigator){
 if(!navigatorObject?.gpu?.requestAdapter)return {available:false,renderer:"WebGL",detail:"WebGPU API saknas här"};
 try{
  const adapter=await navigatorObject.gpu.requestAdapter({powerPreference:"low-power"});
  return {available:Boolean(adapter),renderer:"WebGL",
   detail:adapter?"WebGPU-enhet finns; studion använder fortfarande WebGL":"Ingen kompatibel WebGPU-adapter"};
 }catch{
  return {available:false,renderer:"WebGL",detail:"WebGPU kunde inte kontrolleras"};
 }
}
