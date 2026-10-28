import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { makeCreativeManifest } from "../workshop/studio/creative-core.mjs";
import { attachCreativeAsset } from "../workshop/studio/creative-site-contract.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const model = new Uint8Array(12), dv = new DataView(model.buffer);
dv.setUint32(0,0x46546c67,true); dv.setUint32(4,2,true); dv.setUint32(8,12,true);
const hash = Buffer.from(await crypto.subtle.digest("SHA-256",model)).toString("hex");
const manifest = makeCreativeManifest({name:"Scene",hash,filename:"scene.glb"});

function adapters() {
  const calls = [];
  return {calls, args:{
    manifest,model,projectId:"project_1234",session:{id:"private"},
    authorize:async () => {calls.push("auth");return true;},
    findAsset:async () => {calls.push("lookup");return null;},
    storeAsset:async () => {calls.push("store");return {id:"asset_1"};},
    linkAsset:async () => {calls.push("link");}
  }};
}
test("rejects unauthorized import before storage", async()=>{
  const a=adapters();a.args.authorize=async()=>false;
  await assert.rejects(attachCreativeAsset(a.args),/behörighet/);
  assert.deepEqual(a.calls,[]);
});
test("rejects tampered GLB without linking", async()=>{
  const a=adapters();a.args.model=new Uint8Array(model);a.args.model[11]=9;
  await assert.rejects(attachCreativeAsset(a.args),/GLB|Kontrollsumman/);
  assert.deepEqual(a.calls,["auth"]);
});
test("new asset is uploaded only after SHA and authorization checks",async()=>{
  const a=adapters();const r=await attachCreativeAsset(a.args);
  assert.equal(r.reused,false);assert.equal(r.assetId,"asset_1");
  assert.deepEqual(a.calls,["auth","lookup","store","link"]);
});
test("matching existing asset is reused without re-upload",async()=>{
  const a=adapters();a.args.findAsset=async()=>{a.calls.push("lookup");return {id:"asset_saved"};};
  const r=await attachCreativeAsset(a.args);
  assert.equal(r.reused,true);assert.equal(r.assetId,"asset_saved");
  assert.deepEqual(a.calls,["auth","lookup","link"]);
});
