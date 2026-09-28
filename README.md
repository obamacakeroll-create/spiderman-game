# Spider-Men: Juma Brothers

An open-world superhero action game built with Three.js, set in a dense, scaled-down procedural Manhattan.
You play as **Ali Juma** (Volt Weaver) and **Majed Juma** (Ironsilk), and switch between them in free roam with a cinematic fly-over.
**Venom** is the campaign's major villain and becomes playable later.

## Run
```bash
npm install
npm run dev        # open the printed URL
npm run build      # static build in dist/
```
Add `?low` to the URL to force the Low preset. Everything else is in **Settings** (title screen or ESC → SETTINGS).

## Settings
- **Graphics:** quality presets (Low/Medium/High/Ultra), resolution scale, shadow quality, N8AO ambient occlusion, SMAA, bloom and its intensity, volumetric clouds, reflective water, street light pools, view distance, crowd and traffic density, brightness, speed blur, film grain, FPS counter.
- **Gameplay:** difficulty, FOV, mouse sensitivity, invert Y, auto camera, camera shake, HUD scale, world markers, subtitles, tutorial hints, day length.
- **Audio:** master, music, effects and voices.
- **Controls:** rebind every action to any key or mouse button.

## Features
- **Characters:** seamless sculpted bodies. Each is a signed-distance-field anatomy meshed with surface nets and skinned automatically to the rig. Suits are drawn in a shader: raised 3D webbing, emblems, glowing circuit lines, armored plating, and a living symbiote sheen for Venom.
- **Atmosphere:** height fog that thickens in the street canyons, a procedural cloud layer, lightning storms with thunder, wet reflective streets in rain, ambient occlusion and filmic color grading.
- **City:** a Manhattan grid with avenues and streets, Central Park with a lake, Times Square billboards, Empire- and Chrysler-style landmarks, a Financial District, a suspension bridge, piers and rivers. Every asset is generated in code:
  - Buildings: PBR glass and stone facades with recessed windows (normal-mapped) that light up at night, lit storefronts with awnings, and crown lighting on skyscrapers.
  - Rooftops: bulkheads, water towers and antennas.
  - Streets: working traffic signals that cars queue at, extruded sedans, SUVs, taxis and vans, steam vents, and pools of light under the street lamps.
  - People: crowds whose walk cycles are baked from the same sculpted bodies as the heroes.
- **Traversal:** momentum-based pendulum web swinging with smart anchor picking, corner steering and perfect releases. Also dives, web-wing gliding, wall running and crawling with vaults, zip to point, point launch, and air tricks.
- **Combat:**
  - Combos, launchers and air juggles.
  - Spider-Sense cues, perfect dodges into counters, web strikes, web shots and wall-webbing.
  - Stealth takedowns (ground and perch) and finishers with cinematic cameras.
  - Hit-stop, screen shake, particles and slow-mo.
  - Enemy types: thug, gunner, brute, shield, jetpack, and regenerating symbiote hosts.
  - Bosses: **Carapace**, **Venom** and **The Warden**'s mech.
- **Heroes:**
  - Ali: Arc Lash chain lightning, Static Dome, Overclock.
  - Majed: Seismic Drop, Web Hammer, Guardian Wall.
  - Venom: tendril pull traversal, grab and throw, Tendril Storm, Symbiote Surge, Roar, and a Feast finisher.
  - The brother you aren't controlling is AI-driven: he swings around the city and joins fights on his own.
- **Campaign:** "Two Webs, One City", 8 missions with dialogue, cinematics, a chase, stealth, 3 boss fights and a playable Venom rampage. Checkpoints and saving use `localStorage`.
- **Side content:** random crimes, 3 enemy bases, 4 ring time-trial challenges, and 20 "Juma Memories" collectibles.
- **Progression:** XP and levels, a skill tree for each brother, 6 unlockable spider suits plus Venom.
- **Photo mode (P):** orbit camera and five color filters.
- **Presentation:** a HUD with a minimap, objective markers, subtitles and a boss bar. Pause menu with map, skills, suits, journal and controls. Bloom and cinematic post-processing (speed blur, chromatic aberration, slow-mo grade). Procedural WebAudio sound effects and adaptive music. Gamepad support.

## Controls
| Action | Key |
|---|---|
| Move / look | WASD / mouse |
| Swing (in air) / sprint and wall-run (ground) | Hold Shift or right mouse |
| Jump / jump-release / glide (hold) | Space |
| Dive | Ctrl / C |
| Zip to point / web strike | E |
| Attack / launcher / dodge | Left mouse / R / F |
| Web shot / finisher / abilities | Q / X / 1-2-3 |
| Air trick | T |
| Switch brother / Venom | Tab / V |
| Photo mode | P |
| Menu | Esc · Enter starts the next mission |
