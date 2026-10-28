// DuoForge Open Research Stack: dependency-free GLB inspection, scene audit and local index contract.
// This does NOT reconstruct geometry, apply meshopt/KTX2, or activate a WebGPU renderer.
import {auditScene} from "./research-performance.mjs";
export const STACK_VERSION="duoforge-open-research@1";
export const MAX_GLB_BYTES=50*1024*1024;
const hashRE=/^[0-9a-f]{64}$/;
const safeName=s=>String(s||"3D-scen").replace(/[\x00-\x1f]/g,"").slice(0,100);
const pad=n=>Math.ceil(n/4)*4;

export function inspectGLB(input){
 const data=input instanceof ArrayBuffer?new Uint8Array(input):input;
 if(!(data instanceof Uint8Array))throw Error("GLB måste vara binära data.");
 if(data.byteLength<20||data.byteLength>MAX_GLB_BYTES)throw Error("GLB måste vara 20 byte–50 MB.");
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2)
  throw Error("Ogiltig GLB-header eller annan glTF-version.");
 if(v.getUint32(8,true)!==data.byteLength)throw Error("GLB-längden stämmer inte.");
 let offset=12,doc=null,hasBin=false;
 while(offset<data.byteLength){
  if(offset+8>data.byteLength)throw Error("Ofullständig GLB-chunk.");
  const length=v.getUint32(offset,true),type=v.getUint32(offset+4,true);
  offset+=8;
  if(length%4||length>data.byteLength-offset)throw Error("Ogiltig GLB-chunkstorlek.");
  if(doc===null){
   if(type!==0x4e4f534a||length>8*1024*1024)throw Error("Första GLB-chunken ska vara JSON (max 8 MB).");
   const txt=new TextDecoder("utf-8",{fatal:true}).decode(data.subarray(offset,offset+length));
   try{doc=JSON.parse(txt.trimEnd());}catch{throw Error("GLB innehåller ogiltig JSON.");}
  }else if(type===0x004e4942){hasBin=true;}
  offset+=length;
 }
 if(!doc||doc.asset?.version!=="2.0"||!Array.isArray(doc.scenes))
  throw Error("GLB saknar giltig glTF 2.0-scen.");
 const ext=Array.isArray(doc.extensionsUsed)?doc.extensionsUsed.filter(x=>typeof x==="string").slice(0,80):[];
 const required=Array.isArray(doc.extensionsRequired)?doc.extensionsRequired.filter(x=>typeof x==="string").slice(0,80):[];
 const issues=[];
 const external=[];
 for(const resource of [...(doc.buffers||[]),...(doc.images||[])]){
  if(typeof resource?.uri==="string")external.push(resource.uri.length>180?resource.uri.slice(0,180)+"…":resource.uri);
 }
 if(external.length)issues.push("Externa buffer-/bildreferenser: GLB är inte självförsörjande.");
 if(required.includes("KHR_draco_mesh_compression"))issues.push("Draco-avkodare krävs; standardimporten i studion är inte konfigurerad med en.");
 if(required.includes("EXT_meshopt_compression"))issues.push("Meshopt-avkodare krävs för den här GLB-filen.");
 if(required.includes("KHR_texture_basisu"))issues.push("KTX2-avkodare krävs för komprimerade texturer.");
 if(ext.some(x=>/gaussian|splat/i.test(x)))issues.push("Gaussian Splats upptäckta – 3D-studions vanliga GLB-import är inte en splat-renderare.");
 let triangles=0,unknownPrimitives=0;
 for(const mesh of doc.meshes||[])for(const primitive of mesh.primitives||[]){
  if(primitive.mode!==undefined&&primitive.mode!==4){unknownPrimitives++;continue;}
  const accessor=doc.accessors?.[primitive.indices??primitive.attributes?.POSITION];
  if(Number.isFinite(accessor?.count))triangles+=Math.floor(accessor.count/3);
 }
 if(unknownPrimitives)issues.push("Scenen innehåller "+unknownPrimitives+" primitiv(er) som inte är trianglar.");
 if(triangles>100000)issues.push("Över 100 000 trianglar – prova mobilprofilen och kontrollera faktisk prestanda.");
 if(doc.animations?.length)issues.push("Animationer finns: verifiera uppspelning efter import.");
 if(!hasBin&&doc.buffers?.length)issues.push("GLB saknar BIN-chunk trots bufferdefinition.");
 return Object.freeze({
  format:"glTF 2.0 / GLB",bytes:data.byteLength,
  scenes:doc.scenes.length,meshes:doc.meshes?.length||0,
  nodes:doc.nodes?.length||0,materials:doc.materials?.length||0,
  textures:doc.textures?.length||0,animations:doc.animations?.length||0,
  estimatedTriangles:triangles,hasBinaryChunk:hasBin,
  extensions:ext,requiredExtensions:required,externalResources:external,
  issues
 });
}

export function inspectScene(root,triangleBudget=100000){
 const report=auditScene(root,triangleBudget);
 const warnings=[...report.issues];
 let unnamed=0,nonFinite=0,nonPositiveScale=0;
 root?.traverse?.(node=>{
  if(!node?.isMesh)return;
  if(!String(node.name||"").trim())unnamed++;
  for(const axis of ["x","y","z"]){
   if(!Number.isFinite(node.position?.[axis]??0)||!Number.isFinite(node.scale?.[axis]??1))nonFinite++;
   if((node.scale?.[axis]??1)<=0)nonPositiveScale++;
  }
 });
 if(unnamed)warnings.push(unnamed+" meshar saknar namn – försvårar riggning och återanvändning.");
 if(nonFinite)warnings.push("Ogiltig position/skala på "+nonFinite+" axelvärden.");
 if(nonPositiveScale)warnings.push("Noll-/negativ skala på "+nonPositiveScale+" axlar.");
 return {...report,unnamed,nonFinite,nonPositiveScale,issues:warnings};
}

export function recommendReuse(digest,name,items=[]){
 if(!hashRE.test(digest))throw Error("Ogiltig SHA-256.");
 const exact=items.find(x=>x.sha256===digest);
 if(exact)return {status:"identical",entry:exact};
 const old=items.filter(x=>x.name?.toLowerCase()===safeName(name).toLowerCase());
 return old.length?{status:"new-version",entry:old[0]}:{status:"new-asset",entry:null};
}

export function makeIndexEntry({sha256,name,projectId=null,glb,scene,now=Date.now()}){
 if(!hashRE.test(sha256))throw Error("Ogiltig SHA-256.");
 if(!Number.isFinite(now)||now<0)throw Error("Ogiltigt tidsvärde.");
 return {
  format:STACK_VERSION,sha256,name:safeName(name),projectId:projectId?String(projectId).slice(0,100):null,
  updated:now,bytes:glb?.bytes||0,
  meshes:glb?.meshes||0,triangles:scene?.triangles??glb?.estimatedTriangles??0,
  warnings:(scene?.issues||glb?.issues||[]).slice(0,12).map(s=>String(s).slice(0,200))
 };
}

export function makePortableReport({entry,glb,scene,capability}){
 if(entry?.format!==STACK_VERSION||!hashRE.test(entry.sha256))
  throw Error("Ogiltigt analysunderlag.");
 // Deliberately excludes private model binaries, authorisation and remote data.
 return {format:STACK_VERSION,entry,glb,scene,capability,
  notice:"Manifest/analys; innehåller INTE själva 3D-modellen. Skicka tillhörande GLB separat."};
}
