# Teknisk handbok — högfidelitetsmesh, PBR, rigg och animation

## Mesh-topologi och skulpt

Skilj primära former (kroppsproportion), sekundära former (muskelgrupper, stora barkplattor, stenblock) och tertiär ytdetalj (hår, sprickor, porer). De två första kan påverka siluetten; tertiär detalj kan ofta bakas till normal map.

**Sculpt high-poly:** voxel remesh för blockout, multires för jämn detalj; stöd meshens slutliga toppologi där den deformeras. **Retopologi:** kontrollerade edge loops, jämn quad flow i deformationer, låg andel extremt långa trianglar. Enkel decimering kan se bra ut statiskt men bli dålig vid riggning.

**Vattentäthet** krävs främst vid 3D-utskrift/booleans eller vissa simuleringar; glTF-spelkaraktärer kan medvetet ha öppna ytor och separata kläddelar. Flagga non-manifold som risk men inte alltid stoppsignal.

## UV + texture baking

- Markera sömmar, UV unwrap, packa öar med tillräcklig padding/mip-border. Orientera helst längs fiberriktning där texturen kräver det.
- Baka high-poly normals i tangent-space (MikkTSpace-kompatibelt), matcha triangulering/tangent basis mellan baker och renderer.
- PBR/metal-rough: baseColor är sRGB; normal/AO/rough/metal är **linjära** data. glTF packar roughness i G, metallic i B. AO ligger separat i R.
- Normal mappens gröna kanal är **+Y** i glTF; om ett verktyg genererar DirectX-normaler, kontrollera inversionen.
- Displacement för high-poly/bake; använd normal maps för små synliga veck i GLB.
- Variation i roughness är ofta viktigare för realism än ett enormt polygonantal. Undvik enbart grynigt brus; bygg material efter verklig struktur.
- Kontrollera PBR i ljusa/mörka miljöer och med neutralt HDRI/IBL, inte enbart i en snygg studiobelysning.

## Skinning

- **Parent-to-bone / rigid assembly:** bra för golem-sten, kugghjul, robotdetaljer; geometri deformeras inte.
- **Linear blend skinning:** viktad påverkan från flera leder för hud, ormar, tygdelar. Begränsa antalet influenser enligt målmotor.
- Bind pose och inverse bind måste matcha; maxa inte bones utan behov. Delad armature + unika namn per varelse undviker animationskollisioner.
- Specialfallet muskler: standard-LBS simulerar inte hud, fett och muskel. Corrective shapes, twist-bones, dual-quaternion eller muscle-sim kan behövas; inte allt finns i glTF-basspecen, då måste effekten bakas eller approximeras.
- **Facial:** morph targets för blink, mun, bryn, phonemes, med smidig övergång. Verifiera stöd för morph animation i aktuell runtime.

## GLB-kompatibilitet

- Förvänta dig PBR metallic-roughness; avancerade Blender-nodnät måste ofta **bakas** eller anpassas innan GLB-export.
- GLB innehåller glTF/JSON + binär payload; Unity/Blender-specifika constraints, Houdini-noder, rig controllers och procedurshaders kan inte antas överleva export.
- Meshopt/Draco för geometri (kräver dekoder i klienten), KTX2/BasisU för GPU-komprimerade texturer (kräver stöd), eller WebP med medveten kompatibilitetskontroll.
- Stöd för animationer, morph targets och PBR ska verifieras efter export genom återimport.
- För transparenta delar testa depth sorting i den faktiska spelmotorn.

## Varför Meshy-liknande kvalitet är svår

Det är en separat disciplin att generera skulpterad form, att generera detaljrik PBR-textur och att bygga deformationstoppologi/rigg. En snygg render säger ingenting om de sista två. Satsa på verklig 360° detalj, bra referens, multivy-kontroll och efterbearbetning.

**Primärkällor:** Blender Manual (sculpt, retopology, rig, export): https://docs.blender.org/manual/en/latest/ ; Khronos glTF spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html ; Khronos PBR: https://www.khronos.org/gltf/pbr ; glTF Transform: https://gltf-transform.dev/ .
