// Shared, deterministic deep-water directional spectrum (CPU and WebGL).
// Tuned for filmic swell/chop, not a full FFT ocean or Navier-Stokes simulation.
// Wavelengths use irrational ratios/phases to avoid obvious repeating tiling.
export const SPECTRUM=Object.freeze([
 [ .36, .049, .018, .76, .38],
 [ .26,-.041, .068,1.04,1.61],
 [ .17, .080,-.055,1.34,2.17],
 [ .11,-.110, .093,1.71, .83],
 [ .057,.145, .039,2.05,2.93],
 [ .048,-.105,-.161,2.43,1.40],
 [ .026,.195,-.111,2.91,4.04],
].map(w=>Object.freeze(w)));
export const isStorm=weather=>weather==="storm"||weather==="storm-sunset";
export function spectralHeight(x,z,time,amplitude=1,velocity=1){
 const t=time*velocity;let out=0;
 for(const [a,kx,kz,omega,phase] of SPECTRUM)out+=a*Math.sin(x*kx+z*kz-t*omega+phase);
 return out*amplitude;
}
export function spectralSlope(x,z,time,amplitude=1,velocity=1){
 const t=time*velocity;let dx=0,dz=0;
 for(const [a,kx,kz,omega,phase] of SPECTRUM){
  const c=amplitude*a*Math.cos(x*kx+z*kz-t*omega+phase);
  dx+=c*kx;dz+=c*kz;
 }
 return {dx,dz};
}
const f=n=>Number(n).toFixed(8);
export const spectralGLSL=SPECTRUM.map(([a,kx,kz,omega,phase])=>
 `${f(a)}*sin(p.x*${f(kx)}+p.y*${f(kz)}-t*${f(omega)}+${f(phase)})`).join("+");
export const slopeGLSL={x:SPECTRUM.map(([a,kx,kz,omega,phase])=>
 `${f(a*kx)}*cos(p.x*${f(kx)}+p.y*${f(kz)}-t*${f(omega)}+${f(phase)})`).join("+"),
 z:SPECTRUM.map(([a,kx,kz,omega,phase])=>
 `${f(a*kz)}*cos(p.x*${f(kx)}+p.y*${f(kz)}-t*${f(omega)}+${f(phase)})`).join("+")};
