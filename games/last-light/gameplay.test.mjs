import test from "node:test";
import assert from "node:assert/strict";
import {MISSIONS,createGameState,updateGame,compass,wrapAngle,formatTime} from "./gameplay.mjs";
test("LAST LIGHT defines four distinct rescue positions and a safe deterministic state",()=>{
 assert.equal(MISSIONS.length,4);
 assert.equal(new Set(MISSIONS.map(m=>m.x+","+m.z)).size,4);
 const state=createGameState();
 assert.equal(state.rescued,0);assert.equal(state.clock,0);assert.equal(state.won,false);
 assert.equal(formatTime(290),"04:50");
 assert.equal(formatTime(-500),"00:00");
 assert.ok(Math.abs(wrapAngle(4*Math.PI))<1e-10);
});
test("throttle, steering, and braking work with bounded frame time",()=>{
 const init={...createGameState(),started:true};
 let f=init;
 for(let i=0;i<80;i++)f=updateGame(f,{gas:true,steer:.7},.05);
 assert.ok(f.speed>0&&f.speed<=19.5);
 assert.ok(f.x>0,"right turn steers toward +X");
 assert.ok(f.z<init.z,"ship makes forward progress");
 const before=f.speed;
 for(let i=0;i<14;i++)f=updateGame(f,{brake:true},.05);
 assert.ok(f.speed<before);
 assert.ok(Number.isFinite(compass(f).difference));
 assert.deepEqual(init,createGameState()&&{...init},"state updates do not mutate original");
});
test("autopilot rescues four crews without AI calls, and keeps clock within limit",()=>{
 let f={...createGameState(),started:true,auto:true};
 for(let i=0;i<13000&&!f.won&&!f.lost;i++)f=updateGame(f,{},.05);
 assert.equal(f.won,true,"autopilot should finish within time limit");
 assert.equal(f.rescued,4);
 assert.ok(f.score>0);
 assert.ok(f.clock<f.timeLimit);
});
test("mission times out and no simulation runs after win or failure",()=>{
 let f={...createGameState(),started:true,clock:289.99};
 f=updateGame(f,{gas:true},.05);
 assert.equal(f.lost,true);
 assert.deepEqual(updateGame(f,{gas:true},.05),f);
});
