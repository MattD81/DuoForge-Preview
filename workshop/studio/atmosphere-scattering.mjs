// DuoForge atmospheric-scattering foundation: analytic single-scattering approximation.
// Not a Bruneton multi-scattering LUT or a volumetric cloud simulation.
// Shared solar direction for sky shader, ocean reflections and world lighting.
export const SUN_ELEVATION_PRESETS=Object.freeze({
 clear:42, sunset:7, storm:24, "storm-sunset":7
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function sunElevationFor(weather="clear"){
 return SUN_ELEVATION_PRESETS[weather]??SUN_ELEVATION_PRESETS.clear;
}
export function normalizedSunElevation(value,fallback=42){
 const number=Number(value);
 return clamp(Number.isFinite(number)?number:fallback,1,80);
}
export function sunDirection(elevation=42){
 const radians=normalizedSunElevation(elevation)*Math.PI/180;
 const y=Math.sin(radians),flat=Math.cos(radians);
 const azimuthLength=Math.hypot(-.56,.82);
 return Object.freeze([-0.56/azimuthLength*flat,y,.82/azimuthLength*flat]);
}
// Angular scattering phase functions used by the GPU approximation.
export function rayleighPhase(cosTheta){
 const mu=clamp(Number(cosTheta)||0,-1,1);
 return 3*(1+mu*mu)/(16*Math.PI);
}
export function henyeyGreensteinPhase(cosTheta,g=.76){
 const mu=clamp(Number(cosTheta)||0,-1,1),anisotropy=clamp(g,-.95,.95);
 return (1-anisotropy*anisotropy)/(4*Math.PI*Math.pow(1+anisotropy*anisotropy-2*anisotropy*mu,1.5));
}
export function atmosphereState(weather="clear",sunElevation=sunElevationFor(weather)){
 const elevation=normalizedSunElevation(sunElevation,sunElevationFor(weather));
 const storm=weather==="storm"||weather==="storm-sunset";
 const low=Math.max(0,1-Math.sin(elevation*Math.PI/180)*2.2);
 const position=sunDirection(elevation).map(x=>x*36);
 const fog=storm?"#748b9a":low>.35?"#c9a3a0":"#9abed0";
 const top=storm?"#243550":low>.35?"#34537d":"#4b93be";
 const horizon=storm?(low>.35?"#d69b87":"#70889a"):(low>.35?"#f1aa89":"#92bfd6");
 return {
  elevation, direction:sunDirection(elevation),position,
  sunColor:storm?(low>.35?0xffd6a3:0xcbd9e8):(low>.35?0xffd6a3:0xffefd1),
  power:(storm?1.6:2.9)*(1-.16*low),
  hemisphere:(storm?1.25:1.85)*(1-.18*low),
  skyTop:top,skyHorizon:horizon,fog,
  // Reflection tint uses the same horizon atmosphere as the sky dome.
  waterSky:horizon
 };
}
