// Version 12 checks: the path as a chain of pieces (and the old route unchanged), the Helix Foundry and Undercity
// Descent (traversable, every spawn and power-up on a floor, encounters only on their own route), breakable
// pieces, and the power-ups along the routes.
import { World } from '../game/js/world.js';
import { createEnemy } from '../game/js/enemies.js';
import { Bots } from '../game/js/bot.js';
import * as L from '../game/js/level.js';
import { SETTINGS, POWERUPS, ULT, RAM } from '../game/js/config.js';
SETTINGS.novaKit = 'marksman'; SETTINGS.echoKit = 'hunter'; SETTINGS.lockMode = 'manual'; SETTINGS.aiSkill = 'elite';

const BT = ['jump', 'dash', 'melee', 'fire', 'parry', 'sig', 'mode', 'lock', 'sub', 'ult'];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const idle = () => ({ mx: 0, my: 0, aimFree: false, ax: 0, ay: 0, held: {}, pressed: {}, released: {} });
function person() {
  let prev = {};
  return (o = {}) => {
    const held = {}, pressed = {}, released = {};
    for (const b of BT) { held[b] = !!(o.held && o.held[b]); pressed[b] = held[b] && !prev[b]; released[b] = !held[b] && !!prev[b]; }
    prev = held; return { mx: o.mx || 0, my: o.my || 0, aimFree: !!o.aim, ax: o.aim ? o.aim[0] : 0, ay: o.aim ? o.aim[1] : 0, held, pressed, released };
  };
}

{ // The path: continuous through every piece, the old route's frames unchanged, and the new routes apart from it and each other
  let worst = 0;
  for (let x = 400; x < 1180; x += 0.25) {
    if (x > 760 && x < 800) continue;
    const a = L.pathFrame(x), b = L.pathFrame(x + 0.25);
    worst = Math.max(worst, Math.abs(Math.hypot(a.px - b.px, a.pz - b.pz) - 0.25), Math.abs(Math.hypot(a.tx, a.tz) - 1));
  }
  const old = [L.pathFrame(50), L.pathFrame(120), L.pathFrame(300)];
  const same = old[0].px === 50 && old[0].nz === 1 && Math.abs(old[1].px - 116.7375) < 1e-3 && old[2].px === 104 - (300 - L.ARC_END) && old[2].nz === -1;
  const pts = r => { const out = []; for (let x = r.sx; x < r.endX; x += 2) { const f = L.pathFrame(x); out.push([f.px, f.pz]); } return out; };
  const F = pts(L.ROUTES[1]), U = pts(L.ROUTES[2]), O = []; for (let x = -20; x < 318; x += 2) { const f = L.pathFrame(x); O.push([f.px, f.pz]); }
  const md = (A, B) => { let m = Infinity; for (const a of A) for (const b of B) m = Math.min(m, Math.hypot(a[0] - b[0], a[1] - b[1])); return m; };
  const gap = Math.min(md(F, U), md(F, O), md(U, O));
  assert(worst < 1e-4 && same && gap > 60, `Path: continuous (error ${worst.toExponential(1)}), the old route unchanged (${same}), the three routes at least ${gap.toFixed(0)} m apart`);
}
{ // Every enemy spawn (not fliers), power-up, breakable piece and checkpoint rests on a floor
  const bad = [];
  const floor = (x, y) => L.groundBelow(x, y + 0.05);
  for (const E of L.ENCOUNTERS) for (const w of [...(E.waves || []), E.extra || []]) for (const [t, x, y] of w) if (t !== 'drone' && Math.abs(floor(x, y) - y) > 0.05) bad.push(`${E.id} ${t}`);
  for (const [x, y, k] of L.LEVEL_PICKUPS) if (Math.abs(floor(x, y) - y) > 0.05) bad.push(`pickup ${k} ${x}`);
  for (const c of L.CHECKPOINTS) if (Math.abs(floor(c.x, c.y) - c.y) > 0.05) bad.push(`checkpoint ${c.x}`);
  assert(bad.length === 0, `Everything placed on the new routes stands on a floor${bad.length ? ': ' + bad.join(', ') : ''}`);
}
{ // Traversable: a bot follows a leader stepping along each new route with no need to be recalled
  const res = [];
  for (const route of ['foundry', 'undercity']) for (const char of ['echo', 'ram']) {
    const R = L.ROUTES.find(r => r.id === route), Z = L.ZONES.find(z => z.id === route);
    const w = new World(); w.teleport(route);
    for (const S of w.encounters) S.state = 'cleared'; for (const g in L.GATES) L.GATES[g] = false;
    const me = w.addPlayer('kbm', 'nova'), bot = w.addPlayer('cpu1', char), bots = new Bots();
    me.mercy = bot.mercy = 1e9; let recalls = 0;
    for (let x = Z.spawn.x + 4; x <= R.endX; x += 6) {
      const y = L.groundBelow(x, 80); if (y === -Infinity) continue;
      Object.assign(me, { x, y, prevX: x, prevY: y, vx: 0, vy: 0, lastSafeX: x, lastSafeY: y });
      for (let t = 0; t < 150; t++) {
        const cmds = { [me.slot]: idle() }; bots.commands(w, cmds); w.step(cmds);
        for (const e of w.events) if (e.type === 'recall' && e.p === bot) recalls++;
        w.events.length = 0; Object.assign(me, { x, y, vx: 0, vy: 0 });
        if (Math.abs(bot.x - x) < 3 && Math.abs(bot.y - y) < 2) break;
      }
    }
    res.push(`${route} ${char}: ${recalls} recalls, ends ${(bot.x - R.endX).toFixed(1)} m from the end`);
    if (recalls > 0 || Math.abs(bot.x - me.x) > 6) res.push('!');
  }
  assert(!res.includes('!'), `Traversable: ${res.filter(r => r !== '!').join('; ')}`);
}
{ // Encounters start only for players on their own route; each route completes on its own
  const w = new World(); w.teleport('foundry');
  const p = w.addPlayer('kbm', 'nova'); p.x = 720; p.y = 24.2; p.mercy = 1e9;
  w.step({ [p.slot]: idle() });
  const skyline = w.encounters.filter(S => S.def.route === 'skyport' && S.state !== 'idle').length;
  const crucible = w.encounters.find(S => S.def.id === 'f-crucible').state;
  for (const S of w.encounters) if (S.def.route === 'foundry') S.state = 'cleared';
  for (const g in L.GATES) L.GATES[g] = false;
  p.x = 759; w.events.length = 0; w.step({ [p.slot]: idle() });
  const done = w.routesDone.foundry && !w.routesDone.skyport && !w.routeDone;
  assert(skyline === 0 && crucible === 'active' && done, `Route scoping: no Skyport encounter starts from the Foundry (${skyline}); the Crucible does (${crucible}); the Foundry completes on its own (${done})`);
}
{ // Breakable pieces: a crate breaks under a strike and drops its power-up; glass shatters at a shot; a pillar shrugs off
  // small arms but not a heavy blow; RAM's charge goes straight through a barricade; a reset puts them all back
  const w = new World(); w.teleport('foundry');
  const p = w.addPlayer('kbm', 'echo'); p.mercy = 1e9;
  const box = (x, tag) => L.BOXES.find(b => b.type === 'd' && b.tag === tag && b.x0 === x);
  const crate = box(412.5, 'crate'), glass = box(482, 'glass'), pillar = box(528, 'pillar'), bar = box(457, 'barricade');
  w.spawnHitbox({ owner: p, team: 'p', x0: 412, x1: 414, y0: 1, y1: 2, dmg: 8, poise: 10, kb: [2, 0], instance: w.newInstance(), heavy: true });
  w.step({ [p.slot]: idle() });
  const loot = w.pickups.find(k => k.level && !k.rest && k.kind === 'fury');
  w.spawnProjectile({ team: 'p', owner: p, x: 479, y: 1.5, vx: 20, vy: 0, ttl: 60, r: 0.15, dmg: 1.5, kind: 'shot' });
  for (let i = 0; i < 20; i++) w.step({ [p.slot]: idle() });
  const hp0 = pillar.hp; w.damageBox(pillar, 2, 528.5, 1, p); const shrugged = pillar.hp === hp0;
  w.damageBox(pillar, 80, 528.5, 1, p);
  const r = w.addPlayer('t1', 'ram'); r.x = 454.5; r.y = 0; r.prevX = 454.5; r.mercy = 1e9; r.facing = 1;
  p.x = 452.5; p.y = 0; p.prevX = 452.5;   // (side by side: the camera keeps the team together)
  const pad = person(); pad({}); w.step({ [p.slot]: idle(), [r.slot]: pad({ mx: 1, held: { dash: true } }) });
  for (let i = 0; i < 20; i++) w.step({ [p.slot]: idle(), [r.slot]: pad({ mx: 1 }) });
  const through = bar.broken && r.x > 458, rx = r.x, broke = { crate: crate.broken, glass: glass.broken, pillar: pillar.broken };
  w.resetToCheckpoint();
  const back = [crate, glass, pillar, bar].every(b => !b.broken && b.hp === L.DESTRUCT[b.tag].hp);
  assert(broke.crate && loot && broke.glass && shrugged && broke.pillar && through && back,
    `Breakables: the crate breaks and drops Fury (${!!loot}), glass shatters at a shot (${broke.glass}), a pillar ignores 2 damage (${shrugged}) and breaks under a heavy blow, RAM charges through a barricade (to x ${rx.toFixed(1)}), and a reset restores them (${back})`);
}
{ // Power-ups along the routes: they wait where they are; an Ult Cell fills the bar, Fury makes hits do more and expires
  const w = new World(); w.teleport('foundry');
  const p = w.addPlayer('kbm', 'nova'); p.mercy = 1e9; p.x = 486; p.y = 4.9; p.prevX = p.x; p.prevY = p.y;
  const waiting = w.pickups.filter(k => k.level && k.rest).length;
  for (let i = 0; i < 40; i++) { w.step({ [p.slot]: { ...idle(), mx: 1 } }); }
  const ult = p.ult;
  w.applyPower(p, 'fury');
  const e = createEnemy('brute', p.x + 1.4, p.y, { cd: 9999 }); e.hp = 500; e.armor = 0; w.enemies.push(e);
  w.spawnHitbox({ owner: p, team: 'p', x0: p.x, x1: p.x + 3, y0: p.y, y1: p.y + 2, dmg: 10, poise: 0, kb: [1, 0], instance: w.newInstance() });
  w.step({ [p.slot]: idle() });
  const furyHit = 500 - e.hp;
  for (let i = 0; i < POWERUPS.fury.ticks + 5; i++) w.step({ [p.slot]: idle() });
  assert(waiting === L.LEVEL_PICKUPS.length && ult >= POWERUPS.ultcell.ult - 1 && Math.abs(furyHit - 10 * POWERUPS.fury.dmg) < 0.01 && p.furyT === 0,
    `Power-ups: ${waiting} waiting along the routes; an Ult Cell fills ${ult.toFixed(0)}%; Fury hits for ${furyHit.toFixed(1)} (10 base) and wears off after ${(POWERUPS.fury.ticks / 60).toFixed(0)} s`);
}
{ // Lift pads: coming down onto one on the foundry floor throws you up past the platform over it
  const w = new World(); w.teleport('foundry');
  const p = w.addPlayer('kbm', 'echo'); p.mercy = 1e9;
  const [x, y, top] = L.LIFTS[2]; p.x = x; p.y = y + 1; p.prevX = x; p.prevY = p.y;
  let peak = 0; for (let i = 0; i < 90; i++) { w.step({ [p.slot]: idle() }); peak = Math.max(peak, p.y); }
  assert(peak > top, `Lift pad at x ${x}: thrown to ${peak.toFixed(1)} m, over the platform at ${top} m`);
}
{ // At a route's start wall the bots wait beside the player instead of climbing the wall (there is nothing up there)
  const w = new World(); const me = w.addPlayer('kbm', 'nova'); const bots = new Bots(); bots.sync(w, 3);
  w.teleport('undercity'); let top = 0;
  for (let i = 0; i < 300; i++) { const c = { [me.slot]: idle() }; bots.commands(w, c); w.step(c); w.events.length = 0; for (const p of w.players) top = Math.max(top, p.y); }
  assert(top < 25 && w.players.every(p => p.x > 799.9), `At the Undercity's start wall the bots stay on the roof, no higher than a jump (highest ${top.toFixed(1)} m)`);
}
