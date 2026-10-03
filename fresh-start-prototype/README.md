# Nova Striker Astra

A rebuilt 2.5D action platformer for one to four local players. The playable mission is **Restore the Skyline Relay**: cross the concourse, defeat the Lockwarden, climb the Storm Spire, reconnect both relay controls, defeat the Stormcaller, and restart the city beacon.

Development belongs to `moderngentlemen-sudo/nova-striker-astra`. The original Claude repository is unchanged.

## Play

- **Offline single file:** open `standalone/nova-striker-prototype.html`. The game, styles, and Three.js are embedded; no network is required. It uses installed system fonts.
- **Editable source:** serve `game/`, for example `python -m http.server 8766 --bind 127.0.0.1 --directory game`, then open `http://127.0.0.1:8766/`. Three.js is included locally. Optional Google Fonts improve title typography when online.
- Choose a hero, then **Deploy to Skyline** or **Training**. Additional controllers can join during play. A keyboard or controller is required; touch controls are not included.

Use a normal desktop browser if an embedded viewer blocks controllers or audio. The source view displays a retry screen if its modules or WebGL cannot initialize.

## The rebuild

- **Mission:** authored objectives, contextual interaction prompts, repair channels, checkpoint healing, completion results, personal best time, and support contributions.
- **World interaction:** eleven machines including breach panels, charged power fixtures, launch surfaces, a repair circuit, an Echo tether anchor, two relay controls and the final beacon. Every hero can complete the main route; abilities offer additional opportunities.
- **Combat:** local hitstop preserves inputs. Defense has a clear cancel priority; missed attacks retain commitment. Melee assistance respects retreat input, walls and platform edges.
- **Nova:** explicit close strike and secondary fire, plus a quick swap between two remembered primary/secondary loadouts.
- **Echo:** directional tether throws and aerial finishers that carry, slam or lift. A lift can extend an aerial sequence once before landing.
- **RAM:** steer a collected pile into a forward or upward release during a charge. An empty charge cannot cancel early this way.
- **Fix:** wrench hits detonate embedded Hot Rivets. Pick up and relocate owned gadgets while preserving their upgrade level, health and remaining lifetime.
- **Presentation:** cel-style character lighting, stronger armor and equipment silhouettes, hostile shape language, district signs, mechanical platform detail, contact shadows, readable machine states, distinct impact/audio signatures, and restored transit/civic lighting.
- **Interface:** character selection, mission/training separation, compact or full combat HUD, improved pause navigation, reduced-effects mode, HUD scale and controller settings. Experimental legacy kits and zone/boss shortcuts are in the Training lab.

## Controls

The complete character reference is available with **H / View**. The original contextual controls remain available alongside the deliberate Astra controls.

| Action | Keyboard and mouse | Xbox-style controller |
|---|---|---|
| Move / crouch / aim | A/D / S / mouse | Left stick / down / right stick |
| Jump, double jump, wall jump | Space | A |
| Dash / slide / charged dash | Shift / down + Shift / hold while still | B / down + B / hold while still |
| Primary fire, hold to charge | Left click or K | RT |
| Contextual melee or utility | Right click or J | X |
| Explicit strike, always melee | X | L3 |
| Explicit Nova secondary | C | LB + X |
| Nova quick loadout swap | Z | LB + RB |
| Dodge / deflect / guard / repair beam | Q | LT |
| Suit ability, including Echo tether | E | Y |
| Mode / attachment / gadget selection | R | RB |
| Secondary / utility selection | T | Tap and release LB |
| Fix pick up/place nearby gadget | B | LB + Y |
| Interact with nearby machinery | G | D-pad up |
| Switch target | F | R3 |
| Ultimate, when full | V | LT + RT |
| Swap hero | 1-4 or Tab during play | D-pad left/right |
| Pause / full controls | Esc / H | Start / View |

**Echo throw:** hold tether and press strike while choosing a direction. Air finishers use neutral/up/down strike. **RAM release:** strike during a charge after collecting enemies; up throws upward. **Fix relocation:** press once near an owned gadget to pick it up, then again to place it. **Repair channels:** press Interact and remain nearby; moving away or taking damage interrupts the connection. Fix repairs faster.

Menus support native keyboard Tab/Shift+Tab, Enter/Space and controller up/down/A/B. Gameplay actions are suppressed while a menu is open and held buttons must be released before they act after closing it.

## Build and validate

Node.js 20+ and pnpm are sufficient. Dependencies are pinned in `pnpm-lock.yaml`.

```sh
pnpm install
pnpm test
pnpm build
pnpm check:build
```

`tools/build.mjs` copies the used Three.js module graph into `game/vendor/three/` and creates the offline standalone from the current source and CSS. `check:build` validates the embedded JavaScript, absence of external loading dependencies, and source fingerprint so a stale standalone cannot be delivered silently. Rebuild after editing source.

The headless suite tests production simulation code, including input retention/consumption, controller chords, defensive priority, explicit attack intent, character extensions, mission progression, interrupted channels, checkpoint/replay cleanup, support statistics and traversal with every hero. Traversal tests suppress combat; progression tests stage boss victories. They do not substitute for a full human balance playthrough or hardware controller evaluation.

## Structure

- `game/js/main.js`: application and menu orchestration.
- `game/js/astraUI.js`, `game/astra.css`: title, settings, mission HUD and results.
- `game/js/world.js`, `game/js/astraMission.js`, `game/js/level.js`: simulation, interactions and mission geography.
- `game/js/player.js`, `combat.js`, `input.js`: moves, collision, input buffers and controller mappings.
- `game/js/render.js`, `astraVisuals.js`, `rigs.js`, `enemyRigs.js`, `anim.js`: rendering and procedural art.
- `game/js/fx.js`, character effect modules, `audio.js`, `music.js`: impact and sound.
- `tests/`: headless regression and integration suites.
- `standalone/`: generated offline game.

The art is still procedural geometry and the soundtrack is synthesized. This is a playable rebuilt mission; authored animation clips, final production assets, online co-op, input remapping, touch controls and additional campaign missions remain future work.

Three.js 0.170.0 is distributed under MIT; its license is included in the vendor directory and standalone HTML. The bundler is esbuild 0.25.0.
