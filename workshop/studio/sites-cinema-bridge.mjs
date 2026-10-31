// DuoForge Sites → Studio adapter. This is a cross-origin *opt-in*
// integration, not a way to read private Sites data on the GitHub host.
// No server, external API, AI key, paid credits or automatic publication.
export const BRIDGE_PROTOCOL="duoforge-cinema-bridge@1";
export const STUDIO_ACTIONS=Object.freeze(["IMPORT_GLB","OPEN_CINEMA","SET_OCEAN","TEXTURE_SELECTED","EXPORT_GLB","PING"]);
export const TRUSTED_SITES_ORIGINS=Object.freeze([
 "https://duoforge-gaming.cuddlyelk8.chatgpt.site"
]);
const LIMIT=50*1024*1024;
const weatherTypes=new Set(["clear","sunset","storm","storm-sunset"]);
const safeId=value=>typeof value==="string"?value.slice(0,100):"";
export function trustedSitesOrigin(origin,options={}){
 if(typeof origin!=="string")return false;
 if(TRUSTED_SITES_ORIGINS.includes(origin))return true;
 // Local-only browser tests and development: opt in explicitly.
 return options.allowLocalhost===true&&/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
export function normalizeBridgeOcean(data){
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Ogiltigt havsväder.");
 const out={};
 const ranges={height:[.05,1.8],speed:[.15,3],whitecaps:[0,1]};
 for(const [key,[min,max]]of Object.entries(ranges)){
  if(!(key in data))continue;
  const n=data[key];
  if(typeof n!=="number"||!Number.isFinite(n)||n<min||n>max)
   throw Error("Otillåtet havsvärde: "+key);
  out[key]=n;
 }
 if("weather" in data){
  if(!weatherTypes.has(data.weather))throw Error("Okänt väderläge.");
  out.weather=data.weather;
 }
 if(!Object.keys(out).length)throw Error("Inga havsinställningar angavs.");
 return out;
}
export function normalizeTextureOptions(data){
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Ogiltigt textureringskommando.");
 const keys=new Set(["mode","presetId","seed","palette","wear","tile","resolution","overwrite"]);
 if(Object.keys(data).some(key=>!keys.has(key)))throw Error("Okänd textureringsparameter.");
 if(data.mode!==undefined&&!["smart","single"].includes(data.mode))throw Error("Otillåtet materialläge.");
 if(data.presetId!==undefined&&(typeof data.presetId!=="string"||!/^[a-z0-9-]{1,72}$/.test(data.presetId)))
  throw Error("Ogiltigt material-ID.");
 if(data.overwrite!==undefined&&typeof data.overwrite!=="boolean")throw Error("overwrite måste vara boolean.");
 const ranges={seed:[0,63],palette:[0,15],wear:[0,15],tile:[0,3]};
 for(const [key,[min,max]]of Object.entries(ranges))if(key in data&&
  (!Number.isInteger(data[key])||data[key]<min||data[key]>max))throw Error("Otillåtet texturvärde: "+key);
 if("resolution" in data&&![128,256,512,1024].includes(data.resolution))throw Error("Otillåten upplösning.");
 return {...data,overwrite:data.overwrite===true};
}
export function makeBridgeReply(action,requestId,ok,extra={}){
 return {protocol:BRIDGE_PROTOCOL,type:"RESULT",action,requestId:safeId(requestId),ok,...extra};
}
export function validateBridgeGLB(value){
 if(!(value instanceof ArrayBuffer)||value.byteLength<20||value.byteLength>LIMIT)
  throw Error("GLB måste vara 20 byte–50 MB.");
 const d=new DataView(value);
 if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||
    d.getUint32(8,true)!==value.byteLength)
  throw Error("Ogiltig GLB-header.");
 return true;
}
export function initSitesStudioBridge({
 win=window,importGLB,openCinema,setOcean,textureSelected=null,exportGLB=null,allowLocalhost=false
}={}){
 if(typeof importGLB!=="function"||typeof openCinema!=="function"||typeof setOcean!=="function")
  throw Error("Sites Studio-anslutningen saknar riktiga funktioner.");
 const url=new URL(win.location.href);
 if(url.searchParams.get("embed")!=="1"||win.parent===win)return {enabled:false,dispose(){}};
 const wanted=url.searchParams.get("parentOrigin");
 if(!trustedSitesOrigin(wanted,{allowLocalhost}))return {enabled:false,dispose(){}};
 const post=(value)=>win.parent.postMessage({protocol:BRIDGE_PROTOCOL,...value},wanted);
 const postTransfer=(value,transfer)=>win.parent.postMessage({protocol:BRIDGE_PROTOCOL,...value},wanted,transfer);
 let busy=false,disposed=false;
 async function handle(event){
  if(disposed||event.source!==win.parent||event.origin!==wanted)return;
  const msg=event.data;
  if(!msg||typeof msg!=="object"||msg.protocol!==BRIDGE_PROTOCOL||msg.type!=="COMMAND")return;
  if(!STUDIO_ACTIONS.includes(msg.action))return;
  const {action}=msg,requestId=safeId(msg.requestId);
  if(busy){post(makeBridgeReply(action,requestId,false,{error:"Studio bearbetar redan ett kommando."}));return;}
  busy=true;
  try{
   if(action==="PING"){post(makeBridgeReply(action,requestId,true,{version:1}));return;}
   if(action==="IMPORT_GLB"){
    validateBridgeGLB(msg.buffer);
    const name=typeof msg.name==="string"?
     msg.name.replace(/[^\p{L}\p{N} _.-]/gu,"").slice(0,80):"Importerad modell";
    const file=new File([msg.buffer],name.endsWith(".glb")?name:name+".glb",{type:"model/gltf-binary"});
    // Import appends to the scene; saved original files in Sites are never modified.
    await importGLB(file,name.replace(/\.glb$/i,""));
    post(makeBridgeReply(action,requestId,true,{bytes:file.size,name:file.name}));
   }else if(action==="SET_OCEAN"){
    const settings=normalizeBridgeOcean(msg.settings);
    setOcean(settings);
    post(makeBridgeReply(action,requestId,true,{settings}));
   }else if(action==="TEXTURE_SELECTED"){
    if(typeof textureSelected!=="function")throw Error("Textureringsmotorn är inte tillgänglig.");
    const options=normalizeTextureOptions(msg.options||{});
    const result=await textureSelected(options);
    post(makeBridgeReply(action,requestId,true,{result}));
   }else if(action==="EXPORT_GLB"){
    if(typeof exportGLB!=="function")throw Error("GLB-exporten är inte tillgänglig.");
    const blob=await exportGLB(1024);
    if(!(blob instanceof Blob)||blob.size<20||blob.size>LIMIT)throw Error("GLB exporten saknas eller är över 50 MB.");
    const buffer=await blob.arrayBuffer();
    postTransfer(makeBridgeReply(action,requestId,true,{bytes:buffer.byteLength,buffer}),[buffer]);
   }else if(action==="OPEN_CINEMA"){
    openCinema();
    post(makeBridgeReply(action,requestId,true,{world:"ocean"}));
   }
  }catch(e){post(makeBridgeReply(action,requestId,false,{error:String(e.message||e).slice(0,180)}));}
  finally{busy=false;}
 }
 win.addEventListener("message",handle);
 // Ready means the document and message listener exist, NOT that a
 // private source model has been imported or video has been rendered.
 post({type:"READY",version:1,capabilities:STUDIO_ACTIONS});
 return {enabled:true,dispose(){disposed=true;win.removeEventListener("message",handle)}};
}
