/**
 * DuoForge GPU Deluxe V5 - CPU scene acceleration for native WebGL2 triangle rays.
 * Small dependency-free BVH. No second platform, no GLB data upload.
 * Selected geometry only: max 768 faces, no textures or skeletal deformation.
 */
export const GPU_DELUXE_V5_VERSION="duoforge-gpu-deluxe@5";
export const V5_MAX_TRIANGLES=768;
const bound=(x,a,b)=>Math.min(b,Math.max(a,x));
const vec3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)?v.map(Number):null;
const valid=t=>t&&vec3(t.a)&&vec3(t.b)&&vec3(t.c);
const triangleBounds=t=>{
 const min=[0,1,2].map(i=>Math.min(t.a[i],t.b[i],t.c[i]));
 const max=[0,1,2].map(i=>Math.max(t.a[i],t.b[i],t.c[i]));
 const center=min.map((v,i)=>(v+max[i])*.5);
 return {min,max,center};
};
const mergeBounds=items=>{
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const item of items)for(let i=0;i<3;i++){
  min[i]=Math.min(min[i],item.bounds.min[i]);
  max[i]=Math.max(max[i],item.bounds.max[i]);
 }
 return {min,max};
};
/**
 * Leaf node: left=-firstIndex-1, right=count. Internal: left/right=node index.
 * Node layout: min.xyz/left, max.xyz/right. Triangle: A, B, C,
 * color.rgb/metalness, roughness/unused/unused/unused (5 RGBA texels).
 */
export function buildTriangleBVH(triangles,{limit=V5_MAX_TRIANGLES,leafSize=4}={}){
 if(!Array.isArray(triangles))throw Error("Ange en lista med trianglar");
 const max=bound(Math.floor(limit)||1,1,V5_MAX_TRIANGLES),leaf=bound(Math.floor(leafSize)||4,1,4);
 const items=[];
 for(const item of triangles.slice(0,max)){
  if(!valid(item))continue;
  const a=vec3(item.a),b=vec3(item.b),c=vec3(item.c);
  const area=Math.hypot(
   (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
   (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),
   (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
  if(area<1e-9)continue;
  const rgb=Array.isArray(item.color)&&item.color.length===3
   ?item.color.map(v=>bound(Number.isFinite(v)?v:.65,0,1)):[.6,.7,.8];
  const tri={a,b,c,color:rgb,metalness:bound(Number(item.metalness)||0,0,1),
   roughness:bound(Number.isFinite(item.roughness)?item.roughness:.6,.08,1)};
  items.push({triangle:tri,bounds:triangleBounds(tri)});
 }
 const nodes=[],ordered=[];
 function visit(batch,depth){
  const box=mergeBounds(batch),index=nodes.length;
  nodes.push({min:box.min,max:box.max,left:0,right:0});
  if(batch.length<=leaf||depth>=24){
   const first=ordered.length;
   for(const item of batch)ordered.push(item.triangle);
   nodes[index].left=-first-1;
   nodes[index].right=batch.length;
  }else{
   const extent=box.max.map((v,i)=>v-box.min[i]);
   const axis=extent.indexOf(Math.max(...extent));
   batch.sort((a,b)=>a.bounds.center[axis]-b.bounds.center[axis]);
   const mid=batch.length>>1;
   nodes[index].left=visit(batch.slice(0,mid),depth+1);
   nodes[index].right=visit(batch.slice(mid),depth+1);
  }
  return index;
 }
 if(items.length)visit(items,0);
 const triData=new Float32Array(Math.max(1,ordered.length)*20);
 ordered.forEach((t,i)=>{
  const j=i*20;
  triData.set([...t.a,0,...t.b,0,...t.c,0,
   ...t.color,t.metalness,t.roughness,0,0,0],j);
 });
 const nodeData=new Float32Array(Math.max(1,nodes.length)*8);
 nodes.forEach((n,i)=>{
  nodeData.set([...n.min,n.left,...n.max,n.right],i*8);
 });
 return Object.freeze({triangles:ordered.length,nodes:nodes.length,
  triangleTextureWidth:Math.max(1,ordered.length)*5,
  nodeTextureWidth:Math.max(1,nodes.length)*2,
  triData,nodeData,leafSize:leaf});
}
export function v5QualityProfile({width=1280,height=720,mobile=false,preset="balanced"}={}){
 const w=bound(Math.floor(width)||1,1,8192),h=bound(Math.floor(height)||1,1,8192);
 const configs={
  balanced:[mobile?64:192,mobile?10000:22000,16],
  cinematic:[mobile?128:384,mobile?16000:42000,48],
  extreme:[mobile?192:768,mobile?22000:72000,96]
 };
 const picked=Object.hasOwn(configs,preset)?preset:"balanced";
 const [maxTriangles,maxPixels,maxSamples]=configs[picked];
 const scale=Math.min(1,Math.sqrt(maxPixels/(w*h)));
 return Object.freeze({preset:picked,mobile,maxTriangles,maxPixels,maxSamples,
  width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale)),
  resolutionScale:scale,usesNeuralModel:false,
  renderMode:"WebGL2-bvh-triangle-raytrace"});
}
/**
 * Full-detail raster path for assets too rich for the small BVH preview.
 * PBR uses the original scene graph, GLB textures, skinning and all triangles.
 * The renderer may lower its device pixel ratio to preserve frame time; it
 * never discards mesh geometry. No DLSS, model weights or network calls.
 */
export function v5DetailPbrProfile({preset="balanced",mobile=false,
 devicePixelRatio=1,adaptiveScale=1}={}){
 const ceiling={balanced:1,cinematic:mobile?1.25:1.5,extreme:mobile?1.5:2};
 const selected=Object.hasOwn(ceiling,preset)?preset:"balanced";
 const native=Number.isFinite(devicePixelRatio)?bound(devicePixelRatio,.5,4):1;
 const adaptive=Number.isFinite(adaptiveScale)?bound(adaptiveScale,.6,1):1;
 return Object.freeze({preset:selected,mode:"full-detail-pbr",
  pixelRatio:Number(Math.max(.5,Math.min(native,ceiling[selected])*adaptive).toFixed(3)),
  maxPixelRatio:Math.min(native,ceiling[selected]),preservesGeometry:true,
  preservesTextures:true,preservesSkinning:true,usesNeuralModel:false});
}

export function v5CameraSignature(camera){
 if(!camera?.matrixWorld?.elements||!camera?.projectionMatrix?.elements)return null;
 return [...camera.matrixWorld.elements,...camera.projectionMatrix.elements].map(v=>Math.round(v*100000)/100000).join(",");
}
