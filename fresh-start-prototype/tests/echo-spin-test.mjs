// Hunter spin keeps timed projectile defense and adds bounded contact stun.
// These are production World.step scenarios, not duplicated collision or timing logic.
import { World } from '../game/js/world.js';
import { createEnemy } from '../game/js/enemies.js';
import { Bots } from '../game/js/bot.js';
import { EMPTY_CMD } from '../game/js/input.js';
import { DEFAULT_SETTINGS, SETTINGS, DEFLECT } from '../game/js/config.js';
import { BOXES } from '../game/js/level.js';
Object.assign(SETTINGS, DEFAULT_SETTINGS, { echoKit: 'hunter', lockOn: false, barks: false });
const assert = (ok, name) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) process.exitCode = 1; };
const buttons = Object.keys(EMPTY_CMD.held);
function setup() {
  const w = new World(); w.enemies = []; w.towerSpawned = true; w.arena.state = 'cleared';
  for (const encounter of w.encounters) encounter.state = 'cleared';
  const p = w.addPlayer('test', 'echo');
  Object.assign(p, { x: 20, y: 0, prevX: 20, prevY: 0, mercy: 0, facing: 1 });
  const log = [], previous = {};
  function run(held = {}, n = 1) {
    for (let i = 0; i < n; i++) {
      const pressed = {}, released = {};
      for (const b of buttons) { pressed[b] = !!held[b] && !previous[b]; released[b] = !held[b] && !!previous[b]; previous[b] = !!held[b]; }
      w.step({ [p.slot]: { ...EMPTY_CMD, aimFree: true, ax: 1, ay: 0, held, pressed, released } });
      log.push(...w.events); w.events = [];
    }
  }
  function enemy(type = 'swarmer', x = 21.2, y = 0, extra = {}) {
    const e = createEnemy(type, x, y, { cd: 9999, slamCd: 9999, hp: 100, maxHp: 100, ...extra });
    w.enemies.push(e); return e;
  }
  run({}, 4); log.length = 0;
  return { w, p, log, run, enemy };
}
const hits = (t, e) => t.log.filter(v => v.type === 'echoSpinHit' && (!e || v.e === e));

{
  const t = setup(), front = t.enemy(), back = t.enemy('swarmer', 18.8), far = t.enemy('sniper', 24);
  t.run({ parry: true }); t.run({}, DEFLECT.window);
  assert(front.hp === 98 && back.hp === 98 && far.hp === 100, 'Spin contacts nearby enemies on both sides, excluding targets beyond staff reach');
  assert(hits(t).length === 2 && hits(t).every(v => v.stunned && v.ticks === 60), 'Each enemy takes one two-damage contact and one sixty-tick stun per activation');
  assert(t.p.state === 'parry' && t.p.parryT === DEFLECT.window && t.p.hitstop === 0 && !t.p.parryResult,
    'Contact preserves the complete original spin window and never grants a projectile parry result');
}
{
  const t = setup(), near = t.enemy('swarmer', 19.2), shooter = t.enemy('sniper', 26);
  t.run({ parry: true }, 2);
  t.w.spawnProjectile({ team: 'e', owner: shooter, x: 21.3, y: 1.1, vx: -12, vy: 0, ttl: 120, r: 0.14, dmg: 12, heavy: true, kind: 'heavy' });
  const pr = t.w.projectiles.at(-1);
  t.run({ parry: true });
  const reflected = t.log.find(v => v.type === 'deflect');
  assert(hits(t, near).some(v => v.stunned) && reflected && pr.team === 'p' && pr.owner === t.p && !pr.dead,
    'One live spinning defense both stuns a melee target and reflects a hostile heavy projectile');
  assert(reflected?.perfect && t.p.hp === t.p.maxHp && t.p.riposteT > 0, 'Perfect reflection timing, full damage prevention, and Riposte remain intact after contact');
}
{
  const t = setup(), e = t.enemy();
  t.run({ parry: true }); t.run({}, 29);
  const until = e.spinStunUntil, remaining = e.stun - e.st;
  t.run({ parry: true }); t.run({}, 2);
  assert(hits(t, e).length === 2 && !hits(t, e)[1].stunned && e.spinStunUntil === until && e.stun - e.st <= remaining,
    'A second spin during per-enemy resistance deals contact damage without extending stun');
  t.run({}, 100); Object.assign(e, { x: 21.2, y: 0, vx: 0, vy: 0, state: 'idle', st: 0, cd: 9999 });
  t.run({ parry: true }); t.run({}, 2);
  assert(hits(t, e).filter(v => v.stunned).length === 2, 'Enemy can be contact-stunned again after its two-second resistance expires');
}
{
  const t = setup(), e = t.enemy();
  const wall = { id: 999999, x0: 20.5, x1: 20.7, y0: -1, y1: 4, type: 's', tag: 'spin-test-wall' };
  BOXES.push(wall);
  try { t.run({ parry: true }); t.run({}, 3); assert(e.hp === 100 && !hits(t).length, 'Solid walls block spin contact damage and stun'); }
  finally { BOXES.splice(BOXES.indexOf(wall), 1); }
}
{
  const t = setup(), e = t.enemy('swarmer', 21.7, 2.45, { hitstop: 999 });
  t.run({ parry: true }); t.run({}, 3);
  assert(e.hp === 100 && !hits(t).length, 'Diagonal corners outside the circular staff sweep are not hit by its bounding square');
}
{
  const t = setup(), brute = t.enemy('brute', 21.3, 0, { armor: 2 }), shield = t.enemy('shield', 18.7, 0, { shieldDir: 1 });
  t.run({ parry: true }); t.run({}, 3);
  assert(brute.armor === 2 && brute.state !== 'stagger' && hits(t, brute).every(v => !v.stunned), 'Intact armor resists the contact stun');
  assert(shield.hp === 100 && !hits(t, shield).length && t.p.hitstop === 0, 'A facing shield blocks contact without pausing Echo or changing spin timing');
}
{
  const t = setup(), e = t.enemy('warden', 21.4, 0, { armor: 0, invuln: 0, phase: 1, staggerCd: 0 });
  t.run({ parry: true }); t.run({});
  assert(e.state === 'stagger' && e.stun === 18 && e.staggerCd === 120 && hits(t, e)[0]?.ticks === 18,
    'Vulnerable bosses receive only a short interrupt with resistance, not a full regular-enemy stun');
}
{
  const t = setup(), e = t.enemy('warden', 21.4, 0, { armor: 0, invuln: 40, phase: 1, staggerCd: 0 });
  t.run({ parry: true }); t.run({}, 2);
  assert(e.hp === 100 && e.state !== 'stagger' && !hits(t, e).length, 'Boss invulnerability still blocks spin damage and stun');
}
{
  const t = setup(); t.enemy(); t.run({ parry: true }); t.run({}, 4); t.run({ strike: true });
  assert(t.p.state === 'attack' && t.p.moveId === 'echo_b1', 'Confirmed spin contact can flow directly into the staff combo after four ticks');
}
{
  const t = setup(); t.run({ parry: true }); t.run({}, 4); t.run({ strike: true });
  assert(t.p.state === 'parry', 'A missed spin keeps its existing recovery instead of gaining a free attack cancel');
}
{
  const t = setup(); t.p.hitstop = 9; t.run({ parry: true }); t.run({}, 9);
  assert(t.p.state === 'parry' && t.p.spinInstance !== null, 'A spin pressed during actor hitstop executes from the existing defense buffer');
  t.p.spinContactHit = true; const e = t.enemy(); e.spinStunUntil = 500;
  t.w.resetToCheckpoint();
  assert(t.p.spinInstance === null && !t.p.spinContactHit && e.spinStunUntil === 0, 'Checkpoint reset clears activation state and contact resistance');
  t.p.spinInstance = 123; t.p.spinContactHit = true; t.w.swapCharacter(t.p, 'nova');
  assert(t.p.spinInstance === null && !t.p.spinContactHit, 'Character change clears the previous spin activation');
}
{
  SETTINGS.echoKit = 'pursuit'; const t = setup(), e = t.enemy();
  t.run({ parry: true }); t.run({}, 5);
  assert(e.hp === 100 && !hits(t).length && t.p.spinInstance === null, 'Training Pursuit parry remains unchanged and does not gain Hunter spin contact');
  SETTINGS.echoKit = 'hunter';
}
{
  const t = setup(), bots = new Bots(); t.p.device = 'cpu1';
  const human = t.w.addPlayer('human', 'nova'); Object.assign(human, { x: 18, y: 0, mercy: 999 });
  const e = t.enemy(); e.hitstop = 0;
  for (let i = 0; i < 40; i++) {
    t.w.step(bots.commands(t.w, { [human.slot]: EMPTY_CMD }));
    t.log.push(...t.w.events); t.w.events = [];
  }
  assert(hits(t, e).some(v => v.stunned), 'AI Echo uses the same Hunter spin to stun an eligible enemy at melee range');
}
Object.assign(SETTINGS, DEFAULT_SETTINGS);
