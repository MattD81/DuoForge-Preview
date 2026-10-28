import * as THREE from "three/webgpu";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {createRescueShip} from "./ship.mjs";
import {ISLAND_SITES,terrainHeight} from "./coastal-terrain.mjs";
import {buildIslandGeometry} from "./coastal-world.mjs";
import {spectralHeight} from "../../workshop/studio/ocean-spectrum.mjs";

const $=id=>document.getElementById(id);
const canvas=$("photo"),isMobile=matchMedia("(pointer: coarse)").matches;
let renderer=null,tracer=null,scene=null,camera=null,controls=null;
let running=false,disposed=false,completes=0;
function status(message){$("status").textContent=message;}
function unsupported(reason){
 $("fallbackText").textContent=reason+" Du kan fortfarande spela originalspelet i WebGL.";
 $("fallback").classList.add("visible");
 $("engine").textContent="Ej tillgänglig";
 status("Strålspårning inte tillgänglig på den här enheten.");
}
function makeEnvironment(){
 // HDR-like procedural lighting backdrop, no download/license.
 const c=document.createElement("canvas");c.width=512;c.height=256;
 const ctx=c.getContext("2d");
 const im=ctx.createImageData(c.width,c.height);
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  const u=x/(c.width-1),v=y/(c.height-1),t=Math.max(0,1-v*2);
  const facing=Math.max(0,Math.sin((u-.26)*Math.PI*2));
  const sun=Math.exp(-Math.pow((u-.30)*14,2)-Math.pow((v-.47)*12,2));
  const haze=Math.exp(-Math.pow((v-.5)*6,2));
  const offset=(y*c.width+x)*4;
  im.data[offset]=Math.min(255,Math.round(27+96*t+75*haze+255*sun));
  im.data[offset+1]=Math.min(255,Math.round(40+80*t+45*haze+192*sun));
  im.data[offset+2]=Math.min(255,Math.round(60+109*t+8*haze+95*sun));
  im.data[offset+3]=255;
 }
 ctx.putImageData(im,0,0);
 const tex=new THREE.CanvasTexture(c);
 tex.mapping=THREE.EquirectangularReflectionMapping;
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.name="DuoForge Aurora procedural film lighting";
 return tex;
}
function createFrozenOcean(){
 // Path tracing cannot render arbitrary WebGL shaders. Instead this is a genuine
 // frozen, triangulated snapshot using the SAME CPU/GPU spectral wave definition.
 const segments=isMobile?35:64,extent=380;
 const geo=new THREE.PlaneGeometry(extent,extent,segments,segments);
 geo.rotateX(-Math.PI/2);
 const attr=geo.attributes.position;
 for(let i=0;i<attr.count;i++){
  attr.setY(i,spectralHeight(attr.getX(i),attr.getZ(i),4.3,.92,1.07)*.72-.35);
 }
 attr.needsUpdate=true;geo.computeVertexNormals();
 const material=new THREE.MeshPhysicalMaterial({
  name:"Physically based seawater — frozen spectral ocean",
  color:0x244454,metalness:0,roughness:.085,
  ior:1.333,clearcoat:1,clearcoatRoughness:.09,
  transmission:.27,thickness:2.2,
  side:THREE.DoubleSide
 });
 const sea=new THREE.Mesh(geo,material);
 sea.name="Raytraced ocean: multiple-bounce reflection/refraction";
 sea.receiveShadow=true;return sea;
}
function photoScene(){
 const s=new THREE.Scene();
 s.environment=makeEnvironment();s.background=s.environment;
 s.environmentIntensity=.78;
 const boat=createRescueShip();
 boat.group.name="Aurora: ray traced exportable PBR rescue vessel";
 boat.group.position.set(0,.45,0);
 boat.group.rotation.set(-.026,.2,.04);
 // Path tracer supports MeshStandard / MeshPhysical; convert real-time
 // unlit placards and searchlight lenses to emissive PBR before BVH capture.
 boat.group.traverse(obj=>{
  if(!obj.isMesh)return;
  const materials=Array.isArray(obj.material)?obj.material:[obj.material];
  const converted=materials.map(mat=>mat?.isMeshBasicMaterial?
   new THREE.MeshStandardMaterial({name:"Ray traced emissive "+mat.name,
    color:mat.color?.clone()||new THREE.Color(0xffffff),
    map:mat.map||null,emissive:mat.color?.clone()||new THREE.Color(0xffffff),
    emissiveIntensity:.65,roughness:.4,metalness:0,
    transparent:mat.transparent,opacity:mat.opacity,side:mat.side})
   :mat);
  obj.material=Array.isArray(obj.material)?converted:converted[0];
 });
 // Keep radar and lamps static during progressive accumulation.
 s.add(boat.group);
 s.add(createFrozenOcean());
 // The same V2 heightfield model as the playable game; no flat billboard.
 const sites=[ISLAND_SITES[0],ISLAND_SITES[1]];
 for(const site of sites){
  const geo=buildIslandGeometry(site,"low");
  const terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
   color:0xe3ded1,vertexColors:true,roughness:.97,metalness:.005,side:THREE.DoubleSide
  }));
  terrain.name="Real triangulated coastal geometry "+site.seed;
  terrain.position.set(site.x,0,site.z);terrain.receiveShadow=true;s.add(terrain);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(1.4,2.5,17,14),
   new THREE.MeshPhysicalMaterial({color:0xd6d8d0,roughness:.56,clearcoat:.12}));
  pole.position.set(site.x,terrainHeight(0,0,site.r,site.seed)+9,site.z);
  pole.name="Ray traced illuminated stone lighthouse";
  s.add(pole);
 }
 const sun=new THREE.DirectionalLight(0xffd9b5,4.0);
 sun.position.set(-32,35,-80);sun.name="Golden hour key from same sun elevation family";
 s.add(sun);
 const fill=new THREE.RectAreaLight(0xc0e1ef,1.9,19,14);
 fill.position.set(16,13,24);fill.lookAt(0,2,0);s.add(fill);
 const glints=new THREE.RectAreaLight(0xffd5a7,4.2,22,10);
 glints.position.set(-19,18,-13);glints.lookAt(0,2,0);s.add(glints);
 const c=new THREE.PerspectiveCamera(42,1,.12,800);
 c.position.set(18,11,25);c.lookAt(0,2.3,-1.5);
 return {scene:s,camera:c,boat};
}
function resize(){
 if(!renderer||!camera||disposed)return;
 const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
 renderer.setSize(w,h,false);
 camera.aspect=w/h;camera.updateProjectionMatrix();
 tracer?.updateCamera();
}
async function setSamples(){
 if(!tracer)return;
 const target=Number($("samples").value);
 tracer.maxSamples=target;tracer.reset();
 $("progressFill").style.width="0%";$("sampleCount").textContent="0";
 status("BVH-strålspårning aktiv: "+target+" prover per pixel, 6 ljusstudsar.");
}
async function start(){
 if(!navigator.gpu||!window.isSecureContext){
  unsupported("WebGPU kräver en säker HTTPS-anslutning och kompatibel grafikdrivrutin.");
  return;
 }
 let adapter;
 try{adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});}
 catch(error){unsupported("Grafikkortet kunde inte öppna en WebGPU-adapter: "+error.message);return;}
 if(!adapter){unsupported("WebGPU-adapter saknas, ingen falsk strålspårningsbild visas.");return;}
 $("engine").textContent="WebGPU hårdvara";
 status("Laddar BVH-strålspåraren och fysiska PBR-material…");
 try{
  // Only downloaded when WebGPU is confirmed; game stays on its original r180
  // WebGL renderer, while this photo mode uses r185+ compatible GPU compute.
  const {WebGPUPathTracer}=await import("three-gpu-pathtracer/webgpu");
  if(disposed)return;
  renderer=new THREE.WebGPURenderer({canvas,antialias:false,powerPreference:"high-performance"});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,isMobile?1:1.5));
  await renderer.init();
  if(disposed)return;
  const captured=photoScene();
  scene=captured.scene;camera=captured.camera;
  resize();
  controls=new OrbitControls(camera,canvas);
  controls.target.set(0,2.3,-1.5);controls.enableDamping=true;
  controls.minDistance=9;controls.maxDistance=85;
  controls.maxPolarAngle=Math.PI*.49;
  controls.addEventListener("change",()=>tracer?.updateCamera());
  tracer=new WebGPUPathTracer(renderer);
  tracer.maxBounces=6;tracer.maxTransparentBounces=5;
  tracer.frameBudget=isMobile?12000:70000;
  tracer.renderScale=isMobile?.5:.8;
  tracer.maxSamples=Number($("samples").value);
  tracer.setScene(scene,camera);
  tracer.addEventListener("complete",()=>{
   completes++;$("progressFill").style.width="100%";
   status("Klart! Flerstudsig BVH-strålspårning färdig — "+$("samples").value+" prover per pixel.");
   $("save").disabled=false;
  });
  let updating=false,lastCheck=0;
  renderer.setAnimationLoop(async now=>{
   if(!running||disposed)return;
   controls.update();
   tracer.renderSample();
   if(now-lastCheck>1500&&!updating){
    lastCheck=now;updating=true;
    try{
     const samples=await tracer.getSampleCountsAsync();
     if(disposed)return;
     const count=samples?.min??0;
     $("sampleCount").textContent=String(count);
     $("progressFill").style.width=Math.min(100,100*count/tracer.maxSamples)+"%";
    }catch(error){console.warn("Photo sample readback unavailable",error);}
    finally{updating=false;}
   }
  });
  addEventListener("resize",resize);
  $("render").disabled=false;
  $("save").disabled=true;
  $("samples").addEventListener("change",()=>{if(tracer)setSamples();});
  $("render").addEventListener("click",()=>{running=true;setSamples();});
  $("save").addEventListener("click",()=>{
   if(disposed||!tracer)return;
   canvas.toBlob(blob=>{
    if(!blob){status("Kunde inte skapa PNG från WebGPU-canvas.");return;}
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="DuoForge_LAST_LIGHT_Raytraced_Aurora.png";
    a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);
   },"image/png");
  });
  running=true;
  status("Riktig GPU-strålspårning startad: BVH, PBR och 6 ljusstudsar. Låt kameran stå stilla.");
 }catch(error){
  console.error("WebGPU photo engine failed",error);
  unsupported("Strålspårningsmotorn kunde inte starta: "+error.message);
  if(renderer){renderer.setAnimationLoop(null);renderer.dispose();renderer=null;}
 }
}
start();
addEventListener("pagehide",()=>{
 disposed=true;running=false;
 renderer?.setAnimationLoop(null);tracer?.dispose();controls?.dispose();renderer?.dispose();
});
