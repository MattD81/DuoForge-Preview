import test from "node:test";
import assert from "node:assert/strict";
import {normalizeConfig} from "../game-builder/planner.mjs";
import {graphFor,cleanPair} from "../game-builder/architect-ui.mjs";

test("Architect gameplay graph reports actual standard runtime mechanics",()=>{
 const game=normalizeConfig({id:"preserved",world:"ocean",hero:"viking",levels:6,enemies:0,collectibles:4});
 const steps=graphFor(game);
 assert.equal(steps.length,5);
 assert.match(steps[1][2],/Hav/);
 assert.match(steps[2][2],/Viking/);
 assert.match(steps[3][2],/0 fiender/);
 assert.match(steps[4][2],/6 banor/);
 assert.equal(game.id,"preserved");
});
test("Architect numeric controls stay inside existing runtime limits",()=>{
 assert.equal(cleanPair("99",1,10),10);
 assert.equal(cleanPair("-5",0,12),0);
 assert.equal(cleanPair("4.8",0,12),5);
 assert.equal(cleanPair("not-a-number",1,10),1);
});
test("Architect controls show available worlds, no invented gameplay systems",()=>{
 const graph=graphFor(normalizeConfig({world:"forest",quality:"auto"}));
 assert.match(graph[1][2],/Skog/);
 assert.ok(graph.every(step=>step.length===3));
 assert.equal(graph[4][1],"Nästa nivå");
});
