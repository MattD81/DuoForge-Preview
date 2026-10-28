import test from "node:test";
import assert from "node:assert/strict";
import {FrameZip} from "../workshop/studio/cinema-production.mjs";
import {parseDuoForgeZip,readFrameParts} from "../workshop/studio/cinema-video-assembly.mjs";
function png(w=32,h=18){
 const b=new Uint8Array(28);
 b.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
 const view=new DataView(b.buffer);
 view.setUint32(16,w);view.setUint32(20,h);return b;
}
async function build(start,end,fps=24){
 const zip=new FrameZip();
 for(let k=start;k<end;k++)await zip.add("frame_"+String(k).padStart(6,"0")+".png",new Blob([png()]));
 await zip.add("manifest.json",new Blob([JSON.stringify({
  format:"duoforge-path-film@1",fps,width:32,height:18,start,end,total:6
 })]));
 return zip.finish();
}
test("path traced frame ZIPs can be re-imported and sorted before local video coding",async()=>{
 const one=await build(0,2),two=await build(2,3);
 const part=parseDuoForgeZip(new Uint8Array(await one.arrayBuffer()));
 assert.equal(part.manifest.fps,24);
 assert.equal(part.entries.size,3);
 const frames=await readFrameParts([two,one]);
 assert.equal(frames.count,3);assert.equal(frames.start,0);
 assert.equal(frames.fps,24);assert.equal(frames.width,32);
 assert.equal(frames.frames[0].type,"image/png");
});
test("video assembler refuses missing frame parts, invalid manifests and duplicates",async()=>{
 const first=await build(0,2),skip=await build(3,4);
 await assert.rejects(()=>readFrameParts([first,skip]),/Saknade bildrutor/);
 await assert.rejects(()=>readFrameParts([first,first]),/finns i flera/);
 const invalid=new Blob([new Uint8Array([0,1,2])]);
 assert.throws(()=>parseDuoForgeZip(new Uint8Array([0,1,2])),/manifest/);
 await assert.rejects(()=>readFrameParts([invalid]),/manifest/);
});
