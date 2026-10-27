import test from "node:test";
import assert from "node:assert/strict";
import {denoisePixels} from "../workshop/studio/cinema-denoise.mjs";

test("denoise preserves alpha, suppresses minor RGB noise and does not invent opaque pixels",()=>{
 const w=7,h=7,d=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){d[4*i]=120;d[4*i+1]=122;d[4*i+2]=124;d[4*i+3]=i%2?255:100;}
 d[4*(3*w+3)]=136;const result=denoisePixels(d,w,h);
 assert.ok(result[4*(3*w+3)]<136);
 assert.equal(result[4*(3*w+3)+3],d[4*(3*w+3)+3]);
 assert.notEqual(result,d);
});
test("denoising is edge aware and checks dimensions",()=>{
 const w=6,h=5,data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let i=(y*w+x)*4;data[i]=x<3?0:255;data[i+1]=data[i+2]=data[i];data[i+3]=255;
 }
 const smooth=denoisePixels(data,w,h);
 assert.ok(smooth[(2*w+2)*4]<20);
 assert.ok(smooth[(2*w+3)*4]>235);
 assert.throws(()=>denoisePixels(data,w+1,h),/pixelunderlag/);
});
