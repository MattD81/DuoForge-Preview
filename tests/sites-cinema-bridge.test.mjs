import test from "node:test";
import assert from "node:assert/strict";
import {
 BRIDGE_PROTOCOL,TRUSTED_SITES_ORIGINS,STUDIO_ACTIONS,
 trustedSitesOrigin,normalizeBridgeOcean,validateBridgeGLB,initSitesStudioBridge
} from "../workshop/studio/sites-cinema-bridge.mjs";

test("Sites embed is limited to the configured, verified DuoForge host",()=>{
 assert.equal(trustedSitesOrigin(TRUSTED_SITES_ORIGINS[0]),true);
 assert.equal(trustedSitesOrigin("https://attacker.example"),false);
 assert.equal(trustedSitesOrigin("https://duoforge-gaming.cuddlyelk8.chatgpt.site.attacker.test"),false);
 assert.equal(trustedSitesOrigin("http://127.0.0.1:8080"),false);
 assert.equal(trustedSitesOrigin("http://127.0.0.1:8080",{allowLocalhost:true}),true);
 assert.ok(STUDIO_ACTIONS.includes("IMPORT_GLB"));
});
test("Cinema config accepts only constrained wave and whitecap settings",()=>{
 assert.deepEqual(normalizeBridgeOcean({weather:"storm-sunset",whitecaps:0,height:1.35}),
  {height:1.35,whitecaps:0,weather:"storm-sunset"});
 assert.throws(()=>normalizeBridgeOcean({whitecaps:Infinity}),/Otillåtet/);
 assert.throws(()=>normalizeBridgeOcean({weather:"extreme"}),/Okänt väderläge/);
 assert.throws(()=>normalizeBridgeOcean({whitecaps:-1}),/Otillåtet/);
});
test("GLB input must be valid v2, exact length and bounded size",()=>{
 const raw=new ArrayBuffer(20),v=new DataView(raw);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,20,true);
 assert.equal(validateBridgeGLB(raw),true);
 v.setUint32(8,21,true);assert.throws(()=>validateBridgeGLB(raw),/header/);
 assert.throws(()=>validateBridgeGLB({}),/GLB/);
});
test("postMessage bridge does not accept commands from other origins or frames",async()=>{
 const allowed=TRUSTED_SITES_ORIGINS[0];
 const outgoing=[],listeners=new Map();
 const parent={postMessage(message,origin){outgoing.push({message,origin})}};
 const win={
  parent,location:{href:"https://mattd81.github.io/DuoForge-Preview/workshop/studio/?world=ocean&embed=1&parentOrigin="+encodeURIComponent(allowed)},
  addEventListener(key,fn){listeners.set(key,fn)},
  removeEventListener(key){listeners.delete(key)}
 };
 const called={imported:[],ocean:[],opened:0};
 const bridge=initSitesStudioBridge({win,
  importGLB:async(file,name)=>called.imported.push({name,size:file.size}),
  openCinema:()=>{called.opened++},
  setOcean:settings=>called.ocean.push(settings)
 });
 assert.equal(bridge.enabled,true);
 assert.equal(outgoing[0].message.type,"READY");
 assert.equal(outgoing[0].origin,allowed);
 const event=async(action,origin=allowed,source=parent,fields={})=>{
  await listeners.get("message")({origin,source,data:{
   protocol:BRIDGE_PROTOCOL,type:"COMMAND",action,requestId:"test-1",...fields
  }});
 };
 await event("OPEN_CINEMA","https://evil.example");assert.equal(called.opened,0);
 await event("OPEN_CINEMA",allowed,{});assert.equal(called.opened,0);
 await event("SET_OCEAN",allowed,parent,{settings:{weather:"storm-sunset",whitecaps:0}});
 assert.deepEqual(called.ocean,[{whitecaps:0,weather:"storm-sunset"}]);
 await event("OPEN_CINEMA");assert.equal(called.opened,1);
 const raw=new ArrayBuffer(20),v=new DataView(raw);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,20,true);
 await event("IMPORT_GLB",allowed,parent,{name:"fartyg.glb",buffer:raw});
 assert.deepEqual(called.imported,[{name:"fartyg",size:20}]);
 assert.equal(outgoing.at(-1).message.ok,true);
 bridge.dispose();assert.equal(listeners.has("message"),false);
});
