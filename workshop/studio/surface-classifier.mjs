// Pure asset naming heuristics for free local material assignment.
// Preserves existing UV/PBR maps unless the user explicitly chooses overwrite.
export function classifySurfaceName(name="",parent="",vehicle=false){
 const n=String(name).toLowerCase().replace(/[_-]+/g," ");
 const p=String(parent).toLowerCase().replace(/[_-]+/g," ");
 const combined=n+" "+p;
 // Fixed parts first; avoid treating a brake caliper as tyre rubber.
 if(/(?:caliper|brake housing|bromsok)/.test(combined))return "brushed";
 if(/(?:tire|tyre|däck|sidewall|wheel rubber|groove|rubber)/.test(n))return "rubber";
 if(/(?:wheel|hjul)/.test(n)&&/(?:tire|tyre|däck)/.test(p))return "rubber";
 if(/(?:glass|window|windshield|windscreen|fönster|ruta|visor|glazing)/.test(combined))return "glass";
 if(/(?:headlight|tail light|led strip|neon|light bar|headlamp)/.test(n))return "neon";
 if(/(?:rim|hub|rotor|brake disc|spoke|alloy|chrome|metal|exhaust|pipe|steel|wheel)/.test(n))return "brushed";
 if(/(?:seat|leather|interior|upholstery|saddle|säte)/.test(combined))return "leather";
 if(/(?:carbon|diffuser|front lip|wing spoiler)/.test(n))return "carbon";
 if(/(?:body|bonnet|hood|chassis|fender|door panel|bumper|roof car|kaross|fairing|hood panel)/.test(n))return "paint";
 if(/(?:trunk|branch|bark|stam)/.test(n))return "bark";
 if(/(?:leaf|leaves|foliage|crown|pine|krona|bush|shrub)/.test(n))return "grass";
 if(/(?:road|asphalt|street|racer track|väg|asfalt)/.test(n))return "asphalt";
 if(/(?:grass|lawn|turf|meadow|gräs)/.test(n))return "grass";
 if(/(?:sand|beach|strand|öken|dune)/.test(n))return "sand";
 if(/(?:stone|rock|gravel|cliff|sten|klippa)/.test(n))return "stone";
 if(/(?:brick|tegel|masonry)/.test(n))return "brick";
 if(/(?:concrete|cement|betong|foundation)/.test(n))return "concrete";
 if(/(?:plaster|stucco|facade|fasad|building|house|wall|vägg)/.test(n))return "plaster";
 if(/(?:wood|deck|plank|timber|oak|pinewood|panel wood|trä)/.test(n))return "wood";
 if(vehicle)return "paint";
 return null;
}
