// DuoForge Film Studio. Cinematic shots and 16:9 recording locally in the browser.
// User keeps editable geometry; Render World supplies the transient preview scene.
// MediaRecorder captures in *real time*; fps and duration depend on device speed.
import * as THREE from "three";
import {createShot,sampleCameraPath,createBrollSequence,sampleBrollSequence,normalizeFilmSettings,normalizeKeyframes} from "./film-path.mjs";
import {createPathTraceStills} from "./path-trace-stills.mjs";
import {createPathFilm} from "./cinema-path-film.mjs";
import {normalizeCuts,movieDuration,locateCut,frameBatch,FrameZip} from "./cinema-production.mjs";

const $=id=>document.getElementById(id);
const safe=(name)=>String(name||"DuoForge").replace(/[^\p{L}\p{N}_. -]/gu,"").trim().replace(/\s+/g,"-").slice(0,70)||"DuoForge";
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const mimeChoices=["video/mp4;codecs=avc1.42E01E","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"];
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),12000);
}
export function initFilmStudio({camera,orbit,canvas,renderer,scene,getAnchor,getWorld,
 isPreviewActive,startPreview,renderFrame,setOutputSize,restoreOutputSize,setWorldTime,
 notify,filename,applyFilmLook=()=>{},setCinematicEffects=()=>{},getPreviewAnchor=()=>null,
 setFilmPose=()=>{},importHDRI=async()=>{},setHDRIIntensity=()=>{},getRigDirector=()=>null}){
 let opened=false,playing=false,recording=false,elapsed=0,path=[],sequence=[],savedCamera=null;
 let mediaRecorder=null,captureTrack=null,stream=null,recordChunks=[],recordEnd=null;
 let lastBlob=null,lastURL=null,downloadName="",keyframes=[];
 let format=normalizeFilmSettings(),movieShot="orbit",pendingCleanup=false;
 let cuts=[],cutPaths=[],activeCut=-1,frameExporting=false,frameAborted=false;
 let soundURL=null,audioContext=null,audioSource=null,audioDestination=null,audioMonitoring=false;
 const ui=$("filmStudioOverlay"),status=$("filmStatus"),progress=$("filmProgress"),seek=$("filmSeek");
 const pathTrace=createPathTraceStills({
  getAnchor:getPreviewAnchor,getCamera:()=>camera,onStatus:message=>{status.textContent=message;},filename
 });
 const pathMovie=createPathFilm({
  getAnchor:getPreviewAnchor,getCamera:()=>camera,
  poseAt:t=>{
   elapsed=t;applyAt(clamp(t/format.duration,0,1));
   setWorldTime(t,0);
  },onStatus:message=>{status.textContent=message;},filename
 });
 const fxSettings=()=>({
  dof:$("filmDof").checked,
  reflections:$("filmSSR").checked,
  aperture:Number($("filmAperture").value),
  maxblur:.009,focusScale:Number($("filmFocusScale").value)
 });
 function updateFx(){
  $("filmApertureValue").textContent=Number($("filmAperture").value).toFixed(4);
  $("filmFocusValue").textContent=Number($("filmFocusScale").value).toFixed(2)+"×";
  if(opened)setCinematicEffects(fxSettings());
 }
 function readSettings(){
  format=normalizeFilmSettings({
   quality:$("filmResolution").value,fps:Number($("filmFps").value),
   fov:Number($("filmFov").value),duration:Number($("filmDuration").value),
   shot:$("filmShot").value
  });
  if(format.shot==="edit"&&cuts.length)format={...format,duration:movieDuration(cuts)};
  return format;
 }
 function worldFocus(){
  const anchor=getAnchor();
  if(!anchor)return {focus:[0,1,0],size:4};
  const box=new THREE.Box3().setFromObject(anchor);
  const dims=box.getSize(new THREE.Vector3());
  const middle=box.getCenter(new THREE.Vector3());
  return {
   focus:middle.toArray(),
   size:clamp(Math.max(dims.x,dims.y,dims.z),.15,256)
  };
 }
 function buildPath(){
  const options=worldFocus();
  movieShot=format.shot;
  if(format.shot==="broll"){
   path=[];cutPaths=[];
   sequence=createBrollSequence(options);
   return sequence;
  }
  if(format.shot==="edit"){
   if(!cuts.length)throw Error("Lägg till minst en scen i filmredigeraren.");
   path=[];sequence=[];
   cutPaths=cuts.map(c=>createShot(c.shot,{world:getWorld(),...options}));
   activeCut=-1;
   return cutPaths;
  }
  sequence=[];cutPaths=[];
  path=createShot(format.shot,{world:getWorld(),focus:options.focus,size:options.size,custom:keyframes});
  return path;
 }
 function displayState(message){
  status.textContent=message;
  $("filmFrameCounter").textContent=elapsed.toFixed(1)+" / "+format.duration.toFixed(1)+" s";
  progress.style.width=(clamp(elapsed/format.duration,0,1)*100).toFixed(1)+"%";
  seek.value=String(Math.round(clamp(elapsed/format.duration,0,1)*1000));
  $("filmPlay").textContent=playing&&!recording?"⏸ Pausa film":"▶ Förhandsvisa";
  $("filmRecord").textContent=recording?"■ Stoppa inspelning":"🎞️ Rendera video";
  const busy=recording||frameExporting;
  $("filmPlay").disabled=busy;
  $("filmClose").disabled=busy;
  $("filmStill").disabled=busy;
  $("filmRecord").disabled=frameExporting;
  for(const id of ["filmShot","filmDuration","filmResolution","filmFps","filmFov","filmSeek","filmAddKeyframe","filmRemoveKeyframe","filmLook","filmFinish","filmBroll","filmDof","filmSSR","filmAperture","filmFocusScale","filmAddCut","filmRemoveCut","filmFrameStart","filmFrameCount","filmFrameResolution","filmAudioFile","filmHdriFile","filmHdriIntensity"])
   $(id).disabled=recording;
  $("filmKeyframes").textContent=String(keyframes.length);
 }
 function cacheCamera(){
  savedCamera={position:camera.position.clone(),quaternion:camera.quaternion.clone(),
   fov:camera.fov,aspect:camera.aspect,target:orbit.target.clone(),orbitEnabled:orbit.enabled};
 }
 function restoreCamera(){
  if(!savedCamera)return;
  camera.position.copy(savedCamera.position);
  camera.quaternion.copy(savedCamera.quaternion);
  camera.fov=savedCamera.fov;camera.aspect=savedCamera.aspect;camera.updateProjectionMatrix();
  orbit.target.copy(savedCamera.target);
  orbit.enabled=savedCamera.orbitEnabled;
  orbit.update();
  savedCamera=null;
 }
 function open(){
  if(!isPreviewActive())startPreview();
  if(!isPreviewActive())return false;
  if(opened)return true;
  cacheCamera();opened=true;ui.hidden=false;
  // Director must be able to compose custom keyframes even if Render World
  // previously used Follow or Cinematic (where orbit was disabled).
  orbit.enabled=true;
  const world=getWorld();
  $("filmShot").value=world==="ocean"?"flyover":"orbit";
  $("filmDuration").value=world==="ocean"?"14":"12";
  // Full HD is the default on mobile too; 720p stays available for slower devices.
  $("filmResolution").value="1080";
  $("filmFov").value="40";
  $("filmLook").value="golden";
  $("filmFinish").checked=true;
  applyFilmLook("golden",true);
  updateFx();
  readSettings();elapsed=0;
  refreshRigPanel();
  displayState("Filmläge redo: välj kamerarörelse och förhandsvisa, eller rendera en riktig videofil.");
  document.body.classList.add("film-studio-active");
  return true;
 }
 function applyAt(progress){
  if(!path.length&&!sequence.length&&!cutPaths.length)buildPath();
  let shot;
  if(format.shot==="edit"){
   const location=locateCut(cuts,clamp(progress,0,1)*format.duration);
   if(activeCut!==location.index){
    activeCut=location.index;
    applyFilmLook(location.cut.look,$("filmFinish").checked);
   }
   shot=sampleCameraPath(cutPaths[location.index],location.progress);
   shot.shotLabel=(location.index+1)+" / "+cuts.length+" · "+location.cut.name;
   setFilmPose(location.localTime,location.cut.motion);
  }else{
   setFilmPose(0,"still");
   shot=format.shot==="broll"?
    sampleBrollSequence(sequence,progress):
    sampleCameraPath(path,progress,{ease:format.shot!=="flyover"});
  }
  getRigDirector()?.sample(elapsed);
  $("filmShotProgress").textContent=shot.shotLabel||"En filmisk kamerarörelse";
  camera.position.fromArray(shot.position);
  orbit.target.fromArray(shot.target);
  camera.fov=format.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(orbit.target);
  if(!playing)orbit.update();
 }
 function beginPlayback(){
  readSettings();
  try{buildPath();}
  catch(e){notify(e.message,4000);displayState(e.message);return false;}
  elapsed=0;playing=true;
  orbit.enabled=false;
  applyAt(0);
  setWorldTime(0,0);
  displayState("Spelar upp "+format.shot+" – filmisk kamerabana.");
  return true;
 }
 function stopPlayback({keepFrame=false}={}){
  playing=false;
  if(!recording)orbit.enabled=true;
  if(!keepFrame&&opened){
   elapsed=0;
   if(path.length||sequence.length||cutPaths.length)applyAt(0);
  }
  displayState("Förhandsvisning klar. Ändra filmrörelsen eller exportera.");
 }
 function detachRecordAudio(){
  $("filmAudioPlayer").pause();
  if(audioSource&&audioDestination){try{audioSource.disconnect(audioDestination);}catch{}}
  audioDestination?.stream?.getTracks().forEach(t=>t.stop());
  audioDestination=null;
 }
 function finishRecorder({cancel=false}={}){
  if(!mediaRecorder)return;
  pendingCleanup=cancel;
  if(mediaRecorder.state!=="inactive"){
   try{mediaRecorder.stop()}catch(err){console.warn("MediaRecorder stop",err);}
  }
  recording=false;playing=false;
  if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
  captureTrack=null;detachRecordAudio();restoreOutputSize();
  orbit.enabled=true;
  displayState(cancel?"Inspelningen avbröts.":"Sparar videofil lokalt …");
 }
 function close(){
  if(!opened)return;
  if(recording||frameExporting){notify("Stoppa exporten innan du lämnar Film Studio.",3000);return;}
  playing=false;
  pathTrace.stop();
  setFilmPose(0,"still");
  pathMovie.stop();
  setCinematicEffects({dof:false,reflections:false});
  if(soundURL){URL.revokeObjectURL(soundURL);soundURL=null;}
  $("filmAudioPlayer").pause();
  if(audioContext){audioContext.close().catch(()=>{});audioContext=null;audioSource=null;audioMonitoring=false;}
  $("filmAudioPlayer").removeAttribute("src");
  $("filmAudioPlayer").hidden=true;
  restoreOutputSize();restoreCamera();
  applyFilmLook("off",false);
  opened=false;ui.hidden=true;document.body.classList.remove("film-studio-active");
 }
 function onPreviewExit(){
  pathMovie.stop();
  if(recording)finishRecorder({cancel:true});
  close();
 }
 function preview(){
  if(!opened&&!open())return;
  if(recording||frameExporting)return;
  if(playing){playing=false;orbit.enabled=true;
   displayState("Förhandsvisning pausad.");return;}
  beginPlayback();
 }
 function chooseMime(hasAudio=false){
  if(typeof MediaRecorder==="undefined")return null;
  const choices=hasAudio?
   ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4","video/webm"]:
   mimeChoices;
  return choices.find(type=>MediaRecorder.isTypeSupported(type))||"";
 }
 async function record(){
  if(frameExporting)return;
  if(recording){finishRecorder();return;}
  if(!opened&&!open())return;
  if(!canvas.captureStream||typeof MediaRecorder==="undefined"){
   notify("Din webbläsare stödjer inte lokal videoinspelning. Använd PNG-foto istället.",5500);return;
  }
  if(!beginPlayback())return;
  const output=readSettings();
  try{
   if(lastURL){URL.revokeObjectURL(lastURL);lastURL=null;}
   $("filmDownload").hidden=true;lastBlob=null;
   setOutputSize(output.width,output.height);
   renderFrame();
   stream=canvas.captureStream(output.fps);
   captureTrack=stream.getVideoTracks()[0]||null;
   if(!captureTrack)throw Error("Ingen videoström från 3D-renderaren.");
   const player=$("filmAudioPlayer");
   const withSound=Boolean(soundURL&&player.src);
   if(withSound){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)throw Error("Din webbläsare saknar stöd för ljudmixning.");
    audioContext ||=new Audio();
    audioSource ||=audioContext.createMediaElementSource(player);
    await audioContext.resume();
    audioDestination=audioContext.createMediaStreamDestination();
    audioSource.connect(audioDestination);
    if(!audioMonitoring){audioSource.connect(audioContext.destination);audioMonitoring=true;}
    const tracks=audioDestination.stream.getAudioTracks();
    if(!tracks.length)throw Error("Ingen ljudkanal skapades för filmen.");
    stream=new MediaStream([...stream.getVideoTracks(),...tracks]);
   }
   const mime=chooseMime(withSound);
   if(!mime)throw Error("Ingen kompatibel videokodare med "+(withSound?"ljud":"bild")+" finns.");
   const bitrate=output.quality==="1080"?11000000:6500000;
   const opts={videoBitsPerSecond:bitrate};
   if(mime)opts.mimeType=mime;
   const recorder=new MediaRecorder(stream,opts);
   mediaRecorder=recorder;recordChunks=[];pendingCleanup=false;
   recorder.ondataavailable=e=>{if(e.data?.size)recordChunks.push(e.data);};
   recorder.onerror=e=>{
    console.error("Film export error",e);
    notify("Filminspelningen misslyckades på denna enhet.",5000);
    finishRecorder({cancel:true});
   };
   recorder.onstop=()=>{
    const cancel=pendingCleanup;
    const blob=new Blob(recordChunks,{type:recorder.mimeType||"video/webm"});
    mediaRecorder=null;recordChunks=[];
    if(cancel){displayState("Inspelningen avbröts.");return;}
    if(blob.size<2000){displayState("Inga bildrutor spelades in. Prova 720p/24 fps eller PNG.");return;}
    const extension=blob.type.includes("mp4")?"mp4":"webm";
    downloadName=safe(filename())+"-"+safe(getWorld())+"-cinematic."+extension;
    lastBlob=blob;
    lastURL=URL.createObjectURL(blob);
    $("filmDownload").href=lastURL;
    $("filmDownload").download=downloadName;
    $("filmDownload").hidden=false;
    // Download must come from the user-started capture workflow. Provide
    // the persistent link in case browser blocks auto-downloads.
    const a=document.createElement("a");a.href=lastURL;a.download=downloadName;a.click();
    displayState("Film skapad: "+(blob.size/1024/1024).toFixed(1)+" MB. Ladda ned igen via knappen.");
   };
   recorder.start(1000);
   recording=true;playing=true;orbit.enabled=false;
   if(withSound){
    player.pause();player.currentTime=0;
    player.play().catch(err=>notify("Ljudspåret kunde inte startas: "+err.message,3500));
   }
   displayState("Spelar in "+output.width+"×"+output.height+" · "+output.fps+" fps (mål) · "+
    output.duration+" s · "+(withSound?"ljud inbäddat":"utan ljud")+". GPU:n bestämmer verklig hastighet.");
  }catch(e){
   console.error("Film Studio capture",e);
   if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
   mediaRecorder=null;recording=false;playing=false;
   detachRecordAudio();
   restoreOutputSize();orbit.enabled=true;
   displayState("Kunde inte starta video: "+e.message);
   notify("Videoinspelning stöds inte fullt ut på din enhet – prova 720p eller PNG.",5500);
  }
 }
 async function still(){
  if(!opened&&!open())return;
  if(recording||frameExporting)return;
  readSettings();
  const beforePlaying=playing;playing=false;
  const big=$("filmPhotoResolution").value==="4k";
  const w=big?3840:1920,h=big?2160:1080;
  try{
   setOutputSize(w,h);renderFrame();
   const blob=await new Promise(res=>canvas.toBlob(res,"image/png"));
   if(!blob)throw Error("WebGL kunde inte skapa PNG-filen.");
   saveBlob(blob,safe(filename())+"-"+safe(getWorld())+"-"+(big?"4K":"1080p")+".png");
   displayState("Filmisk stillbild exporterad i "+w+"×"+h+".");
  }catch(e){notify("Högupplöst bild misslyckades: "+e.message,4700);}
  finally{restoreOutputSize();playing=beforePlaying;}
 }
 function addKeyframe(){
  if(!opened&&!open())return;
  if(keyframes.length>=12){notify("Max 12 kameranyckelbilder per film.",3000);return;}
  // User composes each shot with Orbit/Free camera when playback is stopped.
  keyframes.push({position:camera.position.toArray(),target:orbit.target.toArray()});
  $("filmShot").value="custom";readSettings();
  displayState("Kamerapunkt "+keyframes.length+" lagrad. Flytta kameran och lägg till nästa punkt.");
 }
 function removeKeyframe(){
  keyframes.pop();
  displayState("Antal kameranyckelbilder: "+keyframes.length);
 }
 function exportStoryboard(){
  readSettings();
  const payload={
   format:"duoforge-film@1",world:getWorld(),created:new Date().toISOString(),
   settings:format,keyframes:normalizeKeyframes(keyframes),
   look:$("filmLook").value,finish:$("filmFinish").checked,
   fx:fxSettings(),cuts:normalizeCuts(cuts),
   soundtrack:$("filmAudioPlayer").dataset.name||null,
   note:"Local rendering, approximate browser fps; requires 3D Studio scene."
  };
  saveBlob(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),
   safe(filename())+"-storyboard.json");
 }
 async function importStoryboard(file){
  if(!file)return;
  try{
   if(file.size>100000)throw Error("Storyboard-filen är för stor.");
   const value=JSON.parse(await file.text());
   if(value.format!=="duoforge-film@1")throw Error("Ogiltig filmprojektfil.");
   const opts=normalizeFilmSettings(value.settings||{});
   const frames=normalizeKeyframes(value.keyframes);
   $("filmShot").value=opts.shot;
   $("filmDuration").value=opts.duration;
   $("filmResolution").value=opts.quality;
   $("filmFps").value=opts.fps;
   $("filmFov").value=opts.fov;
   keyframes=frames;
   $("filmLook").value=["golden","studio","noir","natural","off"].includes(value.look)?value.look:"golden";
   $("filmFinish").checked=value.finish!==false;
   if(opened)applyFilmLook($("filmLook").value,$("filmFinish").checked);
   if(value.fx){
    $("filmDof").checked=Boolean(value.fx.dof);
    $("filmSSR").checked=Boolean(value.fx.reflections);
    $("filmAperture").value=String(clamp(Number(value.fx.aperture)||.001,.0001,.003));
    $("filmFocusScale").value=String(clamp(Number(value.fx.focusScale)||1,.35,2.5));
   }
   updateFx();
   cuts=normalizeCuts(value.cuts||[]);
   renderCutList();
   path=[];sequence=[];cutPaths=[];activeCut=-1;readSettings();
   displayState("Storyboard laddat: "+frames.length+" egna kameranyckelbilder.");
  }catch(e){notify("Kunde inte importera filmprojekt: "+e.message,4000);}
 }
 function update(dt){
  if(!opened||!playing)return false;
  elapsed=Math.min(format.duration,elapsed+Math.max(0,Math.min(.1,dt)));
  const progress=clamp(elapsed/format.duration,0,1);
  applyAt(progress);
  setWorldTime(elapsed,dt);
  if((Math.round(elapsed*15)%4)===0)displayState(recording?
   "Renderar video på grafikkortet …":"Spelar upp filmsekvens …");
  if(elapsed>=format.duration){
   if(recording)finishRecorder();
   else stopPlayback({keepFrame:true});
  }
  return true;
 }
 function onWorldChanged(){
  if(!opened)return;
  if(recording)finishRecorder({cancel:true});
  playing=false;elapsed=0;path=[];sequence=[];cutPaths=[];activeCut=-1;
  $("filmShot").value=getWorld()==="ocean"?"flyover":"orbit";
  readSettings();
  applyFilmLook($("filmLook").value,$("filmFinish").checked);
  refreshRigPanel();
  displayState("Ny värld vald. Förhandsvisa en kamerarörelse.");
 }


 function refreshRigPanel(){
  const rig=getRigDirector();
  const clip=$("filmRigClip"),bone=$("filmRigBone");
  clip.replaceChildren(new Option("Ingen animation",""));
  bone.replaceChildren(new Option("Välj led",""));
  for(const name of rig?.clips||[])clip.add(new Option(name.name+" · "+name.duration.toFixed(1)+"s",name.name));
  for(const name of rig?.bones||[])bone.add(new Option(name,name));
  $("filmRigStatus").textContent=rig?.hasSkin?
   "✅ "+rig.bones.length+" leder · "+rig.clips.length+" GLB-animationsklipp. Klippen visas på filmens tidslinje.":
   "Modellen saknar skelett. Importera en riggad GLB; automatisk viktmålning finns inte här.";
 }
 function poseRig(){
  const rig=getRigDirector(),bone=$("filmRigBone").value;
  if(!rig||!bone)return;
  const values=["filmRigX","filmRigY","filmRigZ"].map(id=>
   Number($(id).value)*Math.PI/180);
  if(rig.pose(bone,values)){
   rig.sample(elapsed);
   renderFrame();
   $("filmRigStatus").textContent="Led "+bone+" justerad. Original-GLB är oförändrad.";
  }
 }
 $("filmRigClip").onchange=()=>{
  const rig=getRigDirector();if(!rig)return;
  rig.start($("filmRigClip").value);
  rig.sample(elapsed);renderFrame();
  $("filmRigStatus").textContent=rig.active()?"Spelar skinnat GLB-klipp: "+rig.active():"Ingen skeletal animation vald.";
 };
 $("filmRigBone").onchange=()=>{
  for(const id of ["filmRigX","filmRigY","filmRigZ"])$(id).value="0";
 };
 for(const id of ["filmRigX","filmRigY","filmRigZ"])$(id).oninput=poseRig;
 $("filmRigReset").onclick=()=>{
  const rig=getRigDirector();if(!rig)return;
  rig.release();rig.start($("filmRigClip").value);
  for(const id of ["filmRigX","filmRigY","filmRigZ"])$(id).value="0";
  rig.sample(elapsed);renderFrame();$("filmRigStatus").textContent="Posen är återställd.";
 };
 $("filmTraceMovie").onclick=async()=>{
  if(recording||frameExporting)return;
  if(!opened&&!open())return;
  readSettings();
  try{buildPath();}catch(e){notify(e.message,4000);return;}
  frameExporting=true;playing=false;
  const saved={pos:camera.position.clone(),quat:camera.quaternion.clone(),
   target:orbit.target.clone(),enabled:orbit.enabled,elapsed};
  orbit.enabled=false;
  try{await pathMovie.run({duration:format.duration,fps:format.fps});}
  finally{
   camera.position.copy(saved.pos);camera.quaternion.copy(saved.quat);
   orbit.target.copy(saved.target);orbit.enabled=saved.enabled;
   orbit.update();elapsed=saved.elapsed;
   setFilmPose(0,"still");getRigDirector()?.sample(elapsed);
   frameExporting=false;
  }
 };
 $("filmTraceCancel").onclick=()=>pathMovie.stop();

 function renderCutList(){
  const list=$("filmCutList");list.replaceChildren();
  for(const [index,cut] of cuts.entries()){
   const row=document.createElement("div");row.className="film-cut-row";
   const label=document.createElement("span");
   label.textContent=(index+1)+". "+cut.name+" · "+cut.duration+"s · "+cut.shot+" · "+cut.motion+" · "+cut.look;
   row.append(label);
   for(const [text,changePos] of [["↑",-1],["↓",1]]){
    const btn=document.createElement("button");btn.type="button";btn.textContent=text;btn.title="Flytta scen";
    btn.onclick=()=>{
     const to=index+changePos;if(to<0||to>=cuts.length||frameExporting||recording)return;
     [cuts[index],cuts[to]]=[cuts[to],cuts[index]];onCutsChanged();
    };row.append(btn);
   }
   const remove=document.createElement("button");remove.textContent="✕";remove.title="Radera scen";remove.type="button";
   remove.onclick=()=>{if(frameExporting||recording)return;cuts.splice(index,1);onCutsChanged();};
   row.append(remove);list.append(row);
  }
  $("filmCutTotal").textContent=cuts.length+" scener · "+movieDuration(cuts)+" sekunder";
 }
 function onCutsChanged(){
  cuts=normalizeCuts(cuts);renderCutList();path=[];sequence=[];cutPaths=[];activeCut=-1;
  if(cuts.length){
   $("filmShot").value="edit";elapsed=0;readSettings();
   try{buildPath();applyAt(0);}catch(e){displayState(e.message);}
  }else{
   $("filmShot").value="orbit";readSettings();
   setFilmPose(0,"still");
  }
  displayState("Filmredigerare: "+cuts.length+" scener. Lägg till och flytta tagningar.");
 }
 async function frameSequence(){
  if(frameExporting||recording)return;
  if(!opened&&!open())return;
  readSettings();
  try{buildPath();}catch(e){notify(e.message,3500);return;}
  const resolution=$("filmFrameResolution").value;
  const [width,height]=resolution==="4k"?[3840,2160]:resolution==="1080"?[1920,1080]:[1280,720];
  const countLimit=resolution==="4k"?8:48;
  const plan=frameBatch({duration:format.duration,fps:format.fps,
   start:Number($("filmFrameStart").value),count:Number($("filmFrameCount").value),maxFrames:countLimit});
  frameExporting=true;frameAborted=false;playing=false;
  displayState("Förbereder exakt "+format.fps+" fps som PNG-bildsekvens.");
  $("filmFrameCancel").hidden=false;
  const prev={pos:camera.position.clone(),rotation:camera.quaternion.clone(),
   target:orbit.target.clone(),fov:camera.fov,orbit:orbit.enabled,elapsed};
  orbit.enabled=false;
  const zip=new FrameZip();let done=0;
  try{
   setOutputSize(width,height);
   for(const f of plan.frames){
    if(frameAborted)break;
    elapsed=f.time;applyAt(clamp(elapsed/format.duration,0,1));
    setWorldTime(elapsed,0);renderFrame();
    const png=await new Promise((resolve,reject)=>{
     canvas.toBlob(blob=>blob?resolve(blob):reject(Error("PNG-bildruta kunde inte exporteras.")),"image/png");
    });
    await zip.add("frame_"+String(f.number).padStart(6,"0")+".png",png);
    done++;
    $("filmFrameStatus").textContent="Renderat "+done+"/"+plan.frames.length+" bildrutor · "+
     (f.time).toFixed(2)+" s film · "+width+"×"+height;
    // Yield to UI between every frame. Actual render time never changes film timing.
    await new Promise(r=>requestAnimationFrame(r));
   }
   const resume=plan.first+done<plan.total?plan.first+done:null;
   if(done){
    const manifest={format:"duoforge-frames@1",fps:format.fps,width,height,
     duration:format.duration,start:plan.first,end:plan.first+done,total:plan.total,
     next:resume,cuts:normalizeCuts(cuts),look:$("filmLook").value,
     note:"Frame exact PNG sequence. Assemble with FFmpeg. Soundtrack not embedded."};
    await zip.add("manifest.json",new Blob([JSON.stringify(manifest,null,2)],{type:"application/json"}));
    saveBlob(zip.finish(),safe(filename())+"-frames-"+plan.first+"-"+(plan.first+done-1)+".zip");
   }
   if(resume!==null)$("filmFrameStart").value=String(resume);
   $("filmFrameStatus").textContent=done?
    (frameAborted?"Avbruten · ":"Klar · ")+done+" PNG sparade. "+
    (resume===null?"Alla bildrutor exporterade.":"Nästa del börjar vid bild "+resume+"."):
    "Inga bildrutor exporterades.";
  }catch(e){
   console.warn("Offline film render",e);
   $("filmFrameStatus").textContent="Exporten misslyckades: "+e.message;
  }finally{
   restoreOutputSize();
   camera.position.copy(prev.pos);camera.quaternion.copy(prev.rotation);
   camera.fov=prev.fov;camera.updateProjectionMatrix();
   orbit.target.copy(prev.target);orbit.enabled=prev.orbit;
   orbit.update();elapsed=prev.elapsed;setFilmPose(0,"still");
   frameExporting=false;$("filmFrameCancel").hidden=true;displayState("Bildsekvensexport klar.");
  }
 }
 $("filmAddCut").onclick=()=>{
  if(recording||frameExporting||cuts.length>=12)return;
  cuts.push({name:"Scen "+(cuts.length+1),shot:$("filmCutShot").value,
   look:$("filmCutLook").value,motion:$("filmCutMotion").value,duration:Number($("filmCutSeconds").value)});
  onCutsChanged();
 };
 $("filmRemoveCut").onclick=()=>{if(!recording&&!frameExporting){cuts.pop();onCutsChanged();}};
 $("filmFrameRender").onclick=frameSequence;
 $("filmFrameCancel").onclick=()=>{frameAborted=true;};
 $("filmAudioFile").onchange=e=>{
  const file=e.target.files?.[0];e.target.value="";
  if(!file||file.size>30*1024*1024){notify("Välj en ljudfil på högst 30 MB.");return;}
  if(soundURL)URL.revokeObjectURL(soundURL);
  soundURL=URL.createObjectURL(file);
  const player=$("filmAudioPlayer");player.src=soundURL;player.dataset.name=file.name;
  player.hidden=false;
  $("filmAudioStatus").textContent="Ljudspår inläst: "+file.name+". Kan förhandslyssnas. Bildsekvens-ZIP innehåller inte ljud.";
 };
 $("filmHdriFile").onchange=async e=>{
  const file=e.target.files?.[0];e.target.value="";if(!file)return;
  $("filmHdriStatus").textContent="Laddar HDRI-miljö …";
  try{
   await importHDRI(file);
   setHDRIIntensity(Number($("filmHdriIntensity").value));
   $("filmHdriStatus").textContent="✅ HDRI-ljus från "+file.name+" används i förhandsvisningen.";
  }catch(err){$("filmHdriStatus").textContent="HDRI kunde inte laddas: "+err.message;}
 };
 $("filmHdriIntensity").oninput=()=>setHDRIIntensity(Number($("filmHdriIntensity").value));

 $("filmOpen").onclick=open;
 $("filmOpenPanel").onclick=open;
 $("filmBroll").onclick=()=>{
  if(!opened&&!open())return;
  $("filmShot").value="broll";
  $("filmDuration").value="20";
  $("filmLook").value="golden";
  $("filmFinish").checked=true;
  path=[];sequence=[];cutPaths=[];activeCut=-1;
  applyFilmLook("golden",true);
  readSettings();buildPath();applyAt(0);
  displayState("✨ Fem olika B-roll-vinklar redo. Förhandsvisa eller rendera filmen.");
 };
 $("filmLook").onchange=()=>{if(opened)applyFilmLook($("filmLook").value,$("filmFinish").checked);};
 $("filmFinish").onchange=()=>{if(opened)applyFilmLook($("filmLook").value,$("filmFinish").checked);};
 for(const id of ["filmDof","filmSSR"])$(id).onchange=updateFx;
 for(const id of ["filmAperture","filmFocusScale"])$(id).oninput=updateFx;
 $("filmClose").onclick=close;
 $("filmPlay").onclick=preview;
 $("filmRecord").onclick=record;
 $("filmStill").onclick=still;
 $("filmAddKeyframe").onclick=addKeyframe;
 $("filmRemoveKeyframe").onclick=removeKeyframe;
 $("filmExportStoryboard").onclick=exportStoryboard;
 $("filmImportStoryboard").onchange=async e=>{await importStoryboard(e.target.files?.[0]);e.target.value="";};
 $("filmShot").onchange=e=>{path=[];sequence=[];cutPaths=[];activeCut=-1;elapsed=0;setFilmPose(0,"still");readSettings();displayState("Kamerarörelse: "+e.target.selectedOptions[0].textContent);e.target.blur();};
 for(const id of ["filmDuration","filmResolution","filmFps","filmFov"]){
  $(id).onchange=()=>{readSettings();displayState("Filminställningar uppdaterade.");};
 }
 $("filmSeek").oninput=event=>{
  if(recording)return;
  if(!opened)return;
  readSettings();
  try{
   if(!path.length&&!sequence.length&&!cutPaths.length)buildPath();
   playing=false;orbit.enabled=true;
   elapsed=format.duration*(Number(event.target.value)/1000);
   applyAt(elapsed/format.duration);setWorldTime(elapsed,0);
   renderFrame();
   displayState("Förhandsgranskar bildruta vid "+elapsed.toFixed(1)+" s.");
  }catch(e){displayState(e.message);}
 };
 displayState("Öppna Film Studio för att skapa en film.");
 return {open,close,onPreviewExit,onWorldChanged,update,
  isPlaying:()=>opened&&playing,isOpen:()=>opened,isRecording:()=>recording,
  getTime:()=>elapsed,getSettings:()=>({...format})};
}
