# DuoForge GLB-kvalitetsgrindar — mäta istället för att gissa

En GLB kan vara tekniskt giltig och samtidigt konstnärligt undermålig. Definiera **hårda tekniska fel** och **mjuka estetiska bedömningar** var för sig.

## Gate 0: IP, licens och proveniens

- Användaren äger eller har användningsrätt till referensbilder, modeller och tex.
- Logga modell, version, källa, licens, materialursprung och enhetsinställning. **Publicera aldrig referensbild eller privata tillgångar automatiskt.**
- Avslå modell med geografiskt olämplig licens (se Hunyuan3D 2.1, EU).
- Gör tredjepartsberoenden och model weights till separata tillstånd; "gratis" är inte samma sak som fritt för kommersiell SaaS.

## Gate 1: riktig mesh

- Kontrollera positionsaccessors, finit float-data, indexintervall, primitiv count.
- Kontrollera att 3D-volym finns från minst fem vyer, inte endast ett texturerat platt plan.
- Ingen orimlig utsträckning i scene bounds, trasiga normals, oavsiktligt dubbla ansikten, omvänd culling.
- Vattentät mesh är ett **valbart** mål, inte generellt krav.

## Gate 2: UV, material och realistisk ytvariation

- UV_0 för texturerade primitiv, normals/tangenter för tangent-space normal när runtime kräver.
- PBR baseColor, metallic/roughness, normal map, roughness variation; AO där meningsfullt.
- sRGB för baseColor; linjär sampling för normal/rough/metal/AO.
- Jämför färg med neutral belysning, inte bara filmisk miljö.
- **Kvalitetsprofil**, inte garanti: mobil 512–1024 px, balanserad 1K–2K, närbild upp till 4K efter minneskontroll.

## Gate 3: skinning och animation (endast riggade varelser)

- GLB ska innehålla `skins` och animation channels med `JOINTS_0/WEIGHTS_0`; validera inverseBindMatrices.
- Kontrollera att varje vertex har normaliserade icke-negativa vikter (inom tolerans), och att lederna styr **rätt** vertices.
- Testa toppose, axelabduktion, armbågsböj, knäböj, ryggrotation. För orm: maximal krökning utan stygga veck eller clipping.
- Minsta klipp för demo: idle, move/slither, attack. Övriga klipp kan tillkomma.
- Testa efter serialisering + **reimport**; namn och hierarki kan skilja sig från skaparmiljön.

## Gate 4: mobil prestanda och storlek

**Startvärden att mäta, inte universella hårda gränser:**
- Mobil karaktär: planera kring 15–40k triangles för hero assets med separat LOD, men justera efter material, draw calls, animation och hårdvara.
- Desktop/film: higher quality efter frame-time och VRAM-budget.
- Testa 720p och faktisk iPhone, landscape/portrait. Antal bones, vertex count, skinnade vertices och material/draw calls påverkar mer än enbart filstorlek.
- Mät GPU/CPU frametime, toppminne, scenuppladdning, FPS och exporttid. KTX2 och meshopt är val bara om runtime har rätt dekodrar.

## Gate 5: integritet och upplevelse

- En bild ska aldrig skickas till en extern tjänst utan ett klick som anger mål och villkor.
- Data från externa modeller ska skannas/valideras innan import; ingen körning av fjärrskript från GLB metadata.
- Tryck-och-export kan vara ett snabbt arbetsflöde för **mallar**, men lova inte 100% på högfidelitetsrekonstruktion.
- Resultatkorten anger: generationstid, referensfidelitet (bedömd), trianglar, tex, bones, klipp, rättighet, QA status.

## Föreslagen QA-output (utan att låtsas att test körts)

```json
{
 "schema": "duoforge.asset.qa@1", "id": "example-id", "status": "needs-human-review",
 "technical": {"gltf_valid": null, "mesh": null, "uv": null,
    "pbr": null, "skins": null, "animations": null, "mobile_budget": null},
 "visual": {"front": null, "back": null, "side": null, "deformation": null},
 "provenance": {"source": null, "license": null, "model": null}
}
```

**Använd riktiga verktyg:** https://github.com/KhronosGroup/glTF-Validator , https://gltf-transform.dev/ , testmodeller https://github.com/KhronosGroup/glTF-Sample-Assets . En egenskriven headerkontroll räcker **inte** för standardsäker validering.
