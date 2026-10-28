// DuoForge Character Forge v1: true, editable 360-degree meshes; no projected image sheets.
// All generation stays on this device. Image silhouettes are deliberately 2.5D, NOT AI reconstruction.
import * as THREE from "three";

const palettes = {
  midnight: {cloth:0x244f99, trim:0x3a76bd, cape:0x362d76, bone:0xf2d2b2, dark:0x121226, accent:0x43c9df},
  violet:   {cloth:0x633e96, trim:0xa477d1, cape:0x322353, bone:0xf3dfbd, dark:0x170e27, accent:0x8ce0dc},
  forest:   {cloth:0x276755, trim:0x45a883, cape:0x243c41, bone:0xe9d7b1, dark:0x142328, accent:0x8cdeb2}
};
const material = (color, roughness=.8, metalness=.02) =>
  new THREE.MeshStandardMaterial({color,roughness,metalness,side:THREE.DoubleSide});
function addPart(group,name,geometry,mat,x=0,y=0,z=0,scale=null) {
  const object = new THREE.Mesh(geometry,mat);
  object.name=name;object.position.set(x,y,z);
  if(scale)object.scale.set(...scale);
  object.castShadow=true;object.receiveShadow=true;
  group.add(object);return object;
}
function ball(g,name,mat,x,y,z,sx,sy,sz,segments=28) {
  return addPart(g,name,new THREE.SphereGeometry(1,segments,Math.max(12,Math.round(segments*.67))),mat,x,y,z,[sx,sy,sz]);
}
function cord(g,name,mat,points,radius=.025,segments=48) {
  const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return addPart(g,name,new THREE.TubeGeometry(curve,segments,radius,8,false),mat);
}
function ellipseRim(g,name,mat,cx,cy,cz,rx,ry,tube,detail) {
  const pts=[];
  for(let i=0;i<=64;i++){
    const t=2*Math.PI*i/64;
    pts.push([cx+rx*Math.cos(t),cy+ry*Math.sin(t),cz+.05*Math.sin(t)]);
  }
  return cord(g,name,mat,pts,tube,Math.max(40,detail*48));
}
function drapeGeometry({height=1.8,rBottom=.8,rTop=.36,front=0,back=0,detail=2,seed=0}) {
  const radial=detail===3?96:detail===2?64:40, rows=detail===3?23:16;
  const xyz=[],uv=[],indices=[];
  for(let i=0;i<=rows;i++){
    const t=i/rows;
    const y=.10+t*height;
    const radius=rBottom*(1-t)+rTop*t;
    for(let j=0;j<=radial;j++){
      const a=2*Math.PI*j/radial;
      const wave=(.025+.075*(1-t))*Math.sin(a*8+seed);
      const hem=(1-t)*(1-t)*.085*Math.cos(a*11+seed);
      xyz.push((radius+wave)*Math.cos(a),
        y+hem, (radius+wave)*(.82+.1*t)*Math.sin(a)+front*(1-t)+back*t);
      uv.push(j/radial,t);
    }
  }
  for(let i=0;i<rows;i++)for(let j=0;j<radial;j++){
    const a=i*(radial+1)+j,b=a+radial+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(xyz,3));
  geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
}
function littleSkull(g,prefix,mats,x,y,z,scale=1) {
  const bone=mats.bone,shadow=mats.dark;
  ball(g,prefix+" · skalle",bone,x,y,z,.18*scale,.19*scale,.135*scale,24);
  ball(g,prefix+" · käke",bone,x,y-.13*scale,z+.065*scale,.112*scale,.095*scale,.10*scale,20);
  for(const side of [-1,1]){
    ball(g,prefix+" · ögonhåla",shadow,x+side*.087*scale,y+.022*scale,z+.115*scale,.058*scale,.074*scale,.027*scale,16);
  }
  ball(g,prefix+" · näshåla",shadow,x,y-.07*scale,z+.14*scale,.027*scale,.037*scale,.013*scale,12);
}
function ornamentSpiral(g,mat,x,y,z,direction=1) {
  const points=[];
  for(let i=0;i<=50;i++){
    const t=i/50,ang=t*Math.PI*3.1;
    const r=.014+t*.10;
    points.push([x+direction*r*Math.cos(ang),y+r*Math.sin(ang),z+.006*Math.sin(ang)]);
  }
  cord(g,"Broderad spiral",mat,points,.018,64);
}

/**
 * Builds a fully volumetric, stylized skeleton mage. Parts remain individual meshes
 * in the existing scene hierarchy, so sculpt, materials, transforms and GLB work.
 * Not a one-click reconstruction of the user's reference photograph.
 */
export function createStylizedMage({palette="midnight",detail=2,staff=true,scale=1}={}) {
  const p=palettes[palette]||palettes.midnight;
  const density=Math.max(1,Math.min(3,Math.round(Number(detail)||2)));
  const g=new THREE.Group();g.name="Character Forge · dödskallemagiker";
  g.userData={duoforgeGenerator:"character-forge@1",palette,detail:density};
  const mats={
    cloth:material(p.cloth,.91),trim:material(p.trim,.77),
    cape:material(p.cape,.95),bone:material(p.bone,.87),
    dark:material(p.dark,.97),accent:material(p.accent,.35,.2),
    wood:material(0x9e644d,.9),leather:material(0x352b46,.85),
    gold:material(0xa885b3,.46,.32)
  };

  // Layered skirt and cape: a complete round shell, including an actual back.
  const cape=addPart(g,"Mantel · omslutande baksida",drapeGeometry({
    height:1.76,rBottom:1.05,rTop:.39,front:-.08,back:-.17,detail:density,seed:1.7
  }),mats.cape);
  cape.rotation.y=.04;
  addPart(g,"Mjuk dräkt · 360°",drapeGeometry({
    height:1.95,rBottom:.80,rTop:.32,front:.11,back:0,detail:density,seed:0.5
  }),mats.cloth);
  ball(g,"Bröstkorg under tyg",mats.cloth,0,1.78,0,.42,.47,.34);
  // A soft collar and convex shoulders.
  ball(g,"Kragens veck",mats.trim,0,1.99,.05,.47,.20,.39);
  for(const sign of [-1,1]){
    ball(g,"Ärm · mjuk volym",mats.cloth,sign*.52,1.70,.045,.28,.45,.34);
    ball(g,"Axelsöm",mats.trim,sign*.52,1.94,.09,.27,.16,.29);
    ball(g,"Lädermanschett",mats.leather,sign*.67,1.40,.10,.19,.11,.22);
    littleSkull(g,"Axeldekor "+sign,mats,sign*.51,1.88,.40,.73);
    ball(g,"Magisk kula",mats.accent,sign*.78,1.33,.26,.135,.15,.13);
    ellipseRim(g,"Kulting infattning",mats.gold,sign*.78,1.33,.36,.13,.15,.018,density);
    cord(g,"Hängande rem",mats.leather,[
      [sign*.62,1.66,.31],[sign*.68,1.52,.35],[sign*.78,1.36,.30]],.025,16);
  }
  // Hood has true curved geometry back and front, not a printed photo.
  ball(g,"Huva · rundad hel baksida",mats.cloth,0,2.49,-.095,.80,.79,.68,48);
  ball(g,"Huvans djupa skugga",mats.dark,0,2.43,.55,.60,.61,.09,44);
  ball(g,"Huvans nedre tygveck",mats.cape,0,2.08,.06,.68,.22,.50,36);
  ellipseRim(g,"Huva · upphöjd kant",mats.trim,0,2.47,.70,.64,.63,.115,density);
  // Fully modelled skull: raised brow, recessed black eye cavities, cheeks, teeth.
  ball(g,"Kranium · verkligt 3D",mats.bone,0,2.41,.79,.39,.43,.27,48);
  ball(g,"Käkben",mats.bone,0,2.17,.87,.28,.20,.18,32);
  for(const sign of [-1,1]){
    ball(g,"Ögonhåla",mats.dark,sign*.183,2.48,1.027,.154,.188,.048,32);
    ball(g,"Ögonbrynsben",mats.bone,sign*.19,2.65,.99,.19,.055,.074,28);
    ball(g,"Kindben",mats.bone,sign*.25,2.24,1.005,.14,.088,.065,28);
  }
  const nose=addPart(g,"Näsöppning",new THREE.ConeGeometry(.065,.13,3),mats.dark,0,2.295,1.07);
  nose.rotation.z=Math.PI;
  cord(g,"Leende · munskåra",mats.dark,[[-.19,2.16,1.04],[-.09,2.13,1.051],[0,2.12,1.06],[.09,2.13,1.051],[.19,2.16,1.04]],.018,20);
  for(let i=-2;i<=2;i++)addPart(g,"Tand "+i,new THREE.BoxGeometry(.057,.075,.032),mats.bone,i*.073,2.13,1.075);
  // Decorative stitching follows the surface rather than being an image layer.
  for(const side of [-1,1]){
    ornamentSpiral(g,mats.trim,side*.21,1.28,.53,side);
    cord(g,"Söm vid krage",mats.gold,[
      [side*.10,1.84,.45],[side*.29,1.78,.40],[side*.36,1.64,.38]],.022,24);
  }
  ball(g,"Bröstamulett",mats.accent,0,1.21,.68,.135,.14,.10);
  ellipseRim(g,"Amulettkant",mats.gold,0,1.21,.76,.13,.14,.019,density);
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.16;
    cord(g,"Tygbroderi "+i,mats.trim,[[x,.48,.67],[x*.83,.66,.61],[x*.6,.88,.52]],.015,18);
  }
  // The stave is a separate sculptable and exportable real mesh.
  if(staff){
    const staffPoints=[[-1.06,.11,.22],[-1.09,.7,.25],[-1.11,1.35,.28],
      [-1.17,2.02,.27],[-1.11,2.80,.27],[-1.18,3.33,.24]];
    cord(g,"Stav · böjt trä",mats.wood,staffPoints,.079,60);
    for(let i=0;i<3;i++)cord(g,"Träådring "+i,mats.leather,[
      [-1.08+i*.026,.60,.31],[-1.08+i*.027,1.3,.34],
      [-1.15+i*.027,2.05,.33]],.010,20);
    // Head of an original hooked scythe-like staff, curved bone ornament.
    cord(g,"Stavhuvud · snidad krok",mats.bone,[
      [-1.19,3.33,.22],[-1.48,3.54,.25],[-1.55,3.89,.22],
      [-1.40,4.08,.19],[-1.05,4.10,.18],[-.75,3.94,.19],[-.65,3.74,.20]],.115,52);
    cord(g,"Stavhuvud · inre hulling",mats.bone,[
      [-1.46,3.82,.25],[-1.29,3.64,.26],[-1.10,3.60,.26]],.077,24);
    ball(g,"Stavens rune",mats.accent,-1.25,3.45,.29,.18,.17,.13);
    littleSkull(g,"Stavskalle",mats,-1.19,2.92,.32,.69);
    for(const side of [-1,1]){
      cord(g,"Hängsmycke · rem",mats.leather,[
        [-1.12+side*.13,2.48,.32],[-1.12+side*.13,2.30,.35]],.018,12);
      ball(g,"Hängsmycke · pärla",mats.accent,-1.12+side*.13,2.26,.36,.092,.12,.09);
    }
  }
  g.scale.setScalar(Math.max(.35,Math.min(2.5,Number(scale)||1)));
  g.traverse(o=>{if(o.isMesh){o.frustumCulled=true;}});
  return g;
}

/** Trace an image's external silhouette into a watertight beveled solid.
 * This is 2.5D geometry, NOT full-view 3D synthesis, depth estimation or AI.
 * For a single photo, the back and unseen sides cannot be reconstructed reliably.
 */
export async function createSilhouetteSolid(file,depth=.35){
  if(!(file instanceof Blob))throw Error("Välj en PNG- eller JPG-bild.");
  if(file.size>12*1024*1024)throw Error("Bilden får vara högst 12 MB.");
  const image=await createImageBitmap(file);
  let data,w,h;
  try{
    const ratio=Math.min(1,384/Math.max(image.width,image.height));
    w=Math.max(2,Math.round(image.width*ratio));
    h=Math.max(2,Math.round(image.height*ratio));
    const c=document.createElement("canvas");c.width=w;c.height=h;
    const ctx=c.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(image,0,0,w,h);
    data=ctx.getImageData(0,0,w,h).data;
  }finally{image.close?.()}
  const bg=[0,0,0];
  const corners=[0,(w-1)*4,(h-1)*w*4,((h*w)-1)*4];
  for(const k of corners)for(let i=0;i<3;i++)bg[i]+=data[k+i]/4;
  let usesAlpha=false;for(let i=3;i<data.length;i+=4)if(data[i]<240){usesAlpha=true;break}
  const mask=new Uint8Array(w*h),sum=[0,0,0];
  let count=0,minX=w,maxX=0,minY=h,maxY=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const idx=y*w+x,k=idx*4,alpha=data[k+3];
    const diff=Math.hypot(data[k]-bg[0],data[k+1]-bg[1],data[k+2]-bg[2]);
    if((usesAlpha?alpha>170:diff>62)){
      mask[idx]=1;count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(let i=0;i<3;i++)sum[i]+=data[k+i];
    }
  }
  if(count<100)throw Error("Hittar ingen tydlig siluett. Testa transparent PNG.");
  if(count> w*h*.91)throw Error("Siluetten är för stor. Använd frilagd bild eller jämn bakgrund.");
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const steps=96,radii=new Float32Array(steps);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(mask[y*w+x]){
    const dx=x-cx,dy=cy-y;
    const bin=Math.floor(((Math.atan2(dy,dx)+2*Math.PI)%(2*Math.PI)) / (2*Math.PI)*steps)%steps;
    radii[bin]=Math.max(radii[bin],Math.hypot(dx,dy));
  }
  for(let i=0;i<steps;i++)if(!radii[i]){
    for(let d=1;d<=steps/2;d++){
      const a=radii[(i-d+steps)%steps],b=radii[(i+d)%steps];
      if(a&&b){radii[i]=(a+b)/2;break}
    }
  }
  const smoothed=new Float32Array(steps);
  for(let i=0;i<steps;i++)
    smoothed[i]=(radii[(i+steps-2)%steps]+2*radii[(i+steps-1)%steps]+
      3*radii[i]+2*radii[(i+1)%steps]+radii[(i+2)%steps])/9;
  const size=Math.max(maxX-minX,maxY-minY),shape=new THREE.Shape();
  for(let i=0;i<steps;i++){
    const a=i/steps*2*Math.PI;
    const x=Math.cos(a)*smoothed[i]/size*2.2;
    const y=Math.sin(a)*smoothed[i]/size*2.2;
    if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
  }
  shape.closePath();
  const thickness=Math.max(.06,Math.min(1.2,Number(depth)||.35));
  const geo=new THREE.ExtrudeGeometry(shape,{
    depth:thickness-.04,steps:1,bevelEnabled:true,bevelThickness:.02,
    bevelSize:.02,bevelSegments:2,curveSegments:2
  });
  geo.translate(0,0,-thickness/2);
  geo.computeVertexNormals();
  const color=new THREE.Color(sum[0]/count/255,sum[1]/count/255,sum[2]/count/255);
  const group=new THREE.Group();group.name="Bildsiluett · 2,5D (redigerbar)";
  group.userData={duoforgeGenerator:"silhouette-solid@1",depth:thickness,
    note:"2.5D silhouette extrusion only; no inferred back or image texture"};
  const mesh=addPart(group,"Siluett · verklig volym",geo,
    new THREE.MeshStandardMaterial({color,roughness:.77,metalness:0,side:THREE.DoubleSide}));
  geo.computeBoundingBox();mesh.position.y=-geo.boundingBox.min.y+.04;
  return group;
}

export function initCharacterForge({root,select,pushHistory,refreshTree,updateStats,fitScene,dirty,notify}) {
  const sidebar=document.querySelector(".sidebar.left-panel");
  if(!sidebar||document.getElementById("characterForge"))return;
  const panel=document.createElement("section");panel.id="characterForge";
  panel.className="panel-section character-forge-panel";
  panel.innerHTML=[
    '<div class="section-heading"><h2>✦ Character Forge</h2><span class="mini-pill">3D • 360°</span></div>',
    '<p class="hint">Bygg en riktig, formbar 3D-karaktär med modellbyggd framsida, sidor och baksida. Inga platta bildtexturer.</p>',
    '<label class="field-label" for="forgePalette">Magikerns färgtema</label>',
    '<select id="forgePalette"><option value="midnight">Blå huva / lila mantel</option><option value="violet">Lila mystik</option><option value="forest">Skogsande</option></select>',
    '<label class="field-label" for="forgeDetail">Geometridetalj</label>',
    '<select id="forgeDetail"><option value="1">Mobil</option><option value="2" selected>Balanserad</option><option value="3">Hög</option></select>',
    '<label class="range-line">Storlek <input id="forgeScale" type="range" min=".5" max="1.5" step=".1" value="1"><output id="forgeScaleOut">1.0×</output></label>',
    '<label class="check-line"><input id="forgeStaff" type="checkbox" checked> Modellera stav och dekorationer</label>',
    '<button id="forgeCreate" class="accent">Skapa dödskallemagiker i riktig 3D</button>',
    '<p class="hint">Redigera sedan separata meshdelar, skulptera ytor, tilldela PBR-material, rotera 360° och exportera GLB.</p>',
    '<hr><div class="subheading">Bild → verklig siluettvolym <small>2,5D</small></div>',
    '<label class="field-label" for="forgeImage">Frilagd PNG eller bild med enfärgad bakgrund</label>',
    '<input id="forgeImage" type="file" accept="image/png,image/jpeg,image/webp">',
    '<label class="range-line">Tjocklek <input id="forgeDepth" type="range" min=".1" max="1.0" step=".05" value=".35"><output id="forgeDepthOut">0.35 m</output></label>',
    '<button id="forgeSilhouette" disabled>Skapa extruderad 3D-form</button>',
    '<p id="forgeStatus" class="hint" role="status">Den här bildfunktionen skapar endast en 2,5D-volym. Automatisk AI-rekonstruktion av osynlig baksida ingår inte.</p>'
  ].join("");
  const world=sidebar.querySelector("#worldBuilderPanel");
  if(world)world.insertAdjacentElement("afterend",panel);else sidebar.prepend(panel);
  const $=id=>panel.querySelector("#"+id);
  $("forgeScale").oninput=()=>{$("forgeScaleOut").textContent=Number($("forgeScale").value).toFixed(1)+"×"};
  $("forgeDepth").oninput=()=>{$("forgeDepthOut").textContent=Number($("forgeDepth").value).toFixed(2)+" m"};
  $("forgeImage").onchange=()=>{
    const f=$("forgeImage").files?.[0];
    $("forgeSilhouette").disabled=!f;
    $("forgeStatus").textContent=f?f.name+" · Endast yttre siluett, inte full AI-3D.":"Välj en bild.";
  };
  function insert(group){
    pushHistory();root.add(group);select(group);
    refreshTree();updateStats();fitScene(group);dirty();
    notify(group.name+" skapad. Exportera GLB från översta raden.",4200);
  }
  $("forgeCreate").onclick=()=>{
    try{
      const group=createStylizedMage({
        palette:$("forgePalette").value,detail:Number($("forgeDetail").value),
        staff:$("forgeStaff").checked,scale:Number($("forgeScale").value)
      });
      insert(group);
    }catch(err){console.error(err);notify("Kunde inte skapa magiker: "+err.message,6000)}
  };
  $("forgeSilhouette").onclick=async()=>{
    const file=$("forgeImage").files?.[0];if(!file)return;
    const button=$("forgeSilhouette");button.disabled=true;
    try{
      $("forgeStatus").textContent="Analyserar siluett lokalt …";
      const group=await createSilhouetteSolid(file,Number($("forgeDepth").value));
      insert(group);
      $("forgeStatus").textContent="Siluettvolym klar. För en verklig 360°-karaktär: använd Character Forge eller modellera baksidan manuellt.";
    }catch(err){$("forgeStatus").textContent=err.message;notify("Bildmodellering: "+err.message,6000)}
    finally{button.disabled=false}
  };
}
