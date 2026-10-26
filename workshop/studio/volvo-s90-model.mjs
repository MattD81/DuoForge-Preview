// Unofficial Volvo S90 Recharge-inspired editable 3D study.
// Built from original procedural geometry using published vehicle dimensions.
// NOT Volvo Cars CAD, and NOT Adam Wiese/lazercar's high-poly CC BY model.
import * as THREE from "three";
import {createSurfaceLibrary} from "./procedural-materials.mjs";

export const S90_REFERENCE=Object.freeze({
 name:"Volvo S90 Recharge – DuoForge Studio Edition",
 length:4.969,width:1.890,height:1.446,wheelbase:2.941,
 frontAxleZ:-1.4705,rearAxleZ:1.4705,wheelRadius:.365,
 bodyType:"large luxury sedan",direction:"-Z",
 source:"https://www.volvocars.com/uk/support/car/s90/article/766ee075f0e03896c0a8015109ee0749/"
});
const tmp=new THREE.Vector3();
function cap(value,min,max){return Math.max(min,Math.min(max,value))}
function add(group,geo,material,name,pos,rotation){
 const mesh=new THREE.Mesh(geo,material);
 mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
 if(pos)mesh.position.set(...pos);
 if(rotation)mesh.rotation.set(...rotation);
 group.add(mesh);
 return mesh;
}
function box(parent,material,name,w,h,d,x,y,z,rotation){
 return add(parent,new THREE.BoxGeometry(w,h,d),material,name,[x,y,z],rotation);
}
function cylinder(parent,material,name,rad,height,segments,x,y,z,rotation){
 return add(parent,new THREE.CylinderGeometry(rad,rad,height,segments),material,name,[x,y,z],rotation);
}
function tube(parent,points,material,name,radius=.012,segments=5){
 const curve=new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point)),false,"centripetal",.13);
 return add(parent,new THREE.TubeGeometry(curve,Math.max(12,points.length*7),radius,segments,false),material,name);
}
function polygon(parent,points,material,name){
 const geo=new THREE.BufferGeometry();
 const center=new THREE.Vector3();for(const point of points)center.add(new THREE.Vector3(...point));
 center.multiplyScalar(1/points.length);
 const vertices=[],uv=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],n=points[(i+1)%points.length];
  vertices.push(center.x,center.y,center.z,...p,...n);
  uv.push(.5,.5,0,i/points.length,1,(i+1)/points.length);
 }
 geo.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
 geo.computeVertexNormals();
 return add(parent,geo,material,name);
}
function loft(parent,stations,profiles,material,name){
 // Closed longitudinal hull. Stations are ordered -Z to +Z.
 const pos=[],norm=[],uv=[];
 const push=(a,b,c,u,v,w)=>{
  for(const p of [a,b,c])pos.push(...p);
  uv.push(...u,...v,...w);
 };
 // Each cross-section is a continuous ring in local XY.
 for(let s=0;s<stations.length-1;s++){
  for(let i=0;i<profiles[s].length;i++){
   const n=(i+1)%profiles[s].length;
   const a=[...profiles[s][i],stations[s]],b=[...profiles[s][n],stations[s]],
     c=[...profiles[s+1][i],stations[s+1]],d=[...profiles[s+1][n],stations[s+1]];
   const U0=s/(stations.length-1),U1=(s+1)/(stations.length-1),V0=i/profiles[s].length,V1=(i+1)/profiles[s].length;
   push(a,b,c,[U0,V0],[U0,V1],[U1,V0]);
   push(b,d,c,[U0,V1],[U1,V1],[U1,V0]);
  }
 }
 for(const end of [0,stations.length-1]){
  const profile=profiles[end],z=stations[end],flip=end===0;
  const mean=profile.reduce((acc,p)=>acc.add(new THREE.Vector3(p[0],p[1],z)),new THREE.Vector3()).multiplyScalar(1/profile.length);
  for(let i=0;i<profile.length;i++){
   const a=[...profile[i],z],b=[...profile[(i+1)%profile.length],z];
   const c=mean.toArray();
   if(flip)push(c,b,a,[.5,.5],[0,1],[1,0]);else push(c,a,b,[.5,.5],[0,1],[1,0]);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
 geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
 geo.computeVertexNormals();
 const mat=material.clone();mat.side=THREE.DoubleSide;
 return add(parent,geo,mat,name);
}
function matSet(quality,color,cabin){
 const s=createSurfaceLibrary(quality==="performance"?"low":"high");
 const p=(kind,col,tile=[1,1])=>s.material(kind,{color:col,repeat:tile});
 return {
  library:s,
  paint:p("paint",color),
  paintTrim:p("paint",color),
  glass:p("glass",0x7cabb9),
  windshield:new THREE.MeshPhysicalMaterial({color:0x718d9f,metalness:0,roughness:.055,transparent:true,opacity:.39,transmission:.12,thickness:.014,depthWrite:false,side:THREE.DoubleSide}),
  polished:p("chrome",0xe2e9ee),
  aluminum:p("brushed",0xa7b1b6),
  black:p("carbon",0x24292b),
  glassDark:new THREE.MeshPhysicalMaterial({color:0x1e2d38,roughness:.095,metalness:.14,transparent:true,opacity:.66,depthWrite:false,side:THREE.DoubleSide}),
  rubber:p("rubber",0x353737),
  seat:p("leather",cabin==="sand"?"#b99a73":cabin==="brown"?"#86634e":cabin==="blue"?"#3a4a62":"#33383d"),
  seatSeam:p("leather",cabin==="sand"?"#e4c89e":cabin==="brown"?"#b69479":cabin==="blue"?"#68809b":"#848b91"),
  wood:p("wood",0x997556),
  grille:p("chrome",0xc8d4da),
  vent:p("carbon",0x151a1d),
  chromeDark:p("brushed",0x68717a),
  light:new THREE.MeshStandardMaterial({color:0xe0f2ff,emissive:0xa2dcff,emissiveIntensity:2.2,roughness:.2,metalness:0}),
  lightOff:new THREE.MeshStandardMaterial({color:0xc6d6e2,emissive:0x000000,roughness:.23,metalness:0}),
  tail:new THREE.MeshStandardMaterial({color:0xf11f32,emissive:0xe90025,emissiveIntensity:2.2,roughness:.27,metalness:0}),
  tailOff:new THREE.MeshStandardMaterial({color:0x991522,emissive:0x270308,emissiveIntensity:.18,roughness:.27,metalness:0}),
  indicator:new THREE.MeshStandardMaterial({color:0xff9c32,emissive:0xff6e1a,emissiveIntensity:.86}),
  dials:new THREE.MeshStandardMaterial({color:0x101b24,metalness:.1,roughness:.25,emissive:0x0d1b29,emissiveIntensity:.4}),
  darkLeather:p("leather",0x252a2c),
  brake:p("brushed",0x997d63),
  redBrake:p("paint",0xa82329)
 };
}
function letterCanvas(content,fg,bg,px=64,aspect=2.8){
 const canvas=document.createElement("canvas");
 canvas.width=Math.round(px*aspect);canvas.height=px;
 const ctx=canvas.getContext("2d");
 ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle=fg;ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.font="bold "+Math.round(px*.34)+"px Arial,sans-serif";
 ctx.fillText(content,canvas.width/2,canvas.height/2,canvas.width*.9);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 return new THREE.MeshBasicMaterial({map,transparent:bg==="transparent",side:THREE.DoubleSide,depthWrite:false});
}
function cabinInterior(root,m,quality){
 const interior=new THREE.Group();interior.name="Detailed interior / editable";
 root.add(interior);
 box(interior,m.darkLeather,"Cabin floor",1.63,.08,2.8,0,.39,.2);
 box(interior,m.seat,"Centre armrest",.26,.26,.95,0,.61,.37);
 box(interior,m.wood,"Centre console wood veneer",.29,.03,1.22,0,.75,-.45);
 for(const side of [-1,1])for(const row of [-.55,.81]){
  const seat=new THREE.Group();seat.name=(row<0?"Front":"Rear")+(side<0?" left":" right")+" seat";
  seat.position.set(side*.49,0,row);
  interior.add(seat);
  box(seat,m.seat,"Seat cushion",.58,.18,.63,0,.54,.04);
  const back=box(seat,m.seat,"Seat backrest",.6,.65,.145,0,.88,.28);
  back.rotation.x=-.16;
  box(seat,m.seat,"Headrest",.39,.23,.17,0,1.31,.3);
  box(seat,m.seatSeam,"Center leather stitched bolster",.4,.045,.48,0,.65,.03);
  for(const sx of [-.25,.25]){
   box(seat,m.seatSeam,"Outer side bolster",.06,.11,.55,sx,.65,.06);
   box(seat,m.seatSeam,"Back support side",.06,.47,.16,sx,.93,.27);
  }
  if(quality!=="performance"){
   for(let i=0;i<6;i++)box(seat,m.seatSeam,"Fine seat stitching "+i,.006,.002,.31,0,.657,-.17+i*.085);
  }
 }
 // Two front and two rear seating positions are intentionally preserved.
 box(interior,m.black,"Passenger dashboard shell",1.57,.26,.44,0,.94,-1.03);
 box(interior,m.wood,"Dashboard open-pore wood",1.47,.10,.06,0,1.022,-1.258);
 box(interior,m.black,"Dashboard upper",1.57,.11,.6,0,1.102,-1.09);
 box(interior,m.aluminum,"Chrome air vent rail",1.2,.025,.02,0,1.07,-1.36);
 // Driver cluster at left-hand side (European car).
 const cluster=box(interior,m.dials,"Digital instrument cluster",.40,.21,.02,-.47,1.03,-1.386);
 const clusterPlate=add(interior,new THREE.PlaneGeometry(.34,.16),letterCanvas("P  0 km/h","#8be1ef","#11181d",96,2.1),
   "Driver display digits",[-.47,1.03,-1.406]);
 // Portrait center screen: native Volvo-inspired interface drawn locally.
 const display=box(interior,m.black,"Portrait infotainment display frame",.30,.47,.03,.06,.91,-1.37);
 const screenMaterial=letterCanvas("22°  |  NAVI","#7cf1df","#0b1927",128,1);
 const screen=add(interior,new THREE.PlaneGeometry(.257,.42),screenMaterial,"Sensus-style touchscreen",[.06,.91,-1.393]);
 for(let i=0;i<3;i++)box(interior,m.aluminum,"Ventilation knurled knob "+i,.025,.03,.025,-.37+i*.36,.92,-1.365);
 // Steering wheel including hub, spokes and logo.
 const wheel=new THREE.Group();wheel.name="Interior steering wheel (fixed model)";
 wheel.position.set(-.47,.94,-.98);wheel.rotation.x=-.2;interior.add(wheel);
 add(wheel,new THREE.TorusGeometry(.17,.022,10,40),m.darkLeather,"Steering wheel leather rim");
 box(wheel,m.black,"Steering wheel hub",.15,.10,.04,0,0,.01);
 for(const angle of [0,2*Math.PI/3,4*Math.PI/3]){
  const spoke=box(wheel,m.aluminum,"Metal steering wheel spoke",.034,.14,.012,0,.075,0);
  spoke.rotation.z=angle;
 }
 cylinder(wheel,m.polished,"Steering wheel center badge",.046,.006,24,0,0,.05,[Math.PI/2,0,0]);
 // Gear selector and cupholders.
 box(interior,m.black,"Gear selector housing",.17,.085,.18,0,.81,-.56);
 box(interior,m.polished,"Crystal gear selector",.07,.16,.07,0,.91,-.55);
 for(const z of [-.18,.07]){
  const hole=add(interior,new THREE.TorusGeometry(.062,.012,7,24),m.aluminum,"Chrome cupholder rim",[0,.78,z],[Math.PI/2,0,0]);
  cylinder(interior,m.black,"Cupholder recess",.05,.008,18,0,.78,z);
 }
 // Pillars visible from inside, seat belts and simple interior lights.
 for(const side of [-1,1]){
  tube(interior,[[side*.75,1.12,.24],[side*.71,.67,.81]],m.seatSeam,"Seatbelt harness "+side,.011);
 }
 box(interior,m.black,"Rear parcel shelf",1.52,.07,.47,0,.91,1.59);
 return interior;
}
function buildWheel(parent,m,side,axle,z,quality){
 const sign=side==="Left"?-1:1;
 const x=sign*.819;
 const g=new THREE.Group();g.name=side+" "+axle+" wheel module";
 parent.add(g);
 const rad=S90_REFERENCE.wheelRadius;
 const y=rad;
 const name=side+" "+axle+" ";
 const rot=[0,0,Math.PI/2];
 const tire=cylinder(g,m.rubber,name+"wheel tire sidewall",rad,.233,quality==="performance"?24:48,x,y,z,rot);
 const tread=cylinder(g,m.rubber,name+"wheel tread",rad*.989,.24,quality==="performance"?24:48,x,y,z,rot);
 const spokeCount=quality==="performance"?6:10;
 // Small tire tread blocks follow the wheel's true local X axle.
 for(let i=0;i<(quality==="performance"?16:32);i++){
  const angle=2*Math.PI*i/(quality==="performance"?16:32);
  const zLocal=z+rad*Math.sin(angle),yLocal=y+rad*Math.cos(angle);
  const treadBlock=box(g,m.darkLeather,name+"wheel tire groove "+i,.248,.025,.075,x,yLocal,zLocal,[angle,0,0]);
  treadBlock.castShadow=false;
 }
 // Outer sidewall/rim centers must be x-thin: rig infers X as axle.
 const outerX=x+sign*.123;
 cylinder(g,m.chromeDark,name+"wheel rim barrel",.261,.027,42,outerX,y,z,rot);
 cylinder(g,m.polished,name+"wheel forged rim ring",.248,.028,40,outerX+sign*.01,y,z,rot);
 cylinder(g,m.vent,name+"wheel inner spoke shadow",.219,.031,40,outerX+sign*.02,y,z,rot);
 for(let i=0;i<spokeCount;i++){
  const theta=i*2*Math.PI/spokeCount;
  for(const offset of [-.055,.055]){
   const spoke=box(g,m.aluminum,name+"wheel rim alloy spoke "+i+" "+offset,.028,.205,.027,
    outerX+sign*.035,y+Math.cos(theta)*.133,z+Math.sin(theta)*.133,
    [theta+offset,0,0]);
  }
 }
 cylinder(g,m.polished,name+"wheel hub centre lock",.082,.041,36,outerX+sign*.058,y,z,rot);
 // Brake caliper deliberately excluded from the animated wheel rig.
 const caliper=box(parent,m.redBrake,side+" "+axle+" performance brake caliper",.052,.16,.09,
  outerX-sign*.085,y+.15,z-.10);
 // Suspension strut is also excluded from spinning.
 tube(parent,[[x-sign*.11,.35,z],[x-sign*.09,.73,z-.07]],m.aluminum,side+" "+axle+" suspension strut",.025);
 return g;
}
function bodyExterior(root,m,quality){
 const chassis=new THREE.Group();chassis.name="Volvo S90 body shell";
 root.add(chassis);
 const L=S90_REFERENCE.length;
 // Lower steel underbody and pinched rocker panel; cabin side panels are
 // separate doors so the interior is visible when the doors open.
 box(chassis,m.black,"Underbody sound protection",1.72,.12,4.54,0,.22,0);
 box(chassis,m.paint,"Lower structural rocker",1.78,.18,3.7,0,.39,.02);
 for(const side of [-1,1]){
  box(chassis,m.paint,"Door sill "+(side<0?"Left":"Right"),.13,.105,2.60,side*.834,.43,.16);
  box(chassis,m.polished,"Chrome sill line "+side,.024,.02,2.45,side*.899,.5,.20);
 }
 const frontStations=[-2.484,-2.32,-1.91,-1.57,-1.08];
 const frontProfile=frontStations.map((z,i)=>{
  const t=i/(frontStations.length-1),w=.78+.14*Math.sin(Math.PI*t/1.8);
  return [[-w,.43],[-w,.69],[-w*.98,.88],[-w*.92,.98],[w*.92,.98],[w*.98,.88],[w,.69],[w,.43]];
 });
 loft(chassis,frontStations,frontProfile,m.paint,"Sculpted long hood and front wings");
 // Flatter hood power dome above the sculpted shell.
 loft(chassis,[-2.41,-1.97,-1.24,-.98],[
  [[-.69,.905],[-.67,.955],[.67,.955],[.69,.905]],
  [[-.79,.93],[-.76,1.006],[.76,1.006],[.79,.93]],
  [[-.8,.945],[-.77,1.028],[.77,1.028],[.8,.945]],
  [[-.73,.96],[-.69,.989],[.69,.989],[.73,.96]]
 ],m.paintTrim,"S90 contoured bonnet");
 const rearStations=[1.44,1.78,2.18,2.484];
 const rearProfiles=rearStations.map((z,i)=>{
  const t=i/(rearStations.length-1),w=.92-.17*t;
  return [[-w,.4],[-w,.68],[-w*.99,.91],[-w*.92,.97],[w*.92,.97],[w*.99,.91],[w,.68],[w,.4]];
 });
 loft(chassis,rearStations,rearProfiles,m.paint,"Long rear haunches and trunk");
 box(chassis,m.paint,"Bootlid / rear luggage lid",1.66,.075,.86,0,.976,2.018);
 box(chassis,m.paint,"Front bumper panel",1.72,.30,.17,0,.56,-2.43);
 box(chassis,m.paint,"Rear bumper panel",1.68,.30,.19,0,.53,2.42);
 box(chassis,m.black,"Front lower splitter",1.49,.053,.26,0,.278,-2.44);
 box(chassis,m.black,"Rear diffuser",1.49,.074,.23,0,.27,2.41);
 for(const side of [-1,1]){
  box(chassis,m.paint,"Wheel arch lower wing "+side,.15,.24,.48,side*.82,.64,-1.46);
  box(chassis,m.paint,"Rear wheel arch shoulder "+side,.15,.23,.5,side*.82,.66,1.47);
  for(const z of [S90_REFERENCE.frontAxleZ,S90_REFERENCE.rearAxleZ]){
   const arch=add(chassis,new THREE.TorusGeometry(.405,.025,7,44,Math.PI),
    m.black,(side<0?"Left":"Right")+(z<0?" Front":" Rear")+" fixed wheel arch trim",
    [side*.935,.36,z],[0,Math.PI/2,0]);
  }
  // Straight, exceptionally low Scandinavian beltline and bright chrome.
  tube(chassis,[[side*.915,.96,-1.03],[side*.9,.96,.3],[side*.9,.95,1.45]],m.polished,
   (side<0?"Left":"Right")+" beltline satin chrome",.009);
  tube(chassis,[[side*.89,.49,-2.25],[side*.92,.49,-1.07]],m.aluminum,"Front body chrome",.012);
  tube(chassis,[[side*.9,.49,1.51],[side*.80,.47,2.4]],m.aluminum,"Rear body chrome",.012);
 }
 // Front recognizable Volvo-style vertically slatted waterfall grille.
 box(chassis,m.vent,"Waterfall grille black background",1.115,.39,.035,0,.73,-2.526);
 const outline=add(chassis,new THREE.TorusGeometry(.565,.028,9,76),m.polished,"Chrome elliptical grille surround",
  [0,.735,-2.56],[0,0,0]);
 outline.scale.y=.36;
 const bars=quality==="performance"?11:23;
 for(let i=0;i<bars;i++){
  const x=-.495+i*.99/(bars-1);
  const amplitude=Math.sqrt(Math.max(.12,1-(x/.56)**2));
  const height=.37*amplitude;
  box(chassis,m.aluminum,"Grille vertical chrome slat "+i,.017,height,.016,x,.735,-2.558);
 }
 const slash=tube(chassis,[[-.48,.60,-2.58],[.43,.88,-2.58]],m.polished,"Volvo signature grille diagonal",.019);
 cylinder(chassis,m.polished,"Volvo circular grille emblem",.109,.022,36,0,.735,-2.62,[Math.PI/2,0,0]);
 add(chassis,new THREE.PlaneGeometry(.17,.038),letterCanvas("VOLVO","#ffffff","#1b2730",64,4.1),
  "Volvo badge wordmark",[0,.738,-2.64],[0,Math.PI,0]);
 // Fine lower bumper intakes, registration plate and parking sensors.
 for(const side of [-1,1]){
  box(chassis,m.black,"Front air intake "+side,.31,.10,.04,side*.59,.49,-2.533);
  for(let i=0;i<3;i++)
   box(chassis,m.aluminum,"Front bumper air intake fin "+side+" "+i,.285,.006,.02,side*.59,.455+i*.036,-2.566);
  cylinder(chassis,m.chromeDark,"Front parking sensor "+side,.017,.01,14,side*.70,.58,-2.534,[Math.PI/2,0,0]);
  cylinder(chassis,m.chromeDark,"Rear parking sensor "+side,.017,.01,14,side*.69,.56,2.536,[Math.PI/2,0,0]);
 }
 box(chassis,m.vent,"Front registration plate holder",.41,.10,.025,0,.44,-2.545);
 box(chassis,m.vent,"Rear license recess",.48,.13,.025,0,.63,2.548);
 // LED Thor's hammer geometry: dark sealed headlamp + T-shaped signature.
 const led=[];
 for(const side of [-1,1]){
  box(chassis,m.chromeDark,"Front headlight casing "+side,.46,.12,.075,side*.696,.911,-2.443);
  box(chassis,m.glassDark,"Front headlight clear lens "+side,.445,.11,.01,side*.696,.917,-2.501);
  for(const y of [.942,.903]){
   const strip=box(chassis,m.light,"Volvo Thor hammer LED horizontal "+side,.387,.017,.013,side*.697,y,-2.525);
   led.push(strip);
  }
  box(chassis,m.light,"Volvo Thor hammer LED stem "+side,.022,.104,.018,side*.723,.913,-2.533);
  for(let i=0;i<3;i++)
   cylinder(chassis,m.light,"Front LED matrix projector "+side+" "+i,.023,.012,16,side*(.56+i*.071),.896,-2.538,[Math.PI/2,0,0]);
  const amber=box(chassis,m.indicator,"Front indicator "+side,.088,.02,.019,side*.865,.934,-2.54);
  // C-shaped rear light, all separate unanimated mesh sections.
  box(chassis,m.tail,"Rear taillight top "+side,.37,.052,.035,side*.64,.920,2.507);
  box(chassis,m.tail,"Rear taillight lower "+side,.355,.05,.035,side*.643,.734,2.510);
  box(chassis,m.tail,"Rear taillight vertical "+side,.059,.224,.041,side*.80,.836,2.501);
  box(chassis,m.indicator,"Rear amber turn signal "+side,.07,.028,.027,side*.62,.846,2.536);
 }
 for(let i=0;i<5;i++){
  const material=quality==="performance"?m.polished:m.polished;
  const x=-.17+i*.085;
  box(chassis,material,"VOLVO rear letters metallic "+i,.037,.031,.012,x,1.001,2.481);
 }
 add(chassis,new THREE.PlaneGeometry(.38,.092),letterCanvas("VOLVO","#c9d8df","transparent",64,3.6),
  "VOLVO S90 tailgate brand badge",[0,.97,2.541]);
 add(chassis,new THREE.PlaneGeometry(.32,.052),letterCanvas("S90  T8","#d6e2e5","transparent",64,4.5),
  "S90 Recharge rear badge",[.58,.77,2.536]);
 for(const sign of [-1,1]){
  add(chassis,new THREE.TorusGeometry(.075,.016,10,25),m.aluminum,"Twin chrome exhaust "+sign,
   [sign*.55,.32,2.545],[Math.PI/2,0,0]);
 }
 return {chassis,led};
}
function buildRoof(root,m){
 const roof=new THREE.Group();roof.name="Panoramic roof, glass and sculpted pillars";
 root.add(roof);
 polygon(roof,[[-.69,1.403,-.50],[.69,1.403,-.50],[.73,1.402,1.14],[-.73,1.402,1.14]],
  m.paint,"S90 smooth fastback roof");
 polygon(roof,[[-.66,1.409,-.3],[.66,1.409,-.3],[.66,1.41,.8],[-.66,1.41,.8]],
  m.glassDark,"Panoramic roof dark glass");
 polygon(roof,[[-.77,1.033,-1.036],[.77,1.033,-1.036],[.69,1.396,-.45],[-.69,1.396,-.45]],
  m.windshield,"Front windscreen optical glass");
 polygon(roof,[[-.68,1.391,1.15],[.68,1.391,1.15],[.77,1.033,1.72],[-.77,1.033,1.72]],
  m.windshield,"Rear heated windscreen");
 for(const side of [-1,1]){
  tube(roof,[[side*.78,1.006,-1.052],[side*.70,1.401,-.50]],m.paint,"A pillar "+side,.045);
  tube(roof,[[side*.71,1.406,-.52],[side*.73,1.4,1.15]],m.paint,"Roof side rail "+side,.031);
  tube(roof,[[side*.72,1.396,1.16],[side*.78,1.008,1.745]],m.paint,"C pillar "+side,.068);
  tube(roof,[[side*.73,1.393,.38],[side*.89,1.002,.37]],m.black,"B pillar "+side,.032);
  // Satin chrome finish along the glass edge.
  tube(roof,[[side*.77,1.038,-1.045],[side*.69,1.405,-.50],[side*.72,1.412,1.15],[side*.78,1.034,1.74]],
   m.polished,"Bright chrome window surround "+side,.009);
  // Wipers.
  tube(roof,[[side*.67,1.048,-1.052],[side*.05,1.06,-.993]],m.black,"Windscreen wiper "+side,.009);
 }
 box(roof,m.paint,"Shark fin antenna",.09,.072,.13,0,1.449,1.01);
 return roof;
}
function buildDoors(root,m){
 const doors=[];
 for(const sign of [-1,1])for(const kind of ["Front","Rear"]){
  const side=sign<0?"Left":"Right",isFront=kind==="Front";
  const z0=isFront?-1.06:.28,z1=isFront?.29:1.46;
  const hinge=new THREE.Group();hinge.name=side+" "+kind+" door hinge";
  hinge.position.set(sign*.893,0,z0);
  const door=new THREE.Group();door.name=side+" "+kind+" door opens";
  hinge.add(door);root.add(hinge);
  // Geometry is pivot-relative so yaw animation opens whole glass + panel.
  const mid=(z1-z0)/2,width=z1-z0-.012;
  box(door,m.paint,side+" "+kind+" door paint panel",.067,.48,width,0,.711,mid);
  box(door,m.paint,side+" "+kind+" door upper line",.061,.12,width,0,.976,mid);
  box(door,m.black,side+" "+kind+" door inner trim",.07,.37,width*.96,-sign*.041,.728,mid);
  box(door,m.polished,side+" "+kind+" door chrome lower line",.014,.017,width*.93,sign*.038,.52,mid);
  const glassPoints=isFront?[
   [0,1.023,.04],[0,1.023,width-.05],[0,1.34,width-.18],[0,1.122,.04]
  ]:[
   [0,1.026,.05],[0,1.029,width-.04],[0,1.105,width-.02],[0,1.341,.12]
  ];
  polygon(door,glassPoints,m.windshield,side+" "+kind+" door window");
  tube(door,[glassPoints[0],glassPoints[1],glassPoints[2],glassPoints[3],glassPoints[0]],
   m.chromeDark,side+" "+kind+" window frame",.012);
  const handleZ=isFront?.78:.63;
  box(door,m.polished,side+" "+kind+" chrome opening handle",.028,.035,.20,sign*.059,.942,handleZ);
  box(door,m.black,side+" "+kind+" keyless lock sensor",.005,.013,.024,sign*.075,.952,handleZ+.07);
  box(door,m.black,side+" "+kind+" rubber door seal",.023,.43,.035,sign*.042,.73,width-.025);
  // Interior door trim, leather, wooden strip, speaker grille and handle.
  box(door,m.darkLeather,side+" "+kind+" leather trim",.075,.28,width*.91,-sign*.066,.756,mid);
  box(door,m.wood,side+" "+kind+" open pore wood door trim",.011,.058,width*.72,-sign*.112,.857,mid);
  box(door,m.aluminum,side+" "+kind+" inside handle",.017,.02,.112,-sign*.122,.886,mid-.24);
  add(door,new THREE.TorusGeometry(.063,.01,8,24),m.aluminum,
   side+" "+kind+" premium speaker grill",[-sign*.12,.653,mid-.3],[0,Math.PI/2,0]);
  if(isFront){
   const mirror=new THREE.Group();mirror.name=side+" door mirror with indicator";
   mirror.position.set(sign*.022,1.071,.10);door.add(mirror);
   const cap=add(mirror,new THREE.SphereGeometry(.092,14,10),m.paint,side+" aerodynamic door mirror",
    [sign*.034,.044,0]);
   cap.scale.set(1.08,.65,.88);
   box(mirror,m.glassDark,side+" mirror glass",.012,.072,.12,sign*.072,.043,.016);
   box(mirror,m.indicator,side+" mirror indicator",.015,.013,.14,sign*.087,.055,-.01);
  }
  doors.push({name:side+" "+kind,side,kind,pivot:hinge,open:0});
 }
 return doors;
}
function buildCharger(root,m){
 const hybrid=new THREE.Group();hybrid.name="T8 Recharge port / charging cable details";root.add(hybrid);
 const x=-.905,z=-1.09;
 cylinder(hybrid,m.black,"Charging port black rubber cover",.072,.012,32,x,.827,z,[0,0,Math.PI/2]);
 cylinder(hybrid,m.polished,"Charging port exterior chrome ring",.08,.01,32,x-.015,.827,z,[0,0,Math.PI/2]);
 cylinder(hybrid,m.vent,"Type 2 charging port inlet",.043,.019,20,x-.026,.827,z,[0,0,Math.PI/2]);
 for(let i=0;i<7;i++){
  const a=i*2*Math.PI/7;
  cylinder(hybrid,m.polished,"EV charging contact "+i,.008,.024,9,x-.042,.826+Math.cos(a)*.027,z+Math.sin(a)*.027,[0,0,Math.PI/2]);
 }
 add(hybrid,new THREE.PlaneGeometry(.20,.055),letterCanvas("RECHARGE","#e0f1f7","transparent",64,3.7),
  "Recharge fender badge",[-.91,.697,-.89],[0,-Math.PI/2,0]);
 return hybrid;
}
export function createVolvoS90({quality="detailed",paint="#35495d",interior="sand"}={}){
 const detail=quality==="performance"?"performance":"detailed";
 const root=new THREE.Group();root.name=S90_REFERENCE.name;
 const mats=matSet(detail,paint,interior);
 const {chassis,led}=bodyExterior(root,mats,detail);
 buildRoof(root,mats);
 cabinInterior(root,mats,detail);
 const doors=buildDoors(root,mats);
 buildCharger(root,mats);
 for(const side of ["Left","Right"])for(const [axle,z] of [["Front",S90_REFERENCE.frontAxleZ],["Rear",S90_REFERENCE.rearAxleZ]]){
  buildWheel(root,mats,side,axle,z,detail);
 }
 const lights=[];
 root.traverse(node=>{if(node.isMesh&&/LED|taillight|indicator|projector/i.test(node.name))lights.push(node)});
 root.userData.duoforgeLiving={
  type:"vehicle",kind:"vehicle",version:1,forwardSign:-1,
  wheelBase:S90_REFERENCE.wheelbase,wheelRadius:S90_REFERENCE.wheelRadius,
  maxSpeed:18,reverseSpeed:6,acceleration:5.5,braking:13,
  steeringDegrees:31,rollingResistance:1.6
 };
 root.userData.duoforgeS90={
  studioStudy:true,notOfficialCAD:true,license:"original procedural geometry",
  bodyLength:S90_REFERENCE.length,width:S90_REFERENCE.width,
  wheelbase:S90_REFERENCE.wheelbase,
  quality:detail,paint,interior,
  author:"DuoForge Studio",
  attribution:"Volvo S90 dimensions © Volvo Cars; unofficial fan study. Original lazercar high-poly asset not included."
 };
 root.userData.duoforgeAttribution="DuoForge procedural S90 study, not official Volvo CAD";
 root.traverse(obj=>{if(obj.isMesh){obj.userData.s90Renderable=true;}});
 const api={
  group:root,doors,lamps:lights,materials:mats,
  setDoor(name,isOpen){
   const matching=doors.filter(d=>name==="all"||name===d.name);
   for(const door of matching){
    door.open=Boolean(isOpen);
    door.pivot.rotation.y=(door.side==="Left"?-1:1)*(door.open?.78:0);
   }
   return matching.length;
  },
  setLights(enabled){
   for(const light of lights){
    if(light.name.includes("indicator"))continue;
    if(light.name.includes("taillight"))light.material=enabled?mats.tail:mats.tailOff;
    else light.material=enabled?mats.light:mats.lightOff;
   }
  },
  dispose(){mats.library.dispose()}
 };
 // Programmatically exportable material/geometry; no downloadable third-party model is bundled.
 Object.defineProperty(root,"__s90Controller",{value:api,configurable:true,enumerable:false});
 return root;
}
export function identifyVolvoS90(root){
 return Boolean(root?.userData?.duoforgeS90?.studioStudy);
}
