// Version 11 checks: Echo's utility belt on LB, RAM's Breach Beam (Level 4 cannon), and the settings that came
// with them (impact frame style and colour, AI skill).
import { World } from '../game/js/world.js';
import { createEnemy } from '../game/js/enemies.js';
import { SETTINGS, RAM, HUNTER, IMPACT_STYLES, IMPACT_ACCENT } from '../game/js/config.js';
SETTINGS.novaKit = 'marksman'; SETTINGS.echoKit = 'hunter'; SETTINGS.lockOn = true; SETTINGS.lockMode = 'manual'; SETTINGS.difficulty = 'normal';

const BT = ['jump', 'dash', 'melee', 'fire', 'parry', 'sig', 'mode', 'lock', 'sub', 'ult'];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
function setup(char, x = 99) {
  const w = new World(); w.enemies = []; w.towerSpawned = true; w.arena.state = 'cleared';
  const p = w.addPlayer('t0', char); p.x = x; p.y = 0; p.prevX = x; p.prevY = 0;
  let prev = {}; const log = [];
  const run = (o = {}, n = 1) => {
    for (let i = 0; i < n; i++) {
      const held = {}, pressed = {}, released = {};
      for (const b of BT) { held[b] = !!(o.held && o.held[b]); pressed[b] = held[b] && !prev[b]; released[b] = !held[b] && !!prev[b]; }
      prev = held; w.step({ [p.slot]: { mx: o.mx || 0, my: o.my || 0, aimFree: !!o.aim, ax: o.aim ? o.aim[0] : 0, ay: o.aim ? o.aim[1] : 0, held, pressed, released } });
      log.push(...w.events); w.events.length = 0;
    }
  };
  run({}, 10); p.mercy = 0;
  return { w, p, run, log };
}
const count = (log, t) => log.filter(e => e.type === t).length;

{ // Echo's utility belt on LB: LB throws a snare (crouch + LB plants one), and a tap of fire is a quick rifle shot
  SETTINGS.echoBelt = 'lb';
  const { w, p, run, log } = setup('echo');
  const s0 = p.snares;
  run({ held: { sub: true }, aim: [1, 0] }, 1); run({}, 20);
  const thrown = p.snares === s0 - 1;
  run({ held: { fire: true }, aim: [1, 0] }, 2); run({ aim: [1, 0] }, 4);
  const shot = count(log, 'snipe') === 1 && p.snares === s0 - 1;
  run({}, 60); run({ my: -1, held: { sub: true } }, 1); run({ my: -1 }, 4);
  const planted = p.snares === s0 - 2;
  SETTINGS.echoBelt = 'fire';
  const t = setup('echo'); const t0 = t.p.snares;
  t.run({ held: { fire: true }, aim: [1, 0] }, 2); t.run({ aim: [1, 0] }, 4);
  assert(thrown && shot && planted && t.p.snares === t0 - 1 && count(t.log, 'snipe') === 0,
    `Echo's belt on LB: LB throws a snare (${thrown}), a tap of fire is a quick rifle shot (${shot}), crouch + LB plants one (${planted}); on fire (default) a tap still throws one`);
}
{ // RAM's Breach Beam: past level 3 the cannon charges to Level 4 and lets go a sustained beam that hits a line of
  // enemies, shoves them back, erases enemy shots, and ends after its time
  const { w, p, run, log } = setup('ram');
  const foes = [103, 105, 107].map(x => { const e = createEnemy('shield', x, 0, { cd: 9999 }); e.hp = 500; e.armor = 0; w.enemies.push(e); return e; });
  const x0 = foes.map(e => e.x);
  run({ held: { fire: true }, aim: [1, 0] }, RAM.beam.at + 2);
  const levels = log.filter(e => e.type === 'chargeLevel').map(e => e.level).join();
  run({ aim: [1, 0] }, 1);
  const started = p.state === 'beam' && count(log, 'beamStart') === 1;
  const sn = createEnemy('sniper', 115, 0, { cd: 9999 }); w.enemies.push(sn);
  const pr = { team: 'e', owner: sn, x: 112, y: 1.4, vx: -12, vy: 0, ttl: 200, r: 0.2, dmg: 10, kind: 'std' }; w.spawnProjectile(pr);
  const far = foes.map(() => 0); foes.forEach((e, k) => { x0[k] = e.x; });   // (they walked up to him while he charged)
  for (let i = 0; i < RAM.beam.ticks + 5; i++) { run({ aim: [1, 0] }, 1); foes.forEach((e, k) => { far[k] = Math.max(far[k], e.x - x0[k]); }); }
  const hurt = foes.every(e => e.hp < 500), pushed = far.every(f => f > 0.5), erased = w.projectiles.filter(q => q.team === 'e').length === 0;
  assert(levels === '1,2,3,4' && started && hurt && pushed && erased && p.state !== 'beam' && count(log, 'beamEnd') === 1,
    `Breach Beam: charge levels ${levels}; the beam fires (${started}), hits all 3 Shields (${foes.map(e => (500 - e.hp).toFixed(0)).join('/')} damage), shoves them back (${far.map(f => f.toFixed(1)).join('/')} m), erases a shot (${erased}) and ends`);
  const q = setup('ram'); q.run({ held: { fire: true }, aim: [1, 0] }, RAM.cannon.charge[2] + 5); q.run({ aim: [1, 0] }, 2);
  assert(q.p.state !== 'beam' && count(q.log, 'beamStart') === 0, 'Let go at level 3, the cannon still fires a Breach Shot, not the beam');
}
{ // Settings that came with this version: their defaults, and the impact frame styles the shader knows
  assert(IMPACT_STYLES.length === 7 && IMPACT_STYLES[0] === 'scifi' && IMPACT_STYLES[1] === 'comic' && IMPACT_STYLES.every(s => IMPACT_ACCENT[s]),
    `Impact frame styles: ${IMPACT_STYLES.join(', ')}, each with its own colour`);
}
