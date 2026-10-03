// Astra control contracts: real simulation, focused state arrangements for impact
// timing, plus a mock physical gamepad through the production Input sampler.
import { World } from '../game/js/world.js';
import { createEnemy } from '../game/js/enemies.js';
import { hitEnemy } from '../game/js/combat.js';
import { Input, EMPTY_CMD } from '../game/js/input.js';
import { DEFAULT_SETTINGS, SETTINGS, MOVES } from '../game/js/config.js';
Object.assign(SETTINGS, DEFAULT_SETTINGS, { barks: false });

const buttons = Object.keys(EMPTY_CMD.held);
const assert = (ok, message) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`); if (!ok) process.exitCode = 1; };
function setup(char = 'nova', teammate = false) {
  const w = new World(); w.enemies = []; w.towerSpawned = true; w.arena.state = 'cleared';
  for (const encounter of w.encounters) encounter.state = 'cleared';
  const p = w.addPlayer('test', char), q = teammate ? w.addPlayer('other', 'echo') : null;
  const log = [], previous = {};
  function run(spec = {}, n = 1) {
    for (let i = 0; i < n; i++) {
      const o = typeof spec === 'function' ? spec(i) : spec;
      const held = {}, pressed = {}, released = {};
      for (const b of buttons) {
        held[b] = !!o.held?.[b]; pressed[b] = held[b] && !previous[b]; released[b] = !held[b] && !!previous[b]; previous[b] = held[b];
      }
      w.step({ 0: { mx: o.mx || 0, my: o.my || 0, aimFree: !!o.aim, ax: o.aim?.[0] || 0, ay: o.aim?.[1] || 0, held, pressed, released },
        ...(q ? { 1: { ...EMPTY_CMD, mx: 1 } } : {}) });
      log.push(...w.events); w.events = [];
    }
  }
  run({}, 5); log.length = 0;
  return { w, p, q, run, log };
}
const events = (log, type) => log.filter(e => e.type === type);
function confirmedBreak(w, p) {
  p.state = 'vb'; p.st = 2; p.vbInfo = { tier: 3, dx: 1, dy: 0, keep: 0, v0x: 22, v0y: 0 }; p.instance = w.newInstance();
  const enemy = createEnemy('swarmer', p.x + 1, p.y, { hp: 100 });
  hitEnemy(w, enemy, { owner: p, dmg: 6, poise: 0, kb: [0, 0], vbTier: 3 }, 'melee');
}

for (const action of ['jump', 'parry']) {
  const t = setup('nova', true), x = t.q.x, tick = t.w.tick;
  confirmedBreak(t.w, t.p);
  t.run(i => ({ held: { [action]: i === 0 } }), 10);
  assert(events(t.log, action === 'jump' ? 'jump' : 'dodge').length === 1,
    `${action} pressed at start of nine-tick hitstop executes on first actionable tick`);
  assert(t.w.tick - tick === 10 && t.q.x > x, `Impact pause is local: teammate still moves while ${action} is buffered`);
  t.run({}, 8);
  assert(events(t.log, action === 'jump' ? 'jump' : 'dodge').length === 1, `${action} buffer is consumed once`);
}
{
  const t = setup('echo');
  t.p.state = 'attack'; t.p.moveId = 'echo_b1'; t.p.move = MOVES.echo_b1;
  t.p.st = t.p.move.su + t.p.move.ac + 1; t.p.queued = 'echo_b2'; t.p.hitConfirm = true;
  t.run({ held: { parry: true } });
  assert(t.p.state === 'parry' && t.p.queued === null, 'Successful-hit defensive cancel wins over queued second combo attack');
}
{
  const t = setup('echo');
  t.p.state = 'attack'; t.p.moveId = 'echo_charged'; t.p.move = MOVES.echo_charged; t.p.st = 3; t.p.hitConfirm = false;
  t.run({ held: { parry: true } });
  assert(t.p.state === 'attack', 'Whiff startup remains committed despite defensive input');
}
{
  const t = setup(); t.run({ held: { strike: true } });
  assert(t.p.moveId === 'nova_k1' && events(t.log, 'burst').length === 0, 'Explicit Nova strike punches empty space instead of firing secondary');
  t.run({ held: { strike: true } }, 45); t.run();
  assert(t.p.burstT === 0 && events(t.log, 'burst').length === 0, 'Holding explicit strike never silently charges or releases a secondary');
}
{
  const t = setup(); t.p.burstT = 80; t.p.subArmed = true;
  t.run({ held: { strike: true } });
  assert(t.p.moveId === 'nova_k1' && events(t.log, 'burst').length === 0 && t.p.burstT === 0,
    'Choosing an explicit strike discards an old secondary charge rather than releasing it');
}
{
  const t = setup(), target = createEnemy('shield', 1.5, 0, { hp: 100, hitstop: 999 });
  t.w.enemies.push(target); t.p.lockT = target;
  t.run({ mx: -1, held: { strike: true } });
  assert(t.p.facing === -1 && !t.p.lungeTo, 'Holding away suppresses melee auto-turn and approach');
}
{
  const t = setup(); t.p.x = 13.55; t.p.prevX = t.p.x;
  const target = createEnemy('shield', 15.3, 0, { hp: 100, hitstop: 999 });
  t.w.enemies.push(target); t.p.lockT = target;
  t.run({ held: { strike: true } });
  assert(!t.p.lungeTo && t.p.x < 14 && t.p.onGround, 'Melee assistance does not lunge a grounded player into a gap');
}
{
  const t = setup();
  t.w.enemies.push(createEnemy('shield', t.p.x + 1.1, 0, { hitstop: 999, hp: 100 }));
  t.run({ held: { secondary: true } });
  assert(events(t.log, 'burst').length === 1 && !t.p.moveId, 'Explicit secondary fires at point-blank range without becoming melee');
}
{
  const t = setup(); t.run({ mx: 1, held: { dash: true } });
  t.run({ mx: 1, held: { secondary: true } });
  assert(t.p.state === 'dash' && events(t.log, 'burst').length === 1, 'Explicit secondary preserves an ongoing directional dash');
}
{
  const t = setup(); t.p.chargeT = 110; t.p.burstT = 40;
  t.run({ held: { quick: true } });
  const first = t.p.attachment === 'arc' && t.p.sub === 'disc' && t.p.chargeT === 0 && t.p.burstT === 0;
  t.run({}, 14); t.run({ held: { quick: true } });
  assert(first && t.p.attachment === 'lance' && t.p.sub === 'scatter', 'Quick swap alternates two real loadouts without transferring stored charge');
}
for (const [direction, expected, used] of [[{mx: 1}, 'carry', false], [{my: -1}, 'slam', false], [{my: 1}, 'lift', false], [{my: 1}, null, true]]) {
  const t = setup('echo'); t.p.y = 4; t.p.onGround = false; t.p.airEnderUsed = used;
  t.p.state = 'attack'; t.p.moveId = 'echo_ab2'; t.p.move = MOVES.echo_ab2; t.p.st = t.p.move.su + t.p.move.ac + 1;
  t.p.queued = 'echo_ab3'; t.p.hitConfirm = true;
  t.run(direction);
  assert(expected ? t.p.move.ender === expected : t.p.moveId === 'echo_ab3', `Echo air finisher ${expected || 'cannot lift twice in one airtime'}`);
}
{
  const t = setup('echo'), e = createEnemy('swarmer', 2, 3, { armor: 0, hp: 100 });
  hitEnemy(t.w, e, { owner: t.p, dmg: 3.2, poise: 0, kb: [3, -15], airEnder: 'slam' }, 'melee');
  assert(e.state === 'launched' && e.vy === -15, 'Echo slam directs an airborne light enemy downward instead of re-floating it');
}
{
  const input = Object.create(Input.prototype);
  input.devices = {};
  const pad = { index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  input.pads = () => [pad];
  const sample = (...down) => { pad.buttons.forEach((b, i) => { b.pressed = down.includes(i); b.value = b.pressed ? 1 : 0; }); return input.sample('pad0'); };
  sample(4); const sec = sample(4, 2), releaseModifier = sample(2); sample();
  assert(sec.pressed.secondary && !sec.pressed.melee && !sec.pressed.sub && !releaseModifier.pressed.melee,
    'Controller LB+X is a secondary only, including when LB is released first');
  sample(4); const swap = sample(4, 5); sample();
  assert(swap.pressed.quick && !swap.pressed.mode && !swap.pressed.sub, 'Controller LB+RB quick swap does not cycle attachments accidentally');
  const hold = sample(4), tap = sample();
  assert(!hold.pressed.sub && tap.pressed.sub, 'Controller LB alone cycles utility on release');
  const strike = sample(10), interact = sample(12); sample();
  assert(strike.pressed.strike && interact.pressed.interact, 'Controller exposes explicit strike and world interaction');
}

// Integration: player inputs and combat hitboxes must reach the real world
// implementations, not only a stub with the same method names.
{
  const t = setup('echo'), e = createEnemy('swarmer', 1, 0, { hp: 100, state: 'caught', st: 9, catcher: null });
  t.run({ held: { sig: true } }); // the tether button was already held before the release input
  t.w.enemies.push(e); e.catcher = t.p; t.p.leash = { e, t: 1 };
  t.p.state = 'lash'; t.p.st = 8; t.p.lash = { target: e, hit: true, len: 1 };
  t.run({ my: 1, held: { sig: true, strike: true } });
  const launched = !t.p.leash && e.state === 'launched' && e.vy > 12 && e.missionThrower === t.p;
  t.run({ held: { sig: true } }, 2);
  assert(launched && t.p.state !== 'lash' && t.p.lash === null, 'Echo directional throw leaves lash safely and launches a real tethered enemy');
}
{
  const t = setup('ram'), e = createEnemy('swarmer', 1.1, 0, { hp: 100, cd: 999 });
  t.w.enemies.push(e); t.run({ mx: 1, held: { dash: true } }, 5);
  const caught = t.p.rush?.carried.includes(e);
  t.run({ my: 1, held: { strike: true } }, 4);
  assert(caught && !t.p.rush && e.state === 'launched' && e.vy > 10 && events(t.log, 'directedPile').length === 1,
    'RAM can deliberately finish a real charge with an upward pile release');
}
{
  const t = setup('ram'); t.run({ mx: 1, held: { dash: true } }, 5);
  t.run({ held: { strike: true } });
  assert(t.p.state === 'rush' && !!t.p.rush && events(t.log, 'directedPile').length === 0,
    'RAM cannot erase a missed charge by releasing an empty pile');
}
{
  const t = setup('fix'); t.p.scrap = 100; t.p.gadgetSel = 'sentry'; t.w.deployGadget(t.p);
  const gadget = t.w.gadgets.find(g => g.kind === 'sentry');
  for (let i = 0; i < 4; i++) t.w.wrenchGadget(gadget, t.p);
  gadget.hp = 23; gadget.t = 120;
  const scrap = t.p.scrap;
  t.run({ held: { relocate: true } }); const carried = gadget.carried;
  t.run({ mx: 1 }, 20); const age = gadget.t;
  t.run({ held: { relocate: true } });
  assert(carried && !gadget.carried && gadget.level === 3 && gadget.hp === 23 && gadget.t >= age && gadget.t > 120 && t.p.scrap >= scrap,
    'Fix relocates an upgraded gadget through input while retaining damage, level, and elapsed lifetime');
  assert(events(t.log, 'gadgetRelocate').map(e => e.phase).join(',') === 'pickup,place', 'Gadget relocation requires deliberate pickup and placement');
}
{
  const t = setup('fix'), target = createEnemy('brute', 1.25, 0, { hp: 100, armor: 0, hitstop: 999 });
  t.w.enemies.push(target); t.w.fireHotRivet(t.p, 1);
  t.run({}, 5);
  const rivet = t.w.projectiles.find(pr => pr.kind === 'hotRivet');
  const stuck = !!rivet?.stuck;
  t.run({ held: { strike: true } }); t.run({}, 14);
  assert(stuck && rivet.dead && events(t.log, 'rivetDetonate').length === 1 && events(t.log, 'rivetBlast').length === 1,
    'Fix wrench detonates a real attached Hot Rivet early and exactly once');
}
{
  const t = setup('fix', true), p = t.p, q = t.q, device = p.device;
  Object.assign(p, { hp: 1, scrap: 0, ult: 100, chargeT: 90, burstT: 90, rifleT: 50, quickCd: 9,
    state: 'ult', ultRun: {}, leash: { e: {} }, rush: {}, aegis: {}, patch: {}, hitstop: 9, airEnderUsed: true,
    reserveLoadout: { attachment: 'prism', sub: 'well' }, tossArmed: true, subArmed: true });
  for (const key of Object.keys(p.buf)) p.buf[key] = 0;
  t.w.projectiles = [{}]; t.w.hitboxes = [{}]; t.w.barriers = [{}]; t.w.shockwaves = [{}];
  t.w.gadgets = [{ owner: p, carried: true }]; t.w.pickups = [{}]; t.w.snares = [{}]; t.w.wells = [{}];
  t.w.ultCast = { phase: 'cast', members: [p] }; t.w.scheduled = [{ t: 10, fn() { throw new Error('stale session callback'); } }];
  t.w.startMission();
  assert(t.w.players[0] === p && t.w.players[1] === q && p.device === device && p.hp === p.maxHp && p.scrap > 0,
    'Mission restart preserves player/device identities while restoring class resources');
  assert(p.state === 'normal' && !p.ultRun && !p.leash && !p.rush && !p.aegis && !p.patch && !p.tossArmed && !p.subArmed &&
    p.ult === 0 && p.chargeT === 0 && p.burstT === 0 && p.rifleT === 0 && p.hitstop === 0 && p.quickCd === 0 && !p.airEnderUsed &&
    Object.values(p.buf).every(age => age === 99) && p.reserveLoadout.attachment === 'arc',
    'Mission restart clears pending actions, freezes, ultimates and alternate-loadout state');
  assert(!t.w.ultCast && ['projectiles', 'hitboxes', 'barriers', 'shockwaves', 'gadgets', 'pickups', 'snares', 'wells', 'scheduled'].every(key => !t.w[key].length),
    'Mission restart removes carried gadgets, lingering attacks and previous-session callbacks');
}
