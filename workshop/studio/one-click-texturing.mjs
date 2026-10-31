// DuoForge: one-click procedural PBR texturing in the EXISTING 3D Studio.
// Original algorithms + existing Material Vault. No paid API, no external textures.
// Does not change other objects, imported texture maps (by default) or Sites data.
import * as THREE from "three";
import {generateVaultPixels} from "./pbr-vault-maps.mjs";
import {getVaultPreset} from "./pbr-vault-catalog.mjs";
import {VARIATION_SPACE,ONE_CLICK_VERSION,chooseKind,recipeForKind,validateOptions} from "./one-click-texturing-core.mjs";

const $=id=>document.getElementById(id);
const limit=(n,a=0,b=255)=>Math.max(a,Math.min(b,n));
const formatCount=n=>new Intl.NumberFormat("sv-SE").format(n);

function composeVariant(recipe,size){
 // Reuse the PBR Vault's true seamless tangent-normal / ORM generator; seed the
 // procedural synthesis, not an image shuffle, to make topology reproducible.
 const pixels=generateVaultPixels(recipe.id,size,{seed:recipe.seed});
 const palette=recipe.palette,wear=recipe.wear/15;
 // Palette changes color channels, weathering subtly affects surface energy and roughness.
 const angle=palette*Math.PI*2/16;
 const gains=palette===0?[1,1,1]:[1+.21*Math.cos(angle),1+.21*Math.sin(angle),1-.21*Math.cos(angle)];
 for(let i=0;i<pixels.color.length;i+=4){
  const occlusion=pixels.orm[i]/255;
  const localWeather=wear*(.4+.6*(1-occlusion));
  for(let channel=0;channel<3;channel++){
   pixels.color[i+channel]=limit(Math.round(pixels.color[i+channel]*gains[channel]*(1-localWeather*.23)));
  }
  pixels.orm[i+1]=limit(Math.round(pixels.orm[i+1]+localWeather*42));
  pixels.orm[i+2]=limit(Math.round(pixels.orm[i+2]*(1-localWeather*.19)));
 }
 return pixels;
}
function makeMap(data,size,name,srgb,repeat){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=size;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Canvas 2D stöds inte i denna webbläsare.");
 ctx.putImageData(new ImageData(data,size,size),0,0);
 const tex=new THREE.CanvasTexture(canvas);
 tex.name=name;tex.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.repeat.set(repeat,repeat);
 tex.anisotropy=4;tex.needsUpdate=true;
 return tex;
}
function createPbrMaterial(recipe,size){
 const preset=getVaultPreset(recipe.id);
 const px=composeVariant(recipe,size);
 const color=makeMap(px.color,size,"DuoForge OneClick / baseColor",true,recipe.repeat);
 const normal=makeMap(px.normal,size,"DuoForge OneClick / normal +Y",false,recipe.repeat);
 const orm=makeMap(px.orm,size,"DuoForge OneClick / ORM",false,recipe.repeat);
 // glTF metallicRoughness convention: G roughness, B metallic. Factor 1.
 const material=new THREE.MeshStandardMaterial({
  name:"DuoForge OneClick / "+preset.label,color:0xffffff,
  map:color,normalMap:normal,metalnessMap:orm,roughnessMap:orm,
  metalness:1,roughness:1,normalScale:new THREE.Vector2(1,1)
 });
 material.userData={
  duoforgeOneClick:recipe.key,duoforgeOneClickSchema:ONE_CLICK_VERSION,
  license:"Original DuoForge procedural maps. No third-party textures.",
  maps:"sRGB baseColor; tangent-space +Y normal; linear packed ORM",
  recipe:{id:recipe.id,seed:recipe.seed,palette:recipe.palette,wear:recipe.wear,tile:recipe.tileIndex}
 };
 return material;
}
function hasImportedTexture(mesh){
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 return materials.some(m=>(m?.map||m?.normalMap||m?.metalnessMap||m?.roughnessMap||m?.emissiveMap) &&
  !m?.userData?.duoforgeOneClick);
}
function toMeshes(selected){
 const out=[];
 selected?.traverse?.(obj=>{if(obj.isMesh&&obj.visible&&obj.geometry?.attributes?.position)out.push(obj)});
 return out;
}
function frame(){
 return new Promise(resolve=>{
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(resolve);
  else setTimeout(resolve,0);
 });
}
export function initOneClickTexturing({getSelected,pushHistory,dirty,refreshTree,updateInspector,safeUV,notify,selectionChanged,surfaceLibrary}){
 const host=$("materialLabPanel");if(!host||$("oneClickTexturing"))return null;
 const section=document.createElement("section");section.id="oneClickTexturing";section.className="one-click-texturing";
 section.innerHTML=[
  '<div class="section-heading"><h2>✨ 1-klick texturering</h2><span class="mini-pill">23,5 miljoner kombinationer</span></div>',
  '<p class="hint">Färdiga PBR-recept från vårt Material Vault. Identifierar modellens delar och skapar färg-, normal- och roughness/metallic-kartor på mobilen eller datorn. Varianter genereras vid behov – inte miljontals sparade filer.</p>',
  '<div class="one-click-grid">',
  '<label>Texturupplösning<select id="oneClickResolution"><option value="128">128 · lätt mobil</option><option value="256" selected>256 · balanserad</option><option value="512">512 · detalj</option><option value="1024">1024 · hög (stor modell kan nedskalas)</option></select></label>',
  '<label>Texturskala<select id="oneClickTile"><option value="0">0,5×</option><option value="1">1×</option><option value="2" selected>2×</option><option value="3">4×</option></select></label>',
  '<label>Variantfrö <input id="oneClickSeed" type="number" min="1" max="64" step="1" value="1"></label>',
  '<label>Färgvariation <input id="oneClickPalette" type="range" min="0" max="15" step="1" value="0"></label>',
  '<label>Åldrande/slitage <input id="oneClickWear" type="range" min="0" max="15" step="1" value="0"></label>',
  '</div>',
  '<label class="one-click-check"><input id="oneClickOverwrite" type="checkbox"> Ersätt även importerade texturer (aktivt val)</label>',
  '<div class="one-click-actions"><button class="accent" id="oneClickApply" disabled>✨ Texturera markerad modell</button><button id="oneClickShuffle">🎲 Ny variation</button></div>',
  '<div id="oneClickStatus" role="status" aria-live="polite">Markera hela modellen eller en enskild del i objektträdet.</div>',
  '<p class="hint">Urval: delnamn + enklare heuristik. Ingen bildigenkänning eller AI-gissning. UV-lösa meshar får begränsad plan UV-projicering från Material Lab.</p>'
 ].join("");
 host.insertBefore(section,host.querySelector("#pbrVault"));
 const q=id=>section.querySelector("#"+id),button=q("oneClickApply"),status=q("oneClickStatus");
 const numberInput=q("oneClickSeed");
 let busy=false;
 function selectionUpdate(){button.disabled=busy||toMeshes(getSelected()).length===0}
 function updateStatus(text){status.textContent=text}
 function readOptions(){
  return validateOptions({resolution:Number(q("oneClickResolution").value),
   seed:Math.max(0,Number(numberInput.value)-1),
   palette:Number(q("oneClickPalette").value),wear:Number(q("oneClickWear").value),
   tile:Number(q("oneClickTile").value)});
 }
 q("oneClickShuffle").onclick=()=>{
  let seed=Math.floor(Math.random()*64)+1;
  if(seed===Number(numberInput.value))seed=(seed%64)+1;
  numberInput.value=String(seed);
  updateStatus("Ny variant "+seed+"/64 vald. Tryck Texturera markerad modell.");
 };
 async function apply(){
  if(busy)return;
  const meshes=toMeshes(getSelected());
  if(!meshes.length)return updateStatus("Markera en modell eller mesh först.");
  if(meshes.length>500)return updateStatus("Modellen har över 500 meshar. Välj mindre grupper för att skydda mobilens minne.");
  const overwrite=q("oneClickOverwrite").checked;
  const pending=meshes.filter(mesh=>overwrite||!hasImportedTexture(mesh));
  if(!pending.length){
   updateStatus("Alla "+meshes.length+" meshar har redan importerade texturer. Bocka i Ersätt om de ska skrivas över.");
   return;
  }
  busy=true;selectionUpdate();
  try{
   const settings=readOptions(),vehicle=/\b(vehicle|kart|car|bil|fordon|racer)\b/i.test(getSelected()?.name||"");
   const jobs=pending.map(mesh=>{
    const first=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    const kind=chooseKind({name:mesh.name,parent:mesh.parent?.name,vehicle,
     metalness:first?.metalness,color:first?.color?"#"+first.color.getHexString():""});
    return {mesh,kind,recipe:recipeForKind(kind,settings)};
   });
   const kinds=[...new Set(jobs.map(x=>x.kind))];
   // Downshift expensive runs before allocation. 1024 × 3 maps × many kinds
   // can exceed Safari's memory limit even when the GPU supports it.
   let size=settings.resolution;
   if(kinds.length>6&&size>256)size=256;
   if(kinds.length>12&&size>128)size=128;
   const materials=new Map();
   for(const [i,kind] of kinds.entries()){
    const job=jobs.find(x=>x.kind===kind);
    updateStatus("Genererar PBR "+(i+1)+"/"+kinds.length+" · "+kind+" · "+size+" px …");
    await frame();
    const mat=job.recipe.special
     ?surfaceLibrary.material(job.recipe.special)
     :createPbrMaterial(job.recipe,size);
    materials.set(kind,mat);
   }
   // Save state only after generation succeeds; history can restore old materials.
   pushHistory();
   let changed=0,skippedUV=0;
   for(const {mesh,kind} of jobs){
    if(kind!=="glass"&&kind!=="neon"&&!safeUV(mesh)){skippedUV++;continue}
    mesh.material=materials.get(kind);changed++;
   }
   if(changed){
    dirty();refreshTree();updateInspector();selectionChanged();
    const summary="Klart: "+changed+" av "+meshes.length+" meshar texturerade, "+
      kinds.length+" materialtyper · "+size+"px."+(
       skippedUV?" "+skippedUV+" utan UV hoppades över.":"")+
      (meshes.length-pending.length?" "+(meshes.length-pending.length)+" importerade texturer bevarades.":"");
    updateStatus(summary);notify("✨ 1-klick: "+changed+" meshar klara för GLB-export.",3800);
   }else updateStatus("Kunde inte skapa användbar UV på de markerade delarna.");
  }catch(error){
   console.error("DuoForge OneClick:",error);
   updateStatus("Texturering misslyckades: "+error.message);
   notify("Texturering misslyckades: "+error.message,5000);
  }finally{busy=false;selectionUpdate()}
 }
 button.onclick=apply;
 selectionUpdate();
 updateStatus("Välj objekt och klicka en gång. "+formatCount(VARIATION_SPACE)+" möjliga inställningskombinationer.");
 return {selectionChanged:selectionUpdate};
}
