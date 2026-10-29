# AI, bild-till-3D och skanning — jämförelse 2026-10-29

**OBS:** Öppen GitHub-kod är inte samma sak som fritt licensierade vikter, kompatibla beroenden eller kostnadsfri GPU. Inga modeller installeras av denna kunskapsbank.

| Teknologi | Typ | Styrka | Begränsning | Licens / rekommendation |
| --- | --- | --- | --- | --- |
| **TRELLIS.2** (Microsoft) | En bild → PBR 3D | Hög kvalitet, komplex topologi/material | Linux, NVIDIA GPU **min 24 GB VRAM**, CUDA, tunga beroenden; 3s i paper på H100 ≠ 3s på vanlig dator | Modell/kod MIT, men nvdiffrast/nvdiffrec m.fl. har separata villkor; **utvärdera för framtida lokal GPU, inte installera på Pages** |
| **TRELLIS (v1)** | Bild → 3D/Gaussians | Fler representationer, forskning | Tung GPU, rätt export-/materialkedja krävs | Huvudprojekt MIT; underberoenden separat |
| **TripoSR** (Stability AI/VAST) | En bild → snabb 3D | MIT, låg beräkningsbudget, redan valfri adapter i Studio | Baksida gissas, inga garanterade PBR-mappar eller auto-rigg | **Förstahandsadapter** för frivillig lokal prototyp; kräv GPU/CPU-mätning |
| **InstantMesh** | En bild → multi-view → mesh | 3D från flera genererade vyer, bra forskningsbas | Vikt- och pipeline-version varierar; hög fidelitet kräver efterarbete | Modellkort uppger Apache-2.0; kontrollera repo/beroenden innan integrering |
| **SAM 3D Objects** (Meta) | Mask i bild → form/textur/layout | Objektrekonstruktion även med ocklusion | Ej auto-rigg, skilda exportrepresentationer; villkor för distribuerad modell | SAM License är **inte MIT**; juridisk granskning krävs |
| **Hunyuan3D 2.1** (Tencent) | Bild → form + PBR-textur | Forskning med kraftfulla PBR-resultat | 10 GB form/21 GB texture VRAM enligt repo | **ANVÄND INTE I DUOFORGE I SVERIGE/EU:** communitylicensens territorium **utesluter EU**, UK och Sydkorea. Alternativt krävs uttryckligt giltigt separat tillstånd. |
| **COLMAP** | Många foton → SfM/MVS → mesh | Mer faktisk synlig geometri än single-image | Kräver överlapp, olika kameraställningar, många foton | BSD; lämplig i opt-in arbetsflöde |
| **Meshroom / AliceVision** | Fotogrammetri, nodpipeline | Reproducerbar visuell rekonstruktion | Tung dator, inte en knapp på GitHub Pages | MPL-2.0 för Meshroom; kontrollera alla moduler |
| **Open3D** | Mesh/point cloud verktyg | Städning, filtering, normals, reconstruction | Skapar inte automatiskt fotorealistisk design | MIT för Open3D, relevanta beroenden måste kontrolleras |
| **PyTorch3D** | Forskning/differentiable rendering | 3D optimering och fit mot bilder | Kräver PyTorch och oftast GPU, inte en färdig generator | BSD, bibliotek och inte inbyggd Sites-funktion |

## Beslutslogik (för framtida adapter)

1. Om input har **riktiga multiviewbilder** och dator kan köra lokal pipeline: COLMAP/Meshroom. Gör först licenskontroll.
2. Om input = **en referensbild** och bara en lättare lokal dator finns: befintlig TripoSR-adapter efter uttrycklig start från användaren.
3. Om en kvalificerad **24GB+ NVIDIA GPU** finns, och licensberoenden godkända: TRELLIS.2 som ett frivilligt alternativ.
4. Om runtime bara är iPhone/GitHub Pages: välj **procedural + importerad GLB**, eller förklara att server behövs. Kör aldrig tung modell transparent i bakgrunden.
5. Om resultatet måste vara **spelbar varelse**: lägg alltid till kontroll för retopo, UV, skinning, animation och GPU-budget.

## Forskningsnotering

- 3D Gaussian Splatting och NeRF är användbara för vyrekonstruktion men ger **inte automatiskt en optimal skinnad GLB**. Mesh-konvertering, texturöverföring och rigg kräver extra steg.
- En bild bestämmer inte formen på den osynliga baksidan. Fler bilder/vyer kan förbättra underlaget men garanterar inte perfekt geometri.
- Att generera en mesh snabbt innebär inte att **sculpt, retopo, texturering och rigg** sker på samma tid.
- Modellvikter ska aldrig läggas in i publikt GitHub-repo eller köras på Github Pages. Separat runtime + användarens uttryckliga medgivande.

Direktkällor: https://github.com/microsoft/TRELLIS.2 · https://github.com/microsoft/TRELLIS · https://huggingface.co/stabilityai/TripoSR · https://huggingface.co/TencentARC/InstantMesh · https://github.com/facebookresearch/sam-3d-objects · https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE · https://colmap.github.io/ · https://github.com/alicevision/Meshroom
