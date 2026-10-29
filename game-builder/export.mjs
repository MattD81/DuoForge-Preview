/** ZIP Store (method 0): dependency-free, standards-compliant archives. */
const encoder=new TextEncoder();
const u16=(v)=>[v&255,(v>>>8)&255],u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
const CRC_TABLE=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
export function crc32(bytes){let v=0xffffffff;for(const x of bytes)v=CRC_TABLE[(v^x)&255]^(v>>>8);return (v^0xffffffff)>>>0;}
export function zipStore(entries){
 if(!Array.isArray(entries)||entries.length===0||entries.length>64)throw Error("Oväntat antal ZIP-filer");
 const seen=new Set(),locals=[],centrals=[];let offset=0;
 for(const item of entries){
  const name=String(item.name||"").replaceAll("\\","/");
  if(!name||name.startsWith("/")||name.includes("..")||seen.has(name)||name.length>220)
   throw Error("Ogiltigt eller dubblerat ZIP-filnamn");
  seen.add(name);
  const fname=encoder.encode(name),data=item.data instanceof Uint8Array?item.data:encoder.encode(String(item.data??""));
  if(data.byteLength>10_000_000||fname.byteLength>300)throw Error("Filen är för stor");
  const crc=crc32(data),size=data.byteLength;
  const local=new Uint8Array([
   ...u32(0x04034b50),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),
   ...u32(crc),...u32(size),...u32(size),...u16(fname.length),...u16(0),...fname
  ]);
  locals.push(local,data);
  const central=new Uint8Array([
   ...u32(0x02014b50),...u16(20),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),
   ...u32(crc),...u32(size),...u32(size),...u16(fname.length),...u16(0),...u16(0),...u16(0),
   ...u16(0),...u32(0),...u32(offset),...fname
  ]);
  centrals.push(central);offset+=local.length+data.length;
 }
 const cdSize=centrals.reduce((s,a)=>s+a.length,0);
 const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),
  ...u16(entries.length),...u16(entries.length),...u32(cdSize),...u32(offset),...u16(0)]);
 const zip=new Uint8Array(offset+cdSize+end.length);let n=0;
 for(const part of [...locals,...centrals,end]){zip.set(part,n);n+=part.length;}
 return zip;
}
export const STANDALONE_HTML=`<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#101b2d"><title>Mitt DuoForge-spel</title>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/":"https://cdn.jsdelivr.net/npm/three@0.180.0/","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}</script>
<style>*{box-sizing:border-box}body{background:#0b1423;color:#f5faff;font:16px system-ui;margin:0}.hud{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 15px;flex-wrap:wrap;background:#17243c}#playArea{width:100%;height:min(70vh,750px);min-height:330px;position:relative;overflow:hidden;background:#13273d}canvas{width:100%;height:100%;display:block}.touch{display:flex;justify-content:space-between;align-items:end;gap:12px;padding:13px 14px;touch-action:manipulation}.pad{display:grid;grid-template-columns:repeat(3,48px);grid-template-rows:repeat(2,44px);gap:5px}.pad button:first-child{grid-column:2}.pad button:nth-child(2){grid-column:1}.pad button:nth-child(3){grid-column:2}.pad button:nth-child(4){grid-column:3}.actions{display:flex;flex-wrap:wrap;gap:9px;justify-content:end}button{background:#263f5e;color:white;border:1px solid #517391;border-radius:11px;padding:11px;min-height:44px;min-width:48px;font-weight:700;touch-action:none}.actions button:first-child{background:#257e72}.pressed,button:active{background:#35b99e}#status{color:#a8e3cc}#error{padding:12px;color:#ffb9ad}.help{padding:5px 14px;color:#abbdd2;font-size:13px}@media(min-width:900px){.touch{max-width:700px;margin:auto}}@media(max-width:380px){.pad{grid-template-columns:repeat(3,40px);gap:3px}.actions{gap:3px}.actions button{padding:8px;font-size:12px}}</style></head>
<body><header class="hud"><strong id="title">DuoForge Originals</strong><span id="status" aria-live="polite">Laddar spel…</span><button id="restart" type="button">↻ Starta om</button></header>
<main><div id="playArea" aria-label="Spelbar 3D-värld"></div><div id="controls" class="touch"><div class="pad" aria-label="Gå">
<button data-move="up" aria-label="Framåt">▲</button><button data-move="left" aria-label="Vänster">◀</button><button data-move="down" aria-label="Bakåt">▼</button><button data-move="right" aria-label="Höger">▶</button>
</div><div class="actions"><button data-action="jump">HOPP</button><button data-action="dash">DASH</button><button data-action="attack">⚔ ATTACK</button></div></div>
<p class="help">WASD / piltangenter · J attack · K dash · mellanslag hopp · mobil: knappar · ansluten gamepad: vänsterspak, A/B/X.</p>
<div id="error" role="alert"></div></main>
<script type="module">
import {startBuilderGame} from "./games/game-builder/runtime.mjs";
try{
 const response=await fetch("./project.json",{cache:"no-store"});
 if(!response.ok)throw Error("project.json kunde inte läsas. Starta med en lokal webbserver, inte file://.");
 const config=await response.json();
 document.title=config.title+" – DuoForge";document.getElementById("title").textContent="◈ "+config.title;
 const game=startBuilderGame({host:document.getElementById("playArea"),controls:document.getElementById("controls"),config,
  onState:s=>{document.getElementById("status").textContent="BANA "+Math.min(s.stage,s.levels)+"/"+s.levels+" • ♥ "+s.life+" • ✦ "+s.collected+"/"+s.target+" • "+s.notice;}});
 document.getElementById("restart").addEventListener("click",()=>game.restart());
}catch(error){document.getElementById("error").textContent="Spelstart misslyckades: "+String(error.message||error);}
</script></body></html>`;
export async function collectGameFiles(config,{fetcher=fetch,base=import.meta.url}={}){
 const files=[
  ["games/game-builder/runtime.mjs","./runtime.mjs"],
  ["games/game-builder/planner.mjs","./planner.mjs"],
  ["workshop/studio/gpu-deluxe.mjs","../workshop/studio/gpu-deluxe.mjs"],
  ["workshop/studio/ocean-water.mjs","../workshop/studio/ocean-water.mjs"],
  ["workshop/studio/ocean-spectrum.mjs","../workshop/studio/ocean-spectrum.mjs"],
  ["workshop/studio/atmosphere-scattering.mjs","../workshop/studio/atmosphere-scattering.mjs"]
 ];
 const sources=await Promise.all(files.map(async ([name,url])=>{
  const response=await fetcher(new URL(url,base));
  if(!response.ok)throw Error("Kunde inte inkludera källfil: "+name);
  let data=await response.text();
  // The runtime lives in /game-builder/ inside Preview but in
  // /games/game-builder/ inside exported ZIP. Preserve imports explicitly.
  if(name==="games/game-builder/runtime.mjs")
   data=data.replaceAll('from "../workshop/studio/','from "../../workshop/studio/');
  return {name,data};
 }));
 return [
  {name:"index.html",data:STANDALONE_HTML},
  {name:"project.json",data:JSON.stringify(config,null,2)+"\n"},
  {name:"package.json",data:JSON.stringify({name:"duoforge-builder-game",version:"1.0.0",
   type:"module",private:true,dependencies:{three:"0.180.0"}},null,2)+"\n"},
  {name:"README.md",data:"# "+config.title+"\n\nSkapat med DuoForge Intelligent Game Builder V1.\n"+
   "Starta via lokal HTTP-server (t.ex. python3 -m http.server 8000) och öppna index.html.\n"+
   "För att importera till DuoForge: lägg filerna i ett eget GitHub-spelprojekt och använd Utforska GitHub-spel.\n"+
   "Gratis WebGL/Three.js, inga betalda AI-API:er. Kräver internet för Three.js CDN.\n"+
   "Verklig spelkod finns under games/game-builder/ och delad Ocean Cinema-kod under workshop/studio/.\n"+
   "Skapande sker med regelbaserad prompttolkning, inte generativ AI.\n"},
  ...sources
 ];
}
export async function downloadGame(config,options={}){
 const files=await collectGameFiles(config,options),bytes=zipStore(files);
 const blob=new Blob([bytes],{type:"application/zip"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;
 a.download=String(config.title||"duoforge-spel").normalize("NFKD").replace(/[^a-zA-Z0-9-]+/g,"-").replace(/^-|-$/g,"").slice(0,52)+".zip";
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),45000);
 return {files:files.length,bytes:bytes.length,name:a.download};
}
