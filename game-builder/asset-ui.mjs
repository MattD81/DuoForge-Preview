import {CREATOR_SOURCES,MAX_ASSETS,assertSafeGlb,acceptAssetProvenance,cleanPlacement} from "./safe-assets.mjs";

/** Browser-only UI. Files are local and never uploaded. */
export function setupSafeAssetPanel({getAssets,onChange,onPlacement}){
 const $=id=>document.getElementById(id);
 const source=$("modelSource");
 const list=$("creatorList");
 for(const creator of CREATOR_SOURCES){
  const option=document.createElement("option");
  option.value=creator.id;option.textContent=creator.name+" · CC0";
  source.appendChild(option);
  const card=document.createElement("article");
  card.className="creator";
  const title=document.createElement("strong");title.textContent=creator.name;
  const category=document.createElement("span");category.textContent=creator.category+" · "+creator.spdx;
  const links=document.createElement("div");links.className="creator-links";
  for(const [label,url] of [["Originalkälla ↗",creator.home],["Licens ↗",creator.license],["Stöd skaparen ♥",creator.donate]]){
   const link=document.createElement("a");
   Object.assign(link,{href:url,target:"_blank",rel:"noopener noreferrer",textContent:label});
   links.appendChild(link);
  }
  card.append(title,category,links);list.appendChild(card);
 }
 function renderAssets(assets=getAssets()){
  const out=$("placedAssets");out.replaceChildren();
  if(!assets.length){out.textContent="Inga GLB-modeller tillagda ännu.";return;}
  for(const asset of assets){
   const box=document.createElement("div");box.className="asset-item";
   const title=document.createElement("strong");title.textContent=asset.name+" · "+asset.creator;
   const meta=document.createElement("small");meta.textContent=asset.license+" · "+(asset.sourceUrl||"eget originalverk");
   box.append(title,meta);
   for(const [key,label,min,max,step] of [
    ["scale","Storlek",.15,8,.05],["x","Höger/vänster",-8,8,.2],
    ["z","Fram/bak",-8,8,.2],["rotation","Rotation",-180,180,5]
   ]){
    const row=document.createElement("label");row.className="asset-range";
    const caption=document.createElement("span");caption.textContent=label;
    const slider=document.createElement("input");
    Object.assign(slider,{type:"range",min:String(min),max:String(max),step:String(step),value:String(asset.placement[key])});
    const output=document.createElement("output");output.textContent=slider.value;
    slider.addEventListener("input",()=>{
     asset.placement=cleanPlacement({...asset.placement,[key]:Number(slider.value)});
     output.textContent=slider.value;onPlacement(asset.id,asset.placement);
    });
    row.append(caption,slider,output);box.appendChild(row);
   }
   const remove=document.createElement("button");remove.type="button";
   remove.className="secondary";remove.textContent="Ta bort modell";
   remove.addEventListener("click",()=>onChange(getAssets().filter(x=>x.id!==asset.id)));
   box.appendChild(remove);out.appendChild(box);
  }
 }
 $("importGlb").addEventListener("click",async()=>{
  const feedback=$("assetsFeedback"),file=$("modelFile").files?.[0];
  const button=$("importGlb");button.disabled=true;
  try{
   if(getAssets().length>=MAX_ASSETS)throw Error("Max "+MAX_ASSETS+" GLB-modeller i mobilförhandsvisningen.");
   if(!file||!file.name.toLowerCase().endsWith(".glb"))throw Error("Välj en .glb-fil.");
   if(file.size>8*1024*1024)throw Error("Filen får vara högst 8 MB.");
   const provenance=acceptAssetProvenance({
    sourceId:source.value,assetSourceUrl:$("modelSourceUrl").value,
    rightsConfirmed:$("modelRights").checked,name:file.name.slice(0,-4)});
   const bytes=new Uint8Array(await file.arrayBuffer());assertSafeGlb(bytes);
   const asset={...provenance,id:"model-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),
    bytes,placement:cleanPlacement()};
   onChange([...getAssets(),asset]);
   feedback.textContent="GLB importerad lokalt. Rättighetsintyg och krediter följer spelets ZIP.";
   $("modelFile").value="";$("modelRights").checked=false;
  }catch(error){feedback.textContent="Modellen blockerades: "+String(error.message||error);}
  finally{button.disabled=false;}
 });
 renderAssets();
 return Object.freeze({renderAssets});
}
