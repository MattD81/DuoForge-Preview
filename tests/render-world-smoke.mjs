import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]
});
const failures=[];
try{
 const page=await browser.newPage({viewport:{width:1410,height:900},acceptDownloads:true});
 page.on("pageerror",e=>failures.push(e.message));
 page.on("console",msg=>{if(msg.type()==="error")failures.push(msg.text())});
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});
 assert.equal(await page.locator("#openRenderWorld").isVisible(),true);
 const before=await page.locator("#px").inputValue();
 const beforeObjects=await page.locator("#objectCount").textContent();
 await page.locator("#renderWorld").selectOption("showroom");
 await page.locator("#openRenderWorld").click();
 await page.waitForFunction(()=>document.body.classList.contains("render-world-active"),{timeout:15000});
 assert.equal(await page.locator("#renderWorldOverlay").isVisible(),true);
 assert.equal(await page.locator("#previewAssetName").textContent(),"DuoForge Kart – startmodell");
 assert.equal(await page.locator("#renderCheckpointCount").textContent(),"0/0");
 console.log("PASS: showroom loads the selected model as an isolated test copy");

 for(const type of ["forest","city","night","racetrack"]){
  await page.locator("#renderWorldSelect").selectOption(type);
  await page.waitForFunction(t=>document.querySelector("#renderWorldSelect")?.value===t,type);
  assert.equal(await page.locator("#renderCheckpointCount").textContent(),"0/4");
  console.log("PASS: world preset "+type+" supports real-time environment switching");
 }
 await page.locator("#renderQualitySelect").selectOption("low");
 assert.equal(await page.locator("#renderQuality").inputValue(),"low");
 await page.locator("#renderQualitySelect").selectOption("medium");
 assert.equal(await page.locator("#renderQuality").inputValue(),"medium");
 console.log("PASS: low/medium quality switching updates both control panels");

 await page.locator("#renderCameraSelect").selectOption("cinematic");
 assert.equal(await page.locator("#renderCameraTip").textContent(),"Automatisk filmkamera");
 await page.locator("#renderCameraSelect").selectOption("orbit");
 await page.locator("#renderCameraSelect").selectOption("free");
 assert.match(await page.locator("#renderCameraTip").textContent(),/WASD/);
 await page.locator("#renderCameraSelect").selectOption("follow");
 console.log("PASS: orbit, cinematic, free and follow camera modes are available");

 await page.locator("#renderScreenshot").click();
 const imageDownload=await page.waitForEvent("download");
 assert.match(imageDownload.suggestedFilename(),/racetrack\.png$/);
 console.log("PASS: rendered environment PNG screenshot download works");

 await page.keyboard.down("w");
 await page.waitForFunction(()=>document.querySelector("#renderCheckpointCount")?.textContent?.startsWith("1/"),{timeout:13000});
 await page.keyboard.up("w");
 assert.match(await page.locator("#renderMissionStatus").textContent(),/Kör igenom/);
 console.log("PASS: driving the kart crosses a real checkpoint in rendered world");

 await page.locator("#renderResetMission").click();
 assert.equal(await page.locator("#renderCheckpointCount").textContent(),"0/4");
 console.log("PASS: checkpoint mission resets and preserves preview model");

 await page.locator("#renderExit").click();
 await page.waitForFunction(()=>!document.body.classList.contains("render-world-active"));
 assert.equal(await page.locator("#px").inputValue(),before);
 assert.equal(await page.locator("#objectCount").textContent(),beforeObjects);
 assert.equal(await page.locator("#renderWorldOverlay").isVisible(),false);
 console.log("PASS: exit restores the exact editable scene, transform controls and visibility");

 await page.screenshot({path:"render-world-desktop.png"});
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 mobile.on("pageerror",e=>failures.push("mobile: "+e.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});
 await mobile.locator("#openRenderWorld").click();
 await mobile.waitForFunction(()=>document.body.classList.contains("render-world-active"));
 assert.equal(await mobile.locator("#renderWorldOverlay").isVisible(),true);
 assert.equal(await mobile.locator('[data-preview-drive="gas"]').isVisible(),true);
 await mobile.locator('[data-preview-drive="gas"]').dispatchEvent("pointerdown",{pointerType:"touch",pointerId:41,button:0});
 await mobile.waitForFunction(()=>document.querySelector("#renderSpeed")?.textContent!=="0 km/h",{timeout:9000});
 await mobile.locator('[data-preview-drive="gas"]').dispatchEvent("pointerup",{pointerType:"touch",pointerId:41,button:0});
 await mobile.screenshot({path:"render-world-mobile.png",fullPage:true});
 console.log("PASS: touch acceleration and world display work in narrow mobile viewport");
 assert.deepEqual(failures,[],"No uncaught errors in Chromium");
}finally{await browser.close()}
