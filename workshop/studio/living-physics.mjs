// DuoForge Living Objects — deterministic kinematic bicycle model.
// Units: metres, seconds, radians. yaw=0 points to world +Z; positive steering
// always means turn right RELATIVE TO THE DRIVER, even for −Z-facing GLB assets.
export const VEHICLE_DEFAULTS=Object.freeze({
 kind:"vehicle",version:1,maxSpeed:19,reverseSpeed:6,acceleration:9,
 braking:16,rollingResistance:2.2,wheelBase:2.2,steeringDegrees:28,
 wheelRadius:0.42
});
export function clamp(value,min,max){return Math.min(max,Math.max(min,value))}
export function vehicleConfig(raw={}){
 const safe=(key,min,max)=>clamp(Number.isFinite(Number(raw[key]))?Number(raw[key]):VEHICLE_DEFAULTS[key],min,max);
 return {
  kind:"vehicle",version:1,
  maxSpeed:safe("maxSpeed",1,60),
  reverseSpeed:safe("reverseSpeed",1,25),
  acceleration:safe("acceleration",.5,35),
  braking:safe("braking",1,55),
  rollingResistance:safe("rollingResistance",.1,20),
  wheelBase:safe("wheelBase",.5,12),
  steeringDegrees:safe("steeringDegrees",5,50),
  wheelRadius:safe("wheelRadius",.05,3)
 };
}
export function steeringLimit(speed){
 // Give vehicles a useful low-speed turning radius but avoid sudden spinning
 // at motorway speeds. This is simple arcade stabilization, not tyre physics.
 const v=Math.abs(Number(speed)||0);
 return clamp(1/(1+Math.pow(v/9,1.4)),.27,1);
}
export function driveStep(state,control,seconds,config=VEHICLE_DEFAULTS){
 const cfg=vehicleConfig(config),dt=clamp(seconds,0,.06);
 const throttle=clamp(Number(control.throttle)||0,0,1);
 const brake=clamp(Number(control.brake)||0,0,1);
 const steerInput=clamp(Number(control.steer)||0,-1,1);
 const handbrake=Boolean(control.handbrake);
 let speed=Number(state.speed)||0;
 if(brake>0&&speed>0)speed=Math.max(0,speed-cfg.braking*brake*dt);
 else if(brake>0)speed=Math.max(-cfg.reverseSpeed,speed-cfg.acceleration*.72*brake*dt);
 if(throttle>0&&speed<0)speed=Math.min(0,speed+cfg.braking*throttle*dt);
 else if(throttle>0)speed=Math.min(cfg.maxSpeed,speed+cfg.acceleration*throttle*dt);
 if((throttle===0&&brake===0)||handbrake){
  const drag=cfg.rollingResistance*(handbrake?7:1)*dt;
  speed=Math.abs(speed)<=drag?0:speed-Math.sign(speed)*drag;
 }
 // Keyboard/touch/gamepad all share the same smooth, frame-rate-independent
 // steering state. The same physical wheel angle is used for rendering and yaw.
 const previousSteering=clamp(Number(state.steering)||0,-1,1);
 const smooth=1-Math.exp(-9*dt);
 const steering=previousSteering+(steerInput-previousSteering)*smooth;
 const steerAngleDegrees=steering*cfg.steeringDegrees*steeringLimit(speed);
 const steerAngle=steerAngleDegrees*Math.PI/180;
 const previousYaw=Number(state.yaw)||0;
 // Three.js rotates +Z toward +X for positive Y. A driver's right
 // is -X for +Z-forward vehicles and +X for -Z-forward vehicles, so
 // steering-right MUST DECREASE world yaw for both model orientations.
 const yaw=previousYaw-Math.tan(steerAngle)*speed/cfg.wheelBase*dt;
 const stepDistance=speed*dt;
 const midpointYaw=(previousYaw+yaw)/2;
 return {
  x:(Number(state.x)||0)+Math.sin(midpointYaw)*stepDistance,
  z:(Number(state.z)||0)+Math.cos(midpointYaw)*stepDistance,
  yaw,speed,steering,steerAngleDegrees,
  distance:(Number(state.distance)||0)+Math.abs(stepDistance)
 };
}
