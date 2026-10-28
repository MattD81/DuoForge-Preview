import * as THREE from "three";
// DuoForge Material Lab V3: reproducible, exportable color/normal/ORM microstructure.
// Geometry-based PBR (GGX, Fresnel, energy-conserving coatings) is supplied by
// Three.js MeshPhysicalMaterial, not a cosmetic "metal" CSS effect.
export const MATERIAL_SPECS=Object.freeze({
 hull:Object.freeze({color:0x193c4b,roughness:.29,metalness:.62,clearcoat:.88,clearcoatRoughness:.16,noise:.10,stripes:3,seed:11}),
 darkPaint:Object.freeze({color:0x102d3c,roughness:.37,metalness:.48,clearcoat:.7,clearcoatRoughness:.2,noise:.12,stripes:4,seed:17}),
 ceramic:Object.freeze({color:0xcbd9d7,roughness:.47,metalness:.12,clearcoat:.44,clearcoatRoughness:.33,noise:.08,stripes:2,seed:23}),
 teak:Object.freeze({color:0x8e7053,roughness:.77,metalness:0,clearcoat:0,clearcoatRoughness:0,noise:.22,stripes:24,seed:31}),
 bronze:Object.freeze({color:0xbdaa83,roughness:.29,metalness:.94,clearcoat:0,clearcoatRoughness:0,noise:.14,stripes:15,seed:43}),
 steel:Object.freeze({color:0xaab4b8,roughness:.31,metalness:.92,clearcoat:0,clearcoatRoughness:0,noise:.09,stripes:19,seed:59}),
 safety:Object.freeze({color:0xdf6142,roughness:.38,metalness:.14,clearcoat:.64,clearcoatRoughness:.3,noise:.14,stripes:3,seed:67}),
 stone:Object.freeze({color:0x76827e,roughness:.94,metalness:.015,clearcoat:0,clearcoatRoughness:0,noise:.33,stripes:8,seed:79}),
 wood:Object.freeze({color:0x84694f,roughness:.82,metalness:.005,clearcoat:0,clearcoatRoughness:0,noise:.24,stripes:27,seed:83}),
 roof:Object.freeze({color:0x353e48,roughness:.71,metalness:.16,clearcoat:.05,clearcoatRoughness:.6,noise:.18,stripes:9,seed:89})
});
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function hash(x,y,seed){let h=Math.imul(x+seed,374761393)^Math.imul(y+seed*7,668265263);h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0}
function heightAt(x,y,size,spec){
 const grain=(hash(x,y,spec.seed)/4294967295-.5);
 const stripe=Math.sin((x/size*spec.stripes+y/size*.21)*Math.PI*2);
 const fine=Math.sin((y/size*spec.stripes*2.5+x/size*.33)*Math.PI*2);
 const knots=Math.sin((x+y*.12)*.095+spec.seed);
 return clamp(.5+grain*spec.noise*1.9+stripe*spec.noise*.24+fine*spec.noise*.12+knots*spec.noise*.20,0,1);
}
export function pixelAt(x,y,size,spec){
 const h=heightAt(x,y,size,spec),hx=heightAt((x+1)%size,y,size,spec)-heightAt((x-1+size)%size,y,size,spec);
 const hy=heightAt(x,(y+1)%size,size,spec)-heightAt(x,(y-1+size)%size,size,spec);
 const modulation=clamp(.82+(h-.5)*.66,.66,1.02);
 const base=new THREE.Color(spec.color).convertLinearToSRGB();
 const c=[base.r,base.g,base.b].map(v=>Math.round(clamp(v*modulation,0,1)*255));
 const rough=Math.round(clamp(spec.roughness+(h-.5)*.31,.045,1)*255);
 const metal=Math.round(spec.metalness*255);
 const nx=-hx*1.8,ny=-hy*1.8,norm=Math.hypot(nx,ny,1);
 return {
  color:[...c,255],
  orm:[255,rough,metal,255], // R occlusion 1; G roughness; B metalness (glTF packed ORM).
  normal:[Math.round((nx/norm*.5+.5)*255),Math.round((ny/norm*.5+.5)*255),Math.round((1/norm*.5+.5)*255),255]
 };
}
export function makeSurfaceMaps(spec,{size=128}={}){
 if(typeof document==="undefined")throw Error("PBR texture creation requires a browser canvas");
 const safeSize=clamp(Math.floor(size),32,512),maps={};
 for(const key of ["color","orm","normal"]){
  const canvas=document.createElement("canvas");canvas.width=canvas.height=safeSize;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)throw Error("2D canvas unavailable for PBR material generation");
  const image=ctx.createImageData(safeSize,safeSize),data=image.data;
  for(let y=0;y<safeSize;y++)for(let x=0;x<safeSize;x++){
   const channels=pixelAt(x,y,safeSize,spec)[key],index=(y*safeSize+x)*4;
   data.set(channels,index);
  }
  ctx.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.name="DuoForge procedural "+key+" "+spec.seed;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=4;
  texture.colorSpace=key==="color"?THREE.SRGBColorSpace:THREE.NoColorSpace;
  texture.needsUpdate=true;
  maps[key]=texture;
 }
 return maps;
}
const cache=new Map();
export function materialLab(name,{size=128}={}){
 const spec=MATERIAL_SPECS[name];
 if(!spec)throw Error("Unknown PBR material: "+name);
 const key=name+":"+size;
 if(cache.has(key))return cache.get(key);
 const maps=makeSurfaceMaps(spec,{size});
 const material=new THREE.MeshPhysicalMaterial({
  name:"DuoForge PBR • "+name,
  map:maps.color,
  roughnessMap:maps.orm,metalnessMap:maps.orm,
  normalMap:maps.normal,normalScale:new THREE.Vector2(.27,.27),
  color:0xffffff,metalness:1,roughness:1,
  clearcoat:spec.clearcoat,clearcoatRoughness:spec.clearcoatRoughness,
  envMapIntensity:.95
 });
 material.userData.source="DuoForge Material Lab V3";
 material.userData.spec={...spec};
 cache.set(key,material);
 return material;
}
export function glassMaterial(){
 // Thin panes intentionally use alpha (transparency) in the real-time game,
 // while the ray-traced gallery builds thicker transmissive sample geometry.
 return new THREE.MeshPhysicalMaterial({
  name:"DuoForge PBR • tinted laminated glass",
  color:0x74a1ad,metalness:0,roughness:.075,
  transparent:true,opacity:.56,depthWrite:false,
  clearcoat:1,clearcoatRoughness:.05,ior:1.5,side:THREE.DoubleSide,
  envMapIntensity:1.3
 });
}
export function materialManifest(){
 return Object.fromEntries(Object.entries(MATERIAL_SPECS).map(([key,spec])=>[
  key,{roughness:spec.roughness,metalness:spec.metalness,clearcoat:spec.clearcoat,
  normalMap:true,colorMap:true,ormMap:true}
 ]));
}
