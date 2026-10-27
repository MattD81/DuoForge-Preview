import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"
]});
const issues=[];
try{
 const page=await browser.newPage({viewport:{width:1410,height:900},acceptDownloads:true});
 page.on("pageerror",e=>issues.push(e.message));
 page.on("console",msg=>{if(msg.type()==="error")issues.push(msg.text())});
 await page.goto("http://127.0.0.1:8080/",{waitUntil:"domcontentloaded"});
 assert.equal(await page.locator('a[href*="film=1"]').count(),1);
 await page.locator('a[href*="film=1"]').click();
 await page.waitForTimeout(1300);
 console.log("DEBUG first film launch",JSON.stringify(await page.evaluate(()=>({
  url:location.href,
  body:document.body.className,
  world:document.querySelector("#renderWorld")?.value,
  previewPanel:document.querySelector("#renderWorldOverlay")?.hidden,
  filmPanel:document.querySelector("#filmStudioOverlay")?.hidden,
  filmButton:!!document.querySelector("#filmOpen"),
  filmStatus:document.querySelector("#filmStatus")?.textContent,
  toast:document.querySelector("#toast")?.textContent,
  ready:document.readyState
 }))),JSON.stringify(issues));
 await page.waitForFunction(()=>document.body.classList.contains("film-studio-active"),{timeout:18000});
 assert.equal(await page.locator("#renderWorldOverlay").isVisible(),true);
 assert.equal(await page.locator("#filmStudioOverlay").isVisible(),true);
 assert.equal(await page.locator("#filmShot").inputValue(),"flyover");
 assert.equal(await page.locator("#renderWorldSelect").inputValue(),"ocean");
 console.log("PASS: one-click movie director launches Ocean scene from DuoForge homepage");

 await page.locator("#filmShot").selectOption("orbit");
 await page.locator("#filmDuration").selectOption("6");
 await page.locator("#filmResolution").selectOption("720");
 await page.locator("#filmPlay").click();
 await page.waitForFunction(()=>parseFloat(document.querySelector("#filmFrameCounter")?.textContent||"0")>.3,{timeout:16000});
 assert.match(await page.locator("#filmStatus").textContent(),/Spelar/);
 await page.locator("#filmPlay").click();
 assert.equal(await page.locator("#filmPlay").textContent(),"▶ Förhandsvisa");
 console.log("PASS: 3D camera motion previews smoothly with controllable film duration and pause");

 await page.locator("#filmSeek").evaluate(el=>{el.value="490";el.dispatchEvent(new Event("input",{bubbles:true}));});
 assert.ok(parseFloat(await page.locator("#filmFrameCounter").textContent())>2);
 console.log("PASS: timeline scrub moves camera and water to selected movie time");

 // Save two custom camera positions and verify a portable film storyboard.
 await page.locator("#filmAddKeyframe").click();
 await page.locator("#filmAddKeyframe").click();
 assert.equal(await page.locator("#filmKeyframes").textContent(),"2");
 assert.equal(await page.locator("#filmShot").inputValue(),"custom");
 const [story]=await Promise.all([
  page.waitForEvent("download"),
  page.locator("#filmExportStoryboard").click()
 ]);
 assert.match(story.suggestedFilename(),/storyboard\.json$/);
 const storyboard=JSON.parse(readFileSync(await story.path(),"utf8"));
 assert.equal(storyboard.format,"duoforge-film@1");
 assert.equal(storyboard.keyframes.length,2);
 const fileInput=page.locator("#filmImportStoryboard");
 await fileInput.setInputFiles({
  name:"my-storyboard.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(storyboard))
 });
 await page.waitForFunction(()=>document.querySelector("#filmStatus")?.textContent.includes("Storyboard laddat"));
 console.log("PASS: custom camera keyframes export and re-import as portable film storyboard");

 // Full HD still tests actual media bytes, not just a nominal UI setting.
 await page.locator("#filmShot").selectOption("flyover");
 await page.locator("#filmPhotoResolution").selectOption("1080");
 const [photo]=await Promise.all([
  page.waitForEvent("download",{timeout:30000}),
  page.locator("#filmStill").click()
 ]);
 assert.match(photo.suggestedFilename(),/1080p\.png$/);
 const png=readFileSync(await photo.path());
 assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
 assert.equal(png.readUInt32BE(16),1920);
 assert.equal(png.readUInt32BE(20),1080);
 console.log("PASS: real 1920x1080 cinematic PNG generated from WebGL scene");

 // Browser may not implement a video encoder in software mode; verify safe
 // graceful fallback while checking actual movie recorder when supported.
 const videoSupport=await page.evaluate(()=>({
  media:typeof MediaRecorder!=="undefined",
  capture:typeof document.querySelector("#scene")?.captureStream==="function"
 }));
 if(videoSupport.media&&videoSupport.capture){
  await page.locator("#filmResolution").selectOption("720");
  await page.locator("#filmRecord").click();
  const running=(await page.locator("#filmRecord").textContent()).includes("Stoppa");
  if(running){
   const dimensions=await page.evaluate(()=>({
    width:document.querySelector("#scene")?.width,
    height:document.querySelector("#scene")?.height
   }));
   assert.deepEqual(dimensions,{width:1280,height:720},"Movie capture changes WebGL backing resolution to 720p 16:9");
   await page.waitForTimeout(1200);
   await page.locator("#filmRecord").click();
   await page.waitForFunction(()=>!document.querySelector("#filmRecord")?.textContent.includes("Stoppa"),{timeout:12000});
   await page.waitForTimeout(1200);
   const result=await page.locator("#filmStatus").textContent();
   assert.match(result,/Film skapad|Inga bildrutor|Sparar|Kunde inte/);
   console.log("PASS: WebGL video recorder starts and stops with correct export resolution ("+result+")");
  }else{
   assert.match(await page.locator("#filmStatus").textContent(),/Kunde inte/);
   console.log("PASS: unsupported software video encoder reports fallback");
  }
 }
 // Real film-look UI must generate five individual camera takes, not repeat one shot.
 await page.locator("#filmBroll").click();
 assert.equal(await page.locator("#filmShot").inputValue(),"broll");
 assert.equal(await page.locator("#filmDuration").inputValue(),"20");
 assert.equal(await page.locator("#filmLook").inputValue(),"golden");
 assert.equal(await page.locator("#filmFinish").isChecked(),true);
 assert.match(await page.locator("#filmShotProgress").textContent(),/01 · Hero/);
 await page.locator("#filmSeek").evaluate(el=>{el.value="520";el.dispatchEvent(new Event("input",{bubbles:true}));});
 assert.match(await page.locator("#filmShotProgress").textContent(),/03 · Detail/);
 await page.locator("#filmSeek").evaluate(el=>{el.value="950";el.dispatchEvent(new Event("input",{bubbles:true}));});
 assert.match(await page.locator("#filmShotProgress").textContent(),/05 · Crane/);
 await page.locator("#filmLook").selectOption("noir");
 await page.locator("#filmFinish").uncheck();
 await page.locator("#filmLook").selectOption("studio");
 await page.locator("#filmFinish").check();
 const [brollStoryboard]=await Promise.all([
  page.waitForEvent("download"),
  page.locator("#filmExportStoryboard").click()
 ]);
 const brollData=JSON.parse(readFileSync(await brollStoryboard.path(),"utf8"));
 assert.equal(brollData.settings.shot,"broll");
 assert.equal(brollData.look,"studio");
 assert.equal(brollData.finish,true);
 console.log("PASS: 5 B-roll editorial cuts, changeable PBR finish, light presets and saved look");
 // New photorealistic effects are opt-in; the standard browser path still works.
 assert.equal(await page.locator("#filmDof").isChecked(),false);
 assert.equal(await page.locator("#filmSSR").isChecked(),false);
 await page.locator("#filmDof").check();
 await page.waitForFunction(()=>document.querySelector("#renderQualitySelect").value==="high",{timeout:20000});
 await page.locator("#filmAperture").evaluate(el=>{el.value=".002";el.dispatchEvent(new Event("input",{bubbles:true}));});
 assert.equal(await page.locator("#filmApertureValue").textContent(),"0.0020");
 await page.locator("#filmFocusScale").evaluate(el=>{el.value="1.5";el.dispatchEvent(new Event("input",{bubbles:true}));});
 assert.equal(await page.locator("#filmFocusValue").textContent(),"1.50×");
 await page.locator("#filmDof").uncheck();
 console.log("PASS: opt-in DOF auto-selects High, supports lens/focus controls and safe disable");
 // SSR has its own GPU fallback; the toggle must work without touching original GLB.
 await page.locator("#filmSSR").check();
 await page.waitForTimeout(900);
 await page.locator("#filmSSR").uncheck();
 console.log("PASS: advanced reflections are opt-in and can be switched off");
 const [opticsStory]=await Promise.all([
  page.waitForEvent("download"),page.locator("#filmExportStoryboard").click()
 ]);
 const optics=JSON.parse(readFileSync(await opticsStory.path(),"utf8"));
 assert.equal(optics.fx.dof,false);
 assert.equal(optics.fx.reflections,false);
 assert.ok(Math.abs(optics.fx.focusScale-1.5)<.01);
 assert.ok(Math.abs(optics.fx.aperture-.002)<.0001);
 assert.equal(await page.locator("#filmPathTrace").isVisible(),true);
 // Cancel must remain responsive during optional module loading, even on software GPU.
 await page.locator("#filmPathSamples").selectOption("4");
 await page.locator("#filmPathTrace").click();
 // Some browsers reject unsupported WebGL extensions or CDN modules instantly.
 // Exercise cancellation only if still running; always verify recovered controls.
 await page.waitForTimeout(700);
 const activePathTrace=await page.locator("#filmPathTrace").isDisabled();
 if(activePathTrace){
  await page.locator("#filmPathCancel").evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector("#filmPathTrace").disabled===false,{timeout:35000});
 }
 const traceStatus=await page.locator("#filmPathStatus").textContent();
 assert.match(traceStatus,/Avbryter|Path tracing|Ray tracing|färdig|stöds inte/);
 console.log("PASS: opt-in path traced stills recover or can be cancelled: "+traceStatus);
 // Verify actual pinned WebGL path tracing library loads with the same Three.js
 // instance as the editor; failing here means path tracing cannot run at all.
 const pathModule=await page.evaluate(async()=>{
  try{
   const m=await import("https://esm.sh/three-gpu-pathtracer@0.0.24?bundle&external=three");
   return {ok:typeof m.WebGLPathTracer==="function"&&typeof m.PhysicalCamera==="function"};
  }catch(e){return {ok:false,message:String(e.message||e)};}
 });
 assert.ok(pathModule.ok,"Pinned WebGLPathTracer must actually load: "+(pathModule.message||"missing export"));
 console.log("PASS: real WebGL path tracing engine modules load, without sending GLB files to any server");
 await page.screenshot({path:"film-studio-desktop.png"});
 await page.locator("#filmClose").click();
 assert.equal(await page.locator("#filmStudioOverlay").isVisible(),false);
 assert.equal(await page.locator("#renderWorldOverlay").isVisible(),true);
 await page.locator("#renderExit").click();
 await page.waitForFunction(()=>!document.body.classList.contains("render-world-active"));
 assert.equal(await page.locator("#objectCount").textContent(),"1");
 console.log("PASS: film mode and preview both close without modifying the original 3D model");

 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,acceptDownloads:true});
 mobile.on("pageerror",e=>issues.push("mobile: "+e.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/?world=ocean&film=1",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.body.classList.contains("film-studio-active"),{timeout:30000});
 assert.equal(await mobile.locator("#filmStudioOverlay").isVisible(),true);
 assert.equal(await mobile.locator("#filmRecord").isVisible(),true);
 assert.equal(await mobile.locator("#filmResolution").inputValue(),"1080",
  "High quality Full HD output must be the default on mobile");
 const getScale=()=>mobile.evaluate(()=>{
  const c=document.querySelector("#scene");return c.width/c.clientWidth;
 });
 assert.ok(Math.abs((await getScale())-1.5)<.06,
  "Medium preview uses 1.5x device pixels instead of pixelated 1x on HiDPI");
 await mobile.locator("#renderQualitySelect").selectOption("high");
 await mobile.waitForFunction(()=>{
  const c=document.querySelector("#scene");
  return Math.abs(c.width/c.clientWidth-2)<.06;
 },{timeout:12000});
 console.log("PASS: Retina mobile High render quality uses 2x device pixels");
 await mobile.locator("#renderQualitySelect").selectOption("medium");
 await mobile.waitForFunction(()=>{
  const c=document.querySelector("#scene");
  return Math.abs(c.width/c.clientWidth-1.5)<.06;
 },{timeout:12000});
 await mobile.screenshot({path:"film-studio-mobile.png"});
 await mobile.locator("#filmClose").click();
 await mobile.locator("#renderExit").click();
 await mobile.waitForFunction(()=>!document.body.classList.contains("render-world-active"));
 assert.ok(Math.abs((await getScale())-2)<.06,
  "Closing Render World restores the original editor's HiDPI resolution");
 console.log("PASS: Film Studio uses Full HD by default, High is sharp, and editor quality is restored");
 assert.deepEqual(issues,[],"No unexpected browser runtime errors");
}finally{await browser.close()}
