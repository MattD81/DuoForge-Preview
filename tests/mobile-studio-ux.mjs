import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--enable-webgl","--disable-gpu-sandbox"
]});
const pageErrors=[];
const boot=async(page)=>{
 page.on("pageerror",e=>pageErrors.push(e.message));
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
};
async function geometry(page){
 return page.evaluate(()=>{
  const ids=[".topbar",".workspace",".viewport","#mobileStudioDock",".left-panel",".right-panel","#scene"];
  const bounds={};
  for(const q of ids){
   const el=document.querySelector(q),r=el?.getBoundingClientRect();
   bounds[q]=r?{x:r.x,y:r.y,width:r.width,height:r.height,display:getComputedStyle(el).display}:null;
  }
  return {bounds,innerWidth:innerWidth,innerHeight:innerHeight,scrollX:document.documentElement.scrollWidth,
   scrollY:document.documentElement.scrollHeight,sheetOpen:document.body.classList.contains("mobile-sheet-open")};
 });
}
try{
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});
 await boot(desktop);
 assert.equal(await desktop.locator("#mobileStudioDock").isVisible(),false);
 assert.equal(await desktop.locator(".left-panel").isVisible(),true);
 assert.equal(await desktop.locator(".right-panel").isVisible(),true);
 console.log("PASS: desktop remains existing three-column editor");
 await desktop.close();

 const portrait=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,acceptDownloads:true});
 await boot(portrait);
 await portrait.waitForSelector("#mobileStudioDock",{state:"visible"});
 assert.equal(await portrait.locator(".left-panel").isVisible(),true);
 assert.equal(await portrait.locator(".right-panel").isVisible(),false);
 let g=await geometry(portrait);
 assert.ok(g.bounds["#scene"].height>=220,"portrait canvas height "+g.bounds["#scene"].height);
 assert.ok(g.scrollX<=g.innerWidth+1,"no horizontal page scroll");
 assert.ok(g.scrollY<=g.innerHeight+1,"no long page scroll");
 assert.ok(g.bounds[".left-panel"].y>=g.bounds[".viewport"].bottom-1||g.bounds[".left-panel"].y>=g.bounds[".viewport"].y,"sheet should be separate from canvas");
 // The existing Character Forge creates real geometry while controls are inside the mobile sheet.
 await portrait.locator("#forgeCreate").click();
 await portrait.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="2");
 assert.equal(await portrait.locator(".mobile-canvas-action[data-forward='undo']").isDisabled(),false);
 await portrait.locator(".mobile-canvas-action[data-forward='undo']").click();
 await portrait.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1");
 await portrait.locator(".mobile-canvas-action[data-forward='redo']").click();
 await portrait.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="2");
 // Save and export are prioritized in the mobile topbar; original data stays in IndexedDB/GLB.
 await portrait.locator("#saveProject").click();
 await portrait.waitForFunction(()=>document.querySelector("#saveIndicator")?.textContent?.includes("Sparad lokalt"));
 const [dl]=await Promise.all([portrait.waitForEvent("download"),portrait.locator("#exportGLB").click()]);
 assert.ok((await dl.path())!==null);
 // One-tap tab changes reveal independent drawers without duplicating controls.
 for(const [tab,target,side] of [["scene","#hierarchy","left"],["material","#materialLabPanel","right"],["dna","#shapeDnaLab","left"],["adjust","#inspector","right"],["create","#characterForge","left"]]){
  await portrait.locator('[data-mobile-tab="'+tab+'"]').click();
  assert.equal(await portrait.locator(target).isVisible(),true,"tab: "+tab);
  assert.equal(await portrait.locator("."+side+"-panel").getAttribute("data-mobile-active"),"true");
  assert.equal(await portrait.locator('[data-mobile-tab="'+tab+'"]').getAttribute("aria-pressed"),"true");
 }
 // In-page subtool shortcuts must reach primitives within the same scrolling sheet.
 await portrait.locator(".mobile-sheet-shortcuts button",{hasText:"Former"}).click();
 await portrait.locator('[data-add="sphere"]').click();
 await portrait.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="3");
 await portrait.locator("#mobilePreviewToggle").click();
 g=await geometry(portrait);
 assert.equal(g.sheetOpen,false);
 assert.equal(await portrait.locator(".left-panel").isVisible(),false);
 assert.ok(g.bounds["#scene"].height>440,"collapsed scene height "+g.bounds["#scene"].height);
 await portrait.locator("#mobilePreviewToggle").click();
 assert.equal(await portrait.locator(".left-panel").isVisible(),true);
 assert.equal(await portrait.locator(".mobile-sheet-close").first().isVisible(),true);
 await portrait.screenshot({path:"mobile-studio-portrait.png"});
 console.log("PASS: mobile create/save/export, 5 tabs, preview/full canvas, shortcuts, undo/redo");

 // 844×390 landscape is still treated as phone through short coarse-pointer query.
 const landscape=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await boot(landscape);
 assert.equal(await landscape.locator("#mobileStudioDock").isVisible(),true);
 g=await geometry(landscape);
 assert.ok(g.bounds["#scene"].height>=140,"landscape canvas height "+g.bounds["#scene"].height);
 assert.ok(!g.sheetOpen,"landscape starts with the 3D viewport expanded");
 await landscape.locator('[data-mobile-tab="create"]').click();
 assert.equal(await landscape.locator(".left-panel").isVisible(),true);
 await landscape.locator("#forgeCreate").click();
 await landscape.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="2");
 await landscape.locator("#mobilePreviewToggle").click();
 assert.equal(await landscape.locator(".left-panel").isVisible(),false);
 await landscape.screenshot({path:"mobile-studio-landscape.png"});
 console.log("PASS: landscape touch create and full-screen preview toggle");
 assert.deepEqual(pageErrors,[]);
}finally{await browser.close()}
