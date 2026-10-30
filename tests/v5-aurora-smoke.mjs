/**
 * Real Chromium smoke test for the existing Studio's AURORA V5 deep-link.
 * We test the model, both responsive viewport sizes, and real GLB export.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--enable-webgl","--disable-gpu-sandbox"
]});
try{
 for(const size of [{width:1365,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport:size,deviceScaleFactor:1,acceptDownloads:true});
  const errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text())});
  await page.goto("http://127.0.0.1:8080/workshop/studio/?demo=v5-aurora",
   {waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#projectName")?.value.includes("AURORA V5")
   &&document.querySelector("#objectCount")?.textContent==="1",{timeout:60000});
  const stats=await page.locator("#sceneStats").textContent();
  const tris=Number(stats.match(/([\d\s.,]+)\s*trianglar/)?.[1]?.replace(/\D/g,"")||0);
  assert.ok(tris>5000,"Expected a true detailed model, got "+stats);
  const names=await page.locator(".hierarchy").textContent();
  assert.match(names,/AURORA V5/);
  const canvas=await page.locator("#scene").boundingBox();
  assert.ok(canvas?.width>100&&canvas?.height>100,"canvas must be visible");
  if(size.width>700){
   const wait=page.waitForEvent("download",{timeout:60000});
   await page.locator("#exportGLB").click();
   const download=await wait;
   const file=await readFile(await download.path());
   assert.equal(file.subarray(0,4).toString(),"glTF");
   assert.ok(file.length>100000,"GLB payload must contain real detailed geometry");
   console.log("PASS: AURORA V5 exported GLB, bytes:",file.length);
  }
  // No dependency on published V5 Detail PBR yet. Normal PBR must work.
  await page.waitForTimeout(200);
  assert.deepEqual(errors,[],"No exceptions from V5 scene / shaders / GLB export");
  console.log("PASS: AURORA V5 visible at",size.width+"×"+size.height,stats);
  await page.close();
 }
 const page=await browser.newPage();
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:45000});
 assert.ok(!(await page.locator("#projectName").inputValue()).includes("AURORA"));
 console.log("PASS: original starter scene unchanged without deep link");
 await page.close();
}finally{await browser.close()}
