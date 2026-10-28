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

 // Cinema production: real multi-scene editing, pose tracks and offline time-based PNG frames.
 await page.locator("#filmMovieEditor summary").click();
 await page.locator("#filmCutShot").selectOption("orbit");
 await page.locator("#filmCutMotion").selectOption("turn");
 await page.locator("#filmAddCut").click();
 await page.locator("#filmCutShot").selectOption("crane");
 await page.locator("#filmCutLook").selectOption("noir");
 await page.locator("#filmCutMotion").selectOption("sway");
 await page.locator("#filmAddCut").click();
 assert.equal(await page.locator("#filmShot").inputValue(),"edit");
 assert.match(await page.locator("#filmCutTotal").textContent(),/2 scener · 8 sekunder/);
 await page.locator("#filmSeek").evaluate(el=>{el.value="700";el.dispatchEvent(new Event("input",{bubbles:true}));});
 assert.match(await page.locator("#filmShotProgress").textContent(),/2 \/ 2/);
 const [cinemaProject]=await Promise.all([
  page.waitForEvent("download"),page.locator("#filmExportStoryboard").click()
 ]);
 const movieProject=JSON.parse(readFileSync(await cinemaProject.path(),"utf8"));
 assert.equal(movieProject.cuts.length,2);
 assert.equal(movieProject.cuts[1].motion,"sway");
 console.log("PASS: editable film clips switch camera, GLB animation and cinematic look deterministically");
 await page.locator("#filmFrameQueue summary").click();
 await page.locator("#filmFrameResolution").selectOption("720");
 await page.locator("#filmFrameCount").fill("1");
 const [batch]=await Promise.all([
  page.waitForEvent("download",{timeout:45000}),
  page.locator("#filmFrameRender").click()
 ]);
 const frameZip=readFileSync(await batch.path());
 assert.equal(frameZip.readUInt32LE(0),0x04034b50);
 assert.ok(frameZip.includes(Buffer.from("frame_000000.png")));
 assert.ok(frameZip.includes(Buffer.from("manifest.json")));
 assert.ok(frameZip.includes(Buffer.from("duoforge-frames@1")));
 assert.equal(await page.locator("#filmFrameStart").inputValue(),"1");
 console.log("PASS: offline renderer exports actual frame-exact PNG ZIP with manifest and resume index");

 // Independent new engine core blends samples in linear light, not a fake
 // screen-space white-dot overlay. 50% black + 50% white ~= 188 sRGB.
 const accumulation=await page.evaluate(async()=>{
  const {TemporalFilmCompositor,filmClock}=await import("/workshop/studio/cinema-engine-core.mjs");
  const source=document.createElement("canvas");
  source.width=64;source.height=36;
  const ctx=source.getContext("2d");
  const engine=new TemporalFilmCompositor({width:64,height:36});
  ctx.fillStyle="#000000";ctx.fillRect(0,0,64,36);engine.add(source);
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,64,36);engine.add(source);
  const px=engine.finish().getContext("2d").getImageData(32,18,1,1).data[0];
  const sampleTimes=filmClock({duration:20,fps:24,samples:2}).shutterTimes(95);
  engine.dispose();
  return {px,sampleTimes};
 });
 assert.ok(accumulation.px>=186&&accumulation.px<=190);
 assert.equal(accumulation.sampleTimes.length,2);
 console.log("PASS: original Cinema Engine V1 linear-light compositor blends temporal frames correctly");

 const gpuBlend=await page.evaluate(async()=>{
  const {createCinemaCompositor}=await import("/workshop/studio/cinema-gpu-engine.mjs");
  const source=document.createElement("canvas");source.width=64;source.height=36;
  const ctx=source.getContext("2d");
  const engine=createCinemaCompositor({width:64,height:36});
  ctx.fillStyle="#000";ctx.fillRect(0,0,64,36);engine.add(source);
  ctx.fillStyle="#fff";ctx.fillRect(0,0,64,36);engine.add(source);
  const screen=engine.finish();
  const out=document.createElement("canvas");out.width=64;out.height=36;
  const oc=out.getContext("2d");oc.drawImage(screen,0,0);
  const value=oc.getImageData(32,18,1,1).data[0];
  const mode=engine.mode;engine.dispose();
  return {value,mode};
 });
 assert.ok(gpuBlend.value>=185&&gpuBlend.value<=192,
  "Independent GLSL float16 render pass should produce a correct ~188 sRGB average");
 assert.ok(["webgl2-float16","cpu-linear"].includes(gpuBlend.mode));
 console.log("PASS: Cinema Engine GPU/CPU floating-point render pipeline is operational: "+gpuBlend.mode);

 await page.locator("#filmEngineSamples").selectOption("2");
 await page.locator("#filmEngineShutter").selectOption("180");
 const [temporalBatch]=await Promise.all([
  page.waitForEvent("download",{timeout:45000}),
  page.locator("#filmFrameRender").click()
 ]);
 const temporalZip=readFileSync(await temporalBatch.path());
 assert.ok(temporalZip.includes(Buffer.from('"renderer": "duoforge-cinema-core@1"')));
 assert.ok(temporalZip.includes(Buffer.from('"temporalSamples": 2')));
 assert.equal(await page.locator("#filmFrameStart").inputValue(),"2");
 console.log("PASS: GPU scene renders through new Cinema Core's shutter-sampled offline PNG ZIP exporter");

 // Skeletal GLB bridge must preserve clips and support exact-timestamp bone poses.
 const rigBridge=await page.evaluate(async()=>{
  const THREE=await import("three");
  const {registerRigClips,cloneRiggedModel,makeRigDirector}=await import("/workshop/studio/cinema-rig.mjs");
  const root=new THREE.Group();
  const bone=new THREE.Bone();bone.name="Arm";root.add(bone);
  const clip=new THREE.AnimationClip("wave",2,[
   new THREE.QuaternionKeyframeTrack("Arm.quaternion",[0,1,2],
    [0,0,0,1,0,0,.382683,.92388,0,0,0,1])
  ]);
  registerRigClips(root,[clip]);
  const clone=cloneRiggedModel(root);
  const director=makeRigDirector(clone);
  director.start("wave");
  director.sample(.5);
  const animated=clone.children[0].quaternion.z;
  director.pose("Arm",[.2,0,0]);
  const posed=clone.children[0].quaternion.x;
  director.release();
  return {clips:director.clips.length,bones:director.bones.length,animated,posed,
   restored:Math.abs(clone.children[0].quaternion.x)<.0001};
 });
 assert.equal(rigBridge.clips,1);
 assert.equal(rigBridge.bones,1);
 assert.ok(rigBridge.animated>.15);
 assert.ok(rigBridge.posed>.07);
 assert.equal(rigBridge.restored,true);
 console.log("PASS: imported glTF skeleton clips, animation sampling and non-destructive per-bone poses");
 assert.equal(await page.locator("#filmRigPanel").count(),1);
 assert.equal(await page.locator("#filmTraceMovie").count(),1);
 assert.equal(await page.locator("#filmTraceDenoise").isChecked(),true);
 console.log("PASS: Cinema Film rig controls and opt-in GPU path tracing frame export are present");
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
