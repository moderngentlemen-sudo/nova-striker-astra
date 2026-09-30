# Nova Striker: fresh-start prototype (Version 8)

**Scope.** This folder is an isolated, hypothetical fresh-start track. It does not replace, cancel, reset or
change the existing Nova Striker project or any current work, and it is not a decision to restart the
project. It is a playable test of feel. The characters are procedural placeholder rigs, not approved or
game-ready art, and all sound and music is synthesized placeholder audio.

## What it is

A browser prototype of a 2.5D sci-fi action platformer for 1–4 player local co-op.

- **Nova** (Sentinel) starts with the Marksman kit: a bracer with four chargeable attachments (Lance,
  Volley, Arc, Prism) and a Level 4 beam, a chargeable secondary blaster, the hard-light Aegis, a
  close-range combo, rocket jumps, light boosters and skate-blade boots. His Pass 1 Sentinel kit is in
  Settings.
- **Echo** (Pursuit) starts with the Hunter kit: twin blades and a glaive, a sniper rifle, snares, staff
  deflects, and a nano-scarf with three modes (Tether, Veil, Flare). His Pass 1 Pursuit kit is in Settings.
- **Both** have a chargeable ground pound.
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
| Jump · double jump · wall jump | Space | A or LB |
| Dash · slide · charged dash | Shift · S + Shift · hold Shift while standing still | B · down + B · hold B |
| Fire (hold to charge) | Left click or K | RT |
| Melee (Nova: combo up close, secondary blaster otherwise) | Right click or J | X |
| Ground pound (hold to charge) | S + melee in the air | Down + X in the air |
| Parry | Q or L | LT |
| Suit ability (Nova: the Aegis) | E, I or middle click | Y |
| Switch mode (Nova's attachment, Echo's scarf) | R, U or mouse back | RB |
| Lock-on (tap to lock or switch, hold to release) | F, O or mouse forward | R3 |
| Swap character · pause · help | 1/2 or Tab · Esc or P · H | D-pad left/right · Start · View |

Extra gamepads join by pressing any button, up to four players. H or View shows the full controls in game.

## What changed in Version 8

- **Nova:** slower charging with a Level 4 sustained beam (keep holding fire past level 3), the hard-light
  Aegis (it cracks, splinters and shatters, and Overcharges his weapons), and a close-range hard-light
  combo. Rocket jumps no longer flip him.
- **Echo:** a sniper rifle with a laser sight that flickers while it searches, holds on a target and turns
  red at full focus; staff deflects; Zero-style moves (Dash Slash, Rising Glaive, Spin Slash, Wall Slash, a
  crescent wave).
- **Both:** a chargeable ground pound (down + melee in the air).
- **Also new:** less recoil across the board, dust effects, longer impact frames, and two bosses (the
  Lockwarden and the Stormcaller).

## Code

`game/js/` has one ES module per concern. The simulation (`world.js`, `player.js`, `enemies.js`,
`bosses.js`, `combat.js`, `level.js`) runs on plain data at a fixed 60 Hz and never touches the DOM or
three.js. It emits events, and these react to them:

- rendering (`render.js`, `rigs.js`, `enemyRigs.js`, `anim.js`, `fx.js`, `chargefx.js`, `beamfx.js`,
  `aegisfx.js`, `trails.js`, `ghosts.js`)
- sound (`audio.js`, `music.js`)
- haptics (`haptics.js`)
- the HUD and menus (`ui.js`)

All tuning lives in `config.js`.

## Tests

`node tests/run-all.mjs` needs Node 18 or newer and no install. It runs the headless simulation suites:
161 checks plus a random-input soak. The browser screenshot, smoke and performance runs were done separately
and are not included.

## Known limits

- Keyboard, mouse or gamepad only: there are no touch controls yet.
- iPhones do not allow vibration from a web page.
- Rumble, phone vibration and frame rate have not been checked on real devices yet.
