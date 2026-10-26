# Volvo S90 Recharge Garage — DuoForge 3D Studio

A browser-first, **unofficial Volvo S90 Recharge–inspired** 3D workflow. This includes two distinct assets with different licenses and fidelity.

## 1. DuoForge Studio Edition — editable, lightweight and included

Click **Volvo S90 Garage → Skapa Volvo S90 i 3D** in `/workshop/studio/`.

The model is generated locally with Three.js. It is an original, approximate 3D study using Volvo's public dimensions:

| Dimension | 2021 S90 published value |
| --- | ---: |
| Length | 4,969 mm |
| Width, excluding mirrors | 1,890 mm |
| Wheelbase | 2,941 mm |
| Height | 1,446 mm |

Source: https://www.volvocars.com/uk/support/car/s90/article/766ee075f0e03896c0a8015109ee0749/

Features: editable sculpted panels, separate four opening doors, windshield and rear glass, chrome waterfall grille and signature headlights, rear badge and lamps, T8-inspired charging-port detail, four independent tire/rim/hub sets, multi-seat leather interior, headrests, dashboard, steering wheel, portrait instrument screen, gear selector, textures and GLB export. Paint, interior, LED and door toggles are available in the Garage. It is a **game-ready approximation, not photoreal factory CAD**, and details are artistic interpretations, not verified engineering parts. Two construction quality levels support laptops and mobile devices.

The GLB can be exported from the editor and used in Render World / Living Objects. Speed, wheelbase and steering are configured in model metadata. Wheel meshes are labeled so DuoForge's wheel rig can distinguish them from nonrotating brake calipers. Textures are generated locally; no API key, cloud GPU or paid AI is required.

**Known limitations:** not exact OEM surfacing, no simulated powertrain or real Volvo dashboard software, approximate wheel/body dimensions, simplified car collisions, materials depend on device lighting. The door hinge transforms work in editing mode; these are not automatically animated in driving mode.

## 2. Photorealistic Volvo S90 Recharge by Adam Wiese (lazercar)

**This is a separate third-party 3D model, not bundled in the Studio repo.**

- [Creator's Sketchfab model and license (CC Attribution)](https://sketchfab.com/3d-models/volvo-s90-recharge-free-9462b07c10244fd4a28d86846dc9e3a9)
- [Creator's free Gumroad page](https://lazercar.gumroad.com/l/s90)

Original creator: **Adam Wiese (lazercar)**. License shown on Sketchfab: **Creative Commons Attribution (CC BY)**. The source is a large Blender scene with textures (around 1.6M polygons according to the artist), not a compact game-ready GLB. **Follow the creator's download instructions and preserve attribution.** Volvos brand rights are separate from the model's copyright license.

The **Originalmodell** button opens Sketchfab's credited interactive viewer in an opt-in dialog. Loading the viewer may contact Sketchfab; if embedding is blocked, use the link above.

### Convert your legitimately downloaded original (locally, free)

Install [Blender](https://www.blender.org/) and download the creator's Blender model. Then from the repo root:

```bash
blender -b "/path/to/S90.blend" --python tools/volvo-s90-convert.py -- "/path/to/volvo-s90-showroom.glb" --mode showroom
```

Optional, **lossy draft** for game performance:

```bash
blender -b "/path/to/S90.blend" --python tools/volvo-s90-convert.py -- "/path/to/volvo-s90-game.glb" --mode game
```

Review the reduced model before distributing it. The script adds an attribution node, writes a companion attribution text file and creates the GLB. It does not download or publish the artist's files. Heavy Blender sources may require significant RAM. GLB size, PBR texture fidelity, wheel names and steering axes depend on the source's original hierarchy and may need adjustments in the editor. Test both showroom and driving modes.

Import the GLB through **Importera GLB** in Studio and run the existing **Gör körbar** function on the complete model if its meta has no driving behavior.

## Licenses and affiliations

The included approximate procedural geometry is original DuoForge work. It does **not** include lazercar's licensed high-poly geometry or texture files. Source/model credit must stay attached when redistributing the high-poly artist asset. Volvo, Volvo S90 and Volvo Recharge are brands of Volvo Cars. DuoForge is not an official Volvo Cars product and no Volvo partnership or endorsement is implied.
