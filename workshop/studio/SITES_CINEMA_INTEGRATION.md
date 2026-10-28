# Koppla riktiga DuoForge Sites till Ocean V7 + Cinema Core

**Gäller befintliga plattformen, inte en ny Sites-app.** De faktiska, testade motorerna ligger på GitHub Pages och fungerar i 3D Studio: `https://mattd81.github.io/DuoForge-Preview/workshop/studio/`.

## Vad som nu finns på GitHub (redo att integrera)

`workshop/studio/sites-cinema-bridge.mjs` är en origin-validerad postMessage-brygga, aktiveras endast inne i iframe med `embed=1` och en exakt betrodd `parentOrigin`. Den använder **3D-studions verkliga GLB-import**, **Ocean V7:s väder, våghöjd, hastighet och sjöskum** samt dess **Cinema Core V1/Film Studio**. GLB-filer transporteras som `ArrayBuffer` lokalt från den inloggade appen till den inbäddade GitHub-studion, inte genom att lägga privata tokens i URL:er.

**Det här är en färdig källkods-brygga, inte ett bevis att den aktuella Sites-deployen redan är ändrad.** Den installerade DuoForge-MCP-pluggen exponerar inte filskrivning eller Sites-kodpublicering. Bara inställningar för tema, startsida och spelkort kan ändras direkt via den.

## Ett litet, riktat Sites-kodtillägg

Lägg följande i den befintliga sidan för 3D-verkstad/Film Studio, där `selectedGLB` hämtas från DuoForges **nuvarande, behörighetskontrollerade projektarkiv**. Ändra inte lagringen eller skapa dubblettprojekt. Byt ut fallback-filväljaren mot arkivets befintliga GLB-exportfunktion när den finns.

```html
<section aria-label="DuoForge Cinema 3D">
  <button id="duoforge-import-model">Öppna vald modell i Cinema</button>
  <input id="duoforge-model-file" type="file" accept=".glb,model/gltf-binary" hidden>
  <iframe id="duoforge-cinema-frame"
    title="DuoForge Ocean V7 och Film Studio"
    style="border:0;width:100%;height:80vh;min-height:560px"
    allow="fullscreen" loading="lazy"></iframe>
</section>
<script type="module">
  const base="https://mattd81.github.io";
  const iframe=document.getElementById("duoforge-cinema-frame");
  const origin=location.origin;
  iframe.src=base+"/DuoForge-Preview/workshop/studio/"+
    "?embed=1&world=ocean&parentOrigin="+encodeURIComponent(origin);
  let studioReady=false;
  const responses=new Map();
  window.addEventListener("message",event=>{
    if(event.origin!==base||event.source!==iframe.contentWindow)return;
    if(event.data?.protocol!=="duoforge-cinema-bridge@1")return;
    if(event.data.type==="READY")studioReady=true;
    if(event.data.type==="RESULT"){
      const task=responses.get(event.data.requestId);
      if(task){responses.delete(event.data.requestId);
        event.data.ok?task.resolve(event.data):task.reject(Error(event.data.error));
      }
    }
  });
  function send(action,data={},transfer=[]){
    if(!studioReady)throw Error("Cinema Studio är inte redo ännu.");
    const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      responses.set(requestId,{resolve,reject});
      iframe.contentWindow.postMessage({
        protocol:"duoforge-cinema-bridge@1",type:"COMMAND",action,requestId,...data
      },base,transfer);
      setTimeout(()=>{if(responses.has(requestId)){responses.delete(requestId);
        reject(Error("Cinema Studio svarade inte."));}},20000);
    });
  }
  // Example: no archive API invented; use the existing GLB export Blob from Sites.
  async function sendModel(glbFile){
    if(!glbFile?.name?.toLowerCase().endsWith(".glb"))throw Error("Välj en GLB.");
    const buffer=await glbFile.arrayBuffer();
    await send("IMPORT_GLB",{name:glbFile.name,buffer},[buffer]);
    await send("SET_OCEAN",{settings:{
      weather:"storm-sunset",height:1.1,speed:1.2,whitecaps:0.12
    }});
    await send("OPEN_CINEMA");
  }
  const input=document.getElementById("duoforge-model-file");
  document.getElementById("duoforge-import-model").onclick=()=>input.click();
  input.onchange=async()=>{try{await sendModel(input.files[0]);}
    catch(error){alert(error.message);}finally{input.value="";}};
</script>
```

**Viktigt om produktionsdomän:** origin-listan i `sites-cinema-bridge.mjs` har explicit `https://duoforge-gaming.cuddlyelk8.chatgpt.site`. Om den riktiga Sites-deployen körs via en annan domän ska exakt den domänen genomgå granskning och läggas till i listan. Ingen wildcard-trust för `chatgpt.site`.

## Vem kan göra vad?

- GitHub Studio: publicerad modul, Ocean V7 och den egna Cinema Core, öppen för användning idag.
- Sites efter liten UI-kodändring: kan välja en GLB från **samma arkiv**, öppna den i inbäddad Studio och styra hav och film utan att lämna plattformen.
- Sites i nuläget: **inte verifierat att Sites-koden har detta UI**; denna brygga skriver inte själv till Sites.
- All video och PNG-rendering kör i besökarens webbläsare, med aktuella exportgränser. Inga externa AI-/GPU-krediter, inga dolda moln-render-jobb.

## Acceptanstest innan man kallar det integrerat i Sites

Öppna den faktiska 3D-verkstaden i Sites, välj en sparad GLB via befintligt arkiv, välj **Öppna i Cinema**, kontrollera att rätt modell (inte exempelkart) syns i 3D och att `SET_OCEAN` ändrar skumreglaget, förhandsvisa en femvinkel-sekvens, exportera PNG-del och kontrollera filer/ljud/video på dator och iPhone. Kontrollera att originalprojektet i Sites inte har ändrats och att inga Work-krediter använts.
