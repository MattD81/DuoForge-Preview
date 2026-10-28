import test from "node:test";
import assert from "node:assert/strict";
import {atrousDenoisePixels} from "../workshop/studio/cinema-wavelet-denoise.mjs";
test("wavelet denoiser suppresses noise without touching alpha",()=>{
 const w=11,h=9,d=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){d[i*4]=120;d[i*4+1]=120;d[i*4+2]=120;d[i*4+3]=i%2?100:250;}
 d[(4*w+5)*4]=165;
 const result=atrousDenoisePixels(d,w,h,{passes:3});
 assert.ok(result[(4*w+5)*4]<165);
 assert.equal(result[(4*w+5)*4+3],d[(4*w+5)*4+3]);
 assert.notEqual(result,d);
});
test("wavelet denoising retains strong edges",()=>{
 const w=13,h=7,pixels=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=x<6?10:240;pixels[i+3]=255}
 const out=atrousDenoisePixels(pixels,w,h);
 assert.ok(out[(3*w+5)*4]<30);assert.ok(out[(3*w+6)*4]>220);
 assert.throws(()=>atrousDenoisePixels(pixels,7,7),/pixelunderlag/);
});
