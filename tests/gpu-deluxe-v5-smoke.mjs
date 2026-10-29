import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--enable-webgl","--disable-gpu-sandbox"]
});
try{
 for(const size of [{width:1280,height:800},{width:390,height:844}]){
  const page=await browser.newPage({viewport:size,deviceScaleFactor:1,acceptDownloads:true});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text())});
  await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
  assert.ok(await page.locator("#gpuDeluxeV5").isVisible());
  assert.equal(await page.locator("#gpuV5Enable").getAttribute("aria-pressed"),"false");
  await page.locator("#gpuV5Preset").selectOption("balanced");
  await page.locator("#gpuV5Detail").click();
  await page.waitForFunction(()=>document.querySelector("#gpuV5Status")?.textContent.includes("hela scenens trianglar"),{timeout:45000});
  assert.equal(await page.locator("#gpuV5Detail").getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator("#gpuV5Enable").getAttribute("aria-pressed"),"false");
  console.log("PASS: V5 full-detail PBR",size.width+"x"+size.height);
  await page.locator("#gpuV5Enable").click();
  await page.waitForFunction(()=>document.querySelector("#gpuV5Status")?.textContent.includes("trianglar"),{timeout:45000});
  assert.equal(await page.locator("#gpuV5Enable").getAttribute("aria-pressed"),"true",
   "V5 must not silently revert to V2");
  const status=await page.locator("#gpuV5Status").textContent();
  assert.match(status,/trianglar/);
  assert.match(status,/bildprov/);
  console.log("PASS: V5 BVH render",size.width+"x"+size.height,status);
  await page.locator("#gpuV5Off").click();
  assert.equal(await page.locator("#gpuV5Enable").getAttribute("aria-pressed"),"false");
  await page.locator("#gpuV2Temporal").click();
  assert.equal(await page.locator("#gpuV2Temporal").getAttribute("aria-pressed"),"true");
  await page.locator("#gpuV2Off").click();
  assert.equal(await page.locator("#objectCount").textContent(),"1");
  await page.waitForTimeout(200);
  assert.deepEqual(errors,[],"No shader errors or page exceptions: "+size.width+"px");
  console.log("PASS: V2/normal fallback and no lost 3D model",size.width+"px");
  await page.close();
 }
}finally{await browser.close()}
