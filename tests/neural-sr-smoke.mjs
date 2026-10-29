import assert from "node:assert/strict";
import {chromium} from "playwright";
// Reuses Studio CI's local HTTP server. Does not perform paid GPU training.
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl"]});
try {
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.locator("#gpuV2Neural").waitFor({timeout:25000});
 await page.locator("#gpuV2Neural").click();
 await page.waitForTimeout(1000);
 assert.equal(await page.locator("#gpuV2Neural").getAttribute("aria-pressed"),"true",
  "Neural render path failed; fallback was triggered, inspect console/GPU support");
 assert.equal(await page.locator("#scene").isVisible(),true);
 assert.deepEqual(errors.filter(x=>/neural|shader|gpu deluxe/i.test(x)),[]);
 await page.locator("#gpuV2Off").click();
 assert.equal(await page.locator("#gpuV2Neural").getAttribute("aria-pressed"),"false");
 console.log("Neural SR desktop GPU browser smoke passed");
}finally{await browser.close();}
