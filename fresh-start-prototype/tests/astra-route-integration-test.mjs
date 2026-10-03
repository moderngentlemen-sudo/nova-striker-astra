// Contracts between the Astra mission and the imported routes, AI, breakables and pickups.
// Encounter wins are staged where noted; these checks do not claim a balance playthrough.
import { World } from '../game/js/world.js';
import { Bots } from '../game/js/bot.js';
import { DEFAULT_SETTINGS, SETTINGS } from '../game/js/config.js';
import { EMPTY_CMD } from '../game/js/input.js';
import { BOXES, CHECKPOINTS, GATES, LEVEL_PICKUPS, ROUTES, ZONES, routeAt, pathFrame } from '../game/js/level.js';

Object.assign(SETTINGS, DEFAULT_SETTINGS);
const assert = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const at = (p, x, y) => Object.assign(p, { x, y, prevX: x, prevY: y, lastSafeX: x, lastSafeY: y, vx: 0, vy: 0, state: 'normal', st: 0, onGround: true, hitstop: 0 });
const object = (w, id) => w.interactables.find(o => o.id === id);

{
  const left = pathFrame(398), center = pathFrame(399), first = pathFrame(400);
  assert(routeAt(398).id === 'foundry' && left.px === -62 && center.px === -61 && first.px === -60 && left.pz === first.pz,
    'Foundry left wall maps continuously onto its own path from x398 to x400');
  const far = [1199.9, 1200, 1200.1, 1300].map(pathFrame);
  assert(far.every(f => Object.values(f).every(Number.isFinite)) && Math.abs(Math.hypot(far[2].px - far[0].px, far[2].pz - far[0].pz) - 0.2) < 1e-7,
    'Undercity effects beyond x1200 retain a finite, continuous terminal path frame');
}

for (const id of ['foundry', 'undercity']) for (const char of ['nova', 'echo', 'ram', 'fix']) {
  const w = new World(), p = w.addPlayer('kbm', char), bot = w.addPlayer('cpu1', 'fix');
  const R = ROUTES.find(r => r.id === id), spawn = ZONES.find(z => z.id === id).spawn;
  w.startRoute(id);
  assert(w.mission.mode === 'route' && w.mission.routeId === id && w.mission.title === R.name && p.x === spawn.x && p.y === spawn.y
    && w.players[1] === bot && bot.device === 'cpu1' && bot.hp === bot.maxHp && routeAt(CHECKPOINTS[w.checkpoint].x).id === id
    && !w.interactables.length && !GATES.ASTRA_BREACH, `${id}/${char}: route start retains the party, selects its own checkpoint and disables Skyline-only objectives`);
  w.emit('hit', { owner: p, dmg: 7 }); w.emit('perfectGuard', { p });
  bot.hp -= 5; w.heal(bot, 5, p);
  w.step({});
  assert(w.mission.stats.damageDealt === 7 && w.mission.stats.blocks === 1 && w.mission.stats.healing === 5 && w.mission.stats.elapsedTicks === 1,
    `${id}/${char}: route results track combat, support and elapsed time`);
  // Stage encounter victories, then cross the actual completion trigger.
  for (const s of w.encounters) if (s.def.route === id) s.state = 'cleared';
  for (const q of w.players) at(q, R.endX + 0.5 + q.slot * 0.5, id === 'foundry' ? 24.2 : 0);
  w.events.length = 0; w.step({});
  assert(w.mission.completed && w.routesDone[id] && !w.routesDone.skyport && !w.routeDone && w.events.filter(e => e.type === 'missionComplete').length === 1
    && w.encounters.filter(s => s.def.route !== id).every(s => s.state === 'idle'), `${id}/${char}: completion is scoped to this route and emits one result`);
  const score = w.mission.stats.score; w.step({});
  assert(w.mission.stats.score === score, `${id}/${char}: final score remains stable`);
  const revision = w.sessionRevision; w.replayMission();
  assert(w.players[0] === p && p.char === char && p.device === 'kbm' && w.mission.routeId === id && !w.mission.completed && w.mission.stats.score === 0
    && w.mission.stats.elapsedTicks === 0 && w.mission.stats.healing === 0 && !Object.keys(w.routesDone).length && w.sessionRevision > revision
    && w.pickups.length === LEVEL_PICKUPS.length, `${id}/${char}: replay resets progress, supplies and statistics while retaining identity`);
}

for (const mode of ['mission', 'foundry']) {
  const w = new World(), p = w.addPlayer('kbm', 'nova'); mode === 'mission' ? w.startMission() : w.startRoute(mode);
  const boxes = BOXES.filter(b => b.type === 'd' && routeAt(b.x0).id === w.mission.routeId);
  const before = boxes[0], later = boxes[1], consumed = w.pickups.find(k => routeAt(k.x).id === w.mission.routeId);
  w.damageBox(before, 1000, before.x0, before.y0, p);
  w.pickups = w.pickups.filter(k => k !== consumed && !(k.level && !k.rest)); // Pick up the waiting supply and crate loot.
  const cp = mode === 'mission' ? 5 : 10; w.checkpoint = cp; w.emit('checkpoint', { i: cp });
  const committedPickups = w.pickups.length;
  w.damageBox(later, 1000, later.x0, later.y0, p); w.pickups = [];
  const revision = w.sessionRevision; p.furyT = 100; p.padCd = 30; w.resetToCheckpoint();
  assert(before.broken && !later.broken && w.pickups.length === committedPickups && !w.pickups.some(k => k.x === consumed.x && k.kind === consumed.kind)
    && w.mission.stats.retries === 1 && !p.furyT && !p.padCd && w.sessionRevision > revision,
    `${mode}: retry restores committed breakables and remaining supplies without recreating consumed loot`);
}

{
  const w = new World(), p = w.addPlayer('kbm', 'nova'); w.startRoute('foundry');
  w.checkpoint = 0; at(p, 403, 0); w.updateEncounters();
  assert(w.checkpoint === CHECKPOINTS.findIndex(c => c.x === 402), 'Checkpoint scanning skips every checkpoint on a different route');
  const previous = w.mission; assert(w.startRoute('missing') === false && w.mission === previous, 'Unknown route IDs leave the active session untouched');
}

{
  const w = new World(), human = w.addPlayer('kbm', 'nova'), helper = w.addPlayer('cpu1', 'fix'), bots = new Bots();
  w.startMission(); w.updateEncounters = () => {}; w.enemies = [];
  for (const id of ['relay-west', 'relay-east']) {
    const o = object(w, id); at(human, o.x - 0.3, o.y); at(helper, o.x - 1.3, o.y);
    for (let i = 0; i < 115; i++) { w.step(bots.commands(w, { [human.slot]: EMPTY_CMD })); w.events.length = 0; }
    assert(o.state === 'restored' && helper === w.players[1], `AI Fix restores ${id} through the real Interact command while the human covers`);
  }
  const beacon = object(w, 'city-beacon'); beacon.state = 'offline'; at(human, 306, 18.6); at(helper, 305, 18.6);
  for (let i = 0; i < 100; i++) w.step(bots.commands(w, { [human.slot]: EMPTY_CMD }));
  assert(beacon.state === 'offline' && !w.mission.completed, 'Helpers leave final beacon activation to the human');
  bots.issue(w, human, 'hold'); const rev = w.sessionRevision; w.startRoute('undercity'); bots.commands(w, {});
  assert(!bots.order && bots.mem.get(helper).t === 1 && w.sessionRevision > rev, 'Starting a route clears AI orders and cached action history despite stable player identities');
  bots.issue(w, human, 'hold'); w.resetToCheckpoint(); bots.commands(w, {});
  assert(!bots.order && bots.mem.get(helper).t === 1, 'Checkpoint retry clears AI hold positions and cached inputs');
  bots.issue(w, human, 'hold'); bots.sync(w, 0);
  assert(!bots.order && !bots.done && w.players.length === 1 && w.players[0] === human, 'Removing the last AI clears its order display and retains the human');
  w.addPlayer('cpu2', 'ram'); bots.issue(w, human, 'hold'); w.removePlayer(w.players.find(p => p.device === 'cpu2').slot); bots.commands(w, {});
  assert(!bots.order && !bots.done, 'Direct removal of the last AI clears its order on the next command update');
  w.addPlayer('kbm2', 'echo'); w.addPlayer('kbm3', 'ram'); w.addPlayer('cpu3', 'fix'); bots.issue(w, human, 'hold'); bots.makeRoom(w);
  assert(!bots.order && !bots.done && w.players.length === 3, 'Making room for a fourth human clears the final AI order immediately');
}
