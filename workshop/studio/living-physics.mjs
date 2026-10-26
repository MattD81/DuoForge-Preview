// DuoForge Living Objects — deterministic, dependency-free 2D vehicle motion.
// Units: metres, seconds, radians. +Z is the vehicle's forward axis.
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
export function driveStep(state,control,seconds,config=VEHICLE_DEFAULTS){
 const cfg=vehicleConfig(config),dt=clamp(seconds,0,.06);
 const throttle=clamp(Number(control.throttle)||0,0,1);
 const brake=clamp(Number(control.brake)||0,0,1);
 const steer=clamp(Number(control.steer)||0,-1,1);
 const handbrake=Boolean(control.handbrake);
 let speed=Number(state.speed)||0;
 // Brake first slows a forward-moving vehicle, then engages reverse.
 if(brake>0&&speed>0) speed=Math.max(0,speed-cfg.braking*brake*dt);
 else if(brake>0) speed=Math.max(-cfg.reverseSpeed,speed-cfg.acceleration*.72*brake*dt);
 if(throttle>0&&speed<0) speed=Math.min(0,speed+cfg.braking*throttle*dt);
 else if(throttle>0) speed=Math.min(cfg.maxSpeed,speed+cfg.acceleration*throttle*dt);
 if((throttle===0&&brake===0)||handbrake){
  const drag=cfg.rollingResistance*(handbrake?7:1)*dt;
  speed=Math.abs(speed)<=drag?0:speed-Math.sign(speed)*drag;
 }
 const currentYaw=Number(state.yaw)||0;
 const yaw=currentYaw+Math.tan(cfg.steeringDegrees*Math.PI/180)*steer*speed/cfg.wheelBase*dt;
 const stepDistance=speed*dt;
 return {
  x:(Number(state.x)||0)+Math.sin(yaw)*stepDistance,
  z:(Number(state.z)||0)+Math.cos(yaw)*stepDistance,
  yaw,speed,
  distance:(Number(state.distance)||0)+Math.abs(stepDistance)
 };
}
