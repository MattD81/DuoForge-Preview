// Assemble DuoForge's *already rendered* path-traced or PBR PNG ZIP parts
// into a browser-encoded movie with an optional locally supplied soundtrack.
// No FFmpeg CDN, uploading, AI calls or paid render server.
const textDecoder=new TextDecoder();
const $=id=>document.getElementById(id);
const MAX_INPUT_BYTES=250*1024*1024;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function get32(buf,i){return new DataView(buf.buffer,buf.byteOffset,buf.byteLength).getUint32(i,true);}
function get16(buf,i){return new DataView(buf.buffer,buf.byteOffset,buf.byteLength).getUint16(i,true);}
function pngDimensions(bytes){
 if(bytes.length<24||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)
  throw Error("Felaktig PNG-bildruta.");
 const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const width=data.getUint32(16),height=data.getUint32(20);
 if(width<1||height<1||width>3840||height>2160)throw Error("PNG-dimensioner utanför säker gräns.");
 return [width,height];
}
export function parseDuoForgeZip(bytes){
 if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);
 if(bytes.byteLength>MAX_INPUT_BYTES)throw Error("ZIP-filen är för stor.");
 const entries=new Map();let offset=0;
 while(offset+30<=bytes.byteLength&&get32(bytes,offset)===0x04034b50){
  const method=get16(bytes,offset+8),flags=get16(bytes,offset+6);
  if(method!==0||flags!==0)throw Error("Endast DuoForges okomprimerade ZIP-filer stöds.");
  const len=get32(bytes,offset+18);
  const n=get16(bytes,offset+26),extra=get16(bytes,offset+28);
  const first=offset+30+n+extra,last=first+len;
  if(n===0||n>90||last>bytes.byteLength)throw Error("Skadad ZIP-fil.");
  const name=textDecoder.decode(bytes.subarray(offset+30,offset+30+n));
  if(!/^[A-Za-z0-9_.-]{1,80}$/.test(name)||entries.has(name))
   throw Error("Ogiltig eller duplicerad fil i ZIP.");
  entries.set(name,bytes.subarray(first,last));
  offset=last;
  if(entries.size>130)throw Error("ZIP-filen innehåller för många filer.");
 }
 if(!entries.has("manifest.json"))throw Error("DuoForge-manifest saknas.");
 let manifest;
 try{manifest=JSON.parse(textDecoder.decode(entries.get("manifest.json")))}
 catch{throw Error("Ogiltigt filmmanifest.");}
 if(!["duoforge-path-film@1","duoforge-frames@1"].includes(manifest.format))
  throw Error("Inte en DuoForge bildsekvens.");
 if(![24,30].includes(manifest.fps)||!Number.isInteger(manifest.start)||!Number.isInteger(manifest.end))
  throw Error("Filmmanifestet saknar giltig fps eller bildrutintervall.");
 if(manifest.end<=manifest.start||manifest.end-manifest.start>128)throw Error("Felaktigt bildrutintervall.");
 for(let frame=manifest.start;frame<manifest.end;frame++)
  if(!entries.has("frame_"+String(frame).padStart(6,"0")+".png"))
   throw Error("Bildruta "+frame+" saknas i ZIP.");
 return {manifest,entries};
}
export async function readFrameParts(files){
 const items=[...files];if(!items.length)throw Error("Välj minst en PNG-ZIP från DuoForge.");
 if(items.length>30)throw Error("Max 30 ZIP-delar per film.");
 if(items.reduce((sum,f)=>sum+f.size,0)>MAX_INPUT_BYTES)
  throw Error("Bildsekvensen överskrider 250 MB. Exportera kortare klipp.");
 const frames=new Map();let fps=null,width=null,height=null;
 for(const file of items){
  const part=parseDuoForgeZip(new Uint8Array(await file.arrayBuffer()));
  const m=part.manifest;
  if(fps===null){fps=m.fps;width=m.width;height=m.height;}
  else if(m.fps!==fps||m.width!==width||m.height!==height)
   throw Error("Alla delar måste ha samma fps och upplösning.");
  for(let i=m.start;i<m.end;i++){
   if(frames.has(i))throw Error("Bildruta "+i+" finns i flera ZIP-delar.");
   const name="frame_"+String(i).padStart(6,"0")+".png";
   const data=part.entries.get(name);
   const [w,h]=pngDimensions(data);
   if(w!==width||h!==height)throw Error("PNG-upplösning och manifest stämmer inte.");
   frames.set(i,new Blob([data],{type:"image/png"}));
  }
 }
 const indexes=[...frames.keys()].sort((a,b)=>a-b);
 if(indexes.length>900)throw Error("Max 900 bildrutor (30 s) per export.");
 for(let i=1;i<indexes.length;i++)if(indexes[i]!==indexes[i-1]+1)
  throw Error("Saknade bildrutor mellan ZIP-delar. Importera alla delar i ordning.");
 return {fps,width,height,start:indexes[0],frames:indexes.map(i=>frames.get(i)),count:indexes.length};
}
const sleep=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
function codec(audio){
 const candidates=audio?
  ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus",
   "video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4"]:
  ["video/mp4;codecs=avc1.42E01E","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"];
 return candidates.find(s=>MediaRecorder.isTypeSupported(s))||null;
}
function download(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),45000);
}
export function createCinemaVideoAssembler({filename,getSoundURL}){
 let working=false,cancel=false;
 const status=s=>{$("filmAssembleStatus").textContent=s;};
 async function run(){
  if(working)return;
  const files=$("filmFramesFiles").files;
  if(!files.length){status("Välj dina PNG-ZIP-delar först.");return;}
  working=true;cancel=false;$("filmAssembleVideo").disabled=true;
  $("filmAssembleCancel").hidden=false;
  let audioContext=null,audioNode=null,audio=null,recordStream=null,recorder=null;
  try{
   if(typeof MediaRecorder==="undefined"||!HTMLCanvasElement.prototype.captureStream)
    throw Error("Webbläsaren saknar stöd för lokal videokodning.");
   const withAudio=Boolean(getSoundURL());
   // First audio resume executes directly from the click gesture.
   if(withAudio){
    const A=window.AudioContext||window.webkitAudioContext;
    if(!A)throw Error("WebAudio saknas.");
    audioContext=new A();await audioContext.resume();
   }
   status("Kontrollerar bildrutornas ordning och format …");
   const {fps,width,height,start,frames,count}=await readFrameParts(files);
   if(cancel)return;
   if(width>1920||height>1080)throw Error("4K kräver desktopkodning; välj 720p/1080p för browserexport.");
   const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
   const context=canvas.getContext("2d",{alpha:false});
   const video=canvas.captureStream(0),videoTrack=video.getVideoTracks()[0];
   if(!videoTrack)throw Error("Videospåret kunde inte skapas.");
   recordStream=video;
   if(withAudio){
    audio=new Audio();audio.preload="auto";audio.src=getSoundURL();
    audioNode=audioContext.createMediaElementSource(audio);
    const output=audioContext.createMediaStreamDestination();
    audioNode.connect(output);audioNode.connect(audioContext.destination);
    recordStream=new MediaStream([...video.getVideoTracks(),...output.stream.getAudioTracks()]);
   }
   const mime=codec(withAudio);
   if(!mime)throw Error("En kompatibel videokodare med "+(withAudio?"ljud":"bild")+" saknas.");
   const chunks=[];
   recorder=new MediaRecorder(recordStream,{mimeType:mime,videoBitsPerSecond:width>=1920?10000000:6500000});
   const finished=new Promise((resolve,reject)=>{
    recorder.onerror=event=>reject(Error("Videokodningen misslyckades: "+(event.error?.message||"okänt fel")));
    recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
    recorder.onstop=resolve;
   });
   recorder.start(500);
   if(audio){audio.currentTime=0;await audio.play();}
   const startTime=performance.now();
   for(let i=0;i<frames.length;i++){
    if(cancel)break;
    const bitmap=await createImageBitmap(frames[i]);
    context.drawImage(bitmap,0,0,width,height);bitmap.close();
    // Capture a precisely numbered source image; wall-time pacing is bounded
    // by browser GPU/image decode speed. MediaRecorder records real timestamps.
    videoTrack.requestFrame?.();
    status("Kodning "+(i+1)+"/"+count+" · bild "+(start+i)+" · "+fps+" fps"+(withAudio?" · ljud":""));
    const elapsed=performance.now()-startTime;
    await sleep((i+1)*1000/fps-elapsed);
   }
   if(recorder.state!=="inactive")recorder.stop();
   await finished;
   if(!cancel){
    const blob=new Blob(chunks,{type:recorder.mimeType||mime});
    if(blob.size<2048)throw Error("Kodningen gav en tom videofil.");
    download(blob,String(filename()||"DuoForge").replace(/[^a-z0-9_-]/gi,"-")+
     "-cinema-"+start+"-"+(start+count-1)+(mime.includes("mp4")?".mp4":".webm"));
    status("✅ Video med "+count+" bildrutor "+(withAudio?"och inbäddat ljud ":"")+
     "har skapats lokalt ("+(blob.size/1024/1024).toFixed(1)+" MB).");
   }else status("Videoexporten avbröts.");
  }catch(e){console.warn("Cinema video assembly",e);status("Videoexporten misslyckades: "+e.message);}
  finally{
   if(recorder?.state==="recording"){try{recorder.stop()}catch{}}
   audio?.pause();
   recordStream?.getTracks().forEach(t=>t.stop());
   await audioContext?.close().catch(()=>{});
   working=false;$("filmAssembleVideo").disabled=false;$("filmAssembleCancel").hidden=true;
  }
 }
 $("filmAssembleVideo").onclick=run;
 $("filmAssembleCancel").onclick=()=>{cancel=true};
 return {stop:()=>{cancel=true},isRunning:()=>working};
}
