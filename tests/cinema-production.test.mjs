import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCuts,movieDuration,locateCut,frameBatch,FrameZip} from "../workshop/studio/cinema-production.mjs";

test("editor scenes normalize safely and cut boundaries are deterministic",()=>{
 const raw=[{name:"Opening",shot:"orbit",duration:2,motion:"float"},{name:"Close up",shot:"dolly",duration:3,look:"noir",motion:"turn"}];
 const cuts=normalizeCuts(raw);
 assert.equal(cuts.length,2);assert.equal(movieDuration(cuts),5);
 assert.deepEqual([locateCut(cuts,0).index,locateCut(cuts,1.99).index,locateCut(cuts,2).index,locateCut(cuts,5).index],[0,0,1,1]);
 assert.ok(Math.abs(locateCut(cuts,2.75).progress-.25)<1e-8);
 assert.equal(locateCut(cuts,5).progress,1);
 assert.equal(normalizeCuts([{shot:"__hack",duration:999,motion:"__bad"}])[0].shot,"orbit");
 assert.throws(()=>locateCut([],1),/minst en scen/);
});
test("offline frame batches use exact movie timestamps and resume without duplicates",()=>{
 const a=frameBatch({duration:5,fps:24,start:0,count:48});
 const b=frameBatch({duration:5,fps:24,start:a.next,count:48});
 const c=frameBatch({duration:5,fps:24,start:b.next,count:48});
 assert.equal(a.total,120);assert.equal(a.frames.length,48);
 assert.equal(b.first,48);assert.equal(c.first,96);assert.equal(c.next,null);
 assert.equal(c.frames.at(-1).number,119);
 assert.ok(Math.abs(c.frames.at(-1).time-119/24)<1e-12);
 assert.ok(a.frames.every((f,i)=>i===0||f.time>a.frames[i-1].time));
});
test("ZIP writer emits standard readable uncompressed PNG names and manifest",async()=>{
 const zip=new FrameZip();
 await zip.add("frame_000000.png",new Blob([Uint8Array.from([137,80,78,71,0,1,2])]));
 await zip.add("manifest.json",new Blob([JSON.stringify({start:0,end:1})]));
 const buffer=new Uint8Array(await zip.finish().arrayBuffer());
 const view=new DataView(buffer.buffer);
 assert.equal(view.getUint32(0,true),0x04034b50);
 assert.equal(view.getUint32(buffer.length-22,true),0x06054b50);
 assert.equal(view.getUint16(buffer.length-22+10,true),2);
 const decoded=new TextDecoder().decode(buffer);
 assert.ok(decoded.includes("manifest.json"));
 assert.ok(decoded.includes("frame_000000.png"));
 await assert.rejects(()=>zip.add("../secret",new Blob([])),/filnamn/);
});
