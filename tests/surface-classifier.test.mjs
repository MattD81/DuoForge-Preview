import test from "node:test";
import assert from "node:assert/strict";
import {classifySurfaceName} from "../workshop/studio/surface-classifier.mjs";

test("Vortex GTR wheel rubber is separate from brake caliper and rim",()=>{
 assert.equal(classifySurfaceName("Left_Front_sport_tire_305_profile","","true"),"rubber");
 assert.equal(classifySurfaceName("Right Front bright yellow performance brake caliper","","true"),"brushed");
 assert.equal(classifySurfaceName("Right_Rear_centre_locking_alloy_hub","","true"),"brushed");
 assert.equal(classifySurfaceName("Vortex GTR body panel","","true"),"paint");
});
test("glass, interiors and hard surfaces have distinct finishes",()=>{
 assert.equal(classifySurfaceName("Front windshield","","true"),"glass");
 assert.equal(classifySurfaceName("Seat leather","","true"),"leather");
 assert.equal(classifySurfaceName("oak wood deck","","false"),"wood");
 assert.equal(classifySurfaceName("Brick wall","","false"),"brick");
 assert.equal(classifySurfaceName("Road asphalt","","false"),"asphalt");
 assert.equal(classifySurfaceName("Tree trunk","","false"),"bark");
 assert.equal(classifySurfaceName("Foliage leaf","","false"),"grass");
});
test("unknown parts default to paint only on known vehicles",()=>{
 assert.equal(classifySurfaceName("random mesh","","false"),null);
 assert.equal(classifySurfaceName("random mesh","",false),null);
 assert.equal(classifySurfaceName("random mesh","",true),"paint");
});
test("GLTF underscore names classify correctly",()=>{
 assert.equal(classifySurfaceName("Left_Front_sidewall","","true"),"rubber");
 assert.equal(classifySurfaceName("Front_window_glass","","true"),"glass");
 assert.equal(classifySurfaceName("brake_caliper","","true"),"brushed");
});
