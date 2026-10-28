import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]
});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on("pageerror",e=>errors.push("desktop "+e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push("desktop console "+m.text())});
 await page.goto("http://127.0.0.1:8080/games/stormblade-duel/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>typeof window.__stormblade?.state==="function",{timeout:30000});
 assert.equal(await page.locator("#fatal").isVisible(),false);
 assert.equal(await page.locator("#modal").isVisible(),true);
 await page.locator("#start").click();
 assert.equal((await page.evaluate(()=>window.__stormblade.state())).running,true);
 const first=await page.evaluate(()=>window.__stormblade.state());
 await page.screenshot({path:"stormblade-desktop.png"});
 await page.keyboard.down("d");
 // Software Chromium can render only a handful of 3D frames per second.
 // Wait for simulation progress instead of assuming wall-time equals game-time.
 await page.waitForFunction(arg=>{const s=window.__stormblade.state();
  return s.playerX>arg.firstX+.4&&Math.abs(s.enemyX-s.playerX)<1.8;
 },{firstX:first.playerX},{timeout:20000}).catch(async()=>{
  throw Error("Fighters did not approach: "+JSON.stringify(await page.evaluate(()=>window.__stormblade.state())));
 });
 await page.keyboard.up("d");
 const second=await page.evaluate(()=>window.__stormblade.state());
 assert.ok(second.playerX>first.playerX+.4,JSON.stringify({first,second}));
 await page.keyboard.press("j");
 await page.waitForFunction(()=>{const s=window.__stormblade.state();return s.enemyHp<100||s.playerHp<100},null,{timeout:16000});
 const fight=await page.evaluate(()=>window.__stormblade.state());
 assert.ok(fight.enemyHp<100||fight.playerHp<100,JSON.stringify(fight));
 await page.locator("#quality").click();
 assert.equal((await page.evaluate(()=>window.__stormblade.state())).mode,"quality");
 await page.locator("#quality").click();
 assert.equal((await page.evaluate(()=>window.__stormblade.state())).mode,"performance");
 await page.locator("#quality").click();
 assert.equal((await page.evaluate(()=>window.__stormblade.state())).mode,"off");
 await page.locator("#quality").click();
 assert.equal((await page.evaluate(()=>window.__stormblade.state())).mode,"auto");
 await page.screenshot({path:"stormblade-desktop.png"});
 await page.locator("#restart").click();
 const reset=await page.evaluate(()=>window.__stormblade.state());
 assert.equal(reset.playerHp,100);assert.equal(reset.enemyHp,100);
 assert.equal(reset.running,true);
 console.log("PASS: 3D rendered, fight movement/combat, GPU Deluxe profiles, full reset");
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 mobile.on("pageerror",e=>errors.push("mobile "+e.message));
 await mobile.goto("http://127.0.0.1:8080/games/stormblade-duel/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>typeof window.__stormblade?.state==="function",{timeout:30000});
 await mobile.locator("#start").click();
 assert.equal(await mobile.locator('[data-action="attack"]').isVisible(),true);
 const before=await mobile.evaluate(()=>window.__stormblade.state());
 await mobile.bringToFront();
 await mobile.locator('[data-move="right"]').dispatchEvent("pointerdown",{pointerType:"touch",pointerId:45,button:0});
 try{
  // Software WebGL may have a multi-second shader/warmup frame on mobile.
  await mobile.waitForFunction(arg=>window.__stormblade.state().playerX>arg.initial+.03,
   {initial:before.playerX},{timeout:20000});
 }finally{
  await mobile.locator('[data-move="right"]').dispatchEvent("pointerup",{pointerType:"touch",pointerId:45,button:0});
 }
 const after=await mobile.evaluate(()=>window.__stormblade.state());
 assert.ok(after.playerX>before.playerX,JSON.stringify({before,after}));
 await mobile.locator('[data-action="attack"]').dispatchEvent("pointerdown",{pointerType:"touch",pointerId:46,button:0});
 await mobile.locator('[data-action="attack"]').dispatchEvent("pointerup",{pointerType:"touch",pointerId:46,button:0});
 await mobile.screenshot({path:"stormblade-mobile.png"});
 assert.equal(await mobile.locator("#fatal").isVisible(),false);
 console.log("PASS: mobile 3D WebGL, touch movement/attack, responsive HUD");
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
