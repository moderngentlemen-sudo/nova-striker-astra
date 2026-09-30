# Nova Striker: fresh-start prototype (Version 9)

**Scope.** This folder is an isolated, hypothetical fresh-start track. It does not replace, cancel, reset or
change the existing Nova Striker project or any current work, and it is not a decision to restart the
project. It is a playable test of feel. The characters are procedural placeholder rigs, not approved or
game-ready art, and all sound and music is synthesized placeholder audio.

## What it is

A browser prototype of a 2.5D sci-fi action platformer for 1–4 player local co-op.

- **Nova** (Sentinel) starts with the Marksman kit: a bracer with four chargeable attachments (Lance,
  Volley, Arc, Prism) and a Level 4 beam, five secondary weapons (Scatter, Grenade, Chain, Disc, Gravity
  Well), a dodge, the hard-light Aegis, a close-range combo, rocket jumps, light boosters and skate-blade
  boots. His Pass 1 Sentinel kit is in Settings.
- **Echo** (Pursuit) starts with the Hunter kit: twin blades and a glaive, a sniper rifle, snares, staff
  deflects, and a nano-scarf with three modes (Tether, Veil, Flare). His Pass 1 Pursuit kit is in Settings.
- **Everyone** has a rising attack of their own (up + melee), a chargeable ground pound, and an ultimate;
  teammates can combine ultimates into a team ultimate.
- **Zones:** Movement Gym, Concourse Lock (an arena ending in the Lockwarden boss), Storm Spire Climb and
  Skyline Relay (ending in the Stormcaller boss).

## Run it

- **From source:** serve `game/` with any static web server (ES modules do not load from `file://`), for
  example `cd game && python3 -m http.server 8000`, then open http://localhost:8000.
- **Single file:** open `standalone/nova-striker-prototype.html` in a browser.

Both load three.js 0.170 and the fonts from public CDNs, so they need an internet connection. Use a normal
browser tab for controllers and rumble, because embedded viewers may block gamepads and vibration.

## Controls

| Action | Keyboard + mouse | Gamepad |
|---|---|---|
| Move · crouch | A/D · S | Left stick |
| Aim | Mouse | Right stick |
| Jump · double jump · wall jump | Space | A |
| Dash · slide · charged dash | Shift · S + Shift · hold Shift while standing still | B · down + B · hold B |
| Fire (hold to charge) | Left click or K | RT |
| Melee (Nova: secondary weapon when nobody is close) | Right click or J | X |
| Rising attack · ground pound | W + melee · S + melee in the air | Up + X · down + X in the air |
| Parry (Echo) · dodge (Nova) | Q or L | LT |
| Suit ability | E, I or middle click | Y |
| Switch mode (Nova's attachment, Echo's scarf) | R, U or mouse back | RB |
| Switch Nova's secondary weapon | T or Y | LB |
| Lock-on (automatic by default: tap to switch, hold to let go) | F, O or mouse forward | R3 |
| Ultimate (full bar) | V or N | LT + RT together |
| Swap character · pause · help | 1/2 or Tab · Esc or P · H | D-pad left/right · Start · View |

Extra gamepads join by pressing any button, up to four players. H or View shows the full controls in game;
B, A, Start or View closes them, and the D-pad scrolls.

## What changed in Version 9

- **Nova's secondary weapons:** no recoil any more, and five to choose from with LB: Scatter (point-blank
  pellets), Grenade (bounces, bursts on a fuse or on contact; level 3 scatters bomblets), Chain (lightning
  that leaps between enemies, round shields, and stuns), Disc (out and back, cutting everything; from level 2
  it hovers; press again to call it back) and Gravity Well (pulls enemies in and holds them, swallows their
  shots, then collapses; press again to open or collapse it early). Tap to fire, hold to charge.
- **Nova's dodge** on LT: a quick hop, untouchable at the start; a last-moment perfect dodge slows the
  enemies around him and gives Overcharge and ultimate charge. Echo keeps his parry and deflect.
- **Automatic lock-on** (Settings: Lock-on mode): the nearest enemy in sight is locked whenever you have no
  target; R3 switches, holding R3 lets go until the next press. Free aim still aims where you point.
- **Rising attacks for everyone,** each designed for the character: Nova's Solar Uppercut, Echo's Rising
  Glaive. Every new character gets their own.
- **Ultimates:** a bar under each player's health fills as they fight. With it full, both triggers together
  call the character's ultimate (Nova: Supernova, a steerable colossal beam and a nova of light; Echo:
  Thousand Cuts). Teammates with a full bar can join during the call for a team ultimate that ends in a
  finisher on every enemy on screen (Echo + Nova: Eclipse Protocol).
- **Impact frames** have a sci-fi look: a cyan photonegative flash, then a hologram grade with glowing
  edges, scanlines, a hex grid, light streaks, a shockwave ring and glitch tears.
- **Controls screen:** a controller closes it with B, A, Start or View, and the game waits while it is open.

## What changed in Version 8

- Nova: slower charging with a Level 4 sustained beam, the hard-light Aegis (it cracks, splinters and
  shatters, and Overcharges his weapons), and a close-range hard-light combo.
- Echo: a sniper rifle with a laser sight that flickers while it searches, holds on a target and turns red
  at full focus; staff deflects; Zero-style moves (Dash Slash, Rising Glaive, Spin Slash, Wall Slash, a
  crescent wave).
- A chargeable ground pound for both, less recoil across the board, dust effects, longer impact frames,
  and two bosses (the Lockwarden and the Stormcaller).

## Code

`game/js/` has one ES module per concern. The simulation (`world.js`, `player.js`, `enemies.js`,
`bosses.js`, `combat.js`, `level.js`) runs on plain data at a fixed 60 Hz and never touches the DOM or
three.js. It emits events, and these react to them:

- rendering (`render.js`, `rigs.js`, `enemyRigs.js`, `anim.js`, `fx.js`, `chargefx.js`, `subfx.js`,
  `ultfx.js`, `beamfx.js`, `aegisfx.js`, `trails.js`, `ghosts.js`)
- sound (`audio.js`, `music.js`)
- haptics (`haptics.js`)
- the HUD and menus (`ui.js`)

All tuning lives in `config.js`.

## Tests

`node tests/run-all.mjs` needs Node 18 or newer and no install. It runs the headless simulation suites:
188 checks plus a random-input soak. The browser screenshot, smoke and performance runs were done separately
and are not included.

## Known limits

- Keyboard, mouse or gamepad only: there are no touch controls yet.
- iPhones do not allow vibration from a web page.
- Rumble, phone vibration and frame rate have not been checked on real devices yet.
- Ultimate charge rates and weapon numbers are first-pass tuning values in `config.js`.
