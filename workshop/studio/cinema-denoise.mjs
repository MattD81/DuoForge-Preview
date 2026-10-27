// Lightweight bilateral RGB denoiser for rendered PNG stills.
// Not an AI denoiser or a substitute for more path-tracing samples.
export function denoisePixels(rgba,width,height,strength=26){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
    rgba.length!==width*height*4)throw Error("Felaktigt pixelunderlag.");
 const out=new Uint8ClampedArray(rgba.length);
 const sigma=Math.max(4,Math.min(64,Number(strength)||26));
 const sigmaSq=sigma*sigma*3;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;
  const r=rgba[i],g=rgba[i+1],b=rgba[i+2];
  let wr=0,wg=0,wb=0,sum=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const yy=Math.max(0,Math.min(height-1,y+dy));
   const xx=Math.max(0,Math.min(width-1,x+dx));
   const j=(yy*width+xx)*4;
   const dr=rgba[j]-r,dg=rgba[j+1]-g,db=rgba[j+2]-b;
   const spatial=dx===0&&dy===0?1:dx===0||dy===0?.73:.53;
   const w=spatial/(1+(dr*dr+dg*dg+db*db)/sigmaSq);
   wr+=rgba[j]*w;wg+=rgba[j+1]*w;wb+=rgba[j+2]*w;sum+=w;
  }
  out[i]=wr/sum;out[i+1]=wg/sum;out[i+2]=wb/sum;out[i+3]=rgba[i+3];
 }
 return out;
}
