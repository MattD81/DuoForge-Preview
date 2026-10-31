/**
 * DuoForge Chat → 3D Studio handoff (public files only; no new server).
 * GLB files must already be published to DuoForge Preview or public
 * MattD81 GitHub raw assets. ChatGPT sandbox links are not public URLs.
 */
export const CHAT_IMPORT_PARAM="df_glb";
export const CHAT_IMPORT_NAME_PARAM="df_name";
export const MAX_CHAT_GLB_BYTES=50*1024*1024;

export function validatePublicGlbUrl(value,siteOrigin){
 if(typeof value!=="string"||!value.trim()||value.length>2000)
  throw Error("Ange en offentlig HTTPS-länk till en GLB-fil.");
 let url;
 try{url=new URL(value.trim())}catch{throw Error("Ogiltig GLB-länk.")}
 if(url.protocol!=="https:"||url.username||url.password||url.hash)
  throw Error("GLB-länken måste använda HTTPS utan inloggning eller fragment.");
 if(!/\.glb$/i.test(url.pathname))throw Error("Länken måste sluta med .glb.");
 if([...url.searchParams.keys()].some(k=>k!=="raw"))
  throw Error("Privata nycklar eller andra frågeparametrar får inte finnas i GLB-länken.");
 const sameSite=url.origin===siteOrigin;
 const ownerRaw=url.hostname==="raw.githubusercontent.com"&&
  /^\/MattD81\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+\.glb$/i.test(url.pathname);
 if(!sameSite&&!ownerRaw)
  throw Error("Använd en GLB i DuoForges GitHub-bibliotek eller på DuoForge Preview.");
 return url.href;
}
export function sanitizeGlbName(value,url){
 const fallback=decodeURIComponent(new URL(url).pathname.split("/").pop()).replace(/\.glb$/i,"");
 return String(value||fallback).replace(/[^\p{L}\p{N} _.-]/gu,"").trim().slice(0,80)||"DuoForge 3D-modell";
}
export function readChatImportParams(search){
 const p=new URLSearchParams(search);
 return p.has(CHAT_IMPORT_PARAM)?{url:p.get(CHAT_IMPORT_PARAM)||"",name:p.get(CHAT_IMPORT_NAME_PARAM)||""}:null;
}
export function buildChatImportLink(studioLocation,modelUrl,modelName=""){
 const url=new URL(studioLocation);
 url.searchParams.set(CHAT_IMPORT_PARAM,validatePublicGlbUrl(modelUrl,url.origin));
 if(modelName)url.searchParams.set(CHAT_IMPORT_NAME_PARAM,String(modelName).slice(0,80));
 return url.href;
}
export async function validateGlbBlob(blob){
 if(!blob||blob.size<20||blob.size>MAX_CHAT_GLB_BYTES)
  throw Error("GLB måste vara mellan 20 byte och 50 MB.");
 const header=new DataView(await blob.slice(0,12).arrayBuffer());
 if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||
    header.getUint32(8,true)!==blob.size)
  throw Error("Filen är inte en giltig GLB v2.");
 return blob;
}
export async function fetchPublicGlb(url,{fetchImpl=fetch,timeoutMs=45000}={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 try{
  const r=await fetchImpl(url,{method:"GET",mode:"cors",credentials:"omit",
   redirect:"error",referrerPolicy:"no-referrer",signal:ctrl.signal});
  if(!r.ok)throw Error("GLB kunde inte hämtas (HTTP "+r.status+").");
  if(Number(r.headers.get("content-length"))>MAX_CHAT_GLB_BYTES)
   throw Error("GLB är för stor (max 50 MB).");
  if(!r.body?.getReader)return validateGlbBlob(await r.blob());
  const reader=r.body.getReader(),chunks=[];let total=0;
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>MAX_CHAT_GLB_BYTES){
    await reader.cancel();throw Error("GLB är för stor (max 50 MB).");
   }
   chunks.push(value);
  }
  return validateGlbBlob(new Blob(chunks,{type:"model/gltf-binary"}));
 }catch(error){
  if(ctrl.signal.aborted)throw Error("Hämtningen tog för lång tid. Prova igen.");
  throw error;
 }finally{clearTimeout(timer)}
}
export function initChatImportBridge({loadGLB,notify,win=window,doc=document,fetchImpl=fetch}={}){
 if(typeof loadGLB!=="function")throw Error("DuoForge Studio saknar GLB-importfunktion.");
 const btn=doc.createElement("button");
 btn.type="button";btn.id="chatImportButton";btn.className="accent-outline";
 btn.textContent="💬 Från chatten";
 btn.title="Öppna en offentlig DuoForge-GLB direkt från chatten";
 const anchor=doc.querySelector('label[for="importFile"]');
 if(anchor)anchor.insertAdjacentElement("afterend",btn);
 else doc.querySelector(".top-actions")?.append(btn);
 const dialog=doc.createElement("dialog");
 dialog.id="chatImportDialog";dialog.className="chat-import-dialog";
 dialog.innerHTML=`
 <form method="dialog" id="chatImportForm">
  <h2>💬 DuoForge · Från chatten</h2>
  <p>En offentlig GLB i DuoForges GitHub-bibliotek kan öppnas direkt här. ChatGPT-sandboxfiler behöver först publiceras i ett godkänt modellbibliotek. Inga privata nycklar används.</p>
  <label for="chatImportUrl">Offentlig DuoForge-GLB-länk</label>
  <input id="chatImportUrl" type="url" inputmode="url" placeholder="https://mattd81.github.io/.../modell.glb" required autocomplete="off">
  <label for="chatImportName">Modellnamn (valfritt)</label>
  <input id="chatImportName" type="text" maxlength="80" placeholder="DuoForge naturtrogen gran">
  <p id="chatImportStatus" role="status" aria-live="polite">Klistra in en GLB-länk från chatten eller öppna en färdig DuoForge-länk.</p>
  <div class="chat-import-actions">
   <button type="button" id="chatImportSubmit" class="accent">Öppna i studion</button>
   <button type="button" id="chatImportCopy">Kopiera öppningslänk</button>
   <button type="submit">Stäng</button>
  </div>
 </form>`;
 doc.body.append(dialog);
 const style=doc.createElement("style");
 style.textContent=`.chat-import-dialog{color:#e8fff1;background:#102920;border:1px solid #47ba85;border-radius:14px;padding:18px;width:min(94vw,480px);max-height:85dvh;overflow:auto;box-shadow:0 18px 60px #000b}.chat-import-dialog::backdrop{background:#000b}.chat-import-dialog form{display:grid;gap:10px}.chat-import-dialog h2{margin:0;color:#a8ffcc}.chat-import-dialog p{line-height:1.5;margin:3px 0;color:#cbe3d5}.chat-import-dialog label{font-weight:650}.chat-import-dialog input{font-size:16px;width:100%;padding:12px;border:1px solid #598e79;border-radius:8px;background:#071d16;color:#fff;min-width:0}.chat-import-actions{display:flex;flex-wrap:wrap;gap:8px}.chat-import-actions button{min-height:44px;flex:1 1 125px}.chat-import-dialog #chatImportStatus{font-size:12px;overflow-wrap:anywhere}`;
 doc.head.append(style);
 const linkInput=doc.getElementById("chatImportUrl");
 const nameInput=doc.getElementById("chatImportName");
 const status=doc.getElementById("chatImportStatus");
 const submit=doc.getElementById("chatImportSubmit");
 let busy=false;
 const report=message=>{status.textContent=message;notify?.(message,5000)};
 const open=()=>{if(!dialog.open)dialog.showModal()};
 btn.addEventListener("click",open);
 async function importUrl(value,name=""){
  if(busy)return false;
  let checked;
  try{checked=validatePublicGlbUrl(value,win.location.origin)}
  catch(error){open();report(error.message);return false}
  busy=true;submit.disabled=true;
  try{
   report("DuoForge hämtar och kontrollerar 3D-modellen …");
   const blob=await fetchPublicGlb(checked,{fetchImpl});
   const modelName=sanitizeGlbName(name,checked);
   await loadGLB(blob,modelName);
   status.textContent="Öppnad i DuoForge: "+modelName;
   if(dialog.open)dialog.close();
   const current=new URL(win.location.href);
   if(current.searchParams.has(CHAT_IMPORT_PARAM)){
    current.searchParams.delete(CHAT_IMPORT_PARAM);
    current.searchParams.delete(CHAT_IMPORT_NAME_PARAM);
    win.history.replaceState(win.history.state,"",current.href);
   }
   notify?.("Öppnad i DuoForge: "+modelName,4500);
   return true;
  }catch(error){open();report("Importen misslyckades: "+error.message);return false}
  finally{busy=false;submit.disabled=false}
 }
 submit.addEventListener("click",()=>importUrl(linkInput.value,nameInput.value));
 doc.getElementById("chatImportCopy").addEventListener("click",async()=>{
  try{
   const link=buildChatImportLink(win.location.href,linkInput.value,nameInput.value);
   await win.navigator.clipboard.writeText(link);
   report("Öppningslänk kopierad. Den öppnar modellen direkt i DuoForge Studio.");
  }catch(error){report("Kunde inte skapa länken: "+error.message)}
 });
 const request=readChatImportParams(win.location.search);
 if(request){
  linkInput.value=request.url;nameInput.value=request.name;
  void importUrl(request.url,request.name);
 }
 return {open,importUrl,enabled:true};
}
