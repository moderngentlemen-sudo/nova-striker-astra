# Nova Striker: fresh-start prototype (Version 10)

**Scope.** This folder is an isolated, hypothetical fresh-start track. It does not replace, cancel, reset or
change the existing Nova Striker project or any current work, and it is not a decision to restart the
project. It is a playable test of feel. The characters are procedural placeholder rigs, not approved or
game-ready art, and all sound and music is synthesized placeholder audio.

## What it is

A browser prototype of a 2.5D sci-fi action platformer for 1–4 player local co-op, with four characters.

- **Nova** (Sentinel) starts with the Marksman kit: a bracer with four chargeable attachments (Lance,
  Volley, Arc, Prism) and a Level 4 beam, five secondary weapons (Scatter, Grenade, Chain, Disc, Gravity
  Well), a dodge, the hard-light Aegis, a close-range combo, rocket jumps, light boosters and skate-blade
  boots. His Pass 1 Sentinel kit is in Settings.
- **Echo** (Pursuit) starts with the Hunter kit: twin blades and a glaive, a sniper rifle, snares, staff
  deflects, and a nano-scarf with three modes (Tether, Veil, Flare). His Pass 1 Pursuit kit is in Settings.
- **RAM** (Vanguard) is the tank: a 2.3 m heavy frame with a tower shield that blocks for the whole team, a
  shoulder charge that plows through enemies, a shoulder cannon, and abilities that protect teammates.
- **Fix** (Mechanic) is the support: a Patch Beam that heals and speeds teammates up, faster revives,
  gadgets and power-ups built from Scrap, a rivet gun and a big wrench.
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
| Melee | Right click or J | X |
| Rising attack · ground pound | W + melee · S + melee in the air | Up + X · down + X in the air |
| Parry (Echo) · dodge (Nova) · guard (RAM) · Patch Beam (Fix) | Q or L | LT |
| Suit ability (RAM: Bulwark Wall · Fix: build a gadget) | E, I or middle click | Y |
| Switch mode (Nova's attachment, Echo's scarf) · Guardian Link (RAM) · pick a gadget (Fix) | R, U or mouse back | RB |
| Nova's secondary weapon · Provoke (RAM) · pick a power-up (Fix) | T or Y | LB |
| Lock-on (automatic by default: tap to switch, hold to let go) | F, O or mouse forward | R3 |
| Ultimate (full bar) | V or N | LT + RT together |
| Swap character · pause · help | 1–4 or Tab · Esc or P · H | D-pad left/right · Start · View |

Extra gamepads join by pressing any button, up to four players; each new player gets the first character
nobody is using. H or View shows the full controls in game; B, A, Start or View closes them, and the D-pad
scrolls.

## What changed in Version 10

### RAM, Vanguard (the tank)

Much bigger than Nova and Echo (2.3 m to their 1.7 m) with 160 health, the most on the team; slower, with
lower jumps. **Stalwart:** ordinary hits don't knock him about (heavy hits and blasts still do).
**Heavyweight:** his melee and close-range hits (shield and fist, Meteor Drop, Kinetic Release, the Guardian
Link landing) throw enemies 1.6 times as far, and a hard enough one sends a light enemy flying (a Piston Punch
throws a Swarmer about 7.5 m). Bosses and armour still hold their ground. His Ram Charge throws sparks off the
floor, and his big impacts (Meteor Drop, Seismic Slam, a Breach Shot bursting on the floor, the Guardian Link
landing, Siege Breaker's slam, and enemies slammed into walls) leave craters that fade after a few seconds.

- **Rampart** (hold LT): a tower shield. It blocks strikes, shots and blasts from in front (shockwaves along
  the floor still pass under it), and enemy shots stop at it, so it covers everyone behind him. The damage comes off its Integrity (the blue bar) instead of
  his health; Integrity grows back once he lowers it, and if it breaks he reels and must wait for it.
  Raised just as a hit lands, it is a **Perfect Guard**: no cost, a shot goes back to whoever fired it, a
  striker reels. Aim up to hold it overhead; he walks slowly behind it and can jump with it up.
- **Kinetic Release** (RT while guarding): every point the shield blocks is stored as Kinetic; this lets it
  all out as a cone of force that erases enemy shots, stronger the more is stored.
- **Ram Charge** (B): a shoulder charge behind the shield that scoops up light enemies and slams them into
  the next wall. Hold B while standing still for the **Battering Ram**: three levels, longer and faster,
  and from level 2 it carries heavy enemies too and breaks armour. Bosses and rooted enemies stop it.
- **Breach Cannon** (RT): a heavy slug; hold to charge a Breach Shot that punches through enemies (level 2
  breaks armour, level 3 also bursts at the end).
- **Melee** (X): shield bash, edge strike and Piston Punch; a shield swat in the air; from a guard, a quick
  shove. Hold for the **Seismic Slam**: shockwaves both ways along the floor. Rising attack: the
  **Hydraulic Uplift** (launches enemies, sweeps shots away). His ground pound, the **Meteor Drop**, lands
  wider and harder.
- **Bulwark Wall** (Y): a hard-light wall for 8 s. Enemy shots stop at it and enemies can't get through
  until they break it; the team's shots pass through boosted.
- **Guardian Link** (RB): links him to the teammate who needs it most, leaping to their side if they are
  far. For 8 s he takes 60% of the damage they take, and they get Plating (an overshield).
- **Provoke** (LB): a war cry. Enemies close by turn on him for 4 s while he braces (takes 40% less), and
  the ones right beside him are shoved back.
- **Ultimate, Siege Breaker:** the team is Fortified with Plating, then he charges behind a colossal
  hard-light ram's head, scooping up everything in his path, and slams the pile down.

### Fix, Mechanic (the support)

Lighter and quicker, with 95 health.

- **Patch Beam** (hold LT): locks onto the teammate who needs it most. It heals fast, then adds Plating,
  and **Tunes Up** whoever it holds: they charge, recharge and fill their bars 1.5 times as fast. On a
  downed teammate it revives them from range; with no one in range she welds herself.
- **Field Mechanic:** beside a downed teammate she revives three times as fast as anyone else, and whoever
  she brings back returns with 60% of their health (40% otherwise).
- **Gadgets** (Y builds, RB picks; cost Scrap): the **Patch Pylon** heals everyone in its field, and a
  downed teammate inside slowly gets back up on their own; the **Sentry** shoots the nearest enemy (rockets
  too at level 3); the **Amp Coil** makes teammates in its field charge and fill their bars faster. Two
  wrench hits raise a gadget a level, up to 3.
- **Power-ups** (melee with no enemy or gadget close; LB picks; cost Scrap): tossed to the nearest teammate
  in front, or dropped at her feet, and anyone can pick one up. **Overclock**: everything charges,
  recharges and fills 1.6 times as fast for 10 s. **Plating**: an overshield. **Medkit**: 40 health.
- **Rivet Gun** (RT): tap for a burst of rivets; hold for a Hot Rivet that sticks where it hits and bursts.
- **Wrench** (X): a three-hit combo; hold for the **Torque Slam**, a ring of sparks that stuns light
  enemies and drones. Rising attack: **Jack-Up**, which leaves a spring pad teammates can bounce off. Her
  ground pound sends out a repair pulse that heals teammates close by.
- **Scrap** (the yellow bar): it trickles in, and comes from her hits and from enemies falling near her.
- **Ultimate, Overhaul:** a supply pod drops and pulses repair light across the screen (it brings back
  anyone who is down and hurts every enemy), then the team is Overclocked and Plated and her gadgets jump to
  level 3.

Fix's boosts (Tune-Up, Overclock and the Amp Coil) stack, up to 2.6 times as fast. They cover every
weapon charge, ability cooldowns and recharges, and ultimate bar build-up.

### Also new

- **Team ultimates** have names for every pair, for example Heavy Metal (RAM + Fix), Starbreaker (Nova +
  RAM) and Razorwire (Echo + Fix).
- **Swapping** goes Nova, Echo, RAM, Fix; keys 1–4 pick a character directly.
- **Fix:** an ultimate that ended with its player falling into a pit, or being pulled back on screen,
  could leave the game frozen. It now ends there.

## What changed in Version 9

- **Nova's secondary weapons:** no recoil, and five to choose from with LB (Scatter, Grenade, Chain, Disc,
  Gravity Well). Tap to fire, hold to charge.
- **Nova's dodge** on LT, with a perfect dodge that slows the enemies around him.
- **Automatic lock-on** (Settings: Lock-on mode).
- **Rising attacks for everyone,** each designed for the character.
- **Ultimates** and team ultimates, a sci-fi impact frame, and a controller-friendly controls screen.

## What changed in Version 8

- Nova: slower charging with a Level 4 sustained beam, the hard-light Aegis, and a close-range combo.
- Echo: a sniper rifle with a laser sight, staff deflects and Zero-style moves.
- A chargeable ground pound for both, less recoil across the board, dust effects, longer impact frames,
  and two bosses (the Lockwarden and the Stormcaller).

## Code

`game/js/` has one ES module per concern. The simulation (`world.js`, `player.js`, `enemies.js`,
`bosses.js`, `combat.js`, `level.js`) runs on plain data at a fixed 60 Hz and never touches the DOM or
three.js. It emits events, and these react to them:

- rendering (`render.js`, `rigs.js`, `enemyRigs.js`, `anim.js`, `fx.js`, `chargefx.js`, `subfx.js`,
  `ultfx.js`, `beamfx.js`, `aegisfx.js`, `ramfx.js`, `fixfx.js`, `trails.js`, `ghosts.js`)
- sound (`audio.js`, `music.js`)
- haptics (`haptics.js`)
- the HUD and menus (`ui.js`)

All tuning lives in `config.js`.

## Tests

`node tests/run-all.mjs` needs Node 18 or newer and no install. It runs the headless simulation suites:
222 checks, including two random-input soaks (the newer one runs all four characters, swapping them
mid-fight). The browser screenshot, smoke and performance runs were done separately and are not included.

## Known limits

- Keyboard, mouse or gamepad only: there are no touch controls yet.
- iPhones do not allow vibration from a web page.
- Rumble, phone vibration and frame rate have not been checked on real devices yet.
- RAM's and Fix's numbers, ultimate charge rates and weapon numbers are first-pass tuning values in
  `config.js`.
