// Progressive path-traced film image sequences. No paid GPU or AI API.
// Export in resumable parts because browser WebGL memory and automatic downloads
// cannot safely support unbounded 4K feature-length renders in one session.
import * as THREE from "three";
import {clone as cloneSkeleton} from "three/addons/utils/SkeletonUtils.js";
import {FrameZip,frameBatch} from "./cinema-production.mjs";
import {atrousDenoisePixels} from "./cinema-wavelet-denoise.mjs";
const PATH_MODULE="https://esm.sh/three-gpu-pathtracer@0.0.24?bundle&external=three";
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function copyHierarchy(from,to){
 to.position.copy(from.position);to.quaternion.copy(from.quaternion);to.scale.copy(from.scale);
 to.visible=from.visible;
 for(let i=0;i<Math.min(from.children.length,to.children.length);i++)
  copyHierarchy(from.children[i],to.children[i]);
}
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function createPathFilm({getAnchor,getCamera,poseAt,onStatus,filename}){
 const $=id=>document.getElementById(id);
 let working=false,cancel=false;
 const status=msg=>{$("filmTraceStatus").textContent=msg;onStatus?.(msg)};
 async function run({duration,fps}){
  if(working)return;
  if(!getAnchor())return status("Ingen 3D-modell finns i renderingsvärlden.");
  const isPhone=matchMedia("(max-width:700px)").matches;
  const res=$("filmTraceResolution").value;
  const width=res==="720"&&!isPhone?1280:960;
  const height=width===1280?720:540;
  const samples=Math.min(32,Math.max(4,Number($("filmTraceSamples").value)||8));
  const maxFrames=isPhone?2:8;
  const plan=frameBatch({duration,fps,start:Number($("filmTraceStart").value),
   count:Number($("filmTraceCount").value),maxFrames});
  working=true;cancel=false;$("filmTraceMovie").disabled=true;
  $("filmTraceCancel").hidden=false;
  let render=null,tracer=null,floor=null;
  const zip=new FrameZip();let done=0;
  try{
   status("Laddar ray tracing för film på din enhet …");
   const mod=await Promise.race([
    import(/* webpackIgnore: true */ PATH_MODULE),
    new Promise((_,reject)=>setTimeout(()=>reject(Error("Ray tracing-biblioteket kunde inte hämtas.")),20000))
   ]);
   if(cancel)return;
   if(typeof mod.WebGLPathTracer!=="function"||typeof mod.PhysicalCamera!=="function")
    throw Error("Ray tracing stöds inte av denna version.");
   let triangles=0,skinned=false;
   const anchor=getAnchor();
   anchor.traverse(o=>{if(o.isSkinnedMesh)skinned=true;
    if(o.isMesh&&o.geometry)triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;});
   if(triangles>(isPhone?90000:250000))throw Error("GLB-modellen är för tung för lokal path tracing.");
   const canvas=document.createElement("canvas");
   render=new THREE.WebGLRenderer({canvas,preserveDrawingBuffer:true,antialias:false});
   if(!render.capabilities.isWebGL2)throw Error("WebGL2 krävs för path tracing.");
   render.setPixelRatio(1);render.setSize(width,height,false);
   render.outputColorSpace=THREE.SRGBColorSpace;
   render.toneMapping=THREE.ACESFilmicToneMapping;render.toneMappingExposure=1.1;
   const scene=new THREE.Scene();scene.background=new THREE.Color(0x263347);
   const model=cloneSkeleton(anchor);
   scene.add(model);
   const box=new THREE.Box3().setFromObject(anchor);
   const center=box.getCenter(new THREE.Vector3());
   const scale=Math.max(1,...box.getSize(new THREE.Vector3()).toArray());
   floor=new THREE.Mesh(new THREE.PlaneGeometry(scale*9,scale*9),
    new THREE.MeshStandardMaterial({color:0x505761,metalness:.2,roughness:.32}));
   floor.rotation.x=-Math.PI/2;floor.position.set(center.x,box.min.y-.03,center.z);
   scene.add(floor);
   for(const [color,power,x,y,z] of [[0xffdbc0,3.0,-2,3,1],[0xa8cdff,1,2,1,1],[0xffffff,1.5,1,2,-2]]){
    const lamp=new THREE.DirectionalLight(color,power);
    lamp.position.set(center.x+x*scale,center.y+y*scale,center.z+z*scale);
    lamp.target.position.copy(center);scene.add(lamp,lamp.target);
   }
   const cam=new mod.PhysicalCamera();
   cam.copy(getCamera());cam.aspect=width/height;cam.updateProjectionMatrix();
   cam.apertureBlades=7;cam.fStop=5.6;
   tracer=new mod.WebGLPathTracer(render);
   tracer.rasterizeScene=false;tracer.renderDelay=0;tracer.fadeDuration=0;tracer.minSamples=1;
   tracer.bounces=4;tracer.tiles.set(2,2);
   tracer.setScene(scene,cam);
   for(const f of plan.frames){
    if(cancel)break;
    poseAt(f.time);
    copyHierarchy(anchor,model);
    scene.updateMatrixWorld(true);
    const masterCamera=getCamera();
    cam.position.copy(masterCamera.position);cam.quaternion.copy(masterCamera.quaternion);
    cam.fov=masterCamera.fov;cam.aspect=width/height;cam.updateProjectionMatrix();
    cam.focusDistance=Math.max(.15,cam.position.distanceTo(center));
    if(skinned)tracer.setScene(scene,cam);
    else{
     tracer.updateTransforms();
     tracer.updateCamera();
    }
    tracer.reset();
    const started=performance.now();let steps=0;
    while(!cancel&&tracer.samples<samples&&performance.now()-started<60000&&steps<samples*50){
     tracer.renderSample();steps++;
     await nextFrame();
    }
    if(cancel)break;
    if(tracer.samples<Math.max(3,Math.min(4,samples)))throw Error(
     "GPU:n hann inte rendera bildruta "+f.number+". Prova 540p/färre samples.");
    let target=canvas;
    if($("filmTraceDenoise").checked){
     const clean=document.createElement("canvas");clean.width=width;clean.height=height;
     const ctx=clean.getContext("2d",{willReadFrequently:true});
     ctx.drawImage(canvas,0,0);
     const pixels=ctx.getImageData(0,0,width,height);
     pixels.data.set(atrousDenoisePixels(pixels.data,width,height));
     ctx.putImageData(pixels,0,0);target=clean;
    }
    const blob=await new Promise(resolve=>target.toBlob(resolve,"image/png"));
    if(!blob?.size)throw Error("PNG-bildruta saknas.");
    await zip.add("frame_"+String(f.number).padStart(6,"0")+".png",blob);
    done++;
    status("🌟 Path tracing: "+done+"/"+plan.frames.length+" rutor · "+Math.floor(tracer.samples)+
     " samples · "+width+"×"+height+" · film-tid "+f.time.toFixed(2)+"s");
    await nextFrame();
   }
   if(done){
    const next=plan.first+done<plan.total?plan.first+done:null;
    await zip.add("manifest.json",new Blob([JSON.stringify({
     format:"duoforge-path-film@1",render:"path-traced",fps,width,height,samples,
     start:plan.first,end:plan.first+done,total:plan.total,next,
     note:"PNG-sekvens. Sätt ihop färdiga delar via videoverktyg; exporterad ZIP saknar ljud."
    },null,2)],{type:"application/json"}));
    saveBlob(zip.finish(),String(filename()||"DuoForge").replace(/[^a-z0-9_-]/gi,"-")+
     "-pathfilm-"+plan.first+"-"+(plan.first+done-1)+".zip");
    if(next!==null)$("filmTraceStart").value=String(next);
    status("✅ "+done+" path-tracade bildrutor exporterade. "+
     (next===null?"Hela filmsekvensen är renderad.":"Fortsätt vid bildruta "+next+"."));
   }else status(cancel?"Avbruten utan bildrutor.":"Inga bildrutor exporterades.");
  }catch(e){
   console.warn("Path film failed",e);status("Path-traced film misslyckades: "+e.message);
  }finally{
   tracer?.dispose?.();floor?.geometry?.dispose?.();floor?.material?.dispose?.();
   render?.dispose?.();working=false;
   $("filmTraceMovie").disabled=false;$("filmTraceCancel").hidden=true;
  }
 }
 function stop(){cancel=true;}
 return {run,stop,isRunning:()=>working};
}
