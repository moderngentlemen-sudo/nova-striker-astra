// Authored mission progression and interaction rules. Pure simulation data: no DOM or renderer.
import { BOXES, ROUTES, GATES, rayBoxT, segmentBlocked, setMissionGeometry } from './level.js';
import { DT } from './config.js';
import { hitEnemy } from './combat.js';

const OBJECTS = [
  { id: 'arrival-launch', type: 'launch', x: 30.8, y: 0, w: 1.8, h: 0.2, state: 'ready', label: 'Launch pad', vx: 8, vy: 28, optional: true },
  { id: 'concourse-panel', type: 'breach', x: 51, y: 0, w: 0.7, h: 2.5, state: 'closed', label: 'Breach panel', hp: 12, maxHp: 12, gate: 'ASTRA_BREACH', optional: true },
  { id: 'concourse-power', type: 'power', x: 56, y: 0, w: 0.9, h: 1.8, state: 'idle', label: 'Power fixture', charge: 0, maxCharge: 3, optional: true },
  { id: 'spire-repair', type: 'repair', x: 110.5, y: 0, w: 1.15, h: 1.4, state: 'offline', label: 'Repair launch circuit', charge: 0, maxCharge: 1, optional: true },
  { id: 'spire-launch', type: 'launch', x: 116, y: 2.5, w: 1.8, h: 0.2, state: 'disabled', label: 'Spire launch pad', vx: 9, vy: 38, optional: true },
  { id: 'spire-anchor', type: 'anchor', x: 135, y: 15, w: 0.6, h: 0.6, state: 'ready', label: 'Scarf anchor', kind: 'anchor', optional: true },
  { id: 'spire-high-launch', type: 'launch', x: 140.5, y: 13.8, w: 1.6, h: 0.2, state: 'ready', label: 'Skyline launch pad', vx: 8, vy: 21, optional: true },
  { id: 'yard-power', type: 'power', x: 235, y: 12.6, w: 0.9, h: 1.8, state: 'idle', label: 'Power fixture', charge: 0, maxCharge: 3, optional: true },
  { id: 'relay-west', type: 'relay', x: 270.9, y: 18.6, w: 1.15, h: 1.7, state: 'offline', label: 'West relay control', charge: 0, maxCharge: 1 },
  { id: 'relay-east', type: 'relay', x: 290, y: 18.6, w: 1.15, h: 1.7, state: 'offline', label: 'East relay control', charge: 0, maxCharge: 1 },
  { id: 'city-beacon', type: 'relay', x: 306.5, y: 18.6, w: 1.6, h: 2.4, state: 'locked', label: 'Restore the Skyline Relay', charge: 0, maxCharge: 1 },
];
const STAGES = [
  ['arrival', 'Reach the concourse', 'Move, jump across the gap, then use a dash. The city relay is offline.'],
  ['breach', 'Open a path through the concourse', 'Strike the striped panel, jump over it, or press Interact beside it. Charge the power fixture to stun nearby machines.'],
  ['lockwarden', 'Break the Concourse Lock', 'Flank shielded machines. Bait the Lockwarden into solid walls, then strike during its recovery.'],
  ['spire', 'Climb the Storm Spire', 'Repair the launch circuit for a shortcut, or use the platforms and wall jumps. Every hero can take the main route.'],
  ['skyline', 'Cross the skyline to the relay controls', 'Use cover against mortars. Hit a power fixture or throw an enemy into it to open a safe approach.'],
  ['restore', 'Restore both relay controls', 'Press Interact near either control and stay close while it reconnects. Damage interrupts the connection.'],
  ['stormcaller', 'Bring down the Stormcaller', 'Watch its attack lanes. Evade the dive, then punish the exposed crash window.'],
  ['beacon', 'Restart the city relay', 'Press Interact at the beacon. Bring the city back online.'],
  ['complete', 'Skyline relay restored', 'Transit is moving again. Replay with a different hero or explore the training room.'],
];
const freshStats = () => ({ elapsedTicks: 0, elapsedSeconds: 0, score: 0, kills: 0, damageDealt: 0, damageTaken: 0,
  deaths: 0, retries: 0, revives: 0, blocks: 0, healing: 0, interactions: 0, optionalRoutes: 0, perPlayer: {} });
const snapshot = world => world.interactables.map(o => ({ id: o.id, state: o.state === 'connecting' ? 'offline' : o.state,
  hp: o.hp, charge: o.state === 'connecting' ? 0 : o.charge, discovered: !!o.discovered }));
const environmentSnapshot = world => ({
  boxes: BOXES.filter(b => b.type === 'd').map(b => ({ id: b.id, hp: b.hp, broken: b.broken })),
  pickups: world.pickups.filter(k => k.level && !k.dead).map(k => ({ kind: k.kind, x: k.x, y: k.y, vx: k.vx, vy: k.vy, rest: k.rest, life: k.life, t: k.t })),
});
const tracked = m => m && (m.mode === 'mission' || m.mode === 'route');
const score = m => Math.max(0, Math.round(m.stats.kills * 100 + m.stats.optionalRoutes * 250 + m.securedInteractions.length * 25 + m.stats.revives * 200 + m.stats.blocks * 10 + m.stats.healing * 2 - m.stats.retries * 100));
const alive = p => p && p.state !== 'downed' && p.state !== 'dead';
const box = o => ({ x0: o.x - o.w / 2, x1: o.x + o.w / 2, y0: o.y, y1: o.y + o.h });
const overlaps = (a, b) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
const near = (p, o, r = 2.7) => Math.hypot(p.x - o.x, p.y + p.h * 0.5 - (o.y + o.h * 0.5)) <= r;

export function initializeMission(world, mode = 'training', routeId = 'skyport') {
  setMissionGeometry(mode === 'mission');
  world.interactables = mode === 'mission' ? OBJECTS.map(o => ({ charge: 0, maxCharge: 1, active: false, ...o })) : [];
  world._interactionHits = new Map();
  const route = ROUTES.find(r => r.id === routeId) || ROUTES[0];
  world.mission = { mode, routeId: route.id, title: mode === 'route' ? route.name : mode === 'mission' ? 'Restore the Skyline Relay' : 'Movement & Combat Training',
    objective: mode === 'mission' ? STAGES[0][1] : 'Practice any hero at your own pace',
    hint: mode === 'mission' ? STAGES[0][2] : 'Use the controls guide to practice moves and character combinations.',
    stage: mode === 'mission' ? 'arrival' : 'training', stageIndex: 0, completed: false, startedTick: world.tick,
    maxX: 0, stats: freshStats(), discoveries: [], securedInteractions: [], onboarding: { move: false, jump: false, dash: false, attack: false, defend: false, interact: false },
    restoration: { concourse: false, spire: false, relay: false, city: false }, nearby: null, checkpointState: [] };
  world.mission.checkpointState = snapshot(world);
  world.mission.environmentCheckpoint = environmentSnapshot(world);
  if (mode === 'route') updateRoute(world);
}

function playerStats(world, p) {
  if (!p || p.kind !== 'player') return null;
  return world.mission.stats.perPlayer[p.slot] ||= { char: p.char, kills: 0, damageDealt: 0, damageTaken: 0, healing: 0, revives: 0, blocks: 0, interactions: 0 };
}
export function recordMissionEvent(world, type, ev) {
  const m = world.mission;
  if (!tracked(m) || m.completed) return;
  const s = m.stats, ps = playerStats(world, ev.p || ev.owner || ev.by);
  if (type === 'hit' && ev.owner?.kind === 'player') { s.damageDealt += ev.dmg || 0; if (ps) ps.damageDealt += ev.dmg || 0; m.onboarding.attack = true; }
  if (type === 'kill' && ev.e?.type !== 'post' && ev.e?.type !== 'turret') { s.kills++; if (ps) ps.kills++; }
  if (type === 'playerHit') { s.damageTaken += ev.dmg || 0; if (ps) ps.damageTaken += ev.dmg || 0; }
  if (type === 'downed') s.deaths++;
  if (type === 'revived' && ev.by) { s.revives++; const by = playerStats(world, ev.by); by.revives++; }
  if (['guardBlock', 'perfectGuard', 'parry', 'aegisHit', 'perfectDodge'].includes(type)) { s.blocks++; if (ps) ps.blocks++; m.onboarding.defend = true; }
  if (['jump', 'djump', 'walljump'].includes(type)) m.onboarding.jump = true;
  if (['dash', 'rushStart', 'slide'].includes(type)) m.onboarding.dash = true;
  if (type === 'checkpoint') {
    m.checkpointState = snapshot(world);
    m.environmentCheckpoint = environmentSnapshot(world);
    for (const p of world.players) if (alive(p)) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
  }
  if (type === 'snipe') hitMissionSegment(world, ev.p, ev.x0, ev.y0, ev.x1, ev.y1, ev.full ? 5 : 2, ev.full, `snipe:${world.newInstance()}`);
}
export function recordMissionHealing(world, p, amount) {
  if (!tracked(world.mission) || world.mission.completed || amount <= 0) return;
  world.mission.stats.healing += amount;
  const ps = playerStats(world, p); if (ps) ps.healing += amount;
}
export function restoreMissionCheckpoint(world) {
  const m = world.mission; if (!tracked(m) || m.completed) return;
  m.stats.retries++;
  // Restore the committed environment, including loot still present at the checkpoint.
  // A consumed pickup stays consumed; a crate broken after the checkpoint becomes intact again.
  if (m.environmentCheckpoint) {
    for (const saved of m.environmentCheckpoint.boxes) {
      const b = BOXES.find(b => b.type === 'd' && b.id === saved.id);
      if (b) { b.hp = saved.hp; b.broken = saved.broken; b.hitT = -1e9; }
    }
    world.pickups = world.pickups.filter(k => !k.level);
    for (const saved of m.environmentCheckpoint.pickups) {
      const k = world.addLevelPickup(saved.x, saved.y, saved.kind, saved.rest, saved.vy);
      Object.assign(k, saved);
    }
  }
  for (const o of world.interactables) {
    const saved = m.checkpointState.find(s => s.id === o.id);
    if (saved) Object.assign(o, saved);
    o.operator = null; o.active = false; o.cooldown = 0; o.hitT = 0;
    if (o.type === 'power') { o.state = 'idle'; o.charge = 0; }
    if (o.gate) GATES[o.gate] = o.state !== 'open';
  }
  world._interactionHits.clear();
  for (const p of world.players) { p.missionPadCd = 0; p.missionPrompt = ''; }
  if (m.mode === 'mission') syncRestoration(world);
}

function discover(world, o) {
  if (!o.optional || world.mission.discoveries.includes(o.id)) return;
  o.discovered = true; world.mission.discoveries.push(o.id); world.mission.stats.optionalRoutes++;
}
function awardInteraction(world, p, o) {
  world.mission.stats.interactions++; const ps = playerStats(world, p); if (ps) ps.interactions++;
  world.mission.onboarding.interact = true;
  if (!world.mission.securedInteractions.includes(o.id)) world.mission.securedInteractions.push(o.id);
  discover(world, o);
}
function activate(world, p, o) {
  o.active = true; o.hitT = 24; o.operator = null;
  if (o.type === 'breach') { o.state = 'open'; o.hp = 0; if (o.gate) GATES[o.gate] = false; }
  if (o.type === 'power') {
    o.state = 'cooldown'; o.cooldown = 240; o.charge = o.maxCharge;
    for (const e of world.enemies) {
      if (e.dead || e.boss || Math.hypot(e.x - o.x, e.y + e.h / 2 - (o.y + 0.8)) > 4.5) continue;
      hitEnemy(world, e, { owner: p, dmg: 3, poise: 80, kb: [Math.sign(e.x - o.x) * 4, 3], shock: true, stun: 65 }, 'blast');
      if (!e.dead) { world.director.release(e); e.state = 'hitstun'; e.st = 0; e.stun = 65; }
    }
  }
  if (o.type === 'repair' || o.type === 'relay') {
    o.state = 'restored'; o.charge = 1; o.operator = null;
    if (o.id === 'spire-repair') world.interactables.find(q => q.id === 'spire-launch').state = 'ready';
  }
  awardInteraction(world, p, o);
  world.emit('interactionActivated', { p, obj: o, x: o.x, y: o.y + o.h / 2 });
  syncRestoration(world);
  if (o.id === 'city-beacon') completeMission(world);
}

function hitObject(world, o, owner, damage, heavy, key) {
  if (!owner || !['breach', 'power'].includes(o.type) || ['open', 'cooldown'].includes(o.state)) return false;
  let seen = world._interactionHits.get(o.id); if (!seen) world._interactionHits.set(o.id, seen = new Set());
  if (seen.has(key)) return false;
  seen.add(key); if (seen.size > 256) seen.delete(seen.values().next().value);
  o.hitT = 10; world.mission.onboarding.attack = true;
  if (o.type === 'breach') {
    o.hp = Math.max(0, o.hp - (heavy ? Math.max(6, damage) : Math.max(1, Math.min(3, damage))));
    o.state = o.hp <= 0 ? 'open' : 'cracked'; o.charge = 1 - o.hp / o.maxHp;
    if (o.hp <= 0) activate(world, owner, o);
  } else { o.charge = Math.min(o.maxCharge, o.charge + (heavy ? 2 : 1)); o.state = 'charged'; if (o.charge >= o.maxCharge) activate(world, owner, o); }
  world.emit('interactionHit', { p: owner, obj: o, x: o.x, y: o.y + o.h / 2, heavy });
  return true;
}
export function hitMissionBox(world, hb) {
  if (world.mission?.mode !== 'mission' || hb.team !== 'p' || !hb.owner) return;
  for (const o of world.interactables) if (overlaps(hb, box(o)))
    hitObject(world, o, hb.owner, hb.dmg || 1, !!(hb.heavy || hb.armorBreak || hb.vbTier || hb.ram), `hit:${hb.instance}`);
}
export function hitMissionSegment(world, owner, x0, y0, x1, y1, damage, heavy, key) {
  if (world.mission?.mode !== 'mission') return;
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  for (const o of world.interactables) {
    if (!['breach', 'power'].includes(o.type)) continue;
    const b = box(o), h = rayBoxT(x0, y0, len ? dx / len : 1, len ? dy / len : 0, b.x0 - 0.15, b.y0 - 0.15, b.x1 + 0.15, b.y1 + 0.15);
    if ((h && h.t <= len + 0.15) || overlaps({ x0, x1: x0, y0, y1: y0 }, b)) hitObject(world, o, owner, damage, heavy, key);
  }
}
export function hitMissionBlast(world, owner, x, y, spec) {
  if (world.mission?.mode !== 'mission' || !owner) return;
  const key = `blast:${world.newInstance()}`;
  for (const o of world.interactables) if (Math.hypot(x - o.x, y - (o.y + o.h / 2)) <= spec.r + o.w / 2)
    hitObject(world, o, owner, spec.dmg || 1, !!spec.armorBreak, key);
}

export function interactMission(world, p) {
  if (!alive(p) || !['normal', 'guard', 'patch', 'slide'].includes(p.state) || world.mission?.mode !== 'mission' || world.mission.completed) return false;
  const choices = world.interactables.filter(o => !['open', 'restored', 'locked', 'disabled', 'cooldown'].includes(o.state)
    && (o.type !== 'anchor' || p.char === 'echo') && near(p, o, o.type === 'anchor' ? 7 : 2.7));
  choices.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  const o = choices[0]; if (!o) return false;
  if (o.type === 'launch') return launchPlayer(world, p, o);
  if (o.type === 'anchor') return useAnchor(world, p, o);
  if (o.type === 'power') return hitObject(world, o, p, 1, false, `interact:${world.newInstance()}`);
  if (o.operator && o.operator !== p) return false;
  o.operator = p; o.startHp = p.hp; o.state = 'connecting'; o.charge = 0; o.active = true;
  world.mission.onboarding.interact = true;
  world.emit('interactionStart', { p, obj: o, x: o.x, y: o.y });
  return true;
}

export function useAnchor(world, p, o) {
  if (!alive(p) || p.char !== 'echo' || o.type !== 'anchor' || !near(p, o, 8) || segmentBlocked(p.x, p.y + p.h / 2, o.x, o.y)) return false;
  p.zip = { target: o }; p.state = 'zip'; p.st = 0; p.onGround = false; p.airDashes = 1; p.airRise = true;
  o.state = 'active'; o.cooldown = 40; awardInteraction(world, p, o);
  world.emit('lashZip', { p, e: o }); world.emit('interactionActivated', { p, obj: o, x: o.x, y: o.y });
  return true;
}
function launchPlayer(world, p, o) {
  if (!alive(p) || o.state === 'disabled' || (p.missionPadCd || 0) > 0 || ['ult', 'hitstun', 'pound'].includes(p.state)) return false;
  p.vx = o.vx; p.vy = o.vy; p.onGround = false; p.coyote = 0; p.state = 'normal'; p.st = 0;
  p.jumpsUsed = 0; p.airDashes = 1; p.airRise = true; p.airDodge = true; p.dashCarry = true; p.launchedT = 55; p.missionPadCd = 45;
  o.state = 'active'; o.cooldown = 18; awardInteraction(world, p, o);
  world.emit('interactionLaunch', { p, obj: o, x: o.x, y: o.y });
  return true;
}
function syncRestoration(world) {
  const m = world.mission, get = id => world.interactables.find(o => o.id === id)?.state === 'restored';
  m.restoration.concourse = world.arena.state === 'cleared';
  m.restoration.spire = get('spire-repair'); m.restoration.relay = get('relay-west') && get('relay-east');
  m.restoration.city = get('city-beacon');
}
export function relayControlsRestored(world) { return !!world.mission?.restoration.relay; }

export function updateMission(world, cmds = {}, beforePhysics = false) {
  const m = world.mission; if (!tracked(m) || m.completed) return;
  if (m.mode === 'route') { if (!beforePhysics) updateRoute(world); return; }
  if (beforePhysics) {
    for (const pr of world.projectiles) {
      if (pr.team !== 'p' || pr.dead || pr.stuck || !(pr.dmg > 0)) continue;
      pr.missionId ||= world.newInstance();
      hitMissionSegment(world, pr.owner, pr.x, pr.y, pr.x + pr.vx * DT, pr.y + pr.vy * DT, pr.dmg, !!(pr.armorBreak || pr.level >= 2), `proj:${pr.missionId}`);
    }
    return;
  }
  m.stats.elapsedTicks = world.tick - m.startedTick; m.stats.elapsedSeconds = Math.floor(m.stats.elapsedTicks / 60);
  for (const p of world.players) {
    if (p.missionPadCd > 0) p.missionPadCd--;
    const cmd = cmds[p.slot]; if (cmd && Math.abs(cmd.mx) > 0.2) m.onboarding.move = true;
    if (alive(p)) m.maxX = Math.max(m.maxX, p.x);
  }
  for (const o of world.interactables) {
    if (o.hitT > 0) o.hitT--;
    if (o.cooldown > 0 && --o.cooldown === 0) { o.state = o.type === 'power' ? 'idle' : 'ready'; o.active = false; o.charge = 0; }
    if (o.operator) {
      const p = o.operator;
      if (!world.players.includes(p) || !alive(p) || !near(p, o) || p.state === 'hitstun' || p.hp < o.startHp) {
        o.operator = null; o.state = o.type === 'breach' ? 'cracked' : 'offline'; o.charge = 0; o.active = false;
      } else {
        o.charge = Math.min(1, o.charge + 1 / (o.type === 'breach' ? 100 : p.char === 'fix' ? 45 : 90));
        if (o.charge >= 1 - 1e-8) activate(world, p, o);
      }
    }
    if (o.type === 'launch' && o.state !== 'disabled') for (const p of world.players)
      if (alive(p) && Math.abs(p.x - o.x) < o.w / 2 + p.w / 2 && Math.abs(p.y - o.y) < 0.28 && p.vy <= 0.1) launchPlayer(world, p, o);
    if (o.type === 'power' && o.state !== 'cooldown') for (const e of world.enemies)
      if (!e.dead && e.missionThrownUntil > world.tick && overlaps(box(o), { x0: Math.min(e.prevX, e.x) - e.w / 2, x1: Math.max(e.prevX, e.x) + e.w / 2, y0: e.y, y1: e.y + e.h })) {
        o.charge = o.maxCharge; activate(world, e.missionThrower, o); break;
      }
  }
  if (m.completed) return;
  syncRestoration(world);
  const boss = world.encounters.find(s => s.def.id === 'beacon'), bossDown = boss?.state === 'cleared';
  const beacon = world.interactables.find(o => o.id === 'city-beacon');
  if (beacon?.state === 'locked' && bossDown && m.restoration.relay && world.arena.state === 'cleared') beacon.state = 'offline';
  let stage = m.maxX < 18 ? 0 : m.maxX < 61 ? 1 : world.arena.state !== 'cleared' ? 2 : m.maxX < 163 ? 3 : m.maxX < 260 ? 4 : !m.restoration.relay ? 5 : !bossDown ? 6 : 7;
  if (m.stageIndex !== stage) { m.stageIndex = stage; m.stage = STAGES[stage][0]; world.emit('missionStage', { stage: m.stage, title: STAGES[stage][1] }); }
  m.objective = STAGES[stage][1]; m.hint = STAGES[stage][2];
  if (stage === 1 && m.maxX < 43) m.hint = 'Use the launch pad to reach the upper walk. Crouch under low passages; jump again in the air or against a wall to climb.';
  const p = world.players[0], nearby = p && world.interactables.find(o => !['open', 'restored', 'disabled', 'locked', 'cooldown'].includes(o.state) && near(p, o) && (o.type !== 'anchor' || p.char === 'echo'));
  m.nearby = nearby ? { id: nearby.id, label: nearby.label, type: nearby.type, charge: nearby.charge, state: nearby.state } : null;
  m.stats.score = score(m);
}
function updateRoute(world) {
  const m = world.mission, route = ROUTES.find(r => r.id === m.routeId);
  const encounters = world.encounters.filter(s => s.def.route === route.id);
  const cleared = encounters.filter(s => s.state === 'cleared').length;
  const active = encounters.find(s => s.state === 'active'), next = encounters.find(s => s.state !== 'cleared');
  m.stats.elapsedTicks = world.tick - m.startedTick; m.stats.elapsedSeconds = Math.floor(m.stats.elapsedTicks / 60);
  m.stats.score = score(m); m.stageIndex = cleared;
  m.stage = active ? 'combat' : next ? 'advance' : 'exit';
  m.objective = active ? `Clear ${active.def.banner[0]}` : next ? `Reach ${next.def.banner[0]}` : `Reach the end of ${route.name}`;
  m.hint = `${cleared} / ${encounters.length} encounters cleared. ${route.id === 'foundry' ? 'Use the lift pads to climb the reactor. Heavy hits break pillars and barricades.' : 'Follow the descent into the transit line. Break crates for supplies and use cover in the final plaza.'}`;
  m.nearby = null;
  if (!world.routesDone[route.id]) return;
  m.completed = true; m.stage = 'complete'; m.stageIndex = encounters.length; m.completedTick = world.tick;
  m.objective = `${route.name} cleared`; m.hint = 'Replay with another hero or try a different route.';
  m.stats.score += 1500;
  world.emit('missionComplete', { mission: m, stats: { ...m.stats }, x: route.endX, y: world.players[0]?.y || 0 });
}
function completeMission(world) {
  const m = world.mission; if (m.completed) return;
  m.completed = true; m.stageIndex = 8; m.stage = 'complete'; m.objective = STAGES[8][1]; m.hint = STAGES[8][2];
  m.restoration.city = true; world.routeDone = true; world.routesDone.skyport = true; m.completedTick = world.tick; m.stats.score = score(m) + 1500;
  world.emit('missionComplete', { mission: m, stats: { ...m.stats }, x: 306.5, y: 21 });
  world.emit('banner', { text: 'Skyline relay restored', sub: 'Transit online. The city is moving again.' });
}
