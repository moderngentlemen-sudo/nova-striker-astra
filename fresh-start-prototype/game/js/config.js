// Nova Striker browser prototype — tuning data.
// Units: metres, seconds. Frame data is in simulation ticks (60 per second).

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const GRAVITY = 49;          // gives a ~3.2 m jump that peaks in ~0.36 s
export const FALL_MULT = 1.35;      // heavier on the way down
export const RISE_CUT_MULT = 2.4;   // releasing jump while rising cuts the arc
export const MAX_FALL = 22;
export const FAST_FALL = 30;
export const HIGH_VEL = 16;         // speed above which melee becomes a Velocity Break

export const COYOTE = 6;
export const JUMP_BUFFER = 6;
export const ACTION_BUFFER = 6;
export const PARRY_BUFFER = 3;      // short on purpose: long parry buffers make late parries

export const PARRY = { window: 12, perfect: 4, whiff: 16 };
export const MERCY_TICKS = 60;

export const CHARS = {
  nova: {
    name: 'Nova', role: 'Sentinel', hp: 100,
    run: 7.4, backpedal: 0.8, accelG: 95, decelG: 120, accelA: 60, crouchSpeed: 0.4,
    jumpV: 17.7, dblV: 15.2,
    dash: { ticks: 11, speed: 22, exitKeep: 0.3, cooldown: 18 },
    slide: { ticks: 16, speed: 12.5, decay: 0.965 },
    wall: { slide: 3.6, jumpVx: 9.5, jumpVy: 16, lock: 7 },
    width: 0.72, height: 1.72, crouchH: 0.95,
    energy: '#ffb547', trim: '#2f5f9e', base: '#eef2f7', under: '#1c2c48',
  },
  echo: {
    name: 'Echo', role: 'Pursuit', hp: 100,
    run: 8.2, backpedal: 0.65, accelG: 64, decelG: 46, accelA: 48, crouchSpeed: 0.45,
    jumpV: 17.7, dblV: 15.2,
    dash: { ticks: 13, speed: 23, exitKeep: 0.6, cooldown: 18 },
    slide: { ticks: 18, speed: 13.5, decay: 0.972 },
    wall: { slide: 4.2, jumpVx: 10.5, jumpVy: 16, lock: 6 },
    width: 0.68, height: 1.74, crouchH: 0.95,
    energy: '#ff9a1f', trim: '#15151b', base: '#f4f4f2', under: '#1b1b22',
  },
};

// Wall play (both characters). Touching a wall in the air while holding toward it starts a slide that
// eases in: a brief grip at gripSpeed, then over `ease` ticks up to the character's slide speed (hold down
// to slide `fast` times quicker). A fall is braked into the slide rather than stopped dead. While sliding
// the character faces away from the wall and can shoot and attack without letting go. Letting go of the
// stick keeps the grip for `stick` ticks, so pressing away and then jump is still a wall jump, and a jump
// within `coyote` ticks of leaving a wall still counts. Touching a wall gives back the double jump.
// Jumping while holding toward the wall (or with the stick neutral) is a climb kick: a small push out and
// a high rise, so a single wall can be climbed. Holding away is a leap (the character's wall.jumpVx).
export const WALL = { grip: 8, gripSpeed: 1.1, ease: 14, brake: 90, fast: 2.2, stick: 7, coyote: 6,
  climb: { vx: 4.2, lock: 5 }, leapVy: 0.92 };

// Charged dash (both characters). On the ground with no direction held, hold dash to charge through three
// levels (charge = ticks to reach each), aim with the stick, and let go to launch. A quick tap (released
// before `tap` ticks) is an ordinary dash toward where you face; with a direction held, dashing is
// instant as always. Each level dashes faster (speed) and longer (ticks) and keeps more momentum at the
// end (exitKeep). From level 2 the first `iframes` ticks are invulnerable; level 3 makes the dash itself
// a strike through every enemy in its path and primes a tier 3 Velocity Break.
export const DASH_CHARGE = { tap: 6, charge: [16, 34, 54], speed: [1.15, 1.3, 1.45], ticks: [1.25, 1.5, 1.75],
  exitKeep: [0.45, 0.55, 0.65], iframes: [0, 10, 99], jumpCarry: 25, strike: { dmg: 2.5, poise: 40, kb: 9 } };

// Lock-on (every player). Press lock to lock onto the best target in front (nearest, in view); while
// locked, a tap cycles to the next target and holding for `hold` ticks lets go. Locked shots and aim go
// straight at the target, homing shots curve to it, a standing player faces it, and melee attacks step
// in toward it. When the target dies the lock jumps to the next one in range; out of range or out of
// sight for `lost` ticks, it lets go. magnet = how close a target must be for a swing to turn and step
// in toward it (at up to `lunge` m/s).
export const LOCK = { range: 18, keep: 24, hold: 20, lost: 90, magnet: 2.8, lunge: 18 };

// Melee frame data. box = hitbox relative to feet: fx forward offset, y centre, w, h.
// cancelFrom = tick of recovery after which a whiffed move may cancel into parry/dash.
export const MOVES = {
  nova_jab1:  { su: 5, ac: 3, rc: 12, box: { fx: 0.8, y: 1.15, w: 1.0, h: 0.7 }, dmg: 1.2, poise: 12, kb: [2, 0], next: 'nova_jab2' },
  nova_jab2:  { su: 5, ac: 3, rc: 12, box: { fx: 0.8, y: 1.15, w: 1.0, h: 0.7 }, dmg: 1.2, poise: 12, kb: [2.5, 0], next: 'nova_shove' },
  nova_shove: { su: 8, ac: 4, rc: 16, box: { fx: 0.85, y: 1.1, w: 1.2, h: 1.1 }, dmg: 1.6, poise: 30, kb: [11, 3], shove: true },
  nova_brace: { su: 13, ac: 4, rc: 18, box: { fx: 0.9, y: 1.1, w: 1.4, h: 1.3 }, dmg: 2.5, poise: 55, kb: [15, 4], shove: true, armorBreak: true },
  nova_air:   { su: 5, ac: 4, rc: 10, box: { fx: 0.75, y: 0.9, w: 1.1, h: 1.0 }, dmg: 1.2, poise: 12, kb: [4, 2], air: true },

  echo_g1:    { su: 4, ac: 3, rc: 10, box: { fx: 0.75, y: 1.15, w: 1.0, h: 0.7 }, dmg: 1.3, poise: 12, kb: [1.5, 0], next: 'echo_g2', blade: true },
  echo_g2:    { su: 5, ac: 3, rc: 11, box: { fx: 0.8, y: 1.15, w: 1.1, h: 0.8 }, dmg: 1.3, poise: 12, kb: [2, 0], next: 'echo_g3', blade: true },
  echo_g3:    { su: 7, ac: 4, rc: 16, box: { fx: 1.0, y: 1.0, w: 1.9, h: 1.2 }, dmg: 2.2, poise: 28, kb: [7, 2], staff: true },
  echo_launch:{ su: 8, ac: 4, rc: 14, box: { fx: 0.8, y: 1.4, w: 1.2, h: 1.6 }, dmg: 1.5, poise: 20, kb: [1.5, 15], launcher: true, staff: true },
  echo_air1:  { su: 4, ac: 3, rc: 9, box: { fx: 0.75, y: 0.95, w: 1.1, h: 1.0 }, dmg: 1.1, poise: 10, kb: [1.5, 5], air: true, hover: true, next: 'echo_air2', blade: true },
  echo_air2:  { su: 4, ac: 3, rc: 9, box: { fx: 0.75, y: 0.95, w: 1.1, h: 1.0 }, dmg: 1.1, poise: 10, kb: [1.5, 5], air: true, hover: true, next: 'echo_air3', blade: true },
  echo_air3:  { su: 6, ac: 4, rc: 12, box: { fx: 0.9, y: 0.9, w: 1.6, h: 1.2 }, dmg: 1.8, poise: 22, kb: [7, 1], air: true, staff: true },
  echo_charged:{ su: 14, ac: 4, rc: 20, box: { fx: 1.1, y: 1.0, w: 2.2, h: 1.4 }, dmg: 5, poise: 55, kb: [10, 3], armorBreak: true, staff: true, heavy: true },
  echo_riposte:{ su: 2, ac: 4, rc: 12, box: { fx: 1.0, y: 1.1, w: 1.8, h: 1.4 }, dmg: 4, poise: 80, kb: [8, 3], staff: true },

  // Hunter kit (proposal under test): faster twin-blade chain, glaive finishers.
  echo_b1:    { su: 3, ac: 2, rc: 8, box: { fx: 0.7, y: 1.15, w: 1.0, h: 0.8 }, dmg: 1.0, poise: 8, kb: [1, 0], next: 'echo_b2', blade: true },
  echo_b2:    { su: 3, ac: 2, rc: 8, box: { fx: 0.75, y: 1.15, w: 1.05, h: 0.8 }, dmg: 1.0, poise: 8, kb: [1, 0], next: 'echo_b3', blade: true, offhand: true },
  echo_b3:    { su: 4, ac: 3, rc: 9, box: { fx: 0.8, y: 1.1, w: 1.2, h: 0.9 }, dmg: 1.2, poise: 12, kb: [1.5, 0], next: 'echo_b4', blade: true, cross: true },
  echo_b4:    { su: 6, ac: 4, rc: 14, box: { fx: 1.1, y: 1.0, w: 2.1, h: 1.3 }, dmg: 2.4, poise: 30, kb: [7, 2], staff: true, glaive: true },
  echo_rise:  { su: 7, ac: 4, rc: 13, box: { fx: 0.8, y: 1.4, w: 1.3, h: 1.7 }, dmg: 1.6, poise: 22, kb: [1.5, 15], launcher: true, staff: true, glaive: true },
  echo_ab1:   { su: 3, ac: 3, rc: 8, box: { fx: 0.75, y: 0.95, w: 1.1, h: 1.0 }, dmg: 1.0, poise: 9, kb: [1.5, 5], air: true, hover: true, next: 'echo_ab2', blade: true },
  echo_ab2:   { su: 3, ac: 3, rc: 8, box: { fx: 0.75, y: 0.95, w: 1.1, h: 1.0 }, dmg: 1.0, poise: 9, kb: [1.5, 5], air: true, hover: true, next: 'echo_ab3', blade: true, offhand: true },
  echo_ab3:   { su: 5, ac: 4, rc: 11, box: { fx: 0.95, y: 0.9, w: 1.7, h: 1.2 }, dmg: 1.9, poise: 24, kb: [7, 1], air: true, staff: true, glaive: true },
};

export const HUNTER = {
  snareCharges: 2, snareRecharge: 300, throwSpeed: 15, throwLift: 5, snareGravity: 32,
  armTicks: 10, life: 600, maxPlanted: 2,
  rootLight: 96, rootHeavyPoise: 38,
  leashTicks: 110, leashLen: 2.3, yankPoise: 45,
  // Staff-rifle: a tap of fire still throws a snare (crouch + tap plants one). Hold to raise the rifle
  // (after `raise` ticks) and let go for a long shot that flies the whole level. Hold to `mark` ticks for a
  // marking shot: it pierces and tags every enemy it passes (tagged enemies take more poise damage and
  // draw Nova's homing shots and Echo's pursuit dash). Simple on purpose: no attachments or splash, and it
  // cannot shoot down enemy fire the way Nova's shots can. He moves at `slow` speed with the rifle up.
  rifle: { raise: 10, mark: 44, cd: 20, markCd: 40, speed: 60, dmg: 2.2, poise: 16, kb: 3, markDmg: 3.2, markPoise: 30, tag: 600, slow: 0.55 },
};

// Echo's scarf modes (approved for testing). One button cycles them; the Signature button
// does something different in each: Tether = Scarf Lash, Veil = Vanish, Flare = Challenge.
// All three Signature moves spend the same scarf charges (ECHO.lashCharges).
export const SCARF = {
  modes: ['tether', 'veil', 'flare'],
  switchCd: 10,
  veilFade: 20,          // ticks to fade out after entering Veil or after it re-arms
  veilRearm: 150,        // after Veil breaks, it re-arms after this long without attacking or being hit
  ambushWindow: 24,      // after breaking Veil with an attack, the first melee hit in this window is an ambush
  ambushDmg: 1.5,
  flareRange: 12,        // enemies this close prefer a flaring Echo over nearer teammates
  flareParry: 4,         // extra parry-window ticks while at least one enemy targets him
  flarePerfect: 3,       // extra perfect-parry ticks while targeted
  flareResolve: 1.6,     // Resolve gain multiplier while flaring
  flareTrickle: 2,       // Resolve per second for each enemy targeting him (counts up to 3)
  challengeRange: 9,     // Challenge pulls every enemy this close onto Echo
  tauntTicks: 180,
};

// Velocity Break v0: power tier comes from what produced the speed.
export const VB = {
  stopTicks: 2, activeFrom: 2, activeTo: 6, whiffRecovery: 10, driftAfter: 6,
  tiers: {
    1: { dmg: 2, poise: 30, kb: 6, armorBreak: false },
    2: { dmg: 3.5, poise: 50, kb: 9, armorBreak: true },
    3: { dmg: 6, poise: 90, kb: 13, armorBreak: true },
  },
};

export const NOVA = {
  shotCd: 8, shotSpeed: 30, shotDmg: 1, shotRange: 20,
  charge1: 30, charge2: 72,
  lance: { dmg: 3, poise: 30, speed: 36 },
  rail: { dmg: 6, poise: 60, speed: 44 },
  bulwarkCd: 480, bulwarkRange: 4, barrierTicks: 120, barrierHalf: 1.6,
};

// Nova's Marksman kit (proposal under test). The bracer takes four attachments that all fire
// projectiles; the mode button cycles them. Hold fire to charge through three levels, and let go
// just as level 3 completes for a Perfect Release. His secondary blaster (the Recoil Burst on the
// melee button) charges the same way. Every shot splashes where it lands, and a charged shot that
// bursts close to him launches him: aim at your feet to rocket jump. Light boosters let him hover,
// skate-blade boots let him glide, and his shots fly until they hit something or leave the level.
// The Pass 1 Sentinel kit stays in Settings.
export const MARKSMAN = {
  attachments: ['lance', 'volley', 'arc', 'prism'],
  switchCd: 10,
  charge: [24, 50, 80],  // ticks to reach charge levels 1, 2 and 3
  perfectWindow: 9,      // a Perfect Release lets go within this many ticks of reaching level 3
  perfectMult: 1.5,      // damage and poise bonus on a Perfect Release
  life: 900,             // safety cap only: his shots otherwise fly until they hit something or leave the level
  // Splash: r (m), dmg and poise dealt to enemies around the impact; rocket = it can rocket-jump him
  // when it bursts on terrain close to him (charged shots only; the height comes from `rocket` below)
  round: { splash: { r: 0.9, dmg: 0.35, poise: 4 } },   // basic tap-fire round
  lance: {               // one fast round that pierces a line of enemies
    1: { speed: 40, dmg: 3, poise: 30, r: 0.22, kb: 5, splash: { r: 1.0, dmg: 1.2, poise: 10, rocket: true } },
    2: { speed: 46, dmg: 5, poise: 50, r: 0.26, kb: 8, armorBreak: true, splash: { r: 1.4, dmg: 2, poise: 16, rocket: true } },
    3: { speed: 52, dmg: 8, poise: 80, r: 0.32, kb: 11, armorBreak: true, rail: true, recoil: 4, splash: { r: 1.9, dmg: 3.2, poise: 25, rocket: true } },
  },
  volley: {              // a fan of homing darts, spread over the enemies in front of him
    darts: { 1: 3, 2: 5, 3: 7, perfect: 9 }, fan: { 1: 0.9, 2: 1.1, 3: 1.35, perfect: 1.6 },
    speed: 20, dmg: 1.1, poise: 9, r: 0.14, seekDelay: 6, seekFor: 150, turn: 0.1, seekRange: 16, seekCone: 1.2,
    splash: { r: 0.8, dmg: 0.4, poise: 4 }, rocket: true,
  },
  arc: {                 // a lobbed shell that bursts on contact; the blast hits shielded enemies too
    speed: 17, lift: 0.7, gravity: 32,
    1: { r: 1.8, dmg: 3, poise: 35, rocket: true },
    2: { r: 2.3, dmg: 4.5, poise: 50, armorBreak: true, rocket: true },
    3: { r: 2.9, dmg: 6.5, poise: 75, armorBreak: true, rocket: true },
    perfectRadius: 1.25,
  },
  prism: {               // a crystal round that splits into shards on impact; shards ricochet off walls
    speed: 30, r: 0.2,
    1: { dmg: 1.6, poise: 14, shards: 2, bounces: 1, splash: { r: 1.2, dmg: 0.6, poise: 6, rocket: true } },
    2: { dmg: 2.2, poise: 18, shards: 3, bounces: 1, splash: { r: 1.4, dmg: 0.9, poise: 8, rocket: true } },
    3: { dmg: 3, poise: 24, shards: 5, bounces: 2, splash: { r: 1.7, dmg: 1.2, poise: 10, rocket: true } },
    perfectBounces: 1,   // extra bounces on a Perfect Release
    shard: { speed: 24, dmg: 1.2, poise: 8, r: 0.12, fan: 0.36, splash: { r: 0.7, dmg: 0.35, poise: 4 } },
  },
  burst: {               // Recoil Burst, his secondary blaster: point-blank pellets; the kick sends him skating back
    cd: 24,
    charge: [22, 46, 72], perfectWindow: 9,
    falloff: 14,         // pellets fly on, but lose damage over this distance (down to a quarter)
    tap: { pellets: 5, fan: 0.63, speed: 28, dmg: 0.5, poise: 7, kb: 8, recoil: 7, lift: 9 },
    1: { pellets: 7, fan: 0.7, speed: 29, dmg: 0.6, poise: 10, kb: 10, recoil: 8, lift: 10 },
    2: { pellets: 9, fan: 0.8, speed: 30, dmg: 0.7, poise: 12, kb: 12, recoil: 10, lift: 12, armorBreak: true },
    3: { pellets: 12, fan: 0.9, speed: 32, dmg: 0.8, poise: 14, kb: 14, recoil: 13, lift: 15, armorBreak: true,
      blast: { r: 1.7, dmg: 2.5, poise: 30 } },
  },
  // Rocket jump: a charged shot bursting within its radius + reach of Nova's centre launches him away
  // from the burst. How high grows with how long the shot was charged: h[0] m at charge level 1, rising
  // steadily to h[1] m at level 3, and `perfect` m on a Perfect Release (for a burst at his feet, i.e.
  // within `close` m below his centre and `slack` m to either side; further away launches less, by up to
  // `falloff`). Attachments scale
  // the height (the Arc shell is the strongest). The launch sets his climb speed rather than adding to
  // it, so the height is a real ceiling. Each extra rocket jump in the same airtime is weaker (air), so he
  // cannot fly by shooting down. `freeze` = impact pause in ticks before he leaves (weak, strong, full);
  // `flipH` = launches at least this high get a backflip; `side`/`sideMax` = sideways push off walls.
  rocket: { h: [3.6, 8.4], perfect: 10.5, attach: { lance: 0.95, volley: 0.8, arc: 1, prism: 0.9 },
    reach: 1.1, close: 0.9, slack: 0.35, falloff: 0.45, air: [1, 0.6, 0.35, 0.2], side: 0.6, sideMax: 18, freeze: [2, 3, 4], flipH: 6 },
  // Light boosters: after the double jump, press and hold jump to hover and climb gently
  boost: { fuel: 60, rise: 3.5, thrust: 70, refill: 2.5, minStart: 6, air: 1.1 },
  // Focus: each charged shot that lands adds 1 (2 on a Perfect Release), basic rounds add a little.
  // Every level adds dmgPer to his projectile damage. Taking damage clears it; idling drains it.
  focus: { max: 5, dmgPer: 0.06, perRound: 0.34, decay: 360, decayStep: 120 },
  // Skate glide on the ground: slower to reach top speed, keeps momentum, brakes hard when reversed
  skate: { top: 8.2, accel: 60, coast: 30, carve: 95, tuck: 12, tuckMin: 3, backpedal: 1 },
};
// Presentation only: HUD names and a tint for each attachment, kept inside Nova's gold family so
// his shots still read as his in a 4-player fight (shapes tell the attachments apart)
export const ATTACH_LOOK = {
  lance: { name: 'Lance', tint: '#ffb547' }, volley: { name: 'Volley', tint: '#ffd889' },
  arc: { name: 'Arc', tint: '#ff9f40' }, prism: { name: 'Prism', tint: '#fff0c8' },
};

export const ECHO = {
  cellsMax: 4, boltCd: 12, boltDmg: 1.5, boltSpeed: 34,
  tracerCd: 72, tracerHold: 24, tracerDmg: 0.8,
  lashRange: 6.5, lashCharges: 2, lashRecharge: 240, zipSpeed: 24,
  resolveHalf: 50,
};

export const PLAYER_COLORS = ['#5ac8fa', '#7ed957', '#f5f5f5', '#4dd0b8'];
export const PLAYER_MARKS = ['▲', '◆', '●', '■'];
export const HOSTILE = '#ff2e7e';

export const DEFAULT_SETTINGS = {
  novaKit: 'marksman',  // 'marksman' (projectile proposal) or 'sentinel' (Pass 1 kit)
  echoKit: 'hunter',    // 'hunter' (close-range proposal) or 'pursuit' (Pass 1 kit)
  echoHead: 'helmet',   // presentation only: 'helmet', 'mask' or 'bare'
  echoRanged: 'B',      // Pursuit kit only. A: Tracer only · B: Bolts + Tracer · C: no ranged
  dashIframes: false,
  vbStop: 'hard',       // 'hard' stop or 'keep30' momentum
  vbRefund: true,
  impactFrames: false,  // comic-look test for shared moments (Q-C)
  camera: 'persp',
  fov: 34,
  aimAssist: true,
  difficulty: 'normal',
  shake: true,
  quality: 'high',
  hitboxes: false,
  barks: true,
  volume: 0.6,
  music: 0.6,
  p1Aim: 'mouse',
  lockOn: true,         // lock-on button (F, R3, mouse forward)
  dashCharge: true,     // hold dash while standing still to charge it (off: dash is always instant)
  haptics: true,        // controller rumble, and phone vibration where the browser allows it
  hapticStrength: 0.8,
};

export const SETTINGS = { ...DEFAULT_SETTINGS };

const KEY = 'nova-striker-proto-settings';
export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(SETTINGS, JSON.parse(raw));
  } catch (e) { /* storage unavailable: keep defaults */ }
}
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(SETTINGS)); } catch (e) { /* ignore */ }
}

export const DIFFICULTY = {
  easy:   { tokens: -1, dmg: 0.7 },
  normal: { tokens: 0, dmg: 1 },
  hard:   { tokens: 1, dmg: 1.3 },
};
