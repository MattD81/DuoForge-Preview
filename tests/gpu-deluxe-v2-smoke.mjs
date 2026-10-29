import test from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,
 args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]});
try{
 for(const size of [{width:1280,height:800},{width:390,height:844}]){
  const page=await browser.newPage({viewport:size,deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
  await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
  const controls=page.locator("#gpuDeluxeV2");
  await controls.waitFor({state:"attached",timeout:15000});
  test.equal(await page.locator("#gpuV2Temporal").getAttribute("aria-pressed"),"false");
  await page.locator("#gpuV2Temporal").click();
  await page.waitForFunction(()=>document.querySelector("#gpuV2Status")?.textContent.includes("Temporal"),{timeout:15000});
  test.equal(await page.locator("#gpuV2Temporal").getAttribute("aria-pressed"),"true");
  await page.waitForTimeout(500);
  test.ok((await page.locator("#scene").evaluate(el=>el.width))>0,"Canvas has drawing buffer");
  await page.locator("#gpuV2Ray").click();
  await page.waitForFunction(()=>document.querySelector("#gpuV2Status")?.textContent.includes("Ray tracing"),{timeout:15000});
  test.equal(await page.locator("#gpuV2Ray").getAttribute("aria-pressed"),"true");
  await page.waitForTimeout(500);
  test.match(await page.locator("#gpuV2Status").textContent(),/Ray tracing/);
  await page.locator("#gpuV2Off").click();
  test.equal(await page.locator("#gpuV2Ray").getAttribute("aria-pressed"),"false");
  await page.waitForTimeout(250);
  test.deepEqual(errors,[],"No browser/WebGL shader exceptions on "+size.width+"px");
  console.log("GPU Deluxe V2 passed",size.width+"x"+size.height);
  await page.close();
 }
}finally{await browser.close()}
