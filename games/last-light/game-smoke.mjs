import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]});
const errors=[];
const watch=page=>{
 page.on("pageerror",e=>errors.push("pageerror: "+e.message));
 page.on("requestfailed",req=>errors.push("requestfailed: "+req.url()+" "+req.failure()?.errorText));
 page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});
};
try{
 const page=await browser.newPage({viewport:{width:1152,height:720},deviceScaleFactor:1,acceptDownloads:true});
 watch(page);
 await page.goto("http://127.0.0.1:8080/games/last-light/",{waitUntil:"domcontentloaded"});
 await page.waitForTimeout(2500);
 if(!(await page.locator("#boot").evaluate(el=>el.hidden))){
  const note=await page.locator("#bootMessage").textContent();
  console.log("BOOT STATE",note,"ERRORS",errors.slice(0,15));
 }
 await page.waitForFunction(()=>document.getElementById("boot")?.hidden===true,{timeout:13000});
 assert.equal(await page.locator("#intro").isVisible(),true);
 assert.equal(await page.locator("#scene").isVisible(),true);
 assert.match(await page.locator(".performance").textContent(),/WebGL/);
 await page.screenshot({path:"last-light-intro-desktop.png"});
 await page.locator("#start").click();
 assert.equal(await page.locator("#intro").isVisible(),false);
 await page.keyboard.down("w");
 // Observe speed while W is held: releasing before checking lets the ship coast to 0.
 await page.waitForFunction(()=>Number(document.querySelector("#speed")?.textContent)>0,{timeout:20000});
 console.log("FRAME STATE",await page.evaluate(()=>({speed:document.querySelector("#speed")?.textContent,fps:document.querySelector("#fps")?.textContent})),errors.slice(0,10));
 await page.keyboard.up("w");
 await page.locator("#auto").click();
 assert.match(await page.locator("#auto").textContent(),/PÅ/);
 await page.locator("#weather").click();
 assert.match(await page.locator("#weather").textContent(),/STORM/);
 await page.locator("#view").click();
 assert.match(await page.locator("#view").textContent(),/DÄCK/);
 await page.locator("#view").click();
 assert.match(await page.locator("#view").textContent(),/FILM/);
 const [ship]=await Promise.all([
  page.waitForEvent("download",{timeout:20000}),page.locator("#exportShip").click()
 ]);
 assert.match(ship.suggestedFilename(),/\.glb$/);
 assert.ok(await ship.path());
 await page.screenshot({path:"last-light-storm-desktop.png"});
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 watch(mobile);
 await mobile.goto("http://127.0.0.1:8080/games/last-light/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.getElementById("boot")?.hidden===true,{timeout:45000});
 await mobile.locator("#start").click();
 assert.equal(await mobile.locator("#controls").isVisible(),true);
 assert.equal(await mobile.locator("#gas").isVisible(),true);
 await mobile.locator("#gas").dispatchEvent("pointerdown",{pointerId:3});
 await mobile.waitForTimeout(500);
 await mobile.locator("#gas").dispatchEvent("pointerup",{pointerId:3});
 await mobile.locator("#view").click();
 await mobile.screenshot({path:"last-light-mobile.png"});
 assert.equal(await mobile.locator("#scene").isVisible(),true);
 assert.deepEqual(errors,[],"Desktop and mobile should not have runtime or WebGL shader errors");
 console.log("PASS: original 3D ocean/atmosphere scene, mobile controls, real GLB export and cinematic camera");
}finally{await browser.close()}
