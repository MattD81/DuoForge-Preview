// End-to-end mobile UX smoke. Run from repository root after starting
// python3 -m http.server 8080 and installing Playwright + Chromium.
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--enable-webgl","--disable-gpu-sandbox"]});
const errors=[];
try{
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 mobile.on("pageerror",error=>errors.push(error.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForSelector("#mobileStudioDock [data-mobile-tab]",{timeout:40000});
 await mobile.waitForSelector("#scene",{state:"visible"});
 assert.equal(await mobile.locator("body").evaluate(el=>el.classList.contains("mobile-sheet-open")),false,"3D must be visible before a tool drawer is requested");
 const desktopOverflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
 assert.equal(desktopOverflow,false,"No horizontal overflow on a phone");
 const initialCanvas=await mobile.locator("#scene").boundingBox();
 assert.ok(initialCanvas.height>450,"Mobile editor must prioritize the 3D view");
 await mobile.locator("#mobileHeaderMore").click();
 assert.equal(await mobile.locator("body.mobile-header-open").count(),1);
 assert.equal(await mobile.locator("#exportGLB").isVisible(),true);
 await mobile.locator("#mobileHeaderMore").click();
 await mobile.locator('[data-mobile-tab="material"]').click();
 assert.equal(await mobile.locator("body.mobile-sheet-open").count(),1);
 assert.equal(await mobile.locator(".right-panel[data-mobile-active=true]").count(),1);
 await mobile.locator('[data-mobile-tab="material"]').click();
 assert.equal(await mobile.locator("body.mobile-sheet-open").count(),0);
 await mobile.locator("#mobileEditorToolsMore").click();
 assert.equal(await mobile.locator("#toolLocal").isVisible(),true);
 await mobile.locator("#mobileEditorToolsMore").click();
 // A real Studio model is loaded on startup. Render World must be a usable
 // full-screen view with status chip rather than a large opaque panel.
 await mobile.locator("#openRenderWorld").click();
 await mobile.waitForSelector("body.render-world-active",{timeout:25000});
 assert.equal(await mobile.locator(".topbar").isVisible(),false);
 const windowHeight=await mobile.evaluate(()=>innerHeight);
 const viewport=await mobile.locator(".viewport").boundingBox();
 assert.ok(viewport.height>=windowHeight-3,"Render World must occupy the complete visual viewport");
 const hud=await mobile.locator(".render-world-hud").boundingBox();
 assert.ok(hud.height<=52,"Default vehicle status must be a compact chip");
 assert.equal(await mobile.locator("#renderResetMission").isVisible(),false);
 await mobile.locator("#mobileHudDetailsToggle").click();
 assert.equal(await mobile.locator("#renderResetMission").isVisible(),true);
 await mobile.locator("#mobileHudDetailsToggle").click();
 await mobile.locator("#mobileRenderOptionsToggle").click();
 assert.equal(await mobile.locator("#renderScreenshot").isVisible(),true);
 await mobile.locator("#mobileRenderOptionsToggle").click();
 await mobile.locator("#renderExit").click();
 await mobile.waitForSelector("body:not(.render-world-active)");
 assert.equal(await mobile.locator("#mobileStudioDock").isVisible(),true);
 // Landscape phone must still keep Exit and drive buttons within bounds.
 await mobile.setViewportSize({width:844,height:390});
 await mobile.locator("#openRenderWorld").click();
 await mobile.waitForSelector("body.render-world-active");
 const exit=await mobile.locator("#renderExit").boundingBox();
 assert.ok(exit&&exit.x>=0&&exit.x+exit.width<=844,"Exit button must remain visible in landscape");
 const controls=mobile.locator("#renderDrivingControls:not([hidden])");
 if(await controls.count()){
  const buttons=controls.locator("button");
  for(let i=0;i<await buttons.count();i++){
   const box=await buttons.nth(i).boundingBox();
   assert.ok(box&&box.x>=0&&box.x+box.width<=844&&box.y>=0&&box.y+box.height<=390,"Driving control clipped");
  }
 }
 await mobile.locator("#renderExit").click();
 assert.deepEqual(errors,[],"No unhandled page errors");
 console.log("PASS Studio mobile: full 3D view, compact HUD, drawers, portrait and landscape");
}finally{await browser.close();}
