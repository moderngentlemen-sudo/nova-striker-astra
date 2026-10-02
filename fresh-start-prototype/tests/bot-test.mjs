// AI teammates (bot.js): filling the empty slots, making room for a person, following the player through the
// Movement Gym, fighting in the Concourse Lock arena, reviving a downed player, and a long run with no errors.
import { World } from '../game/js/world.js';
import { createEnemy } from '../game/js/enemies.js';
import { SETTINGS, ROSTER } from '../game/js/config.js';
import { Bots, isBot } from '../game/js/bot.js';
SETTINGS.novaKit = 'marksman'; SETTINGS.echoKit = 'hunter'; SETTINGS.lockMode = 'auto'; SETTINGS.difficulty = 'normal';

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
{ // Following: the player runs and jumps through the Movement Gym; the bots keep up on their own
  const { w, me, run } = game('gym', 3);
  let worst = 0;
  run(i => ({ mx: 1, held: { jump: (i % 40) < 14 } }), 1500, i => { if (i > 300 && i % 30 === 0) for (const p of w.players) if (isBot(p)) worst = Math.max(worst, Math.abs(p.x - me.x)); });
  const bots = w.players.filter(isBot);
  assert(me.x > 30 && bots.every(p => Math.abs(p.x - me.x) < 8) && worst < 20,
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
