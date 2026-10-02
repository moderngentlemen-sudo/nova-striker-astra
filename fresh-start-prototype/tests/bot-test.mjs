// AI teammates (bot.js): filling the empty slots, making room for a person, following the player through the
// Movement Gym, fighting in the Concourse Lock arena, reviving a downed player, and a long run with no errors.
import { World } from '../game/js/world.js';
import { createEnemy } from '../game/js/enemies.js';
import { SETTINGS, ROSTER, RAM, MARKSMAN } from '../game/js/config.js';
import { Bots, isBot } from '../game/js/bot.js';
SETTINGS.novaKit = 'marksman'; SETTINGS.echoKit = 'hunter'; SETTINGS.lockMode = 'auto'; SETTINGS.difficulty = 'normal'; SETTINGS.aiSkill = 'elite';

const BT = ['jump', 'dash', 'melee', 'fire', 'parry', 'sig', 'mode', 'lock', 'sub', 'ult'];
const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
// A person's command: the stick and the buttons held this tick (pressed/released worked out from the last one)
function person() {
  let prev = {};
  return (o = {}) => {
    const held = {}, pressed = {}, released = {};
    for (const b of BT) { held[b] = !!(o.held && o.held[b]); pressed[b] = held[b] && !prev[b]; released[b] = !held[b] && !!prev[b]; }
    prev = held; return { mx: o.mx || 0, my: o.my || 0, aimFree: false, ax: 0, ay: 0, held, pressed, released };
  };
}
function game(zone, n = 3, char = 'nova') {
  const w = new World(); w.teleport(zone);
  const me = w.addPlayer('kbm', char), bots = new Bots(), pad = person();
  bots.sync(w, n);
  const run = (o, ticks, each) => {
    for (let i = 0; i < ticks; i++) {
      const cmds = { [me.slot]: pad(typeof o === 'function' ? o(i) : o) };
      bots.sync(w, n); bots.commands(w, cmds); w.step(cmds); w.events.length = 0;
      if (each && each(i)) return i;
    }
    return ticks;
  };
  return { w, me, bots, run };
}

{ // Filling the team: the characters no one plays, never past four players, and a person joining takes a bot's place
  const { w, me, bots } = game('gym', 3);
  const chars = w.players.filter(isBot).map(p => p.char);
  bots.sync(w, 1); const one = w.players.filter(isBot).length;
  bots.sync(w, 3); const room = bots.makeRoom(w); w.addPlayer('pad0', 'echo'); bots.sync(w, 3);
  assert(chars.join() === 'echo,ram,fix' && one === 1 && room && w.players.length === 4 && w.players.filter(isBot).length === 2 && me.char === 'nova',
    `AI teammates fill the team as ${chars.join(', ')}; turned down to 1 (${one}); a person joining a full team takes one's place (${w.players.filter(isBot).length} bots left)`);
  const lone = new World(); new Bots().sync(lone, 3);
  assert(lone.players.length === 0, 'No AI teammates before a person has joined');
}
{ // Following: the player runs and jumps through the Movement Gym (stopping before the arena); the bots keep up
  const { w, me, run } = game('gym', 3);
  let worst = 0;
  run(i => (me.x < 52 ? { mx: 1, held: { jump: (i % 40) < 14 } } : {}), 1500, i => { if (i > 300 && i % 30 === 0 && me.x < 52) for (const p of w.players) if (isBot(p)) worst = Math.max(worst, Math.abs(p.x - me.x)); });
  const bots = w.players.filter(isBot);
  assert(me.x > 50 && bots.every(p => Math.abs(p.x - me.x) < 8) && worst < 18,
    `Through the gym to x ${me.x.toFixed(0)}: the bots end ${bots.map(p => `${p.char} ${(p.x - me.x).toFixed(1)} m`).join(', ')} from the player (worst gap on the way ${worst.toFixed(1)} m)`);
}
for (const char of ROSTER) { // Fighting: each character, as a bot, kills enemies next to an idle player
  const w = new World(); w.teleport('gym');
  const me = w.addPlayer('kbm', char === 'nova' ? 'echo' : 'nova'); const bot = w.addPlayer('cpu1', char), bots = new Bots(), pad = person();
  me.x = 20; me.y = 0; bot.x = 18.5; bot.y = 0; me.mercy = bot.mercy = 99999;
  const foes = [22.5, 24, 26].map(x => { const e = createEnemy('swarmer', x, 0, {}); w.enemies.push(e); return e; });
  let t = 0;
  for (; t < 1500 && !foes.every(e => e.dead); t++) { const cmds = { [me.slot]: pad({}) }; bots.commands(w, cmds); w.step(cmds); w.events.length = 0; }
  assert(foes.every(e => e.dead), `${char} as a bot kills 3 Swarmers beside an idle player in ${t} ticks (${foes.filter(e => e.dead).length}/3)`);
}
{ // Reviving: the player goes down; a bot comes over and gets them back up (Fix from range with her beam)
  for (const char of ['echo', 'fix']) {
    const w = new World(); w.teleport('gym');
    const me = w.addPlayer('kbm', 'nova'); const bot = w.addPlayer('cpu1', char), bots = new Bots(), pad = person();
    me.x = 20; me.y = 0; bot.x = 14; bot.y = 0; w.downPlayer(me);
    let t = 0;
    for (; t < 900 && me.state === 'downed'; t++) { const cmds = { [me.slot]: pad({}) }; bots.commands(w, cmds); w.step(cmds); w.events.length = 0; }
    assert(me.state !== 'downed', `${char} as a bot revives the downed player in ${t} ticks`);
  }
}
{ // A long fight in the arena and on the Skyline Relay with an idle player: no errors, nothing non-finite
  let errs = 0, nan = 0, kills = 0;
  for (const zone of ['arena', 'skyline']) {
    const w = new World(); w.teleport(zone);
    const me = w.addPlayer('kbm', 'nova'), bots = new Bots(), pad = person();
    for (let t = 0; t < 4000; t++) {
      const cmds = { [me.slot]: pad({ mx: t % 600 < 300 ? 1 : 0 }) };
      try { bots.sync(w, 3); bots.commands(w, cmds); w.step(cmds); } catch (e) { if (++errs < 3) console.log('ERR', e.stack.split('\n').slice(0, 4).join(' | ')); }
      for (const ev of w.events) if (ev.type === 'kill' && ev.owner && isBot(ev.owner)) kills++;
      w.events.length = 0;
      for (const p of w.players) if (!Number.isFinite(p.x + p.y + p.vx + p.vy)) nan++;
      if (w.arena.state === 'cleared') w.resetArena();
    }
  }
  assert(errs === 0 && nan === 0 && kills > 10, `8000 ticks of bots fighting in the arena and the Skyline Relay: ${errs} errors, ${nan} non-finite, ${kills} kills by bots`);
}

// ---- The smarter plays (elite skill) ----
function duo(char, mine = 'nova', x = 20, bx = 18.5) {
  const w = new World(); w.teleport('gym');
  const me = w.addPlayer('kbm', mine), bot = w.addPlayer('cpu1', char), bots = new Bots(), pad = person();
  me.x = x; me.y = 0; bot.x = bx; bot.y = 0; me.mercy = bot.mercy = 99999;
  const step = (n = 1, o = {}) => { for (let i = 0; i < n; i++) { const cmds = { [me.slot]: pad(o) }; bots.commands(w, cmds); w.step(cmds); w.events.length = 0; } };
  return { w, me, bot, bots, step };
}
{ // Focus fire: the bot takes the player's lock-on target over a nearer enemy
  const { w, me, bot, bots, step } = duo('echo');
  const near = createEnemy('swarmer', 21.5, 0, { cd: 9999 }), far = createEnemy('swarmer', 25, 0, { cd: 9999 });
  near.hp = far.hp = 60; w.enemies.push(near, far); w.setLock(me, far, 'test');
  step(30);
  assert(bots.mem.get(bot).target === far, `Focus fire: the bot goes for the player's locked target (${bots.mem.get(bot).target === far ? 'the far one' : 'the near one'})`);
}
{ // RAM covers a teammate: shots aimed at the player behind him meet his raised shield
  const { w, me, bot, step } = duo('ram', 'fix', 18, 19.6);
  const sn = createEnemy('sniper', 30, 0, { cd: 9999 }); sn.hp = 999; w.enemies.push(sn);
  let guarded = 0;
  for (let i = 0; i < 6; i++) {
    w.spawnProjectile({ team: 'e', owner: sn, x: 27, y: 1.2, vx: -14, vy: 0, ttl: 120, r: 0.2, dmg: 8, kind: 'std' });
    for (let t = 0; t < 30; t++) { step(1); if (bot.state === 'guard') guarded++; }
  }
  assert(guarded > 20 && me.hp > me.maxHp - 16, `RAM raises his shield for the teammate behind him (${guarded} ticks guarding; their health ${me.hp}/${me.maxHp})`);
}
{ // Mortar: a bot leaves the landing zone of a shell coming down on it
  const { w, me, bot, step } = duo('nova', 'echo', 14, 20);
  const m = createEnemy('mortar', 30, 0, { cd: 9999 }); m.hp = 999; w.enemies.push(m);
  const T = 1.2, g = 30, vx = (20 - 29.5) / T, vy = (0.2 - 1.35 + 0.5 * g * T * T) / T;
  w.spawnProjectile({ team: 'e', owner: m, x: 29.5, y: 1.35, vx, vy, gravity: g, r: 0.3, dmg: 0, heavy: true, kind: 'mortar', ttl: 300, blast: { r: 2.2, dmg: 18, poise: 60 } });
  step(60);
  assert(Math.abs(bot.x - 20) > 2.4, `A bot clears a mortar shell's landing zone (${Math.abs(bot.x - 20).toFixed(1)} m from where it lands)`);
}
{ // Shockwave: a bot hops an enemy shockwave running along the floor at it
  const { w, me, bot, step } = duo('echo', 'nova', 14, 20);
  const br = createEnemy('brute', 25, 0, { cd: 9999 }); br.hp = 999; w.enemies.push(br);
  w.spawnShockwave(br, -1, 20);
  const hp0 = bot.hp; step(60);
  assert(bot.hp === hp0, `A bot jumps an enemy shockwave (health ${bot.hp}/${hp0})`);
}
{ // Beams: RAM and Nova charge to Level 4 and fire their beams down a line of enemies
  for (const char of ['ram', 'nova']) {
    const { w, bot, step } = duo(char, char === 'ram' ? 'fix' : 'echo', 8, 14);
    for (const x of [22, 24, 26, 28]) w.enemies.push(createEnemy('post', x, 0, { cd: 9999 }));   // (training posts: they stand still)
    let beamed = false;
    for (let t = 0; t < 600 && !beamed; t++) { step(1); if (bot.state === 'beam') beamed = true; }
    assert(beamed, `${char} as a bot fires a Level 4 beam down a line of 4 training posts`);
  }
}

// ---- Team commands ----
function squad(chars = ['echo', 'ram', 'fix']) {
  const w = new World(); w.teleport('gym');
  const me = w.addPlayer('kbm', 'nova'); me.x = 20; me.y = 0; me.mercy = 99999;
  const bots = new Bots(), pad = person();
  const team = chars.map((c, i) => { const b = w.addPlayer('cpu' + (i + 1), c); b.x = 16 + i; b.y = 0; b.mercy = 99999; return b; });
  const step = (n = 1, o = {}) => { for (let i = 0; i < n; i++) { const cmds = { [me.slot]: pad(o) }; bots.commands(w, cmds); w.step(cmds); w.events.length = 0; } };
  return { w, me, bots, team, step };
}
{ // Attack my target: every bot goes for the commander's lock-on target, even a far one, and the order lapses when it falls
  const { w, me, bots, team, step } = squad();
  const near = createEnemy('swarmer', 21.5, 0, { cd: 9999 }), far = createEnemy('swarmer', 27, 0, { cd: 9999 });
  near.hp = 60; far.hp = 40; w.enemies.push(near, far); w.setLock(me, far, 'test');
  const answers = bots.issue(w, me, 'attack');
  step(20);
  const all = team.every(b => bots.mem.get(b).target === far);
  let t = 0; for (; t < 900 && !far.dead; t++) step(1);
  step(2);
  assert(answers.length === 3 && all && far.dead && bots.order === null,
    `Attack my target: all 3 bots go for the far locked Swarmer (${all}), kill it in ${t} ticks, and the order lapses`);
}
{ // Hold here: the bots stay around the spot while the commander walks off
  const { w, me, bots, team, step } = squad();
  bots.issue(w, me, 'hold');
  step(200, { mx: -1 });
  const spread = team.map(b => Math.abs(b.x - 20).toFixed(1));
  assert(team.every(b => Math.abs(b.x - 20) < 3) && me.x < 14, `Hold here: the bots stay within 3 m of the spot (${spread.join(', ')} m) as the player walks off to x ${me.x.toFixed(0)}`);
}
{ // Cover me: RAM stands between the commander and the enemy with his shield up; Fix beams the commander
  const { w, me, bots, team, step } = squad(['ram', 'fix']);
  const sn = createEnemy('sniper', 30, 0, { cd: 9999 }); sn.hp = 999; w.enemies.push(sn);
  me.hp = 80; bots.issue(w, me, 'cover');
  let guard = 0, beam = 0;
  for (let i = 0; i < 240; i++) {
    if (i % 40 === 0) w.spawnProjectile({ team: 'e', owner: sn, x: 28, y: 1.2, vx: -14, vy: 0, ttl: 120, r: 0.2, dmg: 6, kind: 'std' });
    step(1); if (team[0].state === 'guard') guard++; if (team[1].state === 'patch') beam++;
  }
  const ram = team[0];
  assert(ram.x > me.x && ram.x - me.x < 3 && guard > 20 && beam > 30 && me.hp >= 80,
    `Cover me: RAM ${ (ram.x - me.x).toFixed(1)} m in front of the player (${guard} ticks guarding), Fix's beam on them ${beam} ticks, their health ${me.hp}/${me.maxHp}`);
}
{ // Regroup on me: the bots come in close, then go back to following; the same command again cancels it
  const { w, me, bots, team, step } = squad();
  for (const b of team) b.x = 6;
  bots.issue(w, me, 'regroup'); step(240);
  const close = team.every(b => Math.abs(b.x - me.x) < 3.5);
  step(200); const lapsed = bots.order === null;
  bots.issue(w, me, 'hold'); const cancel = bots.issue(w, me, 'hold');
  assert(close && lapsed && bots.order === null && cancel.length === 3, `Regroup: the bots come within 3.5 m (${team.map(b => (b.x - me.x).toFixed(1)).join(', ')}), it lapses after ${(360 / 60).toFixed(0)} s, and giving a command twice cancels it`);
}
