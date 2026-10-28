// On-demand, experimental MIT Gaussian Splat preview (not a GLB converter).
// All splat bytes remain in the user's browser as an object URL. Spark code is
// downloaded from its version-pinned official CDN ONLY after choosing a file.
const SPARK_URL="https://sparkjs.dev/releases/spark/2.4.0/spark.module.js";
export const SUPPORTED_SPLATS=[".spz",".splat",".ksplat",".ply",".sog"];
export const SPLAT_LIMIT=50*1024*1024;
export function validLocalSplat(file){
 if(!file||typeof file.name!=="string"||!SUPPORTED_SPLATS.some(ext=>file.name.toLowerCase().endsWith(ext)))
  throw Error("Välj .spz, .splat, .ksplat, .ply eller .sog.");
 if(!Number.isFinite(file.size)||file.size<10||file.size>SPLAT_LIMIT)
  throw Error("Splat-filen måste vara 10 byte–50 MB.");
 return true;
}
export async function previewLocalSplat(file,{notify}={}){
 validLocalSplat(file);
 if(!globalThis.document||!globalThis.window)throw Error("Gaussian-visaren kräver en webbläsare.");
 const dialog=document.createElement("dialog");
 dialog.setAttribute("aria-label","Gaussian Splat 3D-förhandsvisning");
 dialog.style.cssText="width:min(970px,95vw);max-width:95vw;max-height:94dvh;padding:12px;background:#111b2a;color:#f4f7fb;border:1px solid #789;border-radius:12px;overflow:auto;";
 const bar=document.createElement("div");bar.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:10px;";
 const heading=document.createElement("strong");heading.textContent="Gaussian Splat • "+file.name;
 const close=document.createElement("button");close.type="button";close.textContent="✕ Stäng";
 const canvas=document.createElement("canvas");
 canvas.style.cssText="display:block;width:100%;height:min(64dvh,560px);min-height:260px;touch-action:none;background:#09111c;border-radius:8px;";
 const note=document.createElement("p");note.style.cssText="font-size:12px;opacity:.8;";
 note.textContent="Experimentell WebGL-visare (Spark MIT). Ingen GLB-export eller kollisionsmesh skapas. Filen läses lokalt.";
 bar.append(heading,close);dialog.append(bar,canvas,note);document.body.append(dialog);
 let url,renderer,controls,splat,spark,raf=0,observer,closed=false;
 function cleanup(){
  if(closed)return;
  closed=true;cancelAnimationFrame(raf);observer?.disconnect();controls?.dispose();
  try{splat?.dispose?.();spark?.dispose?.();renderer?.dispose?.();}catch(error){console.warn("Splat cleanup:",error);}
  if(url)URL.revokeObjectURL(url);
  dialog.remove();
 }
 close.onclick=()=>dialog.close();
 dialog.addEventListener("close",cleanup,{once:true});
 dialog.addEventListener("cancel",()=>{setTimeout(cleanup,0)},{once:true});
 dialog.showModal();
 try{
  note.textContent="Laddar Spark 2.4.0 (extern MIT-kod) på ditt initiativ. Din fil laddas inte upp.";
  const [{SparkRenderer,SplatMesh},THREE,{OrbitControls}]=await Promise.all([
   import(SPARK_URL),import("three"),import("three/addons/controls/OrbitControls.js")
  ]);
  if(closed)return;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x09111c);
  const camera=new THREE.PerspectiveCamera(58,1,.01,10000);camera.position.set(0,0,4);
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:"low-power"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  const resize=()=>{
   const w=Math.max(canvas.clientWidth,1),h=Math.max(canvas.clientHeight,1);
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  };
  observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  controls=new OrbitControls(camera,canvas);controls.enableDamping=true;
  spark=new SparkRenderer({renderer});scene.add(spark);
  url=URL.createObjectURL(file);
  splat=new SplatMesh({url});scene.add(splat);
  note.textContent="Dra för att rotera. Nyp/scrolla för att zooma. Format: "+file.name.split(".").pop().toUpperCase()+".";
  const frame=()=>{if(closed)return;raf=requestAnimationFrame(frame);controls.update();renderer.render(scene,camera);};
  frame();
 }catch(error){
  if(!closed){
   note.textContent="Förhandsvisning kunde inte starta: "+(error?.message||error)+". Detta ändrar inte din befintliga 3D-scen.";
   notify?.("Splat-visning är inte tillgänglig på denna enhet.",4500);
  }
 }
}
