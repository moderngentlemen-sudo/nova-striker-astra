// Bootstrap: fixed 60 Hz simulation, interpolated rendering, drop-in joining, menus.
import { SETTINGS, loadSettings, saveSettings, DT, ROSTER, nextChar, PLAYER_COLORS } from './config.js';
import { Input } from './input.js';
import { World } from './world.js';
import { View } from './render.js';
import { AstraUI as UI } from './astraUI.js';
import { Sound } from './audio.js';
import { Music } from './music.js';
import { Haptics } from './haptics.js';
import { Bots, isBot, ORDERS } from './bot.js';

loadSettings();
const app = document.getElementById('app');
const canvas = document.getElementById('game');
const input = new Input(canvas);
const world = new World();
const view = new View(canvas);
const sound = new Sound();
const music = new Music();
const haptics = new Haptics(input);
const bots = new Bots();
let started = false, paused = false;

const ui = new UI(document.getElementById('overlay'), {
  start: (mode, char, device) => startGame(mode, char, device),
  settings: () => setPaused(true),
  settingChanged: key => { if (started && key === 'aiTeammates') { bots.sync(world, Number(SETTINGS.aiTeammates) || 0); if (paused) ui.renderPlayerList(world); } },
  restart: () => startGame(world.mission.mode === 'route' ? world.mission.routeId : world.mission.mode),
  title: () => showTitle(),
  helpChanged: on => { if (on) clearMenuActions(); else { input.swallowAll(); if (started && !paused && !ui.resultsOpen) canvas.focus(); } },
  resume: () => setPaused(false),
  zone: id => { if (['foundry','undercity'].includes(id)) startGame(id); else { startGame('training'); world.teleport(id); } },
  boss: id => { startGame('training'); world.bossRush(id); },
  pick: (p, c) => world.swapCharacter(p, c),
  remove: p => {
    // removing an AI teammate turns the setting down by one, so it isn't simply added back
    if (isBot(p)) { SETTINGS.aiTeammates = Math.max(0, world.players.filter(isBot).length - 1); saveSettings(); }
    sound.jet(p, false); world.removePlayer(p.slot); input.resetDevice(p.device);
  },
});

input.setMenuActive(() => !started || paused || ui.helpOpen || ui.resultsOpen);
ui.start.querySelector('.deploy').focus();

function resize() {
  const r = app.getBoundingClientRect();
  view.resize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)), world);
}
new ResizeObserver(resize).observe(app);
resize();

function clearMenuActions() {
  input.swallowAll();
  for (const p of world.players) {
    for (const k of Object.keys(p.buf || {})) p.buf[k] = 99;
    p.chargeT = 0; p.burstT = 0; p.rifleT = 0; p.meleeHeldT = 0; p.meleeCharged = false; p.subArmed = false; p.tossArmed = false; p.queued = null; p.chordP = 99; p.chordF = 99;
    if (p.state === 'pound' && p.pound?.phase === 'hold') { p.state = 'normal'; p.st = 0; p.pound = null; }
    if (p.state === 'dashCharge') { p.state = 'normal'; p.st = 0; p.dashChargeT = 0; }
  }
}
function setPaused(on) { if(on)clearMenuActions(); paused = on; ui.setPaused(on, world); if (!on) { if (started) canvas.focus(); else ui.start.querySelector('.deploy').focus(); input.swallowAll(); } }

function startGame(mode = 'mission', char, device) {
  if (!world.players.length) world.addPlayer(device || ui.menuDevice || 'kbm', char || ui.selectedChar || 'nova');
  else if (char) world.swapCharacter(world.players[0], char);
  bots.sync(world, Number(SETTINGS.aiTeammates) || 0);
  if (mode === 'training') world.startTraining(); else if (['foundry','undercity'].includes(mode)) world.startRoute(mode); else world.startMission();
  bots.reset(); ui.setOrder(null); ui.clearSessionPresentation();
  started = true; ui.completedMission = null; ui.hideStart(); ui.toggleHelp(false); setPaused(false);
  view.hitPause = 0; acc = 0;
}
function showTitle() {
  for (const p of [...world.players]) { sound.jet(p, false); world.removePlayer(p.slot); }
  bots.reset(); ui.setOrder(null); ui.clearSessionPresentation();
  world.startTraining(); started = false; ui.toggleHelp(false); setPaused(false); ui.showStart(); input.swallowAll();
}

function tryJoin() {
  const devices = input.pollJoins(new Set(world.players.map(p => p.device)));
  if (!started) { if (input.gamepadBlocked) ui.gamepadNotice(true); return; }
  for (const dev of devices) {
    if (paused || ui.helpOpen || ui.resultsOpen) break;
    if (world.players.length >= 4 && !bots.makeRoom(world)) break;
    // Each new player takes the next character no one is playing yet (Nova, Echo, RAM, Fix)
    const used = new Set(world.players.map(p => p.char)), char = ROSTER.find(c => !used.has(c)) || ROSTER[world.players.length % ROSTER.length];
    input.resetDevice(dev); // A device changing owners must not inherit queued taps.
    world.addPlayer(dev, char);
  }
  if (!started && input.gamepadBlocked) ui.gamepadNotice(true);
}

// A team command to the AI teammates: they answer, and the HUD shows it while it stands
function giveOrder(p, type) {
  if (p.state === 'dead' || isBot(p)) return;
  const previousOrder = bots.order;
  const answers = bots.issue(world, p, type);
  if (!answers.length) { ui.toast('No AI teammates to command (Settings: AI teammates)'); return; }
  const noTarget = type === 'attack' && (!bots.order || bots.order === previousOrder);
  ui.toast(noTarget ? 'No target in sight.' : bots.order ? `P${p.slot + 1}: ${ORDERS.names[type]}` : `P${p.slot + 1}: back to following`);
  const revision = world.sessionRevision;
  answers.forEach(([b, line], i) => setTimeout(() => { if (SETTINGS.barks && started && world.sessionRevision === revision && world.players.includes(b)) ui.bark(b, line); }, 150 + i * 350));
  if (bots.order && !noTarget) view.fx.groundRing(p.x, p.y, PLAYER_COLORS[p.slot], 0.4, 2.4, 0.5, 0.85);
}

function handleMenuEvents() {
  for (const ev of input.takeMenuEvents()) {
    // The controls screen closes with any controller's B, A, Start or View (H or Esc on the keyboard); the
    // buttons that closed it don't also act in the game
    if (ui.helpOpen) {
      if (['back', 'confirm', 'pause', 'help'].includes(ev.type)) { ui.toggleHelp(false); return; }
      else if (ev.type === 'up' || ev.type === 'down') ui.scrollHelp(ev.type === 'down' ? 1 : -1);   // the D-pad scrolls it
      return;
    }
    if (paused || ui.resultsOpen) {
      if (ev.type === 'pause' && !ui.resultsOpen) setPaused(false);
      else if(ev.type === 'help') ui.toggleHelp(true);
      else ui.menuNav(ev);
      return;
    }
    if (!started) { ui.titleNav(ev); return; }
    const p = world.players.find(q => q.device === ev.dev);
    if (!started || (!p && !['help','pause'].includes(ev.type))) continue;
    if (ev.type === 'pause') { setPaused(!paused); return; }
    else if (ev.type === 'help') { ui.toggleHelp(); return; }
    else if (ev.type === 'debug') ui.toggleDebug();
    else if (ev.type === 'swap') world.swapCharacter(p, nextChar(p.char, ev.dir || 1));
    else if (ev.type === 'pick') world.swapCharacter(p, ev.char);
    else if (ev.type === 'order') giveOrder(p, ev.order);
  }
}

function stepSim() {
  bots.sync(world, Number(SETTINGS.aiTeammates) || 0);
  let cmds = {};
  for (const p of world.players) {
    if (isBot(p)) continue;
    cmds[p.slot] = input.sample(p.device, (mx, my) => view.aimFromMouse(mx, my, p), SETTINGS.p1Aim);
  }
  bots.commands(world, cmds);
  // The command in force: on the HUD, a marker where they hold, and a word when an attack order's target falls
  const O = bots.order;
  ui.setOrder(O && world.players.includes(O.by) ? { name: ORDERS.names[O.type], slot: O.by.slot } : null);
  if (O && O.type === 'hold' && world.tick % 50 === 0) view.fx.groundRing(O.x, O.y, PLAYER_COLORS[O.by.slot], 0.5, 1.8, 0.45, 0.6);
  if (SETTINGS.barks && bots.done === world.tick) { const b = world.players.find(isBot); if (b) ui.bark(b, ORDERS.lines[b.char].done); }
  if (window.__NS.inject) cmds = window.__NS.inject(world.tick, cmds) || cmds;
  const inputRevision = world.sessionRevision;
  world.step(cmds);
  if (world.sessionRevision !== inputRevision) input.swallowAll();
  for (const ev of world.events) { view.onEvent(ev); sound.play(ev); ui.onEvent(ev, world); haptics.onEvent(ev); }
  world.events.length = 0;
}

// Browsers only allow audio after a click or key press; the score starts with the first one
const unlockAudio = () => { sound.unlock(); if (sound.ctx) music.start(sound.ctx); };
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

const IDLE = { players: [] };
let acc = 0, last = performance.now(), fps = 60, fpsT = 0, fpsN = 0;
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  fpsT += dt; fpsN++; if (fpsT >= 0.5) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
  input.pollPadMenus();
  handleMenuEvents();
  tryJoin();
  const halted = paused || ui.helpOpen || ui.resultsOpen;
  if (started && !halted && !window.__NS.manual) {
    if (view.hitPause > 0) {
      input.capturePadEdges(world.players.filter(p => !isBot(p)).map(p => p.device));
      view.hitPause -= dt; acc = 0; // Freeze the world while preserving quick controller taps.
    }
    else {
      acc += dt; let steps = 0;
      while (acc >= DT && steps < 5) { stepSim(); acc -= DT; steps++; }
      if (steps === 5) acc = 0;
    }
  }
  music.update(dt, started ? world : null, halted);
  sound.update(started && !halted ? world : IDLE);   // charge hums and wall-slide grind
  if (started && !halted) haptics.update(world);
  try {
    view.render(world, halted ? 1 : Math.min(1, acc / DT), dt);
    ui.update(dt, world, view, fps);
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test hooks (used by automated checks; harmless otherwise)
window.__NS = {
  world, view, ui, input, music, sound, haptics, bots, SETTINGS, manual: false, inject: null,
  order(type, slot = 0) { const p = world.players.find(q => q.slot === slot); if (p) giveOrder(p, type); },
  start(char = 'nova', mode = 'mission') { startGame(mode, char, 'kbm'); },
  title: showTitle,
  step(n = 1) { for (let i = 0; i < n; i++) stepSim(); },
  stats() { return { fps, players: world.players.length, enemies: world.enemies.length, tick: world.tick }; },
};
