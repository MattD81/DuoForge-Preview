// Optional private image-to-3D inference client for existing DuoForge Studio.
// No model, image or credentials are sent anywhere unless the user clicks the AI button.
// It ONLY contacts a separately installed TripoSR service on this device.
const LOCAL_SERVER = "http://127.0.0.1:7863";

export function initLocalImageTo3D({loadGLB,notify}) {
  const panel=document.getElementById("characterForge");
  if(!panel||document.getElementById("forgeAI"))return;
  const section=document.createElement("div");section.id="forgeAI";
  section.innerHTML=[
    '<hr><div class="subheading">AI: bild → riktig 360°-mesh <small>egen server</small></div>',
    '<p class="hint">TripoSR kan uppskatta en komplett 3D-form från en bild. Kräver att du själv startar den öppna modellen på en dator med tillräckligt minne. Ingen molnserver ingår i GitHub Pages.</p>',
    '<button id="forgeAIStart" class="accent-outline">Generera GLB med lokal TripoSR</button>',
    '<p id="forgeAIStatus" class="hint" role="status">Välj en bild ovan. Kräver lokal AI-server på port 7863.</p>'
  ].join("");
  panel.append(section);
  const button=section.querySelector("#forgeAIStart");
  const status=section.querySelector("#forgeAIStatus");
  let busy=false;
  button.addEventListener("click",async()=>{
    if(busy)return;
    const file=panel.querySelector("#forgeImage").files?.[0];
    if(!file){status.textContent="Välj först en frilagd PNG eller JPG under bildimport.";return}
    if(file.size>12*1024*1024){status.textContent="Max 12 MB per bild.";return}
    busy=true;button.disabled=true;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),620000);
    try {
      status.textContent="Kontrollerar din lokala TripoSR-server …";
      const health=await fetch(LOCAL_SERVER+"/health",{signal:controller.signal,cache:"no-store"});
      if(!health.ok)throw Error("Den lokala AI-servern svarar inte korrekt.");
      const state=await health.json();
      if(!state.ready)throw Error("TripoSR-modellen är inte installerad på datorn.");
      status.textContent="3D-inferens körs på din egen dator. Ingen bild laddas upp till DuoForge.";
      const payload=new FormData();payload.append("image",file,file.name);
      const result=await fetch(LOCAL_SERVER+"/generate",{
        method:"POST",body:payload,headers:{"X-DuoForge-Request":"character-forge-v1"},
        signal:controller.signal,cache:"no-store"
      });
      if(!result.ok){
        let message="Serverfel "+result.status;
        try {const data=await result.json();if(data.detail)message=String(data.detail).slice(0,180)}catch{}
        throw Error(message);
      }
      const blob=await result.blob();
      if(blob.size>50*1024*1024||blob.size<32)throw Error("Ogiltig GLB-storlek");
      const header=new Uint8Array(await blob.slice(0,4).arrayBuffer());
      if(String.fromCharCode(...header)!=="glTF")throw Error("AI-servern returnerade inte en giltig GLB");
      await loadGLB(blob,"TripoSR · "+file.name.replace(/\.[^.]+$/,""));
      status.textContent="3D-GLB importerad. Granska särskilt baksida, topologi och textur innan du använder den i spel.";
      notify("AI-genererad GLB importerad i befintliga 3D-studion.",4500);
    }catch(err){
      status.textContent=err.name==="AbortError"?"3D-bearbetningen avbröts/tog för lång tid.":
        "AI-3D inte tillgänglig: "+(err instanceof TypeError?"Ingen anslutning till lokal AI-server.":err.message);
      notify(status.textContent,6000);
    }finally{clearTimeout(timeout);busy=false;button.disabled=false}
  });
}
