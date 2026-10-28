// Browser-local multi-scale à-trous wavelet denoising.
// An edge-preserving fallback, NOT an AI/OpenImageDenoise replacement.
export function atrousDenoisePixels(src,width,height,{passes=3,edgeSigma=30}={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
    !src||src.length!==width*height*4)throw Error("Felaktigt pixelunderlag.");
 const steps=Math.max(1,Math.min(4,Math.floor(passes)));
 let prev=new Uint8ClampedArray(src);
 const sigma=Math.max(2,Math.min(120,Number(edgeSigma)||30));
 const invColor=1/(sigma*sigma*3);
 const offsets=[[-2,0,1],[-1,0,4],[0,0,6],[1,0,4],[2,0,1]];
 // Separable cross-bilateral filtering with successively wider taps
 // improves larger noise scales without turning sharp silhouette edges to mush.
 for(let p=0;p<steps;p++){
  const step=1<<p,next=new Uint8ClampedArray(prev.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=(y*width+x)*4;
   let r=0,g=0,b=0,wSum=0;
   const cr=prev[i],cg=prev[i+1],cb=prev[i+2];
   const tap=(xx,yy,w)=>{
    const j=(yy*width+xx)*4;
    const dr=prev[j]-cr,dg=prev[j+1]-cg,db=prev[j+2]-cb;
    const range=1/(1+(dr*dr+dg*dg+db*db)*invColor);
    const wt=w*range;r+=prev[j]*wt;g+=prev[j+1]*wt;b+=prev[j+2]*wt;wSum+=wt;
   };
   tap(x,y,10);
   for(const [d,,w] of offsets){if(d===0)continue;
    tap(Math.max(0,Math.min(width-1,x+d*step)),y,w);
    tap(x,Math.max(0,Math.min(height-1,y+d*step)),w);
   }
   next[i]=r/wSum;next[i+1]=g/wSum;next[i+2]=b/wSum;next[i+3]=src[i+3];
  }
  prev=next;
 }
 return prev;
}
