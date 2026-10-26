// DuoForge Surface Engine — royalty-free procedural PBR textures generated locally.
// No remote assets, model API, image generation service or tokens are required.
// UV maps remain standard Three.js CanvasTextures and survive GLB export.
import * as THREE from "three";

export const SURFACE_PRESETS=Object.freeze([
 {id:"paint",label:"Billack / metallic",color:"#2465ba",roughness:.22,metalness:.68,clearcoat:1},
 {id:"carbon",label:"Kolfiber",color:"#3b4b57",roughness:.3,metalness:.42,clearcoat:.65},
 {id:"chrome",label:"Krom",color:"#c5d7df",roughness:.13,metalness:1,clearcoat:.5},
 {id:"brushed",label:"Borstad metall",color:"#a0afb9",roughness:.33,metalness:.92,clearcoat:.1},
 {id:"glass",label:"Tonat glas",color:"#6eb6db",roughness:.12,metalness:.08,clearcoat:1},
 {id:"rubber",label:"Gummi / däck",color:"#353d46",roughness:.87,metalness:0,clearcoat:0},
 {id:"leather",label:"Läder",color:"#74523e",roughness:.67,metalness:0,clearcoat:.12},
 {id:"asphalt",label:"Asfalt",color:"#60676c",roughness:.98,metalness:0,clearcoat:0},
 {id:"grass",label:"Gräs",color:"#6f8d4e",roughness:1,metalness:0,clearcoat:0},
 {id:"bark",label:"Träbark",color:"#86664a",roughness:.99,metalness:0,clearcoat:0},
 {id:"wood",label:"Träpanel",color:"#ad7e56",roughness:.72,metalness:0,clearcoat:.07},
 {id:"concrete",label:"Betong",color:"#a9aba8",roughness:.91,metalness:0,clearcoat:0},
 {id:"brick",label:"Tegel",color:"#b66f59",roughness:.88,metalness:0,clearcoat:0},
 {id:"stone",label:"Sten / klippa",color:"#898c84",roughness:.94,metalness:0,clearcoat:0},
 {id:"sand",label:"Sand",color:"#cbb68a",roughness:.96,metalness:0,clearcoat:0},
 {id:"neon",label:"Neon / lysande",color:"#36f5cb",roughness:.26,metalness:.18,clearcoat:.9},
 {id:"plaster",label:"Puts / fasad",color:"#c9c3af",roughness:.84,metalness:0,clearcoat:0}
]);
const PRESETS=new Map(SURFACE_PRESETS.map(p=>[p.id,p]));
const TEXTURED=new Set(["carbon","brushed","rubber","leather","asphalt","grass","bark","wood","concrete","brick","stone","sand","plaster"]);
export function surfacePreset(id){return PRESETS.get(id)||PRESETS.get("concrete")}
export function hasSurfaceTexture(id){return TEXTURED.has(id)}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function hash(label){
 let n=2166136261;
 for(const c of label){n=Math.imul(n^c.charCodeAt(0),16777619);}
 return n>>>0;
}
function randomSeed(seed){
 let x=seed>>>0;
 return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296};
}
function grayscaleNoise(context,size,kind,random){
 const image=context.createImageData(size,size),data=image.data;
 const grain=kind==="asphalt"?51:kind==="grass"?47:kind==="stone"?43:kind==="sand"?30:kind==="concrete"?31:kind==="plaster"?19:17;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4;
  const variation=(random()-.5)*grain;
  const wave=kind==="wood"?Math.sin((x/size)*30+Math.sin(y/12)*1.3)*12:
   kind==="brushed"?Math.sin(y*.88)*4+Math.sin(y*4.1)*2:
   kind==="bark"?Math.sin(x*.22+Math.sin(y*.028)*2.4)*23:0;
  const v=clamp(Math.round(204+variation+wave),80,250);
  data[i]=v;data[i+1]=v;data[i+2]=v;data[i+3]=255;
 }
 context.putImageData(image,0,0);
}
function paintDetails(ctx,size,type,rand){
 if(type==="wood"||type==="bark"){
  ctx.strokeStyle=type==="wood"?"rgba(86,52,26,.3)":"rgba(46,36,27,.34)";
  ctx.lineWidth=type==="wood"?1.2:2.1;
  for(let i=0;i<(type==="wood"?23:31);i++){
   const x=rand()*size;
   ctx.beginPath();
   for(let y=-5;y<=size+5;y+=5){
    const xx=x+Math.sin(y*.038+i)*3+Math.sin(y*.112+i*2)*1.3;
    if(y===-5)ctx.moveTo(xx,y);else ctx.lineTo(xx,y);
   }
   ctx.stroke();
  }
  if(type==="wood"){
   for(let i=0;i<4;i++){
    const x=rand()*size,y=rand()*size;
    ctx.strokeStyle="rgba(84,47,20,.22)";
    ctx.beginPath();ctx.ellipse(x,y,2+rand()*9,9+rand()*13,0,0,Math.PI*2);ctx.stroke();
   }
  }
 }else if(type==="brick"){
  const w=size/4,h=size/8;
  ctx.fillStyle="#838383";ctx.fillRect(0,0,size,size);
  for(let row=0;row<8;row++)for(let col=-1;col<6;col++){
   const x=col*w+(row%2)*w/2+2,y=row*h+2;
   const v=155+Math.round(rand()*75);
   ctx.fillStyle="rgb("+v+","+Math.round(v*.93)+","+Math.round(v*.88)+")";
   ctx.fillRect(x,y,w-4,h-4);
   ctx.fillStyle="rgba(255,255,255,.14)";ctx.fillRect(x,y,w-4,2);
   ctx.fillStyle="rgba(55,43,35,.12)";ctx.fillRect(x,y+h-6,w-4,2);
  }
 }else if(type==="carbon"){
  const step=size/16;
  ctx.fillStyle="#7f7f7f";ctx.fillRect(0,0,size,size);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
   const xx=x*step,yy=y*step,alternate=(x+y)%2===0;
   ctx.fillStyle=alternate?"#d9d9d9":"#575757";
   ctx.fillRect(xx+1,yy+1,step-2,step-2);
   ctx.fillStyle=alternate?"rgba(55,55,55,.25)":"rgba(245,245,245,.28)";
   if(alternate)ctx.fillRect(xx+1,yy+1,step*.48,step-2);
   else ctx.fillRect(xx+1,yy+1,step-2,step*.48);
  }
 }else if(type==="rubber"){
  ctx.strokeStyle="rgba(30,30,30,.3)";ctx.lineWidth=2;
  for(let x=-size;x<size*2;x+=14){
   ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+size,size);ctx.stroke();
   ctx.beginPath();ctx.moveTo(x+size,0);ctx.lineTo(x,size);ctx.stroke();
  }
 }else if(type==="leather"){
  for(let i=0;i<size*2;i++){
   const x=rand()*size,y=rand()*size,r=.5+rand()*1.5;
   ctx.fillStyle=rand()<.5?"rgba(45,34,26,.16)":"rgba(255,255,255,.16)";
   ctx.beginPath();ctx.ellipse(x,y,r,r*.65,0,0,Math.PI*2);ctx.fill();
  }
 }else if(type==="asphalt"||type==="concrete"||type==="stone"||type==="sand"||type==="plaster"){
  const specks=type==="asphalt"?size*7:type==="sand"?size*5:size*2;
  for(let i=0;i<specks;i++){
   const x=rand()*size,y=rand()*size,r=rand()*(type==="stone"?3:1.6)+.3;
   ctx.fillStyle=rand()<.5?"rgba(25,25,25,.25)":"rgba(255,255,255,.2)";
   ctx.fillRect(x,y,r,r);
  }
  if(type==="stone"||type==="concrete"){
   ctx.strokeStyle=type==="stone"?"rgba(70,70,70,.2)":"rgba(65,65,65,.12)";
   ctx.lineWidth=1;
   for(let j=0;j<(type==="stone"?5:2);j++){
    const x=rand()*size,y=rand()*size;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*30-15,y+rand()*34-17);ctx.stroke();
   }
  }
 }else if(type==="grass"){
  // Tiny clumps and individual blades, not a flat green plane.
  for(let i=0;i<size*7;i++){
   const x=rand()*size,y=rand()*size;
   ctx.strokeStyle=rand()>.5?"rgba(44,65,35,.36)":"rgba(255,255,215,.27)";
   ctx.lineWidth=.6+rand()*.8;
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*4,y-1-rand()*5);ctx.stroke();
  }
 }else if(type==="brushed"){
  for(let y=0;y<size;y+=1){
   ctx.fillStyle=rand()>.6?"rgba(252,252,252,.16)":"rgba(58,58,58,.1)";
   ctx.fillRect(0,y,size,rand()*1.2);
  }
 }
}
function makeTexture(type,dimension){
 const canvas=document.createElement("canvas");
 canvas.width=canvas.height=dimension;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 if(!ctx)return null;
 const rand=randomSeed(hash(type));
 grayscaleNoise(ctx,dimension,type,rand);
 paintDetails(ctx,dimension,type,rand);
 return canvas;
}
export function createSurfaceLibrary(quality="medium"){
 const detail=quality==="low"?128:quality==="high"?384:256;
 const textures=new Map(),materials=new Map();
 function texture(type,repeat=[1,1]){
  if(!TEXTURED.has(type))return null;
  const x=clamp(Number(repeat[0])||1,.05,150),y=clamp(Number(repeat[1])||1,.05,150);
  const key=[type,detail,x,y].join(":");
  if(textures.has(key))return textures.get(key);
  const canvas=makeTexture(type,detail);
  if(!canvas)return null;
  const result=new THREE.CanvasTexture(canvas);
  result.name="DuoForge "+type+" procedural texture";
  result.colorSpace=THREE.SRGBColorSpace;
  result.wrapS=result.wrapT=THREE.RepeatWrapping;
  result.repeat.set(x,y);
  result.anisotropy=4;
  result.generateMipmaps=true;
  result.needsUpdate=true;
  textures.set(key,result);
  return result;
 }
 function material(type,options={}){
  const preset=surfacePreset(type),id=preset.id;
  const tint=new THREE.Color(options.color??preset.color);
  const rgb="#"+tint.getHexString();
  const repeat=options.repeat||[1,1];
  const opacity=clamp(Number(options.opacity??1),.05,1);
  const roughness=clamp(Number(options.roughness??preset.roughness),.02,1);
  const metalness=clamp(Number(options.metalness??preset.metalness),0,1);
  const clearcoat=clamp(Number(options.clearcoat??preset.clearcoat??0),0,1);
  const key=[id,rgb,repeat[0],repeat[1],opacity,roughness,metalness,clearcoat].join("|");
  if(materials.has(key))return materials.get(key);
  const opts={
   name:"DuoForge / "+id,color:tint,metalness,roughness,clearcoat,
   clearcoatRoughness:id==="paint"?.13:id==="carbon"?.21:.24,
   opacity,transparent:opacity<.999,side:id==="glass"?THREE.DoubleSide:THREE.FrontSide
  };
  const map=texture(id,repeat);
  if(map){opts.map=map;
   // Low-amplitude material bumps create depth without large mesh geometry.
   if(id!=="grass"&&id!=="carbon"){opts.bumpMap=map;opts.bumpScale=id==="brick"?.032:id==="asphalt"?.018:id==="wood"?.02:.012;}
  }
  if(id==="glass"){opts.roughness=.09;opts.metalness=.05;opts.transparent=true;opts.opacity=options.opacity??.4;
   opts.depthWrite=false;opts.clearcoat=1;opts.side=THREE.DoubleSide;}
  if(id==="neon"){opts.emissive=tint.clone();opts.emissiveIntensity=1.4;opts.color=tint.clone().multiplyScalar(.65);}
  if(id==="chrome"){opts.metalness=1;opts.roughness=.085;}
  const m=new THREE.MeshPhysicalMaterial(opts);
  m.userData={duoforgeSurface:id,duoforgeTile:repeat.slice()};
  materials.set(key,m);
  return m;
 }
 function dispose(){
  for(const m of materials.values())m.dispose();
  for(const t of textures.values())t.dispose();
  materials.clear();textures.clear();
 }
 return {material,texture,dispose,stats:()=>({textures:textures.size,materials:materials.size,detail})};
}
