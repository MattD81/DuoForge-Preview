// DuoForge Cinema: opt-in WebGL2 progressive physical path tracing for STILL images.
// Stable WebGL release 0.0.24 supports Three.js r180. Never used in gameplay/real-time
// Film Studio video. All work stays on the user's device (no paid GPU or API).
import * as THREE from "three";
import {atrousDenoisePixels} from "./cinema-wavelet-denoise.mjs";
const MODULE_URL="https://esm.sh/three-gpu-pathtracer@0.0.24?bundle&external=three";
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

export function createPathTraceStills({getAnchor,getCamera,onStatus,filename}){
 let running=false,cancelled=false;
 const $=id=>document.getElementById(id);
 const status=text=>{onStatus(text);$("filmPathStatus").textContent=text;};
 function download(blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=String(filename()||"DuoForge").replace(/[^\p{L}\p{N}_. -]/gu,"").replace(/\s+/g,"-").slice(0,70)+"-pathtraced.png";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 function stop(){if(running){cancelled=true;status("Avbryter path tracing …");}}
 async function render(){
  if(running)return;
  const anchor=getAnchor();
  if(!anchor){status("Importera först en GLB-modell och öppna Render World.");return;}
  running=true;cancelled=false;$("filmPathTrace").disabled=true;
  $("filmPathCancel").hidden=false;
  let tracer=null,renderer=null,workScene=null,floor=null;
  try{
   if(!document.createElement("canvas").getContext("webgl2"))
    throw Error("Din enhet stödjer inte WebGL2 för path tracing.");
   status("Laddar path tracing-motorn (första användningen) …");
   // Dynamic import means normal 3D Studio has zero path-tracing download cost.
   const module=await Promise.race([
    import(/* webpackIgnore: true */ MODULE_URL),
    new Promise((_,reject)=>setTimeout(()=>reject(Error("Path tracing kunde inte hämtas.")),20000))
   ]);
   if(cancelled)return;
   if(typeof module.WebGLPathTracer!=="function"||typeof module.PhysicalCamera!=="function")
    throw Error("Path tracing-modulen saknar WebGLPathTracer eller PhysicalCamera.");
   const mainCamera=getCamera();
   const isPhone=matchMedia("(max-width:700px)").matches;
   const scale=String($("filmPathResolution").value);
   // 1080p path tracing is too memory-intensive on many mobile GPUs.
   const target=isPhone&&scale==="1080"?"720":scale;
   const width=target==="1080"?1920:target==="720"?1280:960;
   const height=target==="1080"?1080:target==="720"?720:540;
   const limit=isPhone?100000:250000;
   let triangles=0;
   anchor.traverse(obj=>{
    if(!obj.isMesh||!obj.geometry)return;
    const geo=obj.geometry;
    triangles+=(geo.index?geo.index.count:geo.attributes.position?.count||0)/3;
   });
   if(triangles>limit)throw Error("Modellen är för tung för lokal path tracing ("+Math.ceil(triangles)+" trianglar, max "+limit+").");
   if(cancelled)return;
   const canvas=document.createElement("canvas");
   renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,preserveDrawingBuffer:true});
   if(!renderer.capabilities.isWebGL2)throw Error("Path tracing behöver WebGL2.");
   renderer.setPixelRatio(1);renderer.setSize(width,height,false);
   renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.toneMapping=THREE.ACESFilmicToneMapping;
   renderer.toneMappingExposure=1.1;
   workScene=new THREE.Scene();
   workScene.background=new THREE.Color(0x243348);
   // Clone the current presentation model; never touch saved edit geometry.
   const subject=anchor.clone(true);
   workScene.add(subject);
   const box=new THREE.Box3().setFromObject(subject);
   if(box.isEmpty())throw Error("Hittade ingen renderbar modell.");
   const center=box.getCenter(new THREE.Vector3());
   const extent=Math.max(1,...box.getSize(new THREE.Vector3()).toArray());
   floor=new THREE.Mesh(new THREE.PlaneGeometry(extent*9,extent*9),
    new THREE.MeshStandardMaterial({color:0x48545d,metalness:.3,roughness:.28}));
   floor.rotation.x=-Math.PI/2;floor.position.set(center.x,box.min.y-.025,center.z);
   floor.receiveShadow=true;workScene.add(floor);
   const light=(color,power,dx,dy,dz)=>{
    const l=new THREE.DirectionalLight(color,power);
    l.position.set(center.x+dx*extent,center.y+dy*extent,center.z+dz*extent);
    l.target.position.copy(center);
    workScene.add(l,l.target);
   };
   light(0xffe3bf,3.1,-1.8,2.8,1.5);
   light(0x9bbffa,.9,1.7,1.2,.2);
   light(0xffffff,1.9,.4,1.9,-1.9);
   const camera=new module.PhysicalCamera();
   camera.copy(mainCamera);
   camera.aspect=width/height;
   camera.updateProjectionMatrix();
   camera.position.copy(mainCamera.position);
   camera.quaternion.copy(mainCamera.quaternion);
   camera.focusDistance=Math.max(.2,camera.position.distanceTo(center));
   camera.fStop=clamp(Number($("filmPathAperture").value)||5.6,1.4,16);
   camera.apertureBlades=7;
   tracer=new module.WebGLPathTracer(renderer);
   tracer.rasterizeScene=false;
   tracer.renderDelay=0;
   tracer.fadeDuration=0;
   tracer.minSamples=1;
   tracer.bounces=4;
   tracer.tiles.set(2,2);
   tracer.setScene(workScene,camera);
   const samples=clamp(Number($("filmPathSamples").value)||16,4,128);
   status("Ray tracing: bygger upp "+samples+" samples …");
   // Slow GPUs remain responsive and cancellable; cap wall time and memory.
   const start=performance.now();let frames=0,last=-1;
   while(!cancelled&&tracer.samples<samples&&performance.now()-start<120000&&frames<samples*50){
    tracer.renderSample();
    await nextFrame();
    frames++;
    if(Math.floor(tracer.samples)!==last){
     last=Math.floor(tracer.samples);
     status("Path tracing "+Math.min(samples,last)+"/"+samples+" samples");
    }
   }
   if(cancelled)return;
   if(tracer.samples<Math.max(3,Math.min(samples,4)))throw Error("Grafikkortet hann inte rendera bilden.");
   let output=canvas;
   if($("filmPathDenoise").checked){
    try{
     status("Kantbevarande brusreducering …");
     const copy=document.createElement("canvas");
     copy.width=width;copy.height=height;
     const ctx=copy.getContext("2d",{willReadFrequently:true});
     ctx.drawImage(canvas,0,0);
     const image=ctx.getImageData(0,0,width,height);
     image.data.set(atrousDenoisePixels(image.data,width,height));
     ctx.putImageData(image,0,0);
     output=copy;
    }catch(err){console.warn("Denoising unavailable",err);}
   }
   const blob=await new Promise(resolve=>output.toBlob(resolve,"image/png"));
   if(!blob?.size)throw Error("Kunde inte skapa path traced PNG.");
   download(blob);
   status("✅ Path traced PNG färdig ("+width+"×"+height+", "+Math.floor(tracer.samples)+" samples).");
  }catch(error){
   console.warn("DuoForge path tracing unavailable:",error);
   status("Path tracing stöds inte här: "+String(error.message||error)+". Använd vanlig 4K PNG.");
  }finally{
   tracer?.dispose?.();
   // Do not dispose shared GLB textures/geometry: clones refer to the original.
   floor?.geometry?.dispose?.();floor?.material?.dispose?.();
   renderer?.dispose?.();
   running=false;$("filmPathTrace").disabled=false;$("filmPathCancel").hidden=true;
  }
 }
 $("filmPathTrace").onclick=render;
 $("filmPathCancel").onclick=stop;
 return {stop,isRunning:()=>running};
}
