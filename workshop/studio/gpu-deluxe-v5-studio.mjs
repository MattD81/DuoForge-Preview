/**
 * GPU Deluxe V5 in EXISTING 3D Studio: optional triangle-accurate ray preview.
 * Does not touch/serialize imported models or change other renderer pipelines.
 */
import * as THREE from "three";
import {buildTriangleBVH,v5QualityProfile,v5CameraSignature} from "./gpu-deluxe-v5-core.mjs";
import {V5_RAYTRACE_SHADER,V5_ACCUMULATE_SHADER,V5_PRESENT_SHADER} from "./gpu-deluxe-v5-shaders.mjs";

function sceneSignature(root){
 root.updateMatrixWorld(true);
 const parts=[];
 root.traverse(node=>{
  if(!node.isMesh||!node.geometry)return;
  const attr=node.geometry.attributes?.position;
  const mat=Array.isArray(node.material)?node.material[0]:node.material;
  parts.push([node.uuid,node.visible?1:0,attr?.count||0,attr?.version||0,
   node.geometry.index?.version||0,mat?.version||0,
   ...node.matrixWorld.elements.map(n=>Math.round(n*10000)/10000)].join(":"));
 });
 return parts.join("|");
}
function extractMeshTriangles(root,maxTriangles){
 root.updateMatrixWorld(true);
 const meshes=[];let totalTriangles=0,unskinned=0;
 root.traverse(node=>{
  if(!node.isMesh||!node.visible||!node.geometry?.attributes?.position)return;
  const geo=node.geometry,p=geo.attributes.position,index=geo.index;
  const n=Math.floor((index?.count??p.count)/3);
  if(n<1)return;
  meshes.push({node,p,index,first:totalTriangles,count:n});
  totalTriangles+=n;
  if(node.isSkinnedMesh)unskinned++;
 });
 const triangles=[],v0=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3();
 const step=totalTriangles/Math.max(1,maxTriangles);
 let atMesh=0;
 for(let sample=0;sample<Math.min(maxTriangles,totalTriangles);sample++){
  const global=Math.min(totalTriangles-1,Math.floor((sample+.5)*step));
  while(atMesh<meshes.length-1&&global>=meshes[atMesh].first+meshes[atMesh].count)atMesh++;
  const {node,p,index,first}=meshes[atMesh],tri=global-first;
  const get=(slot,out)=>{
   const id=index?index.getX(tri*3+slot):tri*3+slot;
   out.fromBufferAttribute(p,id).applyMatrix4(node.matrixWorld);
   return out.toArray();
  };
  const mat=Array.isArray(node.material)?node.material[0]:node.material;
  const col=mat?.color?.isColor?mat.color:new THREE.Color(.62,.72,.83);
  const a=get(0,v0),b=get(1,v1),c=get(2,v2);
  triangles.push({a,b,c,color:[col.r,col.g,col.b],metalness:mat?.metalness??.03,
   roughness:mat?.roughness??.62});
 }
 return {triangles,totalTriangles,meshCount:meshes.length,
  skinnedMeshes:unskinned,subsampled:totalTriangles>maxTriangles};
}
function makeDataTexture(data,width){
 const tex=new THREE.DataTexture(data,width,1,THREE.RGBAFormat,THREE.FloatType);
 tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
 tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
 tex.generateMipmaps=false;tex.flipY=false;tex.needsUpdate=true;
 return tex;
}
export function initGpuDeluxeV5Studio({renderer,canvas,root,camera,isBusy=()=>false,
 getGpuTime=()=>null,notify=()=>{}}={}){
 if(!renderer||!canvas||!root||!camera)throw Error("GPU Deluxe V5 requires existing Studio");
 const parent=document.querySelector(".sidebar.right-panel")||document.querySelector(".sidebar");
 if(!parent)return null;
 const panel=document.createElement("section");
 panel.id="gpuDeluxeV5";panel.className="panel-section";
 panel.innerHTML=[
  '<div class="section-heading"><h2>⚡ GPU Deluxe V5</h2><span class="mini-pill">CINEMA V5</span></div>',
  '<p class="hint">Ray tracing genom verkliga trianglar (BVH), skuggor, reflektioner, ambient occlusion, progressiv antialiasing, brusreducering och adaptiv pixelbudget. Allt kör lokalt.</p>',
  '<label class="field-label" for="gpuV5Preset">Grafikprofil</label>',
  '<select id="gpuV5Preset" aria-label="GPU Deluxe V5 kvalitet">',
  '<option value="balanced">Balanced · snabbare</option>',
  '<option value="cinematic">Cinematic · fler detaljer</option>',
  '<option value="extreme">Extreme · maximal förhandsvisning</option>',
  '</select>',
  '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:8px">',
  '<button id="gpuV5Enable" type="button" aria-pressed="false">✦ V5 Ray Cinema</button>',
  '<button id="gpuV5Reset" type="button">↻ Nytt bildprov</button>',
  '<button id="gpuV5Capture" type="button">PNG</button>',
  '<button id="gpuV5Off" type="button">Normal vy</button>',
  '</div>',
  '<p id="gpuV5Status" class="hint" role="status" aria-live="polite">V5 redo. V2 och vanlig 3D-vy finns kvar.</p>',
  '<p class="hint">V5 raytracar ett begränsat urval verkliga trianglar (max 768). Materialfärger används; texturer, exakta animationer och AI-uppskalning ingår inte. Cinematic/Extreme belastar datorns GPU.</p>'
 ].join("");
 parent.append(panel);
 const $=id=>panel.querySelector("#"+id);
 const gl=renderer.getContext();
 const supported=!!renderer.capabilities?.isWebGL2&&!!gl?.texImage3D;
 if(!supported){
  $("gpuV5Enable").disabled=true;
  $("gpuV5Status").textContent="V5 kräver WebGL2. Normal 3D och GPU Deluxe V2 fungerar fortfarande.";
 }
 let active=false,disposed=false,preset="balanced",profile=null,signature=null,geometry=null,
  triTexture=null,nodeTexture=null,rayTarget=null,accum=[],sampleCount=0,frame=0,dim=[0,0],
  lastCamera=null,rayMaterial=null,accumMaterial=null,presentMaterial=null,historyIdx=0,
  rendererIssue="",gpuSlowFrames=0,adaptiveScale=1,refreshCounter=0;
 const quadGeo=new THREE.PlaneGeometry(2,2),quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const quad=new THREE.Mesh(quadGeo,new THREE.MeshBasicMaterial());
 quad.frustumCulled=false;const fsScene=new THREE.Scene();fsScene.add(quad);
 const mobile=()=>Math.min(canvas.clientWidth||1280,canvas.clientHeight||720)<700;
 const makeMaterial=shader=>new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,
  vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader,
  uniforms:{},depthTest:false,depthWrite:false,toneMapped:false});
 function disposeBuffers(){
  rayTarget?.dispose();rayTarget=null;
  for(const t of accum)t.dispose();accum=[];
  dim=[0,0];sampleCount=0;historyIdx=0;lastCamera=null;
 }
 function disposeGeometry(){
  triTexture?.dispose();triTexture=null;nodeTexture?.dispose();nodeTexture=null;
  geometry=null;signature=null;disposeBuffers();
 }
 function refreshGeometry(){
  const src=extractMeshTriangles(root,profile.maxTriangles);
  geometry={...src,bvh:buildTriangleBVH(src.triangles,{limit:profile.maxTriangles})};
  triTexture?.dispose();nodeTexture?.dispose();
  triTexture=makeDataTexture(geometry.bvh.triData,geometry.bvh.triangleTextureWidth);
  nodeTexture=makeDataTexture(geometry.bvh.nodeData,geometry.bvh.nodeTextureWidth);
  signature=sceneSignature(root);
  disposeBuffers();
  if(!geometry.bvh.triangles)notify("V5: Scenen saknar läsbara trianglar, enbart golv och himmel visas.");
 }
 function ensureProfile(){
  renderer.getDrawingBufferSize(_drawing);
  const w=Math.max(1,_drawing.x|0),h=Math.max(1,_drawing.y|0);
  const next=v5QualityProfile({width:w,height:h,mobile:mobile(),preset});
  if(!profile||profile.maxTriangles!==next.maxTriangles){
   profile=next;disposeGeometry();return;
  }
  profile=next;
 }
 const _drawing=new THREE.Vector2();
 function allocate(){
  const w=Math.max(1,Math.floor(profile.width*adaptiveScale));
  const h=Math.max(1,Math.floor(profile.height*adaptiveScale));
  if(dim[0]===w&&dim[1]===h&&rayTarget&&accum.length===2)return;
  disposeBuffers();dim=[w,h];
  const options={depthBuffer:false,stencilBuffer:false,
   magFilter:THREE.LinearFilter,minFilter:THREE.LinearFilter};
  const type=gl.getExtension("EXT_color_buffer_float")?THREE.HalfFloatType:THREE.UnsignedByteType;
  rayTarget=new THREE.WebGLRenderTarget(w,h,{...options,type});
  accum=[new THREE.WebGLRenderTarget(w,h,{...options,type}),
   new THREE.WebGLRenderTarget(w,h,{...options,type})];
 }
 function ensureMaterials(){
  if(rayMaterial)return;
  rayMaterial=makeMaterial(V5_RAYTRACE_SHADER);
  Object.assign(rayMaterial.uniforms,{
   uTriangles:{value:null},uNodes:{value:null},uNodeCount:{value:0},
   uTriangleCount:{value:0},uCameraWorld:{value:new THREE.Matrix4()},
   uInvProjection:{value:new THREE.Matrix4()},uResolution:{value:new THREE.Vector2()},
   uFrame:{value:0},uSampleCount:{value:1},uExposure:{value:1}
  });
  accumMaterial=makeMaterial(V5_ACCUMULATE_SHADER);
  Object.assign(accumMaterial.uniforms,{
   uCurrent:{value:null},uHistory:{value:null},uSamples:{value:1}
  });
  presentMaterial=makeMaterial(V5_PRESENT_SHADER);
  Object.assign(presentMaterial.uniforms,{
   uSource:{value:null},uTexel:{value:new THREE.Vector2(1,1)},uDenoise:{value:.65}
  });
 }
 function reset(){sampleCount=0;historyIdx=0;lastCamera=null;}
 function setActive(value){
  if(disposed||value&&!supported)return;
  if(active===value)return;
  active=value;reset();adaptiveScale=1;gpuSlowFrames=0;
  $("gpuV5Enable").setAttribute("aria-pressed",String(active));
  if(active){
   document.querySelector("#gpuV2Off")?.click();
   $("gpuV5Status").textContent="V5 startar triangelbaserad ray tracing…";
   notify("GPU Deluxe V5: BVH-ray tracing aktiverad.");
  }else{
   disposeBuffers();$("gpuV5Status").textContent="V5 pausad. Normal WebGL/V2-visning återställd.";
  }
 }
 $("gpuV5Enable").onclick=()=>setActive(!active);
 $("gpuV5Off").onclick=()=>setActive(false);
 $("gpuV5Reset").onclick=()=>{reset();if(active)refreshGeometry();};
 $("gpuV5Preset").onchange=e=>{preset=e.target.value;
  adaptiveScale=1;profile=null;disposeGeometry();
  if(active)$("gpuV5Status").textContent="Ny V5-profil: "+preset;
 };
 $("gpuV5Capture").onclick=()=>{
  if(!active)return notify("Aktivera V5 före PNG-export.");
  canvas.toBlob(blob=>{
   if(!blob)return notify("Kunde inte ta V5-bild på enheten.");
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.download="duoforge-gpu-v5-"+preset+".png";a.href=url;a.click();
   setTimeout(()=>URL.revokeObjectURL(url),3000);
  },"image/png");
 };
 // The older V2 buttons must remain functional.
 const oldPanel=document.getElementById("gpuDeluxeV2");
 function onV2Click(e){
  if(e.target.closest?.("#gpuV2Ray,#gpuV2Temporal"))setActive(false);
 }
 oldPanel?.addEventListener("click",onV2Click);
 function render(){
  if(!active||disposed||isBusy())return false;
  try{
   ensureProfile();
   if(!signature||++refreshCounter%25===0){
    const changed=sceneSignature(root);
    if(changed!==signature)refreshGeometry();
   }
   allocate();ensureMaterials();
   camera.updateMatrixWorld(true);
   const camSig=v5CameraSignature(camera);
   if(camSig!==lastCamera){sampleCount=0;historyIdx=0;lastCamera=camSig;}
   const renderFrame=Math.min(profile.maxSamples,sampleCount+1);
   rayMaterial.uniforms.uTriangles.value=triTexture;
   rayMaterial.uniforms.uNodes.value=nodeTexture;
   rayMaterial.uniforms.uNodeCount.value=geometry.bvh.nodes;
   rayMaterial.uniforms.uTriangleCount.value=geometry.bvh.triangles;
   rayMaterial.uniforms.uCameraWorld.value.copy(camera.matrixWorld);
   rayMaterial.uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
   rayMaterial.uniforms.uResolution.value.set(...dim);
   rayMaterial.uniforms.uFrame.value=renderFrame;
   rayMaterial.uniforms.uSampleCount.value=preset==="balanced"?1:3;
   rayMaterial.uniforms.uExposure.value=1.13;
   quad.material=rayMaterial;
   renderer.setRenderTarget(rayTarget);
   renderer.clear();renderer.render(fsScene,quadCam);
   // Ping-pong accumulation: no texture feedback with active render target.
   const current=accum[historyIdx%2],previous=accum[(historyIdx+1)%2];
   accumMaterial.uniforms.uCurrent.value=rayTarget.texture;
   accumMaterial.uniforms.uHistory.value=previous.texture;
   accumMaterial.uniforms.uSamples.value=renderFrame;
   quad.material=accumMaterial;
   renderer.setRenderTarget(current);renderer.clear();renderer.render(fsScene,quadCam);
   presentMaterial.uniforms.uSource.value=current.texture;
   presentMaterial.uniforms.uTexel.value.set(1/dim[0],1/dim[1]);
   presentMaterial.uniforms.uDenoise.value=preset==="balanced"?.35:.7;
   quad.material=presentMaterial;
   renderer.setRenderTarget(null);renderer.render(fsScene,quadCam);
   historyIdx++;sampleCount=renderFrame;
   return true;
  }catch(error){
   console.error("GPU Deluxe V5 fallback",error);
   renderer.setRenderTarget(null);
   rendererIssue=String(error?.message||error).slice(0,180);
   setActive(false);$("gpuV5Status").textContent="V5 kunde inte köras: "+rendererIssue+
    ". Normal rendering är återställd.";
   return false;
  }
 }
 function updateStatus(){
  if(disposed||!active||++frame%30)return;
  const q=getGpuTime();
  const gpuMs=q?.supported&&q.gpuMs!==null?q.gpuMs:null;
  if(gpuMs!==null&&sampleCount>1){
   gpuSlowFrames=gpuMs>45?gpuSlowFrames+1:0;
   if(gpuSlowFrames>=4&&adaptiveScale>.55){
    adaptiveScale=Math.max(.55,adaptiveScale*.8);disposeBuffers();gpuSlowFrames=0;
   }
  }
  const sampled=geometry?.bvh.triangles??0,total=geometry?.totalTriangles??0;
  $("gpuV5Status").textContent="V5 "+preset+" · "+sampled+"/"+total+
   " trianglar · "+sampleCount+"/"+(profile?.maxSamples??0)+" bildprov · "+
   dim.join("×")+" px"+(gpuMs===null?" · GPU-tid ej tillgänglig":" · "+gpuMs+" ms GPU")+
   (geometry?.skinnedMeshes?" · skelettanimation visas som statisk geometri":"")+
   (total>sampled?" · begränsat geometriprov":"");
 }
 function dispose(){
  if(disposed)return;disposed=true;setActive(false);
  disposeGeometry();rayMaterial?.dispose();accumMaterial?.dispose();presentMaterial?.dispose();
  quad.material.dispose();quadGeo.dispose();oldPanel?.removeEventListener("click",onV2Click);
  panel.remove();
 }
 window.addEventListener("pagehide",dispose,{once:true});
 return Object.freeze({render,updateStatus,dispose,get active(){return active}});
}
