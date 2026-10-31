/**
 * DuoForge Magic Builder — conservative, user-attested asset licensing.
 * Source cards do NOT grant rights to arbitrary uploaded files.
 * No external assets are fetched or redistributed by this module.
 */
export const CREATOR_SOURCES=Object.freeze([
 Object.freeze({id:"kenney",name:"Kenney",category:"Natur, byggdelar, spelobjekt",
  home:"https://kenney.nl/assets",license:"https://kenney.nl/support",
  donate:"https://kenney.nl/donate",credit:"Kenney",spdx:"CC0-1.0"}),
 Object.freeze({id:"kaykit-dungeon",name:"KayKit – Dungeon Remastered",category:"Banor, väggar, grottor",
  home:"https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0",
  license:"https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0/blob/main/LICENSE.txt",
  donate:"https://www.patreon.com/kaylousberg",credit:"Kay Lousberg (KayKit)",spdx:"CC0-1.0"}),
 Object.freeze({id:"kaykit-characters",name:"KayKit – Adventurers",category:"Riggade spelkaraktärer",
  home:"https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0",
  license:"https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/blob/main/LICENSE.txt",
  donate:"https://www.patreon.com/kaylousberg",credit:"Kay Lousberg (KayKit)",spdx:"CC0-1.0"}),
 Object.freeze({id:"polyhaven",name:"Poly Haven",category:"PBR, HDRI och 3D-modeller",
  home:"https://polyhaven.com/models",license:"https://polyhaven.com/license",
  donate:"https://polyhaven.com/donate",credit:"Poly Haven och ursprunglig modellskapare",spdx:"CC0-1.0"})
]);
const BY_ID=new Map(CREATOR_SOURCES.map(x=>[x.id,x]));
const MAX_GLB_BYTES=8*1024*1024;
export const MAX_ASSETS=6;
const text=(x,max=160)=>String(x??"").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,max);
function httpsUrl(value){
 try {const u=new URL(String(value||"")); if(u.protocol!=="https:"||u.username||u.password) return null; return u.href;}
 catch{return null;}
}
export function assertSafeGlb(input){
 const data=input instanceof Uint8Array?input:new Uint8Array(input);
 if(data.length<32||data.length>MAX_GLB_BYTES)throw Error("GLB måste vara 32 byte–8 MB.");
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==data.length)
  throw Error("Endast kompletta binära glTF 2.0-filer (.glb) stöds.");
 const jsonSize=v.getUint32(12,true);
 if(jsonSize<10||jsonSize>1_000_000||jsonSize%4!==0||20+jsonSize>data.length||
    v.getUint32(16,true)!==0x4e4f534a)throw Error("Ogiltig GLB JSON-sektion.");
 let gltf;
 try{gltf=JSON.parse(new TextDecoder().decode(data.subarray(20,20+jsonSize)));}
 catch{throw Error("Ogiltigt glTF-innehåll.");}
 if(gltf?.asset?.version!=="2.0"||!Array.isArray(gltf.meshes)||!gltf.meshes.length)
  throw Error("GLB saknar giltig glTF 2.0-geometri.");
 // Fail closed: reject remote dependencies, even if embedded in extension metadata.
 const check=(obj)=>{
  if(!obj||typeof obj!=="object")return;
  for(const [k,value] of Object.entries(obj)){
   if((k==="uri"||k==="url")&&typeof value==="string"&&!/^data:image\/(png|jpeg|webp);base64,/i.test(value))
    throw Error("Modellen länkar till externa resurser. Exportera en självständig GLB med inbäddade texturer.");
   if(value&&typeof value==="object")check(value);
  }
 };
 check(gltf);
 if((gltf.extensionsRequired||[]).some(x=>/KHR_draco_mesh_compression|EXT_meshopt_compression|KHR_texture_basisu/.test(x)))
  throw Error("Den här komprimeringen kräver särskilda dekodrar; exportera en vanlig GLB.");
 return {bytes:data,meshes:gltf.meshes.length};
}
export function acceptAssetProvenance({sourceId,assetSourceUrl,rightsConfirmed,name}={}){
 const label=text(name,90);
 if(!label)throw Error("Modellen måste ha ett namn.");
 if(rightsConfirmed!==true)throw Error("Bekräfta att du har rätt att använda och dela modellen.");
 if(sourceId==="own"){
  return Object.freeze({name:label,creator:"Eget originalverk (uppladdarens intyg)",
   sourceUrl:"",license:"OWNER-ATTESTED",licenseUrl:"",donateUrl:"",
   declaration:"Uppladdaren intygar att modellen är ett originalverk och att delning är tillåten."});
 }
 const source=BY_ID.get(sourceId);
 if(!source)throw Error("Okänd källa: modellen blockeras tills rättigheterna kontrollerats.");
 const assetUrl=httpsUrl(assetSourceUrl);
 if(!assetUrl)throw Error("Ange en HTTPS-länk till just den modell eller det källpaket som filen kommer från.");
 const sourceHost=new URL(source.home).hostname;
 const host=new URL(assetUrl).hostname;
 const urlPath=new URL(assetUrl).pathname;
 const permitted=sourceId==="kenney"?
   (host==="kenney.nl"||host==="www.kenney.nl")&&urlPath.startsWith("/assets/")&&urlPath.length>"/assets/".length:
   sourceId.startsWith("kaykit")?
    (host==="github.com"&&urlPath.startsWith(new URL(source.home).pathname))||
    (host==="kaylousberg.itch.io"&&urlPath.length>1):
    (host==="polyhaven.com"||host==="www.polyhaven.com")&&urlPath.startsWith("/a/")&&urlPath.length>3;
 if(!permitted)throw Error("Länken matchar inte skaparen/källpaketet. Kontakta projektägaren för manuell licensgranskning.");
 return Object.freeze({name:label,creator:source.credit,sourceUrl:assetUrl,license:"CC0-1.0",
  licenseUrl:source.license,donateUrl:source.donate,
  declaration:"Uppladdaren intygar att filen tillhör den utvalda CC0-källan och inte är ett betalt eller separat licensierat tillägg."});
}
export function cleanPlacement(input={}){
 const limit=(x,min,max,fallback)=>Number.isFinite(Number(x))?Math.max(min,Math.min(max,Number(x))):fallback;
 return {x:limit(input.x,-8,8,3),z:limit(input.z,-8,8,2),
  scale:limit(input.scale,.15,8,1),rotation:limit(input.rotation,-180,180,0)};
}
export function safeAssetFile(id){
 if(!/^[a-z0-9-]{1,45}$/i.test(String(id||"")))throw Error("Ogiltigt modell-ID.");
 return "assets/"+id+".glb";
}
export function publicAssetRecord(asset){
 const {bytes,...rest}=asset;
 return {...rest,placement:cleanPlacement(rest.placement),file:safeAssetFile(rest.id)};
}
export function creditsText(assets=[]){
 const rows=[
 "# DuoForge – skaparkrediter och materialkällor","",
 "Krediterna är alltid synliga även när en licens inte kräver namnangivelse.",
 "Donationer är frivilliga, går direkt till upphovspersonen och påverkar inte licensen.","",
 "## Teknik", "",
 "- three.js – https://threejs.org/ – MIT. Biblioteket laddas separat via CDN.",
 "- DuoForge Game Builder – egen projektkod. Separata tredjepartsbibliotek har egna villkor.","",
 "## Modeller i detta spel", ""
 ];
 if(!assets.length)rows.push("Inga externa GLB-modeller tillagda.");
 for(const a of assets){
  const record=publicAssetRecord(a);
  rows.push("### "+record.name,"",
   "- Skapare: "+record.creator,
   "- Licens/rättighetsintyg: "+record.license,
   "- Källa: "+(record.sourceUrl||"Uppladdarens egna original"),
   "- Licensunderlag: "+(record.licenseUrl||"Uppladdarens originalverksintyg"),
   "- Stöd skaparen: "+(record.donateUrl||"Ingen bekräftad donationslänk"),
   "- Intyg: "+record.declaration,"");
 }
 rows.push("## Viktigt","",
  "DuoForge verifierar inte automatiskt att uppladdaren äger en fil eller att den överensstämmer med angiven källa.",
  "Vid osäker licens, varumärken, porträtt eller tredjepartsupphovsrätt: publicera inte modellen.",
  "Avaktivera/publicera inte vidare om upphovspersonen anmäler ett rättighetsproblem.","");
 return rows.join("\n");
}
