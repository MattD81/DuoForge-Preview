import test from "node:test";
import assert from "node:assert/strict";
import {validatePublicGlbUrl,readChatImportParams,sanitizeGlbName,buildChatImportLink,fetchPublicGlb} from "../chat-import-bridge.mjs";
const ORIGIN="https://mattd81.github.io";
const good=ORIGIN+"/DuoForge-Preview/workshop/models/gran.glb";
const raw="https://raw.githubusercontent.com/MattD81/DuoForge-Preview/main/workshop/models/gran.glb";
const glb=()=>{const b=new ArrayBuffer(20),d=new DataView(b);d.setUint32(0,0x46546c67,true);d.setUint32(4,2,true);d.setUint32(8,20,true);return new Blob([b])};
test("accepts DuoForge-owned public GLBs",()=>{
 assert.equal(validatePublicGlbUrl(good,ORIGIN),good);
 assert.equal(validatePublicGlbUrl(raw,ORIGIN),raw);
});
test("rejects unrelated, private and non-GLB URLs",()=>{
 for(const bad of ["http://mattd81.github.io/a.glb","https://evil.example/a.glb",
 "https://user:pass@mattd81.github.io/a.glb","https://mattd81.github.io/a.gltf",
 "https://mattd81.github.io/a.glb?token=abc",
 "https://raw.githubusercontent.com/other/repo/main/a.glb","sandbox:/mnt/data/a.glb"])
  assert.throws(()=>validatePublicGlbUrl(bad,ORIGIN));
});
test("creates the studio link with existing query parameters intact",()=>{
 const u=new URL(buildChatImportLink(ORIGIN+"/DuoForge-Preview/workshop/studio/?mode=mobile",good,"Gran"));
 assert.equal(u.searchParams.get("mode"),"mobile");
 assert.deepEqual(readChatImportParams(u.search),{url:good,name:"Gran"});
 assert.equal(readChatImportParams("?mode=mobile"),null);
 assert.equal(sanitizeGlbName("<Gran>!",good),"Gran");
});
test("validates header, rejects bogus data and oversized responses",async()=>{
 assert.equal((await fetchPublicGlb(good,{fetchImpl:async()=>new Response(glb())})).size,20);
 await assert.rejects(fetchPublicGlb(good,{fetchImpl:async()=>new Response("fake")}),/GLB/);
 await assert.rejects(fetchPublicGlb(good,{fetchImpl:async()=>new Response(null,{status:200,
  headers:{"content-length":String(51*1024*1024)}})}),/för stor/);
});
