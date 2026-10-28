import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]
});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:780},deviceScaleFactor:1});
 page.on("pageerror",error=>errors.push("pageerror: "+error.message));
 page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text())});
 await page.goto("http://127.0.0.1:8080/games/aetherfall/",{waitUntil:"domcontentloaded",timeout:30000});
 assert.ok(await page.locator("#start").isVisible());
 await page.locator("#start").click();
 await page.waitForFunction(()=>document.querySelector("#startScreen")?.classList.contains("hidden"),{timeout:30000});
 await page.waitForFunction(()=>/^[0-9A-F]{7}$/.test(document.querySelector("#dna")?.textContent||""),{timeout:15000});
 assert.match(await page.locator("#perf").textContent(),/FUSION LoD/);
 assert.match(await page.locator("#place").textContent(),/SOLTEMPLET/);
 await page.keyboard.down("KeyW");await page.waitForTimeout(450);await page.keyboard.up("KeyW");
 await page.keyboard.press("KeyJ");
 await page.keyboard.press("KeyE");
 await page.locator("#pauseButton").click();
 assert.ok(await page.locator("#pauseScreen").isVisible());
 await page.locator("#resume").click();
 assert.ok(await page.locator("#pauseScreen").isHidden());
 await page.screenshot({path:"aetherfall-desktop.png"});
 console.log("PASS desktop: rendered scene, real Fusion LoD/SceneDNA, movement, attack, pulse, pause/resume");
 assert.deepEqual(errors,[],"No desktop page JavaScript errors");
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const mobileErrors=[];
 mobile.on("pageerror",e=>mobileErrors.push(e.message));
 await mobile.goto("http://127.0.0.1:8080/games/aetherfall/",{waitUntil:"domcontentloaded",timeout:30000});
 await mobile.locator("#start").click();
 await mobile.waitForFunction(()=>document.querySelector("#startScreen")?.classList.contains("hidden"),{timeout:30000});
 assert.equal(await mobile.locator("#touchControls button").count(),8);
 assert.ok(await mobile.locator('[data-action="attack"]').isVisible());
 await mobile.locator('[data-move="up"]').tap();
 await mobile.locator('[data-action="attack"]').tap();
 await mobile.locator('[data-action="dash"]').tap();
 const layout=await mobile.evaluate(()=>({innerWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvas:document.getElementById("stage").getBoundingClientRect().width}));
 assert.ok(layout.scrollWidth<=layout.innerWidth+1,"Mobile must not scroll sideways");
 assert.ok(layout.canvas>=390,"3D canvas occupies device width");
 await mobile.screenshot({path:"aetherfall-mobile.png",fullPage:true});
 console.log("PASS mobile: fullscreen 3D, 8 touch controls, no horizontal overflow");
 assert.deepEqual(mobileErrors,[],"No mobile script errors");
}finally{await browser.close();}
