import test from "node:test";
import assert from "node:assert/strict";
import {LEVELS,PORTAL,startGame,step,advanceLevel,canOpenPortal,distance} from "./logic.mjs";
const tick=(state,input,seconds)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)step(state,input,.05);return state;};
test("three genuinely different maps and real objectives",()=>{
 assert.equal(LEVELS.length,3);
 const mapKeys=new Set(LEVELS.map(x=>JSON.stringify([x.cores,x.enemies])));
 assert.equal(mapKeys.size,3);
 const state=startGame();
 assert.equal(state.status,"playing");
 assert.equal(state.enemies.length,4);
 assert.equal(state.cores.length,3);
});
test("movement normalizes diagonal input and prevents fall off island",()=>{
 const state=startGame();const x=state.player.x,z=state.player.z;
 step(state,{x:1,z:-1},.05);
 assert.ok(state.player.x>x);assert.ok(state.player.z<z);
 tick(state,{x:1,z:0},10);
 assert.ok(Math.hypot(state.player.x,state.player.z)<=24.21);
 assert.ok(state.player.hp>=0);
});
test("jump, dash, attack and pulse spend energy / apply damage",()=>{
 const s=startGame();s.enemies[0].x=0;s.enemies[0].z=10;
 step(s,{jump:true},.05);assert.ok(s.player.y>0);
 s.player.x=0;s.player.z=12;
 step(s,{attack:true},.05);
 assert.ok(s.enemies[0].hp<55);assert.ok(s.events.some(x=>x.type==="slash"));
 tick(s,{},.5);
 const energy=s.player.energy;
 step(s,{pulse:true},.05);
 assert.ok(s.player.energy<energy);assert.ok(s.events.some(x=>x.type==="pulse"));
 tick(s,{},1);
 const before=s.player.x;
 step(s,{x:1,dash:true},.05);
 assert.ok(s.player.x>before+.6);assert.ok(s.events.some(x=>x.type==="dash"));
});
test("core pickup gates exit with minimum guardian eliminations",()=>{
 const s=startGame();
 for(const c of s.cores){s.player.x=c.x;s.player.z=c.z;step(s,{},.05);}
 assert.equal(s.cores.filter(c=>c.got).length,3);
 assert.equal(canOpenPortal(s),false);
 const target=s.enemies.slice(0,2);
 for(const e of target){e.x=0;e.z=10;}
 s.player.x=0;s.player.z=12;
 for(let i=0;i<3;i++){tick(s,{},.36);step(s,{attack:true},.05);}
 assert.ok(s.kills>=2);
 assert.equal(canOpenPortal(s),true);
 s.player.x=PORTAL.x;s.player.z=PORTAL.z;
 step(s,{},.05);
 assert.equal(s.status,"level-complete");
 const next=advanceLevel(s);
 assert.equal(next.level,1);
 assert.equal(next.score,s.score+500);
 assert.ok(next.player.hp>=70);
});
test("final world ends with victory, defeated player loses",()=>{
 const s=startGame(2);
 for(const core of s.cores)core.got=true;
 s.kills=s.requiredKills; s.player.x=PORTAL.x;s.player.z=PORTAL.z;
 step(s,{},.016);assert.equal(s.status,"won");
 const dead=startGame();
 dead.player.hp=1;dead.player.x=0;dead.player.z=1;
 dead.enemies[0].x=0;dead.enemies[0].z=1;dead.enemies[0].cooldown=0;
 step(dead,{},.05);assert.equal(dead.status,"dead");
 assert.throws(()=>advanceLevel(dead));
});
test("invalid delta does not break invariants",()=>{
 const s=startGame();
 step(s,{x:Infinity,z:Infinity},NaN);
 assert.ok(Number.isFinite(s.player.x));
 assert.ok(Number.isFinite(s.player.hp));
 assert.ok(Number.isFinite(distance(s.player,{x:0,z:0})));
});
