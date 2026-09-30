# Nova Striker: fresh-start prototype (Version 7)

**Scope.** This folder is an isolated, hypothetical fresh-start track. It does not replace, cancel, reset or
change the existing Nova Striker project or any current work, and it is not a decision to restart the
project. It is a playable test of feel. The characters are procedural placeholder rigs, not approved or
game-ready art, and all sound and music is synthesized placeholder audio.

## What it is

A browser prototype of a 2.5D sci-fi action platformer for 1–4 player local co-op.

- **Nova** (Sentinel) starts with the Marksman kit. It has a bracer with four chargeable attachments
  (Lance, Volley, Arc, Prism), a chargeable secondary blaster, rocket jumps, light boosters and skate-blade
  boots. His Pass 1 Sentinel kit is in Settings.
- **Echo** (Pursuit) starts with the Hunter kit. It has twin blades and a glaive, snares, a staff-rifle, and
  a nano-scarf with three modes (Tether, Veil, Flare). His Pass 1 Pursuit kit is in Settings.
- **Zones:** Movement Gym, Concourse Lock (an arena), Storm Spire Climb and Skyline Relay (drones, mortars,
  chargers and a gated two-wave fight).

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
| Melee (Nova: secondary blaster) | Right click or J | X |
| Parry | Q or L | LT |
| Suit ability | E, I or middle click | Y |
| Switch mode (Nova's attachment, Echo's scarf) | R, U or mouse back | RB |
| Lock-on (tap to lock or switch, hold to release) | F, O or mouse forward | R3 |
| Swap character · pause · help | 1/2 or Tab · Esc or P · H | D-pad left/right · Start · View |

Extra gamepads join by pressing any button, up to four players. H shows the full controls in game.

## What changed in Version 7

- **Rocket jumps:** the height grows with charge time, from about 3 m at charge level 1 to about 10 m on a
  Perfect Release (the Arc goes highest). While you line one up, a marker shows the height. The launch
  effects are much bigger.
- **Wall play:** the slide grips, then eases in. The grip is sticky and a slightly late wall jump still
  works. Climb kicks let you climb a single wall, and leaps push you off. Everyone can shoot and attack from
  a wall.
- **Charged dash:** hold dash while standing still to charge it through three levels. Afterimages grow with
  each level.
- **Echo's staff-rifle:** hold fire for a long shot, or longer for a piercing marking shot.
- **Also new:** lock-on, a distinct charge and release look for each attachment, and haptics for
  controllers and phones.

## Code

`game/js/` has one ES module per concern. The simulation (`world.js`, `player.js`, `enemies.js`,
`combat.js`, `level.js`) runs on plain data at a fixed 60 Hz and never touches the DOM or three.js. It emits
events, and these react to them:

- rendering (`render.js`, `rigs.js`, `enemyRigs.js`, `fx.js`, `chargefx.js`, `ghosts.js`)
- sound (`audio.js`, `music.js`)
- haptics (`haptics.js`)
- the HUD and menus (`ui.js`)

All tuning lives in `config.js`.

## Tests

`node tests/run-all.mjs` needs Node 18 or newer and no install. It runs the headless simulation suites:
126 checks plus a random-input soak. The browser screenshot runs were done separately and are not included.

## Known limits

- Keyboard, mouse or gamepad only: there are no touch controls yet.
- iPhones do not allow vibration from a web page.
- Rumble, phone vibration and frame rate have not been checked on real devices yet.
