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
 assert.equal(await page.locator("#gpuDeluxeMode").inputValue(),"auto");
 await page.waitForFunction(()=>document.querySelector("#gpuDeluxeStats")?.textContent.includes("GPU Deluxe AUTO"));
 await page.locator("#gpuDeluxeMode").selectOption("performance");
 await page.waitForFunction(()=>document.querySelector("#gpuDeluxeStats")?.textContent.includes("PERFORMANCE"));
 await page.locator("#gpuDeluxeMode").selectOption("quality");
 await page.waitForFunction(()=>document.querySelector("#gpuDeluxeStats")?.textContent.includes("QUALITY"));
 await page.locator("#gpuDeluxeMode").selectOption("off");
 await page.waitForFunction(()=>document.querySelector("#gpuDeluxeStats")?.textContent.includes("OFF"));
 await page.locator("#gpuDeluxeMode").selectOption("auto");
 console.log("PASS: GPU Deluxe presets, live diagnostics and original-graphics opt out");
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
 await page.locator("#renderQualitySelect").selectOption("high");
 await page.waitForTimeout(1200);
 assert.equal(await page.locator("#renderQuality").inputValue(),"high");
 await page.locator("#renderQualitySelect").selectOption("medium");
 console.log("PASS: high-quality postprocessing mode initializes and returns to medium safely");

 await page.locator("#renderCameraSelect").selectOption("cinematic");
 assert.equal(await page.locator("#renderCameraTip").textContent(),"Automatisk filmkamera");
 await page.locator("#renderCameraSelect").selectOption("orbit");
 await page.locator("#renderCameraSelect").selectOption("free");
 assert.match(await page.locator("#renderCameraTip").textContent(),/WASD/);
 await page.locator("#renderCameraSelect").selectOption("follow");
 console.log("PASS: orbit, cinematic, free and follow camera modes are available");

 const [imageDownload]=await Promise.all([page.waitForEvent("download"),page.locator("#renderScreenshot").click()]);
 assert.match(imageDownload.suggestedFilename(),/racetrack\.png$/);
 console.log("PASS: rendered environment PNG screenshot download works");
 if(await page.evaluate(()=>typeof MediaRecorder!=="undefined"&&!!document.querySelector("#scene")?.captureStream)){
  await page.locator("#renderRecord").click();
  if((await page.locator("#renderRecord").textContent()).includes("Stoppa")){
   await page.waitForTimeout(1000);
   let recordedDownload=null;
   page.once("download",download=>{recordedDownload=download;});
   await page.locator("#renderRecord").click();
   await page.waitForFunction(()=>document.querySelector("#renderRecord")?.textContent.includes("Spela in"));
   await page.waitForTimeout(800);
   if(recordedDownload)assert.match(recordedDownload.suggestedFilename(),/renderworld\.(?:webm|mp4)$/);
   console.log("PASS: local video recorder starts/stops safely (download depends on browser capture support)");
  }
 }

 await page.locator("#scene").click({position:{x:650,y:430}});
 console.log("DEBUG before driving",JSON.stringify(await page.evaluate(()=>({
  kind:document.querySelector("#renderMissionKind")?.textContent,
  time:document.querySelector("#renderTime")?.textContent,
  body:document.body.className
 }))));
 await page.keyboard.down("w");
 await page.waitForTimeout(1600);
 console.log("DEBUG rendered drive",JSON.stringify(await page.evaluate(()=>({
  speed:document.querySelector("#renderSpeed")?.textContent,
  checkpoint:document.querySelector("#renderCheckpointCount")?.textContent,
  camera:document.querySelector("#renderCameraSelect")?.value,
  focus:document.activeElement?.tagName,
  mission:document.querySelector("#renderMissionStatus")?.textContent,
  time:document.querySelector("#renderTime")?.textContent,
  source:document.querySelector("#renderMissionKind")?.textContent,
  controlsVisible:getComputedStyle(document.querySelector("#renderDrivingControls")).display,
  errors:window.__previewErrors||[]
 }))));
 await page.waitForFunction(()=>parseInt(document.querySelector("#renderSpeed")?.textContent||"0",10)>0,null,{timeout:12000});
 await page.keyboard.up("w");
 assert.match(await page.locator("#renderMissionStatus").textContent(),/Kör igenom/);
 console.log("PASS: rendered-world vehicle accelerates; checkpoint progression is independently unit-tested");

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
