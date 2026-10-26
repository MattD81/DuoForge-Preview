import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]
});
try{
 const page=await browser.newPage({viewport:{width:1350,height:900}});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});
 const result=await page.evaluate(async()=>{
  const THREE=await import("three");
  const {classifyWheelName,inspectWheels,createWheelRig}=await import("./wheel-rig.mjs");
  const names=[
   "Right Front sport tire 305 profile","Right Front grouped forged",
   "Right Front centre locking alloy hub","Right Front ventilated rotor ring",
   "Right Front bright yellow performance brake caliper",
   "Right Front caliper racing insignia",
   "Right Front flared painted wheel arch","Right Front rounded external sidewall"
  ];
  const labels=names.map(name=>({name,include:!!classifyWheelName(name)}));
  const underscoreNames=[
   "Left_Front_sport_tire_305_profile","Right_Rear_centre_locking_alloy_hub",
   "Left_Front_bright_yellow_performance_brake_caliper","Left_front_flared_wheel_arch"
  ].map(name=>!!classifyWheelName(name));
  const model=new THREE.Group();model.name="Synthetic Vortex GTR";
  const original=new Map(),calipers=[];
  function mesh(name,x,y,z,w=.3){
   const geometry=new THREE.BoxGeometry(w,.78,.78);
   geometry.translate(x,y,z); // Mimics the real Vortex GLB with baked geometry coordinates
   const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
   m.name=name;model.add(m);
   original.set(m,{parent:m.parent,p:m.position.clone(),q:m.quaternion.clone(),s:m.scale.clone()});
   return m;
  }
  for(const side of ["Left","Right"])for(const axle of ["Front","Rear"]){
   const x=side==="Left"?-1.05:1.05,z=axle==="Front"?-1.47:1.4;
   mesh(side+" "+axle+" sport tire 305 profile",x,.49,z);
   mesh(side+" "+axle+" grouped forged",x,.49,z,.1);
   mesh(side+" "+axle+" centre locking alloy hub",x,.49,z,.06);
   mesh(side+" "+axle+" ventilated rotor ring",x,.49,z,.05);
   const caliper=mesh(side+" "+axle+" bright yellow performance brake caliper",x,.58,z+.2,.11);
   calipers.push(caliper);
  }
  const analysis=inspectWheels(model);
  const groups=analysis.wheels.map(w=>({key:w.key,axis:w.axis,center:w.center.toArray()}));
  const rig=createWheelRig(model);
  const caliperParents=calipers.map(m=>m.parent);
  const spinBefore=rig.wheels.map(w=>w.spin.rotation.x);
  rig.step({distance:1.5,steerInput:.5,steerDegrees:28,wheelRadius:.4});
  const animation=rig.wheels.map(w=>({key:w.key,rollX:w.spin.rotation.x,rollY:w.spin.rotation.y,steerY:w.steer.rotation.y}));
  // For a -Z-facing Vortex GTR, local +Y steering MUST turn the front
  // wheel's -Z heading toward world +X (driver's right).
  const rightFront=rig.wheels.find(w=>w.key==="right-front");
  const rightHeadingX=new THREE.Vector3(0,0,-1).applyAxisAngle(
   new THREE.Vector3(0,1,0),rightFront.steer.rotation.y
  ).x;
  rig.step({distance:0,steerInput:-.5,steerDegrees:28,wheelRadius:.4});
  const leftHeadingX=new THREE.Vector3(0,0,-1).applyAxisAngle(
   new THREE.Vector3(0,1,0),rightFront.steer.rotation.y
  ).x;
  rig.step({distance:0,steerInput:-1,steerAngleDegrees:8,steerDegrees:28,wheelRadius:.4});
  const syncedAngle=rightFront.steer.rotation.y;
  const calipersUntouched=calipers.every((m,i)=>m.parent===caliperParents[i]&&m.rotation.x===0&&m.rotation.y===0);
  rig.dispose();
  let exactRestore=model.children.length===original.size;
  for(const [m,before] of original){
   exactRestore &&= m.parent===before.parent&&m.position.equals(before.p)&&m.quaternion.equals(before.q)&&m.scale.equals(before.s);
  }
  // Default kart also uses axle X; should still be detected and reversible.
  const kart=new THREE.Group();kart.name="Kart";
  for(const x of [-1.1,1.1])for(const z of [-1.1,1.1]){
   const cyl=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.3,20),new THREE.MeshBasicMaterial());
   cyl.rotation.z=Math.PI/2;cyl.position.set(x,.42,z);cyl.name="wheel_"+x+"_"+z+"_tire";kart.add(cyl);
  }
  const kartRig=createWheelRig(kart,{forwardSign:1});
  const kartAxes=kartRig.wheels.map(w=>w.axis);
  kartRig.dispose();
  return {labels,groups,forwardSign:analysis.forwardSign,partCount:analysis.partCount,
    rollBefore:spinBefore,animation,rightHeadingX,leftHeadingX,syncedAngle,underscoreNames,calipersUntouched,exactRestore,kartAxes,cartCount:kartRig.count};
 });
 assert.deepEqual(result.labels.map(o=>o.include),[true,true,true,true,false,false,false,true]);
 assert.deepEqual(result.underscoreNames,[true,true,false,false],"GLTFLoader underscore names classify correctly");
 assert.equal(result.groups.length,4);
 assert.deepEqual(result.groups.map(x=>x.key).sort(),["left-front","left-rear","right-front","right-rear"]);
 assert.equal(result.forwardSign,-1,"Vortex front is on -Z");
 assert.ok(result.groups.every(w=>w.axis==="x"),"Axle is X, not Y");
 assert.equal(result.partCount,16,"4 animated parts per wheel; no brake calipers");
 assert.ok(result.animation.every(w=>w.rollX<0),"Forward rotation on X is negative for -Z vehicle");
 assert.ok(result.animation.every(w=>w.rollY===0),"No erroneous Y-axis wheel spin");
 assert.ok(result.animation.filter(w=>w.key.endsWith("front")).every(w=>w.steerY<0),"Right steer produces negative local Y on front axle");
 assert.ok(result.rightHeadingX>0,"Right steer on -Z model physically points wheels toward +X");
 assert.ok(result.leftHeadingX<0,"Left steer on -Z model physically points wheels toward -X");
 assert.ok(Math.abs(result.syncedAngle+8*Math.PI/180)<1e-9,"Visual negative Y angle follows logical positive right-steer degrees");
 assert.ok(result.animation.filter(w=>w.key.endsWith("rear")).every(w=>w.steerY===0),"Rear axle doesn't steer");
 assert.equal(result.calipersUntouched,true,"Brake calipers remain stationary");
 assert.equal(result.exactRestore,true,"Original scene hierarchy/transforms are restored after driving");
 assert.equal(result.cartCount,4,"Original kart remains supported");
 assert.ok(result.kartAxes.every(a=>a==="x"));
 console.log("PASS: Vortex GTR 4 wheels, X-axis spin, separate steering, fixed calipers and non-destructive rig teardown");
 console.log("PASS: Original DuoForge kart wheel alignment remains correct");
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
