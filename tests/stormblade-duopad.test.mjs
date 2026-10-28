import test from "node:test";
import assert from "node:assert/strict";
import {readStandardPad,createGamepadBridge} from "../games/stormblade-duel/duopad-input.mjs";
const controller=()=>({connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))});
test("DuoPad maps sticks, dpad, guard and combat without guessing",()=>{
 const p=controller();p.axes[0]=.8;p.axes[1]=-.75;p.buttons[0].pressed=true;p.buttons[4].pressed=true;
 const out=readStandardPad(p);
 assert.equal(out.right,true);assert.equal(out.up,true);
 assert.equal(out.block,true);assert.equal(out.attack,true);
 assert.equal(out.heavy,false);assert.equal(out.left,false);
 p.axes[0]=.1;p.axes[1]=0;p.buttons[15].pressed=true;
 assert.equal(readStandardPad(p).right,true);
});
test("DuoPad edges fire once per press, trigger again after release",()=>{
 const p=controller(),bridge=createGamepadBridge({getGamepads:()=>[p]});
 assert.equal(bridge.poll().edges.connected,true);
 assert.equal(bridge.poll().edges.connected,false);
 p.buttons[0].pressed=true;
 assert.equal(bridge.poll().edges.attack,true);
 assert.equal(bridge.poll().edges.attack,false);
 p.buttons[0].pressed=false;bridge.poll();
 p.buttons[0].pressed=true;
 assert.equal(bridge.poll().edges.attack,true);
});
test("DuoPad disconnect and unsupported device fail safe",()=>{
 let devices=[null],bridge=createGamepadBridge({getGamepads:()=>devices});
 assert.equal(bridge.poll().connected,false);
 const p=controller();devices=[p];assert.equal(bridge.poll().connected,true);
 devices=[null];assert.equal(bridge.poll().connected,false);
 assert.equal(bridge.poll().block,false);
 assert.equal(readStandardPad({connected:false}).attack,false);
 bridge=createGamepadBridge({getGamepads:()=>{throw Error("permission")}});
 assert.equal(bridge.poll().connected,false);
});
