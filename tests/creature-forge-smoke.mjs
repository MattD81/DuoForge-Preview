import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

// Served from repo root (python -m http.server 8080).
const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--enable-webgl","--disable-gpu-sandbox"
]});
const errors=[];
function jsonOfGLB(buffer){
 assert.equal(buffer.subarray(0,4).toString(),"glTF");
 assert.equal(buffer.readUInt32LE(4),2);
 const size=buffer.readUInt32LE(12);
 assert.equal(buffer.subarray(16,20).toString(),"JSON");
 return JSON.parse(buffer.subarray(20,20+size).toString());
}
try {
 const page=await browser.newPage({viewport:{width:1450,height:930},acceptDownloads:true});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForSelector("#creatureCreate",{timeout:30000});
 assert.equal(await page.locator("#creatureType option").count(),4);
 for(const [i,id] of ["castle","brute","forest","serpent"].entries()){
  await page.locator("#creatureType").selectOption(id);
  await page.locator("#creatureDetail").selectOption(i===3?"3":"2");
  await page.locator("#creatureCreate").click();
  await page.waitForFunction(n=>Number(document.querySelector("#objectCount")?.textContent)>=n,i+2);
  assert.match(await page.locator("#creatureStatus").innerText(),/GLB-klipp/);
  assert.ok(await page.locator("#creatureMotion option").count()>=3);
  const [dl]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
  const gltf=jsonOfGLB(readFileSync(await dl.path()));
  assert.ok(gltf.meshes?.length>=i+8,id+" must export geometry");
  assert.ok(gltf.skins?.length>=i+2,id+" must export skinned meshes");
  assert.ok(gltf.animations?.length>=3+i*2,id+" must export bone animations");
  assert.ok(gltf.materials?.some(m=>m.pbrMetallicRoughness),id+" must export PBR");
  assert.ok(gltf.textures?.length>0,id+" must include real textures");
  console.log("PASS:",id,"skins",gltf.skins.length,"animations",gltf.animations.length);
 }
 await page.locator("#creatureMotion").selectOption("Slither");
 await page.waitForTimeout(120);
 assert.equal(await page.locator("#creatureStop").isDisabled(),false);
 await page.locator("#creatureStop").click();
 assert.equal(await page.locator("#creatureStop").isDisabled(),true);
 const count=Number(await page.locator("#objectCount").innerText());
 await page.locator("#undo").click();
 await page.waitForFunction(expected=>Number(document.querySelector("#objectCount")?.textContent)===expected,count-1);
 await page.locator("#redo").click();
 await page.waitForFunction(expected=>Number(document.querySelector("#objectCount")?.textContent)===expected,count);
 const [redoDL]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
 const redoGLB=jsonOfGLB(readFileSync(await redoDL.path()));
 assert.ok(redoGLB.skins?.length>=13,"undo/redo must keep skinned bind targets");
 assert.ok(redoGLB.animations?.length>=11,"undo/redo must keep animation tracks");
 console.log("PASS: animated GLB, player, undo/redo rig preservation");
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 mobile.on("pageerror",e=>errors.push(e.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForSelector("#creatureCreate",{timeout:30000});
 await mobile.locator("#creaturePrompt").fill("en mossig skogsväktare");
 await mobile.locator("#creatureCreate").click();
 await mobile.waitForFunction(()=>Number(document.querySelector("#objectCount")?.textContent)>=2);
 assert.equal(await mobile.locator("#creatureType").inputValue(),"forest");
 console.log("PASS: mobile 1-click with deterministic prompt routing");
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
