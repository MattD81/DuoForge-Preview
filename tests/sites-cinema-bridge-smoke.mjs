import assert from "node:assert/strict";
import {chromium} from "playwright";

// Minimum valid GLB v2 with one triangle. No archive/model server required.
function tinyGLB(){
 const json={
  asset:{version:"2.0"},scene:0,scenes:[{nodes:[0]}],
  nodes:[{name:"Bridge Test Ship",mesh:0}],
  meshes:[{primitives:[{attributes:{POSITION:0},mode:4}]}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:"VEC3",min:[0,0,0],max:[1,1,0]}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:36,target:34962}],
  buffers:[{byteLength:36}]
 };
 const text=Buffer.from(JSON.stringify(json));
 const pad=(4-text.length%4)%4;
 const body=Buffer.concat([text,Buffer.alloc(pad,32)]);
 const pos=Buffer.alloc(36);
 new Float32Array(pos.buffer,pos.byteOffset,9).set([0,0,0,1,0,0,0,1,0]);
 const file=Buffer.alloc(12+8+body.length+8+pos.length);
 file.writeUInt32LE(0x46546c67,0);file.writeUInt32LE(2,4);
 file.writeUInt32LE(file.length,8);file.writeUInt32LE(body.length,12);
 file.writeUInt32LE(0x4e4f534a,16);body.copy(file,20);
 const off=20+body.length;
 file.writeUInt32LE(pos.length,off);file.writeUInt32LE(0x004e4942,off+4);pos.copy(file,off+8);
 return [...file];
}
const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"
]});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const issues=[];
 page.on("pageerror",e=>issues.push(e.message));
 await page.goto("http://127.0.0.1:8080/",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>{
  window.__bridgeResult=[];
  window.addEventListener("message",e=>{
   if(e.source!==document.querySelector("#cinema-test")?.contentWindow||
      e.origin!==location.origin)return;
   if(e.data?.protocol==="duoforge-cinema-bridge@1")window.__bridgeResult.push(e.data);
  });
  const iframe=document.createElement("iframe");
  iframe.id="cinema-test";
  iframe.style.width="1100px";iframe.style.height="740px";
  iframe.src="/workshop/studio/?world=ocean&embed=1&parentOrigin="+encodeURIComponent(location.origin);
  document.body.append(iframe);
 });
 await page.waitForFunction(()=>window.__bridgeResult?.some(v=>v.type==="READY"),{timeout:45000});
 const frame=page.frameLocator("#cinema-test");
 assert.equal(await frame.locator("#oceanWeatherLive").count(),1);
 async function command(action,data={}){
  const id=String(Math.random()).slice(2);
  return page.evaluate(async({action,id,data})=>{
   const el=document.querySelector("#cinema-test");
   const buffer=data.payload?new Uint8Array(data.payload).buffer:null;
   const target={protocol:"duoforge-cinema-bridge@1",type:"COMMAND",action,requestId:id};
   if(action==="IMPORT_GLB"){target.name="Bridge Test Ship.glb";target.buffer=buffer;}
   if(action==="SET_OCEAN")target.settings={weather:"storm-sunset",whitecaps:0,height:1.05,speed:1.2};
   return new Promise((resolve,reject)=>{
    const handler=e=>{
     if(e.origin!==location.origin||e.source!==el.contentWindow)return;
     if(e.data?.protocol!=="duoforge-cinema-bridge@1"||e.data?.type!=="RESULT"||
        e.data?.requestId!==id)return;
     window.removeEventListener("message",handler);
     e.data.ok?resolve(e.data):reject(Error(e.data.error));
    };
    window.addEventListener("message",handler);
    el.contentWindow.postMessage(target,location.origin,buffer?[buffer]:[]);
    setTimeout(()=>{window.removeEventListener("message",handler);reject(Error("Studio bridge timed out: "+action));},20000);
   });
  },{action,id,data});
 }
 const result=await command("IMPORT_GLB",{payload:tinyGLB()});
 assert.equal(result.name,"Bridge Test Ship.glb");
 await command("SET_OCEAN");
 assert.equal(await frame.locator("#oceanWhitecapsLive").inputValue(),"0");
 assert.equal(await frame.locator("#oceanWeatherLive").inputValue(),"storm-sunset");
 await command("OPEN_CINEMA");
 await frame.locator("#filmStudioOverlay").waitFor({state:"visible",timeout:15000});
 assert.match(await frame.locator("#previewAssetName").textContent(),/Bridge Test Ship/);
 assert.deepEqual(issues,[],"Browser runtime errors should be absent");
 console.log("PASS: real production-shaped parent iframe imported GLB binary, selected it, changed zero-foam Ocean V7 and opened Cinema Core without Work");
}finally{await browser.close();}
