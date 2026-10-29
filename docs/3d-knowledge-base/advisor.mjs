// Pure, offline recommendation rules for DuoForge 3D knowledge catalog.
// Does not run image-to-3D, download weights, or request external APIs.
const keys={
 castle:/slott|borg|castle|golem|stenmonster|stenjätte/i,
 brute:/muskel|brute|jätte|troll|orc|fighter|humanoid/i,
 forest:/skog|tree|wood|forest|bark|rot|gren|ent/i,
 serpent:/orm|serpent|snake|drake|fjäll|tentakel/i,
 image:/bild|photo|foto|image|referens/i,
 photo:/flera bilder|fotogrammetri|scan|skanna|multi.view/i,
 mobile:/mobil|iphone|android|low.poly|lågpoly/i
};
export function route3D(request,knowledge){
 const phrase=String(request||"").slice(0,400);
 const matches=Object.entries(keys).filter(([,rx])=>rx.test(phrase)).map(([id])=>id);
 // Multi-photo takes precedence over single-image for actual photogrammetry.
 if(matches.includes("photo"))matches.splice(matches.indexOf("image"),1);
 const chosen=matches.length?matches:["castle"];
 const ids=[...new Set(chosen.flatMap(key=>knowledge.recommendations[key]||[]))];
 const data=new Map(knowledge.techniques.map(x=>[x.id,x]));
 const techniques=ids.map(id=>data.get(id)).filter(Boolean).filter(x=>x.licenseStatus!=="blocked_eu");
 return {kind:chosen,techniques,requiresGPU:techniques.some(t=>t.runtime==="external_optional"),
 caveat:"Valet är en kunskapsrekommendation, inte körd modellinferens; rättigheter och hårdvara måste kontrolleras."};
}
export function filter3D(knowledge,{search="",area="all",showBlocked=false}={}){
 const query=String(search||"").toLocaleLowerCase("sv").trim();
 return knowledge.techniques.filter(t=>(showBlocked||t.licenseStatus!=="blocked_eu")&&
  (area==="all"||t.area===area)&&
  (!query||[t.title,t.goal,t.limitation,t.license,t.area,...t.inputs]
    .join(" ").toLocaleLowerCase("sv").includes(query)));
}
