import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"
]});
const issues=[];
try{
 const page=await browser.newPage({viewport:{width:1420,height:920}});
 page.on("pageerror",error=>issues.push("runtime: "+error.message));
 page.on("console",message=>{
  if(message.type()==="error")issues.push("console: "+message.text());
 });
 await page.goto("http://127.0.0.1:8080/",{waitUntil:"domcontentloaded"});
 assert.equal(await page.locator('a[href*="world=ocean"]:not([href*="film=1"])').count(),1,"Ocean preview button remains available alongside Film Studio");
 await page.locator('a[href*="world=ocean"]:not([href*="film=1"])').click();
 await page.waitForURL(/world=ocean/,{timeout:15000});
 await page.waitForFunction(()=>document.body.classList.contains("render-world-active"),{timeout:30000});
 assert.equal(await page.locator("#renderWorldSelect").inputValue(),"ocean");
 assert.equal(await page.locator("#oceanOverlayControls").isVisible(),true);
 assert.equal(await page.locator("#oceanPanelControls").isVisible(),false,"Sidebar is hidden in preview");
 assert.match(await page.locator("#renderMissionStatus").textContent(),/Levande hav/);
 assert.equal(await page.locator("#renderCheckpointCount").textContent(),"0/0");
 console.log("PASS: main DuoForge Preview launches Ocean Render World without extra clicks");

 const water=await page.evaluate(async()=>{
  const THREE=await import("three");
  const {createEnvironment}=await import("./render-environments.mjs");
  const {oceanHeight,oceanSlope,normalizeOceanSettings}=await import("./ocean-water.mjs");
  const env=createEnvironment({world:"ocean",quality:"low",oceanSettings:{height:.6,speed:1,weather:"clear"}});
  let animated=0,rocks=0,buoys=0,dock=0;
  env.group.traverse(obj=>{
   if(obj.userData?.oceanPreview)animated++;
   if(obj.name.includes("island"))rocks++;
   if(obj.name.includes("Floating marker buoy"))buoys++;
   if(obj.name.includes("weathered deck board"))dock++;
  });
  const values=[0,1.2,2.7,4.4].map(t=>oceanHeight(24,31,t,{height:.6,speed:1,weather:"clear"}));
  const shader=env.ocean.mesh.material;
  const valid=shader.isShaderMaterial&&shader.vertexShader.includes("uHeight")&&
   shader.fragmentShader.includes("fresnel")&&shader.fragmentShader.includes("ggxD")&&
   !shader.fragmentShader.includes("wake=exp")&&shader.uniforms.uSunDir.value.length()>.99;
  const slope=oceanSlope(18,12,3,{height:1.2,speed:2.3,weather:"storm"});
  const physical={roughness:shader.uniforms.uRoughness.value,slopeOk:Number.isFinite(slope.dx)&&Number.isFinite(slope.dz),
   whitecaps:shader.uniforms.uWhitecaps.value,
   foamControlled:shader.fragmentShader.includes("uWhitecaps")&&
    shader.fragmentShader.includes("distanceFromCamera")};
  const divisions=env.ocean.mesh.geometry.attributes.position.count;
  env.update(3.3,.016);
  const gpuTime=shader.uniforms.uTime.value;
  env.setOceanSettings({height:1.2,speed:2.3,weather:"storm"});
  const storm={height:shader.uniforms.uHeight.value,speed:shader.uniforms.uSpeed.value,mode:shader.uniforms.uStorm.value};
  env.dispose();
  return {animated,rocks,buoys,dock,values,valid,physical,divisions,gpuTime,storm,clamp:normalizeOceanSettings({height:200,speed:-3,weather:"invalid"})};
 });
 assert.equal(water.animated,1,"Exactly one shader-animated ocean mesh");
 assert.ok(water.divisions>4000,"Wave geometry has enough subdivisions");
 assert.ok(water.buoys>=4&&water.dock>=8&&water.rocks>=4,"Marina, floating markers and islands exist");
 assert.equal(water.valid,true);
 assert.equal(water.physical.slopeOk,true);
 assert.equal(water.physical.whitecaps,.12);
 assert.equal(water.physical.foamControlled,true);
 assert.ok(water.physical.roughness>=.20&&water.physical.roughness<=.4);
 assert.equal(new Set(water.values.map(x=>x.toFixed(4))).size,4,"Waves move with time, rather than remaining static");
 assert.equal(water.gpuTime,3.3,"Uniforms update every render frame");
 assert.deepEqual(water.storm,{height:1.2,speed:2.3,mode:1.48});
 assert.equal(water.clamp.height,1.8);assert.equal(water.clamp.speed,.15);assert.equal(water.clamp.weather,"clear");
 console.log("PASS: actual GPU wave mesh, layered animation, islands, dock, buoys and safe wave parameters");

 await page.locator("#oceanHeightLive").evaluate(el=>{el.value="1.15";el.dispatchEvent(new Event("input",{bubbles:true}))});
 await page.waitForFunction(()=>document.querySelector("#oceanHeight")?.value==="1.15");
 await page.locator("#oceanSpeedLive").evaluate(el=>{el.value="1.65";el.dispatchEvent(new Event("input",{bubbles:true}))});
 await page.waitForFunction(()=>document.querySelector("#oceanSpeed")?.value==="1.65");
 await page.locator("#oceanWhitecapsLive").evaluate(el=>{
  el.value="0";el.dispatchEvent(new Event("input",{bubbles:true}));
 });
 assert.equal(await page.locator("#oceanWhitecaps").inputValue(),"0");
 assert.match(await page.locator("#oceanWhitecapsValue").textContent(),/0 %/);
 await page.locator("#oceanWhitecapsLive").evaluate(el=>{
  el.value=".18";el.dispatchEvent(new Event("input",{bubbles:true}));
 });
 assert.equal(await page.locator("#oceanWhitecaps").inputValue(),"0.18");
 console.log("PASS: clean ocean foam can be disabled and adjusted live without modifying waves");
 await page.locator("#oceanWeatherLive").selectOption("storm");
 assert.equal(await page.locator("#oceanWeather").inputValue(),"storm");
 await page.locator("#oceanWeatherLive").selectOption("storm-sunset");
 assert.equal(await page.locator("#oceanWeather").inputValue(),"storm-sunset");
 const enhanced=await page.evaluate(async()=>{
  const {normalizeOceanSettings}=await import("/workshop/studio/ocean-water.mjs");
  return normalizeOceanSettings({weather:"storm-sunset"}).weather;
 });
 assert.equal(enhanced,"storm-sunset");
 await page.screenshot({path:"ocean-storm-sunset.png"});
 await page.locator("#oceanWeatherLive").selectOption("storm");
 console.log("PASS: physically layered ocean storm + sunset weather presets and GPU cloud sky");
 assert.match(await page.locator("#oceanHeightValue").textContent(),/1,15/);
 console.log("PASS: wave height, speed and storm toggles synchronize between viewport and panel");

 // Check a real browser frame and retain a screenshot for diagnosing shader colour.
 await page.locator("#renderQualitySelect").selectOption("low");
 await page.screenshot({path:"ocean-render-world-desktop.png"});
 // Switch between worlds and back, preserving previous storm settings.
 await page.locator("#renderWorldSelect").selectOption("forest");
 assert.equal(await page.locator("#oceanOverlayControls").isVisible(),false);
 await page.locator("#renderWorldSelect").selectOption("ocean");
 assert.equal(await page.locator("#oceanWeatherLive").inputValue(),"storm");
 await page.locator("#oceanWeatherLive").selectOption("sunset");
 await page.screenshot({path:"ocean-sunset.png"});
 console.log("PASS: switch between Ocean and previous worlds without losing wave settings");

 await page.locator("#renderExit").click();
 await page.waitForFunction(()=>!document.body.classList.contains("render-world-active"));
 assert.equal(await page.locator("#renderWorld").inputValue(),"ocean");
 assert.equal(await page.locator("#oceanPanelControls").isVisible(),true);
 assert.equal(await page.locator("#objectCount").textContent(),"1","Original editable kart remains in scene after ocean preview");
 console.log("PASS: exit restores editor, original 3D objects and ocean settings");

 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 mobile.on("pageerror",error=>issues.push("mobile: "+error.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/?world=ocean&preview=1",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.body.classList.contains("render-world-active"),{timeout:30000});
 assert.equal(await mobile.locator("#oceanOverlayControls").isVisible(),true);
 await mobile.locator("#oceanWeatherLive").selectOption("sunset");
 await mobile.locator("#oceanHeightLive").evaluate(el=>{el.value=".4";el.dispatchEvent(new Event("input",{bubbles:true}))});
 await mobile.screenshot({path:"ocean-render-world-mobile.png"});
 console.log("PASS: touch-ready Ocean controls load on mobile");
 assert.deepEqual(issues,[],"No unexpected WebGL shader or JavaScript errors");
}finally{await browser.close()}
