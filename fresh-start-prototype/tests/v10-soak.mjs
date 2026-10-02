// Soak for Version 10: Nova, Echo, RAM and Fix fight on random inputs for 8000 ticks, in the arena, the tower
// and the Skyline Relay. Every button is in play (guards and the Patch Beam held, walls, links, provokes,
// gadgets, power-ups, ultimates with the bars topped up now and then), and every 1500 ticks everyone swaps to the
// next character, so each kit is left mid-action (a charge with a pile, a link, gadgets out). Checks for
// exceptions, NaN, and that every count and resource stays bounded: shots, enemies, gadgets, power-ups, walls,
// Integrity, Kinetic, Scrap, Plating, the boost rate, and nothing left plowed with no one carrying it.
import { World } from '../game/js/world.js';
import { SETTINGS, RAM, FIX, PLATE_MAX, ROSTER, nextChar } from '../game/js/config.js';
import { boostRate } from '../game/js/player.js';
SETTINGS.novaKit = 'marksman'; SETTINGS.echoKit = 'hunter'; SETTINGS.lockMode = 'auto';
const BT = ['jump', 'dash', 'melee', 'fire', 'parry', 'sig', 'mode', 'lock', 'sub', 'ult'];
let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
function soak(zone) {
  const w = new World(); w.teleport(zone);
  const ps = ROSTER.map((c, i) => w.addPlayer('t' + i, c));
  const prev = ps.map(() => ({ held: {} }));
  const plans = ps.map(() => ({ t: 0, o: {} }));
  const max = { proj: 0, enemies: 0, gadgets: 0, pickups: 0, walls: 0 }; let errs = 0, nan = 0, bad = 0, orphan = 0; const ev = {}, why = new Set();
  for (let tick = 0; tick < 8000; tick++) {
    const cmds = {};
    ps.forEach((p, i) => {
      const pl = plans[i];
      if (--pl.t <= 0) {
        pl.t = 5 + Math.floor(rnd() * 40);
        const held = {};
        for (const b of BT) held[b] = rnd() < (b === 'fire' ? 0.45 : b === 'parry' ? 0.25 : b === 'mode' || b === 'sub' || b === 'sig' ? 0.1 : b === 'lock' ? 0.05 : b === 'ult' ? 0.03 : b === 'jump' ? 0.3 : 0.15);
        const a = rnd() * Math.PI * 2;
        pl.o = { mx: rnd() < 0.7 ? (rnd() < 0.65 ? 1 : -1) : 0, my: rnd() < 0.15 ? -1 : rnd() < 0.12 ? 1 : 0, aim: [Math.cos(a), Math.sin(a) * 0.8], held };
      }
      const o = pl.o, held = {}; for (const b of BT) held[b] = !!o.held[b];
      const pressed = {}, released = {}; for (const b of BT) { pressed[b] = held[b] && !prev[i].held[b]; released[b] = !held[b] && !!prev[i].held[b]; }
      const c = { mx: o.mx, my: o.my, aimFree: true, ax: o.aim[0], ay: o.aim[1], held, pressed, released };
      prev[i] = c; cmds[p.slot] = c;
    });
    try { w.step(cmds); } catch (e) { errs++; if (errs < 3) console.log('ERR', e.stack.split('\n').slice(0, 4).join(' | ')); }
    for (const e of w.events) ev[e.type] = (ev[e.type] || 0) + 1;
    w.events.length = 0;
    max.proj = Math.max(max.proj, w.projectiles.length); max.enemies = Math.max(max.enemies, w.enemies.length);
    max.gadgets = Math.max(max.gadgets, w.gadgets.length); max.pickups = Math.max(max.pickups, w.pickups.filter(k => !k.level).length);   // (not the level's own power-ups)
    max.walls = Math.max(max.walls, w.barriers.filter(b => b.kind === 'rampart').length);
    if (tick % 900 === 450) for (const p of ps) p.ult = 100;   // ultimates now and then
    if (tick % 1500 === 1499 && !w.ultCast) for (const p of ps) if (p.state !== 'ult') w.swapCharacter(p, nextChar(p.char));
    for (const q of [...w.projectiles, ...w.enemies, ...w.gadgets, ...w.pickups]) if (!Number.isFinite(q.x + q.y)) nan++;
    for (const p of ps) {
      if (!Number.isFinite(p.x + p.y + p.vx + p.vy + p.integrity + p.kinetic + p.scrap + p.plate)) nan++;
      const check = (ok, what) => { if (!ok) { bad++; why.add(what); } };
      check(p.integrity >= -1e-6 && p.integrity <= RAM.guard.integrity + 1e-6, 'integrity');
      check(p.kinetic >= -1e-6 && p.kinetic <= 100 + 1e-6, 'kinetic');
      check(p.scrap >= -1e-6 && p.scrap <= FIX.scrap.max + 1e-6, 'scrap');
      check(p.plate >= -1e-6 && p.plate <= PLATE_MAX + 1e-6, 'plate');
      check(boostRate(p) <= FIX.maxRate + 1e-9, 'rate');
      check(p.char === 'ram' || (!p.rush && !p.link && !p.leap), 'ram state on ' + p.char);
      check(p.char === 'fix' || (!p.patch && !w.gadgets.some(g => g.owner === p && !g.dead)), 'fix state on ' + p.char);
    }
    for (const e of w.enemies) if (e.state === 'plowed' && !(e.plowBy && (e.plowBy.state === 'rush' || e.plowBy.state === 'ult')) && e.st > 2) orphan++;
    if (w.arena.state === 'cleared') w.resetArena();
    if (zone === 'skyline' && w.encounters.every(S => S.state === 'cleared')) for (const S of w.encounters) S.state = 'idle';
  }
  const pick = ['guardOn', 'guardBlock', 'perfectGuard', 'rampartBreak', 'kineticRelease', 'rush', 'plowCatch', 'ramSplat', 'ramBonk', 'wallUp', 'wallHit', 'wallDown',
    'link', 'linkHit', 'leap', 'provoke', 'quake', 'upliftBlast', 'fortify', 'ramSlam',
    'patchOn', 'gadgetDeploy', 'gadgetUp', 'sentryShot', 'sentryRocket', 'padBounce', 'powerToss', 'powerUp', 'noScrap', 'rivetStick', 'rivetBlast', 'sparkRing', 'repairPulse',
    'podLand', 'overhaulPulse', 'revive', 'ultCast', 'ultJoin', 'teamFinisher', 'swap', 'kill', 'wipe'];
  console.log(zone, JSON.stringify({ errs, nan, bad, why: [...why], orphan, ...max, stuck: !!w.ultCast && w.ultCast.t > 400, events: Object.fromEntries(pick.map(k => [k, ev[k] || 0])) }));
  return errs === 0 && nan === 0 && bad === 0 && orphan === 0 && max.proj < 250 && max.enemies < 40 && max.gadgets <= 8 && max.pickups < 30 && max.walls <= 1 && !(w.ultCast && w.ultCast.t > 400);
}
const ok = [soak('arena'), soak('tower'), soak('skyline')].every(Boolean);
console.log((ok ? 'PASS' : 'FAIL') + ' V10 soak: four characters on random inputs with swaps; no exceptions or NaN, every count and resource bounded');
