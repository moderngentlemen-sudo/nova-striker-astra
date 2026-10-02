// AI teammates. Settings: AI teammates fills the empty slots of the team with computer-controlled players. Each
// one produces the same command a gamepad would (stick, held/pressed/released buttons, free aim) once a tick, so
// the simulation treats it exactly like a person: same moves, same cooldowns, same rules.
//
// What a bot does, in order: get a downed teammate back up (Fix with her Patch Beam from range); keep up with
// the team (it follows the first human player, jumping walls and gaps); and fight whatever is close, in its
// character's role:
//   Nova  keeps her distance and shoots, charging shots between taps; bracer combo up close; dodges wind-ups
//   Echo  closes in for blade combos, dashes in from mid range, parries wind-ups and incoming shots
//   RAM   wades in with the shield: combos, Ram Charge from mid range, Breach Cannon, guards wind-ups and
//         shots, lets the stored Kinetic go, Provokes a crowd, Guardian Links a teammate in trouble
//   Fix   heals and revives with the Patch Beam whenever someone needs it, rivets and wrench otherwise, and
//         builds a gadget when there is Scrap to spare and a fight on
// Everyone uses their ultimate when it is ready and enemies are close, and joins a teammate's team ultimate.
// Reactions are not perfect: a bot answers only some wind-ups, and only after a short delay.
import { ULT, RAM, FIX, ROSTER } from './config.js';
import { groundBelow, hasHeadroom } from './level.js';

const BTNS = ['jump', 'dash', 'melee', 'fire', 'parry', 'sig', 'mode', 'lock', 'sub', 'ult'];
export const BOT = {
  sight: 11,         // m: enemies this close are fought
  leash: 9,          // m: ...unless the bot is this far from the player it follows (it catches up first)
  follow: 1.6,       // m: where it stands behind the player it follows (more for each further bot)
  reviveRange: 22,   // m: a downed teammate this close is gone to first
  react: 0.55,       // chance of answering a given wind-up or shot at all
  delay: 8,          // ticks before it does
  range: { nova: 6.5, echo: 1.3, ram: 1.5, fix: 5.5 },   // m it likes to fight at
};

export const isBot = p => typeof p.device === 'string' && p.device.startsWith('cpu');

const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const alive = e => !e.dead && e.hp > 0;
const up = q => q.state !== 'downed' && q.state !== 'dead';

export class Bots {
  constructor() { this.mem = new Map(); }

  // Keep the number of AI players at `want`, never more than the slots the human players leave free. They
  // take the characters no one is playing (Nova, Echo, RAM, Fix order), and are only added once a person has.
  sync(world, want) {
    const humans = world.players.filter(p => !isBot(p)), bots = world.players.filter(isBot);
    const allowed = humans.length ? Math.max(0, Math.min(want, 4 - humans.length)) : 0;
    for (let i = bots.length - 1; i >= allowed; i--) { world.removePlayer(bots[i].slot); this.mem.delete(bots[i]); }
    for (let n = Math.min(bots.length, allowed); n < allowed; n++) {
      const used = new Set(world.players.map(p => p.char)), char = ROSTER.find(c => !used.has(c)) || ROSTER[n % ROSTER.length];
      let id = 1; const devs = new Set(world.players.map(p => p.device)); while (devs.has('cpu' + id)) id++;
      world.addPlayer('cpu' + id, char);
    }
  }
  // Free a slot for a person joining a full team: the last AI player leaves
  makeRoom(world) {
    const bots = world.players.filter(isBot);
    if (world.players.length < 4 || !bots.length) return false;
    const b = bots[bots.length - 1]; world.removePlayer(b.slot); this.mem.delete(b); return true;
  }

  // The commands for every AI player this tick, added to `cmds` (by slot)
  commands(world, cmds) {
    for (const p of world.players) if (isBot(p)) cmds[p.slot] = this.command(world, p);
    for (const p of this.mem.keys()) if (!world.players.includes(p)) this.mem.delete(p);
    return cmds;
  }

  command(world, p) {
    let M = this.mem.get(p);
    if (!M) { M = { prev: {}, jumpT: 0, fireT: 0, meleeT: 0, guardT: 0, seen: new Set(), react: new Map(), seed: (p.slot + 1) * 7919, t: 0, target: null, retarget: 0, gadgetT: 240 }; this.mem.set(p, M); }
    M.t++;
    const rnd = () => ((M.seed = (M.seed * 16807) % 2147483647) / 2147483647);
    const held = {}; let mx = 0, my = 0, aimFree = false, ax = 0, ay = 0;
    const out = () => {
      const pressed = {}, released = {};
      for (const b of BTNS) { held[b] = !!held[b]; pressed[b] = held[b] && !M.prev[b]; released[b] = !held[b] && !!M.prev[b]; }
      M.prev = { ...held };
      return { mx, my, aimFree, ax, ay, held, pressed, released };
    };
    if (p.state === 'downed' || p.state === 'dead' || p.state === 'ult') return out();

    const team = world.players.filter(q => q !== p);
    const leader = team.find(q => !isBot(q) && up(q)) || team.find(up) || null;
    const order = world.players.filter(isBot).indexOf(p);
    const cx = p.x, cy = p.y + p.h / 2;
    const dist = (e) => Math.hypot(e.x - cx, e.y + e.h / 2 - cy);

    // ---- Join a teammate's team ultimate; use our own when it is ready and a fight is on ----
    if (world.ultCast && !world.ultCast.members.includes(p) && p.ult >= ULT.max) { held.ult = (M.t % 4) < 2; return out(); }

    // ---- Who to fight: the nearest enemy in sight (re-chosen every few ticks, like a person would) ----
    if (--M.retarget <= 0 || !M.target || !alive(M.target)) {
      M.retarget = 10;
      let best = null, bd = BOT.sight;
      for (const e of world.enemies) {
        if (!alive(e) || e.state === 'plowed') continue;
        const d = dist(e); if (d < bd) { bd = d; best = e; }
      }
      M.target = best;
    }
    let tgt = M.target && alive(M.target) ? M.target : null;
    const farFromLeader = leader && Math.abs(leader.x - p.x) > BOT.leash;
    if (farFromLeader && tgt && Math.abs(tgt.x - leader.x) > BOT.leash) tgt = null;   // catch up first

    // ---- Where to go ----
    const downed = team.filter(q => q.state === 'downed' && Math.abs(q.x - p.x) < BOT.reviveRange).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    let goal = p.x, stopAt = 0.5;
    if (downed && !(p.char === 'fix' && Math.abs(downed.x - p.x) < FIX.beam.range - 1)) { goal = downed.x; stopAt = 0.6; }
    else if (tgt && !farFromLeader) {
      const R = BOT.range[p.char], side = sign(p.x - tgt.x) || -tgt.facing || 1;
      goal = tgt.x + side * (R + tgt.w / 2); stopAt = p.char === 'nova' || p.char === 'fix' ? 1.2 : 0.35;
    } else if (leader) { goal = leader.x - (leader.facing || 1) * BOT.follow * (1 + order * 0.7); stopAt = 0.8; }
    const dx = goal - p.x;
    if (Math.abs(dx) > stopAt) mx = sign(dx);

    // ---- Platforming: jump walls, gaps and up to where the goal is; never walk off a ledge the goal isn't past ----
    const dir = mx || p.facing, goalY = downed && goal === downed.x ? downed.y : leader && !tgt ? leader.y : tgt ? tgt.y : p.y;
    const wall = mx && !hasHeadroom(p.x + dir * 0.45, p.y + 0.3, p.w, Math.max(0.6, p.h - 0.4));
    const floorAhead = groundBelow(p.x + dir * (p.w / 2 + 0.6), p.y + 0.2);
    const gap = mx && p.onGround && floorAhead < p.y - 1.2;
    const goalPastGap = Math.abs(dx) > 2.2;
    if (gap && !goalPastGap && goalY >= p.y - 0.5) mx = 0;           // don't step off for nothing
    const wantUp = goalY > p.y + 1.1 && Math.abs(dx) < 5;
    // a wall in the way while airborne: climb kicks (jump while holding toward it) take it up a tall wall
    const climb = !p.onGround && p.wallDir !== 0 && p.wallDir === dir && (wall || goalY > p.y + 0.5);
    // (a jump only starts on a fresh press, so each one begins by letting go of the button if it is held)
    if (M.jumpT <= 0 && p.onGround && (wall || (gap && goalPastGap && goalY >= p.y - 0.5) || wantUp)) { M.jumpT = 14; M.jumpNew = true; }
    else if (M.jumpT <= 0 && !p.onGround && (climb ? p.vy < 3 : p.vy < 1 && p.jumpsUsed < 1 && (wall || (goalY > p.y + 0.8 && Math.abs(dx) < 4) || (floorAhead < p.y - 3 && goalPastGap)))) { M.jumpT = 10; M.jumpNew = true; }
    if (M.jumpT > 0) {
      if (M.jumpNew && M.prev.jump) held.jump = false;
      else { held.jump = true; M.jumpNew = false; M.jumpT--; }
    }
    // Stuck (no headway toward a goal over 3 m away for about 3 s, out of a fight): catch up with the team the
    // way a player left off screen does (no penalty)
    if (M.t % 60 === 0) {
      M.stuck = !tgt && Math.abs(dx) > 3 && Math.abs(p.x - (M.lastX ?? p.x + 9)) < 0.6 ? (M.stuck || 0) + 1 : 0; M.lastX = p.x;
      if (M.stuck >= 3) { M.stuck = 0; world.recall(p, false); return out(); }
    }

    if (!tgt) { M.fireT = 0; this.support(world, p, M, held, leader, rnd); return out(); }

    // ---- Fighting ----
    const d = dist(tgt), tx = tgt.x - p.x, ty = (tgt.y + tgt.h / 2) - cy, len = Math.hypot(tx, ty) || 1;
    aimFree = true; ax = tx / len; ay = ty / len;
    if (!mx && Math.abs(tx) > 0.2 && sign(tx) !== p.facing) mx = sign(tx) * 0.3;   // turn to face it
    if (!p.onGround) { ay = Math.max(ay, -0.3); }                                    // (aiming hard down in the air is a ground pound)

    // Threats: an enemy winding up on us, or an enemy shot about to hit us; answered only sometimes, after a delay
    const threat = this.threat(world, p, M, rnd);

    const close = Math.abs(tx) < 2.0 + tgt.w / 2 && Math.abs(ty) < 1.6;
    switch (p.char) {
      case 'nova': {
        if (threat) { held.parry = true; mx = -sign(tx) || -p.facing; }               // dodge away
        else if (close) { aimFree = false; held.melee = (M.t % 9) < 3; }
        else { held.fire = this.fireCycle(M, 46); }
        break;
      }
      case 'echo': {
        if (threat) held.parry = (M.t % 3) === 0;                                       // parry / deflect
        else if (close) { aimFree = false; held.melee = (M.t % 8) < 3; }
        else if (d > 3 && d < 6.5 && p.onGround && Math.abs(ty) < 1 && (M.t % 70) === 0) { held.dash = true; mx = sign(tx); }
        else if (d >= 6.5) held.fire = this.fireCycle(M, 20);
        break;
      }
      case 'ram': {
        const guarding = p.state === 'guard';
        if (threat || (guarding && M.guardT > 0)) { held.parry = true; aimFree = true; ax = sign(tx) || p.facing; ay = 0; if (threat) M.guardT = 30; M.guardT--; if (p.kinetic >= 45) held.fire = (M.t % 6) < 2; }
        else if (close) { aimFree = false; held.melee = (M.t % 12) < 3; }
        else if (d > 3 && d < 8 && p.onGround && Math.abs(ty) < 0.8 && (M.t % 90) === 0 && !p.rush) { held.dash = true; mx = sign(tx); }
        else if (d < 10) held.fire = this.fireCycle(M, 26);
        const crowd = world.enemies.filter(e => alive(e) && dist(e) < 6).length;
        const hurt = team.find(q => up(q) && q.hp < q.maxHp * 0.45 && Math.abs(q.x - p.x) < RAM.link.range);
        if (crowd >= 3 && p.provokeCd === 0 && (M.t % 30) === 0) held.sub = true;
        else if (hurt && p.linkCd === 0 && !p.link && (M.t % 30) === 15) held.mode = true;
        break;
      }
      case 'fix': {
        if (this.patch(world, p, team)) { held.parry = true; aimFree = false; }
        else if (close) { aimFree = false; held.melee = (M.t % 9) < 3; }
        else held.fire = this.fireCycle(M, 18);
        if (p.scrap >= 70 && --M.gadgetT <= 0 && !world.gadgets.some(g => g.owner === p && !g.dead && g.kind !== 'pad')) { held.sig = true; M.gadgetT = 600; }
        break;
      }
    }
    // Ultimate: when it is full and there is something worth hitting close by
    if (p.ult >= ULT.max && !world.ultCast && d < 7 && (M.t % 20) === 0) held.ult = true;
    return out();
  }

  // Out of a fight: Fix keeps the team patched up; RAM holds his guard up if shots are coming
  support(world, p, M, held, leader, rnd) {
    if (p.char === 'fix' && this.patch(world, p, world.players.filter(q => q !== p))) held.parry = true;
    if (p.char === 'ram' && this.threat(world, p, M, rnd)) held.parry = true;
  }

  // Fix: someone in Patch Beam range is down or hurt (or she is, with no one else to see to)
  patch(world, p, team) {
    const R = FIX.beam.range;
    const need = team.some(q => (q.state === 'downed' || (up(q) && q.hp < q.maxHp * 0.75)) && Math.hypot(q.x - p.x, q.y - p.y) < R);
    return need || p.patch || (p.hp < p.maxHp * 0.5);
  }

  // Charged shots: hold for `hold` ticks, let go, a short pause, again
  fireCycle(M, hold) { M.fireT = (M.fireT + 1) % (hold + 6); return M.fireT < hold; }

  // An enemy winding up an attack on us, or an enemy shot that will reach us within a few ticks. Each one is
  // answered (or not) once, decided by chance, and only after BOT.delay ticks.
  threat(world, p, M, rnd) {
    const cx = p.x, cy = p.y + p.h / 2;
    let seen = null;
    for (const e of world.enemies) {
      if (!alive(e) || e.state !== 'windup' || (e.target && e.target !== p)) continue;
      if (Math.abs(e.x - cx) < 3.2 && Math.abs(e.y - p.y) < 2) { seen = e; break; }
    }
    if (!seen) for (const pr of world.projectiles) {
      if (pr.team !== 'e' || pr.dead) continue;
      const rx = cx - pr.x, ry = cy - pr.y, d = Math.hypot(rx, ry);
      if (d > 5 || (rx * pr.vx + ry * pr.vy) <= 0) continue;
      const tHit = d / (Math.hypot(pr.vx, pr.vy) || 1) * 60;
      if (tHit < 22) { seen = pr; break; }
    }
    for (const [k, r] of M.react) if (world.tick - r.at > 90) M.react.delete(k);
    if (!seen) return false;
    let r = M.react.get(seen);
    if (!r) { r = { at: world.tick, yes: rnd() < BOT.react }; M.react.set(seen, r); }
    return r.yes && world.tick - r.at >= BOT.delay;
  }
}
