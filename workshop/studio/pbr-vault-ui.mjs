// DuoForge PBR Vault mobile-first browser UI.
// 360 searchable procedural PBR recipes; pixels allocated only on user demand.
// Data never leaves the browser. Model geometry and material history use existing Studio.
import * as THREE from "three";
import {VAULT_PRESETS,VAULT_CATEGORIES,getVaultPreset,filterVault,VAULT_VERSION} from "./pbr-vault-catalog.mjs";
import {generateVaultPixels} from "./pbr-vault-maps.mjs";

const $=id=>document.getElementById(id);
const localKey="duoforge.material-vault.favourites.v1";
const readFavorite=()=>{
 try{const arr=JSON.parse(localStorage.getItem(localKey)||"[]");return new Set(Array.isArray(arr)?arr.filter(x=>getVaultPreset(x)):[])}
 catch{return new Set()}
};
function canvasTexture(raw,n,name,srgb,repeat){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=n;
 const ctx=canvas.getContext("2d",{willReadFrequently:false});
 if(!ctx)throw Error("Webbläsaren saknar Canvas 2D.");
 ctx.putImageData(new ImageData(new Uint8ClampedArray(raw),n,n),0,0);
 const texture=new THREE.CanvasTexture(canvas);
 texture.name=name;texture.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat,repeat);
 texture.anisotropy=4;texture.needsUpdate=true;
 return texture;
}
function canvasFromPixels(data,n){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=n;
 const ctx=canvas.getContext("2d");ctx.putImageData(new ImageData(data,n,n),0,0);return canvas;
}
function pngBuffer(data,n){
 const canvas=canvasFromPixels(data,n);
 return new Promise((resolve,reject)=>canvas.toBlob(async blob=>{
  if(!blob){reject(Error("Kan inte skapa PNG."));return}
  resolve(new Uint8Array(await blob.arrayBuffer()));
 },"image/png"));
}
function crc32(bytes){
 let crc=0xffffffff;
 for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
 return (crc^0xffffffff)>>>0;
}
// A standards-compliant ZIP (store method, UTF-8 names, no dependencies).
export function buildVaultZip(entries){
 const encoder=new TextEncoder(),files=entries.map(e=>{
  const name=encoder.encode(e.name),data=e.bytes;
  if(name.byteLength>65535)throw Error("För långt filnamn.");
  return {name,data,crc:crc32(data)};
 });
 let position=0;
 const chunk=[],directory=[];
 function local(file){
  const header=new Uint8Array(30+file.name.length),d=new DataView(header.buffer);
  d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x0800,true);
  d.setUint32(14,file.crc,true);d.setUint32(18,file.data.length,true);d.setUint32(22,file.data.length,true);
  d.setUint16(26,file.name.length,true);header.set(file.name,30);
  const offset=position;position+=header.length+file.data.length;
  chunk.push(header,file.data);
  return offset;
 }
 for(const f of files){
  const offset=local(f),central=new Uint8Array(46+f.name.length),d=new DataView(central.buffer);
  d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);
  d.setUint32(16,f.crc,true);d.setUint32(20,f.data.length,true);d.setUint32(24,f.data.length,true);
  d.setUint16(28,f.name.length,true);d.setUint32(42,offset,true);
  central.set(f.name,46);directory.push(central);
 }
 const start=position;for(const d of directory){chunk.push(d);position+=d.length}
 const footer=new Uint8Array(22),view=new DataView(footer.buffer);
 view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);
 view.setUint16(10,files.length,true);view.setUint32(12,position-start,true);view.setUint32(16,start,true);
 chunk.push(footer);return new Blob(chunk,{type:"application/zip"});
}
function down(name,blob){
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function addStyle(parent,el){parent.append(el);return el}
export function initPbrVault({getSelected,pushHistory,dirty,refreshTree,updateInspector,safeUV,notify,selectionChanged}){
 const host=$("materialLabPanel");if(!host||$("pbrVault"))return null;
 const panel=document.createElement("section");panel.id="pbrVault";panel.className="pbr-vault";
 panel.innerHTML=[
  '<hr><div class="section-heading"><h2>📚 Material Vault</h2><span class="mini-pill">360 PBR + texturer</span></div>',
  '<p class="hint">30 materialfamiljer × 12 unika struktur- och färgvarianter. Äkta Base Color, tangent-normal och ORM-kartor genereras vid behov – inga externa bilder eller licenskostnader.</p>',
  '<div class="vault-search"><input id="vaultSearch" type="search" aria-label="Sök PBR-material" placeholder="Sök sten, marmor, ek, guld…"><select id="vaultCategory" aria-label="Materialkategori"><option>Alla</option></select></div>',
  '<label class="vault-check"><input type="checkbox" id="vaultFaves"> ★ Endast favoriter</label>',
  '<div class="vault-toolbar"><label>Upplösning <select id="vaultQuality" aria-label="Texturupplösning"><option value="128">128 · Snabb mobil</option><option value="256" selected>256 · Balanserad</option><option value="512">512 · Detaljerad</option><option value="1024">1024 · Hög kvalitet</option></select></label><span id="vaultCount" aria-live="polite">360 material</span></div>',
  '<div id="vaultGrid" class="vault-grid" role="group" aria-label="Materialarkiv"></div>',
  '<button id="vaultMore" class="vault-more" type="button">Visa fler material</button>',
  '<div class="vault-selected"><strong id="vaultSelectedName">Välj ett material</strong><span id="vaultSelectedInfo">Förhandsgranskning och PBR-kartor skapas lokalt.</span>',
  '<div class="vault-preview"><canvas id="vaultPreview" width="128" height="128" aria-label="Förhandsvisning av vald materialtextur"></canvas><div class="vault-sample"><span>PBR</span><small>Albedo · Normal · ORM</small></div></div>',
  '<div class="vault-actions"><button id="vaultApply" class="accent" disabled>🎨 Applicera på modellen</button><button id="vaultDownload" disabled>⬇ Hämta PBR-texturer (.zip)</button></div>',
  '<p id="vaultStatus" class="hint" role="status">Markera en modell och välj ett material ovan.</p></div>'
 ].join("");
 host.append(panel);
 const nodes=id=>panel.querySelector("#"+id);
 for(const category of VAULT_CATEGORIES){const option=document.createElement("option");option.value=option.textContent=category;nodes("vaultCategory").add(option)}
 let chosenId=null,shown=0,busy=false,selectedSet=new Set(),favorites=readFavorite();
 const pageSize=30;
 function saveFav(){try{localStorage.setItem(localKey,JSON.stringify([...favorites]))}catch{}}
 function status(message){nodes("vaultStatus").textContent=message;return message}
 function curFilter(){return filterVault({search:nodes("vaultSearch").value,category:nodes("vaultCategory").value,
   favorites:nodes("vaultFaves").checked?favorites:null,limit:pageSize,offset:shown});}
 function renderCard(p){
  const card=document.createElement("div");card.className="vault-card";card.dataset.vaultId=p.id;
  const b=document.createElement("button");b.type="button";b.className="vault-pick";
  b.title=p.label;b.setAttribute("aria-pressed",String(chosenId===p.id));
  const thumb=document.createElement("canvas");thumb.width=thumb.height=56;thumb.setAttribute("aria-hidden","true");
  const label=document.createElement("span");label.textContent=p.label;b.append(thumb,label);
  b.onclick=()=>choose(p.id);
  const fav=document.createElement("button");fav.type="button";fav.className="vault-favorite";
  fav.setAttribute("aria-label","Favoritmarkera "+p.label);fav.title="Favorit";
  fav.textContent=favorites.has(p.id)?"★":"☆";
  fav.setAttribute("aria-pressed",String(favorites.has(p.id)));
  fav.onclick=()=>{
   if(favorites.has(p.id))favorites.delete(p.id);else favorites.add(p.id);
   saveFav();fav.textContent=favorites.has(p.id)?"★":"☆";
   fav.setAttribute("aria-pressed",String(favorites.has(p.id)));
   if(nodes("vaultFaves").checked)refresh();
  };
  card.append(b,fav);
  // Cheap ~3,000-pixel thumbnail, generated once when card is added; not a 512 texture.
  const preview=generateVaultPixels(p.id,64);
  thumb.getContext("2d").putImageData(new ImageData(preview.color,64,64),0,0);
  return card;
 }
 function refresh(append=false){
  if(!append){shown=0;nodes("vaultGrid").replaceChildren()}
  const page=curFilter();
  for(const p of page.items)nodes("vaultGrid").append(renderCard(p));
  shown+=page.items.length;
  const total=filterVault({search:nodes("vaultSearch").value,category:nodes("vaultCategory").value,
    favorites:nodes("vaultFaves").checked?favorites:null,limit:0}).count;
  nodes("vaultCount").textContent=shown+" / "+total+" material";
  nodes("vaultMore").hidden=shown>=total;
  if(total===0)nodes("vaultGrid").textContent="Inga material matchade sökningen.";
 }
 function choose(id){
  const p=getVaultPreset(id);if(!p)return;
  chosenId=id;
  for(const card of nodes("vaultGrid").querySelectorAll(".vault-card")){
   card.querySelector(".vault-pick").setAttribute("aria-pressed",String(card.dataset.vaultId===id));
  }
  nodes("vaultSelectedName").textContent=p.label;
  nodes("vaultSelectedInfo").textContent=p.category+" • "+Math.round(p.roughness*100)+" % roughness • "+Math.round(p.metalness*100)+" % metallic";
  const preview=generateVaultPixels(id,128);
  nodes("vaultPreview").getContext("2d").putImageData(new ImageData(preview.color,128,128),0,0);
  nodes("vaultDownload").disabled=false;
  selectionChanged();
  status(p.label+" klar för applicering. Du kan också hämta texturerna som ZIP.");
 }
 function targets(){
  const root=getSelected(),out=[];
  root?.traverse(o=>{if(o.isMesh&&o.visible&&o.geometry)out.push(o)});
  return out;
 }
 function updateSelection(){
  nodes("vaultApply").disabled=!chosenId||targets().length===0||busy;
 }
 async function work(action){
  if(busy||!chosenId)return;
  busy=true;nodes("vaultApply").disabled=true;nodes("vaultDownload").disabled=true;
  try{await action()}
  catch(e){console.error(e);status("Materialfel: "+e.message);notify(e.message,5500)}
  finally{busy=false;nodes("vaultDownload").disabled=!chosenId;updateSelection()}
 }
 function tex(pixels,n,name,srgb,repeat){
  return canvasTexture(pixels,n,name,srgb,repeat);
 }
 async function apply(){
  await work(async()=>{
   const meshes=targets();if(!meshes.length)throw Error("Markera först en modell eller mesh.");
   const p=getVaultPreset(chosenId),size=Number(nodes("vaultQuality").value);
   status("Bygger "+size+"×"+size+" PBR-texturer lokalt …");
   // Promise yield keeps the status visible before synchronous pixel generation.
   await new Promise(r=>requestAnimationFrame(r));
   const pixel=generateVaultPixels(p.id,size);
   const tile=Math.max(.5,Math.min(12,Number($("surfaceTile")?.value)||2));
   const map=tex(pixel.color,size,p.label+" · baseColor",true,tile);
   const normalMap=tex(pixel.normal,size,p.label+" · tangent +Y",false,tile);
   const packed=tex(pixel.orm,size,p.label+" · occlusion-roughness-metallic",false,tile);
   // glTF packs roughness in G, metallic in B. Factors must be 1 to respect texture values.
   const material=new THREE.MeshStandardMaterial({name:"DuoForge Vault / "+p.label,
    color:0xffffff,map,normalMap,roughnessMap:packed,metalnessMap:packed,
    roughness:1,metalness:1,normalScale:new THREE.Vector2(1,1)});
   material.userData={duoforgeVault:p.id,duoforgeVaultVersion:VAULT_VERSION,
    duoforgeVaultLicense:"DuoForge original procedural maps",
    duoforgeVaultChannels:"baseColor + tangent normal + packed ORM (R=AO, G=roughness, B=metallic)"};
   const valid=meshes.filter(m=>m.geometry?.attributes?.position);
   if(!valid.length)throw Error("Modellen saknar användbara meshar.");
   pushHistory();
   let changed=0;
   for(const mesh of valid){
    if(!safeUV(mesh))continue;
    mesh.material=material;changed++;
   }
   if(changed===0)throw Error("Kunde inte skapa UV på någon mesh.");
   dirty();refreshTree();updateInspector();selectionChanged();
   status("Klart! "+changed+"/"+valid.length+" meshar fick "+p.label+
     " med riktiga PBR-kartor. Exportera GLB från toppmenyn.");
   notify("PBR-material applicerat på "+changed+" meshar.",3800);
  });
 }
 async function download(){
  await work(async()=>{
   const p=getVaultPreset(chosenId),size=Number(nodes("vaultQuality").value);
   status("Skapar "+p.label+" · ZIP med tre PBR-kartor …");
   await new Promise(r=>requestAnimationFrame(r));
   const data=generateVaultPixels(p.id,size);
   const [albedo,normal,orm]=await Promise.all([
    pngBuffer(data.color,size),pngBuffer(data.normal,size),pngBuffer(data.orm,size)]);
   const info={
    id:p.id,name:p.label,license:p.license,resolution:size,tiling:true,
    maps:{"basecolor.png":"sRGB RGB","normal.png":"linear +Y tangent RGB",
      "orm.png":"linear R=occlusion G=roughness B=metallic"},
    note:"Original procedurtextur från DuoForge. Normals och ORM är datatexturer (ej sRGB)."
   };
   const json=new TextEncoder().encode(JSON.stringify(info,null,2)+"\n");
   const archive=buildVaultZip([
    {name:"basecolor.png",bytes:albedo},{name:"normal.png",bytes:normal},
    {name:"orm.png",bytes:orm},{name:"material.json",bytes:json}]);
   down("duoforge-pbr-"+p.id+"-"+size+".zip",archive);
   status("Nedladdat: "+p.label+" · Base Color, Normal, ORM och manifest.");
  });
 }
 nodes("vaultSearch").oninput=()=>refresh();
 nodes("vaultCategory").onchange=()=>refresh();
 nodes("vaultFaves").onchange=()=>refresh();
 nodes("vaultMore").onclick=()=>refresh(true);
 nodes("vaultApply").onclick=apply;
 nodes("vaultDownload").onclick=download;
 refresh();
 return {selectionChanged:updateSelection};
}
