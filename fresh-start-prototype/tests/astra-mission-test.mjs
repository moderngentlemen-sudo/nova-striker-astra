// Mission contracts and interaction integration, using default combat settings.
// State staging below isolates mission progression; it is not a human balance playthrough.
import { World } from '../game/js/world.js';
import { DEFAULT_SETTINGS, SETTINGS } from '../game/js/config.js';
import { EMPTY_CMD } from '../game/js/input.js';
import { GATES, BOXES, pointInSolid, groundBelow } from '../game/js/level.js';
import { createEnemy } from '../game/js/enemies.js';
import { hitPlayer } from '../game/js/combat.js';

Object.assign(SETTINGS, DEFAULT_SETTINGS);
const assert = (ok, text) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${text}`); if (!ok) process.exitCode = 1; };
const cmd = (held = {}, extras = {}) => ({ ...EMPTY_CMD, held: { ...EMPTY_CMD.held, ...held }, pressed: { ...EMPTY_CMD.pressed, ...held }, released: { ...EMPTY_CMD.released }, ...extras });
function setup(char = 'nova') { const w = new World(); const p = w.addPlayer('test', char); w.startMission(); return { w, p }; }
function position(p, x, y) { Object.assign(p, { x, y, prevX: x, prevY: y, vx: 0, vy: 0, onGround: true, state: 'normal', st: 0, hitstop: 0, mercy: 0 }); }
function safeTicks(w, n) { for (let i = 0; i < n; i++) { w.step({}); w.events.length = 0; } }
const object = (w, id) => w.interactables.find(o => o.id === id);

{
  const { w, p } = setup('echo');
  assert(w.mission.mode === 'mission' && w.mission.title === 'Restore the Skyline Relay' && w.interactables.length === 11, 'Mission initializes authored objectives and eleven world objects');
  assert(GATES.ASTRA_BREACH && pointInSolid(51, 1), 'Closed breach panel participates in production collision');
  const hb = { owner: p, team: 'p', x0: 50, x1: 52, y0: 0, y1: 3, dmg: 3, instance: w.newInstance() };
  for (let i = 0; i < 10; i++) w.spawnHitbox(hb);
  assert(object(w, 'concourse-panel').hp === 9, 'Persistent attack hitboxes damage a panel once per attack instance');
  for (let i = 0; i < 3; i++) w.spawnHitbox({ ...hb, instance: w.newInstance() });
  assert(object(w, 'concourse-panel').state === 'open' && !pointInSolid(51, 1), 'Ordinary attacks open a breach without a required character');
  const p0 = p; p.hp = 1; w.replayMission();
  assert(p === p0 && p.char === 'echo' && p.device === 'test' && p.hp === p.maxHp && p.x === 0 && !w.mission.completed, 'Replay retains player identity and resets health, route and mission');
  w.startTraining();
  assert(w.mission.mode === 'training' && w.interactables.length === 0 && !BOXES.some(b => b.tag === 'ASTRA_BREACH'), 'Training removes mission geometry and restores practice targets');
}
for (const char of ['nova', 'echo', 'ram', 'fix']) {
  const { w, p } = setup(char);
  w.updateEncounters = () => {}; w.enemies = [];
  position(p, 109.6, 0); w.step({ 0: cmd({ interact: true }) }); safeTicks(w, char === 'fix' ? 48 : 94);
  assert(object(w, 'spire-repair').state === 'restored' && object(w, 'spire-launch').state === 'ready', `${char} restores a repair junction through the production input hook`);
  position(p, 270.6, 18.6); w.step({ 0: cmd({ interact: true }) }); safeTicks(w, 94);
  position(p, 289.1, 18.6); w.step({ 0: cmd({ interact: true }) }); safeTicks(w, 94);
  assert(w.mission.restoration.relay && object(w, 'relay-west').state === 'restored' && object(w, 'relay-east').state === 'restored', `${char} can restore both mission controls solo with default settings`);
  assert(!w.mission.completed && object(w, 'city-beacon').state === 'locked', `${char} cannot complete the mission by skipping its bosses`);
  // Stage won encounters to test the final progression contract independently of combat balance.
  w.arena.state = 'cleared'; for (const s of w.encounters) s.state = 'cleared';
  safeTicks(w, 1); position(p, 305.5, 18.6); w.step({ 0: cmd({ interact: true }) }); safeTicks(w, 95);
  assert(w.mission.completed && w.mission.stage === 'complete' && w.mission.restoration.city && w.routeDone, `${char} reaches the real mission result state after boss wins and beacon activation`);
  const score = w.mission.stats.score; safeTicks(w, 10);
  assert(w.mission.stats.score === score, `${char} result score freezes after completion`);
}
{
  const { w, p } = setup('ram'); w.updateEncounters = () => {}; w.enemies = [];
  position(p, 109.6, 0); w.interact(p); safeTicks(w, 20);
  p.x = 105; safeTicks(w, 1);
  assert(object(w, 'spire-repair').state === 'offline' && object(w, 'spire-repair').charge === 0, 'Leaving an interaction cancels and clears its partial progress');
  position(p, 109.6, 0); w.interact(p); safeTicks(w, 20);
  hitPlayer(w, p, { dmg: 1, kb: [0, 0], owner: { x: 109, y: 0 }, instance: w.newInstance() }); safeTicks(w, 1);
  assert(object(w, 'spire-repair').operator === null, 'Taking damage interrupts a relay connection');
}
{
  const { w, p } = setup(); w.updateEncounters = () => {}; w.enemies = [];
  position(p, 109.6, 0); w.interact(p); safeTicks(w, 92);
  w.checkpoint = 2; w.emit('checkpoint', { i: 2 });
  position(p, 270.6, 18.6); w.interact(p); safeTicks(w, 92);
  p.hitstop = 9; p.buf.interact = 0; p.queued = 'nova_k2';
  w.resetToCheckpoint();
  assert(object(w, 'spire-repair').state === 'restored' && object(w, 'relay-west').state === 'offline' && !w.mission.restoration.relay, 'Retry preserves checkpoint repairs and reverts later objective progress');
  assert(w.mission.stats.retries === 1 && w.projectiles.length === 0 && w.hitboxes.length === 0, 'Retry records the attempt and clears transient attacks');
  assert(p.hitstop === 0 && p.queued === null && Object.values(p.buf).every(v => v === 99), 'Retry clears hitstop and stale queued input before players regain control');
}
{
  const { w, p } = setup('echo'); w.updateEncounters = () => {}; w.enemies = [];
  position(p, 53, 0); const power = object(w, 'concourse-power');
  const e = createEnemy('swarmer', 55.6, 0); e.state = 'caught'; e.catcher = p; w.enemies.push(e); p.leash = { e, t: 0 };
  assert(w.releaseLeashDirectional(p, 1, 0), 'Directional scarf release handles a caught enemy');
  safeTicks(w, 2);
  assert(power.state === 'cooldown' && power.cooldown > 0, 'A thrown enemy energizes a nearby power fixture');
  const n = w.mission.stats.interactions;
  w.spawnHitbox({ owner: p, team: 'p', x0: 55, x1: 57, y0: 0, y1: 2, dmg: 99, instance: w.newInstance() });
  assert(w.mission.stats.interactions === n, 'Fixture cooldown prevents repeated stun activations');
}
{
  const { w, p } = setup('nova'); w.updateEncounters = () => {}; w.enemies = [];
  position(p, 53, 0); p.aimX = 1; p.aimY = 0;
  for (let i = 0; i < 3; i++) { w.fireShot(p, 0); safeTicks(w, 12); }
  assert(object(w, 'concourse-power').state === 'cooldown', 'Real projectile sweeps activate power fixtures');
}
{
  const { w, p } = setup('echo'); w.updateEncounters = () => {}; w.enemies = [];
  position(p, 133.5, 11.2); p.aimX = 0.37; p.aimY = 0.93;
  const anchor = object(w, 'spire-anchor');
  assert(w.findLashTarget(p, p.x, p.y + 0.9, p.aimX, p.aimY, 6.5) === anchor, 'The scarf can acquire a real environmental anchor');
  w.lashConnect(p, anchor); safeTicks(w, 5);
  assert(p.state === 'zip' && p.y > 11.2, 'An anchor traverses through production zip movement');
}
{
  const { w, p } = setup('fix'); w.updateEncounters = () => {}; w.enemies = [];
  const q = w.addPlayer('ally', 'nova'); q.hp -= 20; w.heal(q, 10, p);
  w.emit('perfectGuard', { p: q, x: 0, y: 0 });
  assert(w.mission.stats.healing === 10 && w.mission.stats.blocks === 1 && w.mission.stats.perPlayer[0].healing === 10, 'Mission results record healing and defense contributions separately from damage');
}
{
  const { w, p } = setup('fix'); w.arena.state = 'cleared';
  // Stage arrival at the control room; leave its actual encounter and gate logic intact.
  for (const s of w.encounters) if (s.def.id === 'patrol' || s.def.id === 'yard') s.state = 'cleared';
  w.towerSpawned = true; w.enemies = [];
  position(p, 263, 18.6); w.step({});
  const room = w.encounters.find(s => s.def.id === 'relay');
  assert(room.state === 'active' && GATES.L2 && GATES.R2 && w.enemies.some(e => e.enc === 'relay'), 'Mission control room creates real enemy pressure and seals its gates');
  // Suppress enemy decisions to isolate the objective contract, without pre-clearing the room.
  for (const e of w.enemies) { e.state = 'hitstun'; e.st = 0; e.stun = 10000; }
  position(p, 270.6, 18.6); w.interact(p); safeTicks(w, 47);
  assert(room.state === 'active' && GATES.R2, 'One restored control does not open the relay gate');
  position(p, 289.1, 18.6); w.interact(p); safeTicks(w, 48);
  assert(room.state === 'cleared' && !GATES.L2 && !GATES.R2 && w.enemies.filter(e => e.enc === 'relay').every(e => e.dead), 'Both controls power down remaining security and open the exit without a kill-all requirement');
  position(p, 302, 18.6); w.step({});
  assert(w.encounters.find(s => s.def.id === 'beacon').state === 'active' && w.enemies.some(e => e.boss && !e.dead), 'Restored controls unlock the real Stormcaller encounter');
}

// Geometry-only traversal uses the real movement simulation and normal health/physics.
// Combat is separately exercised by the existing combat/boss suites; this checks solo route access.
for (const char of ['nova', 'echo', 'ram', 'fix']) {
  const { w, p } = setup(char); w.updateEncounters = () => {}; w.enemies = [];
  let held = {}, jumpHold = 0, doubled = false, falls = 0, ticks = 0;
  for (; ticks < 8000 && p.x < 305; ticks++) {
    const wall = pointInSolid(p.x + 0.9, p.y + 0.4) || pointInSolid(p.x + 0.9, p.y + 1.4);
    const gap = p.onGround && groundBelow(p.x + 1.1, p.y + 0.2) < p.y - 0.5;
    if (p.onGround) { doubled = false; if ((wall || gap) && jumpHold === 0) jumpHold = 18; }
    else if (p.wallDir && jumpHold === 0) jumpHold = 18;
    else if (!doubled && jumpHold === 0 && p.vy < 2 && (wall || groundBelow(p.x + 1.5, p.y) < p.y - 3)) { doubled = true; jumpHold = 14; }
    const next = { jump: jumpHold > 1 }; if (jumpHold > 0) jumpHold--;
    const duck = ((p.x > 27 && p.x < 30.2) || (p.x > 42 && p.x < 50.4)) && p.y < 1;
    const frame = cmd(next, { mx: 1, my: duck ? -1 : 0 }); frame.pressed.jump = next.jump && !held.jump; frame.released.jump = !next.jump && !!held.jump;
    w.step({ 0: frame }); held = next; falls += w.events.filter(e => e.type === 'recall').length; w.events.length = 0;
  }
  assert(p.x >= 305 && falls === 0, `${char} traverses the entire mission geometry with default movement and no falls (x=${p.x.toFixed(1)}, ticks=${ticks})`);
}
