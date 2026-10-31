import test from "node:test";
import assert from "node:assert/strict";
import {
 BRIDGE_PROTOCOL,TRUSTED_SITES_ORIGINS,STUDIO_ACTIONS,normalizeTextureOptions,initSitesStudioBridge
} from "../workshop/studio/sites-cinema-bridge.mjs";
test("OneClick options are strictly bounded and cannot force overwrite without opt in",()=>{
 assert.ok(STUDIO_ACTIONS.includes("TEXTURE_SELECTED"));
 assert.ok(STUDIO_ACTIONS.includes("EXPORT_GLB"));
 assert.deepEqual(normalizeTextureOptions({mode:"smart",resolution:256,seed:2,wear:4}),{
  mode:"smart",resolution:256,seed:2,wear:4,overwrite:false
 });
 assert.deepEqual(normalizeTextureOptions({}),{overwrite:false});
 assert.throws(()=>normalizeTextureOptions({resolution:4096}),/upplösning/);
 assert.throws(()=>normalizeTextureOptions({wear:35}),/texturvärde/);
 assert.throws(()=>normalizeTextureOptions({overwrite:"yes"}),/boolean/);
 assert.throws(()=>normalizeTextureOptions({token:"secret"}),/Okänd/);
});
test("Site bridge invokes real OneClick callback then exports only selected GLB via transferred buffer",async()=>{
 const origin=TRUSTED_SITES_ORIGINS[0],outgoing=[],listeners=new Map();
 const parent={postMessage(...args){outgoing.push(args)}};
 const win={parent,
  location:{href:"https://mattd81.github.io/DuoForge-Preview/workshop/studio/?embed=1&parentOrigin="+encodeURIComponent(origin)},
  addEventListener(name,fn){listeners.set(name,fn)},
  removeEventListener(name){listeners.delete(name)}
 };
 const glb=new ArrayBuffer(20),dv=new DataView(glb);
 dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,20,true);
 let textured=null;
 const bridge=initSitesStudioBridge({win,importGLB:async()=>{},
  openCinema:()=>{},setOcean:()=>{},
  textureSelected:async opts=>{textured=opts;return {changed:2,total:2}},
  exportGLB:async()=>new Blob([glb],{type:"model/gltf-binary"})
 });
 const event=async(action,originOverride=origin,opts={})=>listeners.get("message")({
  source:parent,origin:originOverride,
  data:{protocol:BRIDGE_PROTOCOL,type:"COMMAND",action,requestId:action,options:opts}
 });
 await event("TEXTURE_SELECTED","https://evil.example",{mode:"smart"});
 assert.equal(textured,null,"unknown origin cannot texture");
 await event("TEXTURE_SELECTED",origin,{mode:"smart",resolution:256});
 assert.deepEqual(textured,{mode:"smart",resolution:256,overwrite:false});
 assert.equal(outgoing.at(-1)[0].result.changed,2);
 await event("EXPORT_GLB");
 const returned=outgoing.at(-1)[0];
 assert.equal(returned.ok,true);
 assert.equal(returned.bytes,20);
 assert.ok(returned.buffer instanceof ArrayBuffer);
 assert.deepEqual(outgoing.at(-1)[2],[returned.buffer],"export response transfers ArrayBuffer");
 bridge.dispose();
});
