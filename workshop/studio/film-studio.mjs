// DuoForge Film Studio. Cinematic shots and 16:9 recording locally in the browser.
// User keeps editable geometry; Render World supplies the transient preview scene.
// MediaRecorder captures in *real time*; fps and duration depend on device speed.
import * as THREE from "three";
import {createShot,sampleCameraPath,createBrollSequence,sampleBrollSequence,normalizeFilmSettings,normalizeKeyframes} from "./film-path.mjs";
import {createPathTraceStills} from "./path-trace-stills.mjs";

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
 notify,filename,applyFilmLook=()=>{},setCinematicEffects=()=>{},getPreviewAnchor=()=>null}){
 let opened=false,playing=false,recording=false,elapsed=0,path=[],sequence=[],savedCamera=null;
 let mediaRecorder=null,captureTrack=null,stream=null,recordChunks=[],recordEnd=null;
 let lastBlob=null,lastURL=null,downloadName="",keyframes=[];
 let format=normalizeFilmSettings(),movieShot="orbit",pendingCleanup=false;
 const ui=$("filmStudioOverlay"),status=$("filmStatus"),progress=$("filmProgress"),seek=$("filmSeek");
 const pathTrace=createPathTraceStills({
  getAnchor:getPreviewAnchor,getCamera:()=>camera,onStatus:message=>{status.textContent=message;},filename
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
   path=[];
   sequence=createBrollSequence(options);
   return sequence;
  }
  sequence=[];
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
  $("filmPlay").disabled=recording;
  $("filmClose").disabled=recording;
  $("filmStill").disabled=recording;
  for(const id of ["filmShot","filmDuration","filmResolution","filmFps","filmFov","filmSeek","filmAddKeyframe","filmRemoveKeyframe","filmLook","filmFinish","filmBroll","filmDof","filmSSR","filmAperture","filmFocusScale"])
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
  displayState("Filmläge redo: välj kamerarörelse och förhandsvisa, eller rendera en riktig videofil.");
  document.body.classList.add("film-studio-active");
  return true;
 }
 function applyAt(progress){
  if(!path.length&&!sequence.length)buildPath();
  const shot=format.shot==="broll"?
   sampleBrollSequence(sequence,progress):
   sampleCameraPath(path,progress,{ease:format.shot!=="flyover"});
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
   if(path.length||sequence.length)applyAt(0);
  }
  displayState("Förhandsvisning klar. Ändra filmrörelsen eller exportera.");
 }
 function finishRecorder({cancel=false}={}){
  if(!mediaRecorder)return;
  pendingCleanup=cancel;
  if(mediaRecorder.state!=="inactive"){
   try{mediaRecorder.stop()}catch(err){console.warn("MediaRecorder stop",err);}
  }
  recording=false;playing=false;
  if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
  captureTrack=null;restoreOutputSize();
  orbit.enabled=true;
  displayState(cancel?"Inspelningen avbröts.":"Sparar videofil lokalt …");
 }
 function close(){
  if(!opened)return;
  if(recording){notify("Stoppa inspelningen innan du lämnar Film Studio.",3000);return;}
  playing=false;
  pathTrace.stop();
  setCinematicEffects({dof:false,reflections:false});
  restoreOutputSize();restoreCamera();
  applyFilmLook("off",false);
  opened=false;ui.hidden=true;document.body.classList.remove("film-studio-active");
 }
 function onPreviewExit(){
  if(recording)finishRecorder({cancel:true});
  close();
 }
 function preview(){
  if(!opened&&!open())return;
  if(recording)return;
  if(playing){playing=false;orbit.enabled=true;
   displayState("Förhandsvisning pausad.");return;}
  beginPlayback();
 }
 function chooseMime(){
  if(typeof MediaRecorder==="undefined")return null;
  return mimeChoices.find(type=>MediaRecorder.isTypeSupported(type))||"";
 }
 function record(){
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
   const mime=chooseMime();
   stream=canvas.captureStream(output.fps);
   captureTrack=stream.getVideoTracks()[0]||null;
   if(!captureTrack)throw Error("Ingen videoström från 3D-renderaren.");
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
   displayState("Spelar in "+output.width+"×"+output.height+" · "+output.fps+" fps (mål) · "+
    output.duration+" s. Bildhastighet beror på GPU:n.");
  }catch(e){
   console.error("Film Studio capture",e);
   if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
   mediaRecorder=null;recording=false;playing=false;
   restoreOutputSize();orbit.enabled=true;
   displayState("Kunde inte starta video: "+e.message);
   notify("Videoinspelning stöds inte fullt ut på din enhet – prova 720p eller PNG.",5500);
  }
 }
 async function still(){
  if(!opened&&!open())return;
  if(recording)return;
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
   fx:fxSettings(),
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
   path=[];sequence=[];readSettings();
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
  playing=false;elapsed=0;path=[];sequence=[];
  $("filmShot").value=getWorld()==="ocean"?"flyover":"orbit";
  readSettings();
  applyFilmLook($("filmLook").value,$("filmFinish").checked);
  displayState("Ny värld vald. Förhandsvisa en kamerarörelse.");
 }
 $("filmOpen").onclick=open;
 $("filmOpenPanel").onclick=open;
 $("filmBroll").onclick=()=>{
  if(!opened&&!open())return;
  $("filmShot").value="broll";
  $("filmDuration").value="20";
  $("filmLook").value="golden";
  $("filmFinish").checked=true;
  path=[];sequence=[];
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
 $("filmShot").onchange=e=>{path=[];sequence=[];elapsed=0;readSettings();displayState("Kamerarörelse: "+e.target.selectedOptions[0].textContent);e.target.blur();};
 for(const id of ["filmDuration","filmResolution","filmFps","filmFov"]){
  $(id).onchange=()=>{readSettings();displayState("Filminställningar uppdaterade.");};
 }
 $("filmSeek").oninput=event=>{
  if(recording)return;
  if(!opened)return;
  readSettings();
  try{
   path=buildPath();
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
