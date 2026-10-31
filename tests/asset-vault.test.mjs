import test from "node:test";
import assert from "node:assert/strict";
import {validateGLB, cleanAssetName, MAX_VAULT_BYTES} from "../workshop/studio/asset-vault.mjs";

function header(size, magic=0x46546c67, version=2) {
 const bytes = new Uint8Array(size);
 const v = new DataView(bytes.buffer);
 v.setUint32(0, magic, true);v.setUint32(4, version, true);v.setUint32(8, size, true);
 return new Blob([bytes], {type:"model/gltf-binary"});
}
test("correct GLB 2 header is accepted", async () => {
 await assert.doesNotReject(()=>validateGLB(header(20)));
});
test("invalid headers and lengths are rejected", async () => {
 await assert.rejects(()=>validateGLB(header(20,0)));
 await assert.rejects(()=>validateGLB(header(20,0x46546c67,1)));
 const wrong = new Uint8Array(20);
 new DataView(wrong.buffer).setUint32(0,0x46546c67,true);
 new DataView(wrong.buffer).setUint32(4,2,true);
 new DataView(wrong.buffer).setUint32(8,40,true);
 await assert.rejects(()=>validateGLB(new Blob([wrong])));
 await assert.rejects(()=>validateGLB(new Blob([new Uint8Array(8)])));
 await assert.rejects(()=>validateGLB({size:MAX_VAULT_BYTES+1}));
});
test("user-controlled names are bounded without HTML rendering",()=>{
 assert.equal(cleanAssetName("tree.glb"),"tree");
 assert.equal(cleanAssetName("  My model.GLB  "),"My model");
 assert.equal(cleanAssetName(""),"Min modell");
 assert.equal(cleanAssetName("x".repeat(200)).length,80);
});
