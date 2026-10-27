// DuoForge Film Production: deterministic cut schedule and frame sequences.
// Pure utilities; no browser dependencies until an actual export is requested.
export const MOVIE_SHOTS=Object.freeze(["orbit","dolly","crane","flyover"]);
export const MOVIE_MOTIONS=Object.freeze(["still","turn","float","sway"]);
export const MOVIE_LOOKS=Object.freeze(["golden","studio","noir","natural","off"]);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function normalizeCuts(list){
 if(!Array.isArray(list))return [];
 return list.slice(0,12).filter(c=>c&&typeof c==="object").map((c,i)=>({
  name:String(c.name||"Scen "+(i+1)).slice(0,48),
  shot:MOVIE_SHOTS.includes(c.shot)?c.shot:"orbit",
  look:MOVIE_LOOKS.includes(c.look)?c.look:"golden",
  motion:MOVIE_MOTIONS.includes(c.motion)?c.motion:"still",
  duration:clamp(Number.isFinite(Number(c.duration))?Number(c.duration):4,1,30)
 }));
}
export function movieDuration(cuts){return normalizeCuts(cuts).reduce((n,c)=>n+c.duration,0)}
export function locateCut(list,seconds){
 const cuts=normalizeCuts(list);
 if(!cuts.length)throw Error("Lägg till minst en scen.");
 const total=cuts.reduce((n,c)=>n+c.duration,0);
 const t=clamp(Number.isFinite(Number(seconds))?Number(seconds):0,0,total);
 let begin=0;
 for(let i=0;i<cuts.length;i++){
  const cut=cuts[i],end=begin+cut.duration;
  if(t<end||i===cuts.length-1)
   return {cut,index:i,begin,end,total,localTime:t-begin,progress:clamp((t-begin)/cut.duration,0,1)};
  begin=end;
 }
 throw Error("Scenen kunde inte hittas.");
}
export function frameBatch({duration,fps=24,start=0,count=24,maxFrames=48}={}){
 const total=Math.max(1,Math.ceil(Math.max(0,Number(duration)||0)*fps));
 const first=clamp(Math.floor(Number(start)||0),0,total-1);
 const n=clamp(Math.floor(Number(count)||1),1,maxFrames);
 const frames=Array.from({length:Math.min(n,total-first)},(_,i)=>({
  number:first+i,time:(first+i)/fps
 }));
 return {total,first,end:first+frames.length,next:first+frames.length<total?first+frames.length:null,frames};
}
function crc32(input){
 if(!crc32.table)crc32.table=Uint32Array.from({length:256},(_,i)=>{
  let c=i;for(let j=0;j<8;j++)c=(c>>>1)^(c&1?0xedb88320:0);return c>>>0;
 });
 let crc=0xffffffff;
 for(const byte of input)crc=crc32.table[(crc^byte)&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}
const enc=new TextEncoder();
function header(len){return new DataView(new ArrayBuffer(len))}
function putText(dst,at,txt){new Uint8Array(dst.buffer,at,txt.length).set(txt)}
// ZIP store: PNG data is already compressed; avoid costly recompression.
export class FrameZip{
 constructor(){this.parts=[];this.directory=[];this.offset=0;this.count=0}
 async add(name,blob){
  if(this.count>=128)throw Error("Max 128 filer per ZIP-del.");
  if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(name))throw Error("Ogiltigt filnamn.");
  const bytes=blob instanceof Blob?new Uint8Array(await blob.arrayBuffer()):new Uint8Array(blob);
  const size=bytes.byteLength,n=enc.encode(name),crc=crc32(bytes);
  if(this.offset+size+n.length+128>=0xffffffff)throw Error("ZIP-delen är för stor.");
  const h=header(30);
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(8,0,true);
  h.setUint16(10,0,true);h.setUint16(12,0x0021,true);
  h.setUint32(14,crc,true);h.setUint32(18,size,true);h.setUint32(22,size,true);
  h.setUint16(26,n.length,true);h.setUint16(28,0,true);
  this.parts.push(h.buffer,n,blob instanceof Blob?blob:bytes);
  this.directory.push({name:n,size,crc,offset:this.offset});
  this.offset+=30+n.length+size;this.count++;
 }
 finish(){
  const directoryStart=this.offset;
  for(const item of this.directory){
   const h=header(46);
   h.setUint32(0,0x02014b50,true);h.setUint16(4,20,true);h.setUint16(6,20,true);
   h.setUint16(12,0,true);h.setUint16(14,0x0021,true);
   h.setUint32(16,item.crc,true);h.setUint32(20,item.size,true);
   h.setUint32(24,item.size,true);h.setUint16(28,item.name.length,true);
   h.setUint32(42,item.offset,true);
   this.parts.push(h.buffer,item.name);
   this.offset+=46+item.name.length;
  }
  const end=header(22);
  end.setUint32(0,0x06054b50,true);end.setUint16(8,this.count,true);
  end.setUint16(10,this.count,true);end.setUint32(12,this.offset-directoryStart,true);
  end.setUint32(16,directoryStart,true);
  this.parts.push(end.buffer);
  return new Blob(this.parts,{type:"application/zip"});
 }
}
