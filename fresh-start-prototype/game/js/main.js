// Bootstrap: fixed 60 Hz simulation, interpolated rendering, drop-in joining, menus.
import { SETTINGS, loadSettings, DT, ROSTER, nextChar } from './config.js';
import { Input } from './input.js';
import { World } from './world.js';
import { View } from './render.js';
import { AstraUI as UI } from './astraUI.js';
import { Sound } from './audio.js';
import { Music } from './music.js';
import { Haptics } from './haptics.js';

loadSettings();
const app = document.getElementById('app');
const canvas = document.getElementById('game');
const input = new Input(canvas);
const world = new World();
const view = new View(canvas);
const sound = new Sound();
const music = new Music();
const haptics = new Haptics(input);
let started = false, paused = false;

const ui = new UI(document.getElementById('overlay'), {
  start: (mode, char, device) => startGame(mode, char, device),
  settings: () => setPaused(true),
  restart: () => startGame('mission'),
  title: () => showTitle(),
  helpChanged: on => { if (on) clearMenuActions(); else { input.swallowAll(); if (started && !paused && !ui.resultsOpen) canvas.focus(); } },
  resume: () => setPaused(false),
  zone: id => { if (!started) startGame('training'); else world.startTraining(); world.teleport(id); setPaused(false); },
  boss: id => { if (!started) startGame('training'); else world.startTraining(); world.bossRush(id); setPaused(false); },
  pick: (p, c) => world.swapCharacter(p, c),
  remove: p => { sound.jet(p, false); world.removePlayer(p.slot); },
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

function startGame(mode = 'mission', char, device = 'kbm') {
  if (!world.players.length) world.addPlayer(device, char || ui.selectedChar || 'nova');
  else if (char) world.swapCharacter(world.players[0], char);
  if (mode === 'training') world.startTraining(); else world.startMission();
  started = true; ui.completedMission = null; ui.hideStart(); ui.toggleHelp(false); setPaused(false);
  view.hitPause = 0; acc = 0;
}
function showTitle() {
  for (const p of [...world.players]) { sound.jet(p, false); world.removePlayer(p.slot); }
  world.startTraining(); started = false; ui.toggleHelp(false); setPaused(false); ui.showStart(); input.swallowAll();
}

function tryJoin() {
  const devices = input.pollJoins(new Set(world.players.map(p => p.device)));
  if (!started) { if (input.gamepadBlocked) ui.gamepadNotice(true); return; }
  for (const dev of devices) {
    if (world.players.length >= 4 || paused || ui.helpOpen || ui.resultsOpen) break;
    // Each new player takes the next character no one is playing yet (Nova, Echo, RAM, Fix)
    const used = new Set(world.players.map(p => p.char)), char = ROSTER.find(c => !used.has(c)) || ROSTER[world.players.length % ROSTER.length];
    world.addPlayer(dev, char);
  }
  if (!started && input.gamepadBlocked) ui.gamepadNotice(true);
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
  }
}

function stepSim() {
  let cmds = {};
  for (const p of world.players) {
    cmds[p.slot] = input.sample(p.device, (mx, my) => view.aimFromMouse(mx, my, p), SETTINGS.p1Aim);
  }
  if (window.__NS.inject) cmds = window.__NS.inject(world.tick, cmds) || cmds;
  world.step(cmds);
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
    if (view.hitPause > 0) { view.hitPause -= dt; acc = 0; }   // an impact frame's hit-pause holds the world still
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
  world, view, ui, input, music, sound, haptics, SETTINGS, manual: false, inject: null,
  start(char = 'nova', mode = 'mission') { startGame(mode, char); },
  title: showTitle,
  step(n = 1) { for (let i = 0; i < n; i++) stepSim(); },
  stats() { return { fps, players: world.players.length, enemies: world.enemies.length, tick: world.tick }; },
};
