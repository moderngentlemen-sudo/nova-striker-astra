// DOM overlays: start screen, HUD, markers, barks, banners, pause/settings, help, debug.
import { SETTINGS, saveSettings, PLAYER_COLORS, PLAYER_MARKS, CHARS, NOVA, ECHO, HUNTER, MARKSMAN, ATTACH_LOOK, DASH_CHARGE } from './config.js';

// Echo's scarf mode chip: every player can read which mode his scarf is in
function scarfChip(p) {
  if (p.scarfMode === 'veil') {
    const txt = p.veiled ? 'Veil · hidden' : p.veilBreakT > 0 ? `Veil · ${Math.ceil(p.veilBreakT / 60)}s` : 'Veil · fading';
    return `<span class="chip veil ${p.veiled ? 'on' : ''}">${txt}</span>`;
  }
  if (p.scarfMode === 'flare') return `<span class="chip flare">Flare${p.targetedBy ? ` · ${p.targetedBy} on you` : ''}</span>`;
  return '<span class="chip tether">Tether</span>';
}
const scarfCharges = p => `<span class="chip">Scarf ${'◆'.repeat(p.lashCharges)}${'◇'.repeat(ECHO.lashCharges - p.lashCharges)}</span>`;
import { vbTier, chargeStage, burstStage } from './player.js';

// Nova, Marksman kit: loaded attachment, charge stage (the Perfect Release window reads "Release!") and Focus
const STAGE = { charging: 'charging', L1: 'Level 1', L2: 'Level 2', perfect: 'Release!', L3: 'Level 3' };
function marksmanChips(p) {
  const A = ATTACH_LOOK[p.attachment], stage = chargeStage(p), bstage = burstStage(p), f = Math.floor(p.focus);
  const fuel = Math.round(p.fuel / MARKSMAN.boost.fuel * 100);
  return `<span class="chip attach" style="color:${A.tint};box-shadow:inset 0 0 0 1px ${A.tint}">${A.name}</span>` +
    (STAGE[stage] ? `<span class="chip ${stage === 'perfect' ? 'perfect' : 'ready'}">${STAGE[stage]}</span>` : '') +
    (STAGE[bstage] ? `<span class="chip ${bstage === 'perfect' ? 'perfect' : 'ready'}">Burst ${STAGE[bstage]}</span>` : '') +
    `<span class="chip focus${f ? ' on' : ''}">Focus ${'◆'.repeat(f)}${'◇'.repeat(MARKSMAN.focus.max - f)}</span>` +
    `<span class="res fuel" title="Light boosters"><i style="width:${fuel}%"></i></span>`;
}

// Chips every character can show: a charging dash, and the lock-on target
const ENEMY_NAMES = { swarmer: 'Swarmer', shield: 'Shieldbearer', sniper: 'Sniper', brute: 'Brute', post: 'Sparring post', turret: 'Turret',
  drone: 'Drone', mortar: 'Mortar', charger: 'Charger' };
function commonChips(p) {
  const C = DASH_CHARGE.charge, t = p.state === 'dashCharge' ? p.dashChargeT : 0, L = t >= C[2] ? 3 : t >= C[1] ? 2 : t >= C[0] ? 1 : 0;
  return (L ? `<span class="chip ${L === 3 ? 'perfect' : 'ready'}">Dash ${L}</span>` : '') +
    (p.lockT ? `<span class="chip lock">◎ ${ENEMY_NAMES[p.lockT.type] || 'Target'}</span>` : '');
}
// Echo's staff-rifle (Hunter kit): shown while it is up or cooling down
function rifleChip(p) {
  const R = HUNTER.rifle;
  if (p.rifleT >= R.mark && p.rifleCd === 0) return '<span class="chip perfect">Mark!</span>';
  if (p.rifleT >= R.raise) return p.rifleCd === 0 ? '<span class="chip ready">Rifle</span>' : `<span class="chip">Rifle ${(p.rifleCd / 60).toFixed(1)}s</span>`;
  return p.rifleCd > 0 ? `<span class="chip">Rifle ${(p.rifleCd / 60).toFixed(1)}s</span>` : '';
}

const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

const SETTING_DEFS = [
  { key: 'novaKit', label: "Nova's kit", opts: [['marksman', 'Marksman: bracer attachments, Recoil Burst, skates'], ['sentinel', 'Sentinel: Pass 1 kit']] },
  { key: 'echoHead', label: "Echo's head (look only)", opts: [['helmet', 'Full helmet, amber visor'], ['mask', 'Survival mask'], ['bare', 'Bare face']] },
  { key: 'echoKit', label: "Echo's kit", opts: [['hunter', 'Hunter: blades, glaive, snares, reel'], ['pursuit', 'Pursuit: Pass 1 kit']] },
  { key: 'echoRanged', label: "Echo's ranged option, Pursuit kit only (Q-A test)", opts: [['A', 'A: Tracer shot only'], ['B', 'B: Bolts + Tracer'], ['C', 'C: No ranged attack']] },
  { key: 'vbStop', label: 'Velocity Break stop', opts: [['hard', 'Hard stop'], ['keep30', 'Keep 30% momentum']] },
  { key: 'vbRefund', label: 'Velocity Break refunds air dash on hit', bool: true },
  { key: 'dashIframes', label: 'Dash invulnerability (A/B test)', bool: true },
  { key: 'impactFrames', label: 'Comic impact frames on big moments (Q-C test)', bool: true },
  { key: 'camera', label: 'Camera projection', opts: [['persp', 'Perspective'], ['ortho', 'Orthographic']] },
  { key: 'fov', label: 'Camera field of view', range: [24, 50, 1] },
  { key: 'aimAssist', label: 'Aim assist (gamepad 8-way aim)', bool: true },
  { key: 'lockOn', label: 'Lock-on button (F / R3)', bool: true },
  { key: 'dashCharge', label: 'Charged dash (hold dash while standing still)', bool: true },
  { key: 'haptics', label: 'Rumble and vibration', bool: true },
  { key: 'hapticStrength', label: 'Rumble strength', range: [0, 1, 0.05] },
  { key: 'p1Aim', label: 'Keyboard player aims with', opts: [['mouse', 'Mouse'], ['keys', 'Movement keys (8-way)']] },
  { key: 'difficulty', label: 'Difficulty', opts: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']] },
  { key: 'barks', label: 'Character lines (CP-09 test)', bool: true },
  { key: 'shake', label: 'Screen shake', bool: true },
  { key: 'quality', label: 'Graphics quality', opts: [['high', 'High (bloom, shadows)'], ['low', 'Low']] },
  { key: 'volume', label: 'Sound effects volume', range: [0, 1, 0.05] },
  { key: 'music', label: 'Music volume', range: [0, 1, 0.05] },
];

export class UI {
  constructor(root, handlers) {
    this.root = root; this.H = handlers;
    this.hud = h('div', 'hud'); root.appendChild(this.hud);
    this.labels = h('div', 'labels'); root.appendChild(this.labels);
    this.banner = h('div', 'banner'); this.banner.hidden = true; root.appendChild(this.banner);
    this.toastEl = h('div', 'toast'); this.toastEl.hidden = true; root.appendChild(this.toastEl);
    this.debug = h('pre', 'debug'); this.debug.hidden = true; root.appendChild(this.debug);
    this.panels = new Map(); this.markers = new Map(); this.barks = []; this.enemyLabels = new Map();
    this.bannerT = 0; this.toastT = 0; this.paused = false; this.helpOpen = false;
    this.buildStart(); this.buildPause(); this.buildHelp();
  }

  // ---- Start ----
  buildStart() {
    const s = h('div', 'overlay start');
    s.innerHTML = `
      <div class="card">
        <p class="eyebrow">Fresh-start track · Browser prototype · Pass 1</p>
        <h1>Nova Striker</h1>
        <p class="lede">Movement, combat and co-op feel test. Placeholder art and sound; nothing here is final.</p>
        <div class="join"><span class="pulse"></span>Click, press any key, or press a gamepad button to join</div>
        <div class="cols">
          <div><h3>Keyboard + mouse</h3><ul>
            <li><kbd>A</kbd><kbd>D</kbd> move · <kbd>S</kbd> crouch · <kbd>Space</kbd> jump</li>
            <li><kbd>Shift</kbd> dash · <kbd>S</kbd>+<kbd>Shift</kbd> slide</li>
            <li>Left click fire (hold to charge) · Right click melee</li>
            <li><kbd>Q</kbd> parry · <kbd>E</kbd> suit ability · <kbd>R</kbd> switch mode</li>
            <li><kbd>F</kbd> lock-on · <kbd>1</kbd>/<kbd>2</kbd> Nova/Echo</li></ul></div>
          <div><h3>Gamepad</h3><ul>
            <li>Left stick move · Right stick aim · R3 lock-on</li>
            <li>A / LB jump · B dash · X melee · Y suit ability · RB switch mode</li>
            <li>RT fire (hold to charge) · LT parry</li>
            <li>D-pad left/right swap character · Start pause</li></ul></div>
        </div>
        <p class="fine">Nova: <kbd>R</kbd> or RB switches bracer attachments (Lance, Volley, Arc, Prism). Hold fire or melee to charge through three levels; let go on the flash for a Perfect Release. Fire a charged shot at your feet to rocket jump: the longer the charge, the higher he goes (the gold line shows how high). After a double jump, press jump again for his light boosters.</p>
        <p class="fine">Echo's scarf modes: <b>Tether</b> grapples, <b>Veil</b> hides him (his first strike from hiding is an ambush), <b>Flare</b> pulls enemies onto him. <kbd>R</kbd> or RB switches; <kbd>E</kbd> or Y uses the mode. Tap fire to throw a snare; hold it to raise his rifle for a long shot, or longer for a marking shot.</p>
        <p class="fine">Both: slide down walls and shoot or strike from them; hold dash while standing still to charge it. Up to four players: extra gamepads join by pressing any button. <kbd>H</kbd> or View shows controls, <kbd>Esc</kbd> or Start opens settings and zones.</p>
        <p class="fine notice" hidden></p>
        <p class="fine touchnote">This build needs a keyboard or a gamepad. Touch controls are designed separately and arrive with a mobile port.</p>
      </div>`;
    this.root.appendChild(s); this.start = s;
  }
  hideStart() { this.start.hidden = true; }
  gamepadNotice(show) {
    const n = $('.notice', this.start);
    n.hidden = !show;
    n.textContent = 'Gamepads are blocked in this viewer. Keyboard and mouse work here; open the page in a browser tab to use controllers.';
  }

  // ---- Pause / settings ----
  buildPause() {
    const p = h('div', 'overlay pause'); p.hidden = true;
    const card = h('div', 'card wide'); p.appendChild(card);
    card.appendChild(h('p', 'eyebrow', 'Paused'));
    card.appendChild(h('h2', '', 'Settings and test toggles'));
    const row = h('div', 'actions');
    const mk = (label, fn) => { const b = h('button', 'btn', label); b.addEventListener('click', fn); row.appendChild(b); return b; };
    mk('Resume', () => this.H.resume());
    mk('Movement Gym', () => this.H.zone('gym'));
    mk('Concourse Lock', () => this.H.zone('arena'));
    mk('Storm Spire Climb', () => this.H.zone('tower'));
    mk('Skyline Relay', () => this.H.zone('skyline'));
    mk('Controls', () => this.toggleHelp(true));
    card.appendChild(row);
    this.playerList = h('div', 'players'); card.appendChild(this.playerList);
    const grid = h('div', 'settings'); card.appendChild(grid);
    for (const d of SETTING_DEFS) {
      const id = 'set-' + d.key, lab = h('label', 'setting');
      lab.setAttribute('for', id); lab.appendChild(h('span', '', d.label));
      let input;
      if (d.bool) { input = h('input'); input.type = 'checkbox'; input.checked = !!SETTINGS[d.key]; input.addEventListener('change', () => { SETTINGS[d.key] = input.checked; saveSettings(); }); }
      else if (d.range) {
        input = h('input'); input.type = 'range'; [input.min, input.max, input.step] = d.range.map(String); input.value = String(SETTINGS[d.key]);
        input.addEventListener('input', () => { SETTINGS[d.key] = Number(input.value); saveSettings(); });
      } else {
        input = h('select'); for (const [v, t] of d.opts) { const o = h('option', '', t); o.value = v; input.appendChild(o); }
        input.value = SETTINGS[d.key]; input.addEventListener('change', () => { SETTINGS[d.key] = input.value; saveSettings(); });
      }
      input.id = id; lab.appendChild(input); grid.appendChild(lab);
    }
    card.appendChild(h('p', 'fine', 'Character lines are placeholder writing for the CP-09 test, not canon. Settings are remembered in this browser only.'));
    this.root.appendChild(p); this.pause = p;
  }
  setPaused(on, world) {
    this.paused = on; this.pause.hidden = !on;
    if (on) { this.renderPlayerList(world); this.focusables = [...this.pause.querySelectorAll('button, select, input')]; this.focusIdx = 0; this.focusables[0].focus(); }
  }
  renderPlayerList(world) {
    this.playerList.innerHTML = '';
    for (const p of world.players) {
      const row = h('div', 'prow');
      row.appendChild(h('span', 'pmark', `<b style="color:${PLAYER_COLORS[p.slot]}">${PLAYER_MARKS[p.slot]} P${p.slot + 1}</b> ${p.device === 'kbm' ? 'Keyboard + mouse' : 'Gamepad ' + (Number(p.device.slice(3)) + 1)}`));
      for (const c of ['nova', 'echo']) {
        const b = h('button', 'btn small' + (p.char === c ? ' on' : ''), CHARS[c].name);
        b.addEventListener('click', () => { this.H.pick(p, c); this.renderPlayerList(world); }); row.appendChild(b);
      }
      if (p.slot !== 0) { const r = h('button', 'btn small ghost', 'Remove'); r.addEventListener('click', () => { this.H.remove(p); this.renderPlayerList(world); }); row.appendChild(r); }
      this.playerList.appendChild(row);
    }
  }
  menuNav(ev) {
    if (!this.paused || !this.focusables) return;
    const f = this.focusables;
    if (ev.type === 'up' || ev.type === 'down') {
      this.focusIdx = (this.focusIdx + (ev.type === 'down' ? 1 : -1) + f.length) % f.length; f[this.focusIdx].focus();
    } else if (ev.type === 'confirm') {
      const el = f[this.focusIdx];
      if (el.tagName === 'BUTTON') el.click();
      else if (el.tagName === 'SELECT') { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change')); }
      else if (el.type === 'checkbox') { el.checked = !el.checked; el.dispatchEvent(new Event('change')); }
      else if (el.type === 'range') { const v = Number(el.value) + Number(el.step) * 2; el.value = String(v > Number(el.max) ? el.min : v); el.dispatchEvent(new Event('input')); }
    } else if (ev.type === 'back') this.H.resume();
  }

  // ---- Help ----
  buildHelp() {
    const x = h('div', 'overlay help'); x.hidden = true;
    x.innerHTML = `<div class="card wide"><p class="eyebrow">Controls</p><h2>What each button does</h2>
      <table><thead><tr><th>Action</th><th>Gamepad</th><th>Keyboard + mouse</th></tr></thead><tbody>
      <tr><td>Move · crouch</td><td>Left stick</td><td>A/D · S</td></tr>
      <tr><td>Jump · double jump · wall jump</td><td>A or LB</td><td>Space</td></tr>
      <tr><td>Dash (8-way) · slide (down + dash)</td><td>B</td><td>Shift</td></tr>
      <tr><td>Charged dash: hold dash while standing still, aim, let go. Each level goes further; level 2 is briefly invulnerable, level 3 cuts through enemies (afterimages show the level)</td><td>Hold B</td><td>Hold Shift</td></tr>
      <tr><td>Wall slide and wall jump: hold toward a wall to slide down it. Jump while holding toward it (or neutral) to kick up it; hold away to leap off. You can shoot and strike while sliding</td><td>Toward the wall · A</td><td>A/D toward the wall · Space</td></tr>
      <tr><td>Lock-on: press to lock the best target in front; tap again to switch targets, hold to let go. Your aim and homing shots go to the target, and melee steps in toward it</td><td>R3 (click the right stick)</td><td>F, O, or mouse forward button</td></tr>
      <tr><td>Velocity Break</td><td colspan="2">Melee while dashing, sliding, fast-falling, or just after a dash</td></tr>
      <tr><td>Melee · charged melee</td><td>X · hold X</td><td>Right click or J · hold</td></tr>
      <tr><td>Echo launcher · Echo dive</td><td>Up + X · Down + X in the air</td><td>W + melee · S + melee in the air</td></tr>
      <tr><td>Fire · charge</td><td>RT · hold RT</td><td>Left click or K · hold</td></tr>
      <tr><td>Aim</td><td>Right stick (free) or left stick (8-way)</td><td>Mouse</td></tr>
      <tr><td>Parry (first 4 frames are perfect)</td><td>LT</td><td>Q or L</td></tr>
      <tr><td>Suit ability: Nova's Bulwark Pulse / Echo's scarf ability for the current mode</td><td>Y</td><td>E, I, or middle click</td></tr>
      <tr><td>Switch mode: Nova's bracer attachment (Lance, Volley, Arc, Prism) · Echo's scarf mode (Tether, Veil, Flare)</td><td>RB</td><td>R, U, or mouse back button</td></tr>
      <tr><td>Nova, Marksman kit: fire · hold to charge the loaded attachment through three levels · let go on the flash after level 3 for a Perfect Release (more damage; a Perfect Lance breaks guards)</td><td>RT · hold RT</td><td>Left click or K · hold</td></tr>
      <tr><td>Nova, Marksman kit: secondary blaster (Recoil Burst), point-blank pellets that knock enemies back and kick you backward (aim down in the air to hop) · hold to charge it through three levels (level 3 adds a blast)</td><td>X · hold X</td><td>Right click or J · hold</td></tr>
      <tr><td>Nova: every shot bursts where it lands and splashes nearby enemies. A charged shot bursting on the ground or a wall close to you launches you: aim at your feet to rocket jump. The longer the charge, the higher you go (a gold line shows the height); a Perfect Release goes highest</td><td colspan="2">Aim down, charge, let go</td></tr>
      <tr><td>Nova: light boosters. After your double jump, press and hold jump to hover and climb (the gold bar under his health)</td><td>A or LB (third press)</td><td>Space (third press)</td></tr>
      <tr><td>Nova's skates: you glide and keep your speed; reverse to carve to a stop; crouch at speed for a low glide</td><td colspan="2">Move as usual</td></tr>
      <tr><td>Nova's Focus: each charged shot that lands adds a level (a Perfect Release adds two) and more damage; getting hit clears it</td><td colspan="2">Shown under his health bar</td></tr>
      <tr><td>Echo, Hunter kit: tap to throw a snare (down + tap plants one) · hold to raise the staff-rifle and let go for a long shot · hold longer (the laser brightens) for a marking shot that pierces and tags every enemy in line</td><td>Tap RT · hold RT</td><td>Tap / hold left click or K</td></tr>
      <tr><td>Tether mode: tap pulls light enemies or zips you to heavy ones; hold reels a light enemy in or yanks a heavy one off balance</td><td>Y (tap / hold)</td><td>E (tap / hold)</td></tr>
      <tr><td>Veil mode: you fade out while you're not attacking and enemies lose track of you; your first strike from hiding is an ambush that staggers. Attacking or getting hit shows you again. Vanish hides you at once</td><td>Y: Vanish</td><td>E: Vanish</td></tr>
      <tr><td>Flare mode: nearby enemies go for you instead of your team; while they do, parries are easier and Resolve builds faster. Challenge pulls every enemy close by onto you</td><td>Y: Challenge</td><td>E: Challenge</td></tr>
      <tr><td>Swap character</td><td>D-pad left/right</td><td>1 / 2 / Tab</td></tr>
      <tr><td>Revive a downed ally</td><td colspan="2">Stand next to them</td></tr>
      </tbody></table>
      <p class="fine">New enemies: <b>Drones</b> fly above you and shoot (parry, or pull them down with Echo's Tether). <b>Mortars</b> lob shells at a magenta ring on the ground: you can't parry the burst, so move, or shoot the shell down with a charged shot. <b>Chargers</b> telegraph a heavy charge: perfect-parry it or jump over, and they daze themselves on walls.</p>
      <p class="fine">Controllers rumble with hits, charges and launches (Settings: Rumble). On Android phones the first player's phone can vibrate; iPhones do not support vibration from a web page, and a page embedded in another site may be blocked from it.</p>
      <p class="fine">Threats: a white glint means you can parry it. A double glint marks a heavy attack: a perfect parry negates it fully. A magenta jagged strip and a rising tone mean you cannot parry it; jump or move.</p>
      <p class="fine">Press <kbd>H</kbd>, View, or click here to close.</p></div>`;
    x.addEventListener('click', () => this.toggleHelp(false));
    this.root.appendChild(x); this.help = x;
  }
  toggleHelp(on) { this.helpOpen = on === undefined ? !this.helpOpen : on; this.help.hidden = !this.helpOpen; }

  // ---- In-game messages ----
  showBanner(text, sub) { this.banner.innerHTML = `<strong>${text}</strong>${sub ? `<span>${sub}</span>` : ''}`; this.banner.hidden = false; this.bannerT = 2.8; }
  toast(text) { this.toastEl.textContent = text; this.toastEl.hidden = false; this.toastT = 2.2; }
  bark(p, text) {
    const el = h('div', 'bark', `<b>${CHARS[p.char].name}</b> ${text}`);
    el.style.setProperty('--pc', PLAYER_COLORS[p.slot]);
    this.labels.appendChild(el); this.barks.push({ el, p, t: 2.6 });
  }

  onEvent(ev, world) {
    switch (ev.type) {
      case 'banner': this.showBanner(ev.text, ev.sub); break;
      case 'checkpoint': this.toast('Checkpoint reached'); break;
      case 'join': this.toast(`Player ${ev.p.slot + 1} joined as ${CHARS[ev.p.char].name}`); break;
      case 'leave': this.toast(`Player ${ev.slot + 1} left`); break;
      case 'downed': this.toast(ev.secondWind ? 'Second Wind: getting back up' : `Player ${ev.p.slot + 1} is down. Stand next to them to revive`); break;
      case 'wipe': this.showBanner('Team down', 'Returning to the last checkpoint'); break;
      case 'bark': this.bark(ev.p, ev.text); break;
      case 'swap': this.toast(`Player ${ev.p.slot + 1} is now ${CHARS[ev.p.char].name}`); break;
    }
  }

  update(dt, world, view, fps) {
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner.hidden = true; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toastEl.hidden = true; }
    this.updatePanels(world);
    this.updateMarkers(world, view);
    for (const b of this.barks) {
      b.t -= dt;
      const s = view.screenOf(b.p.x, b.p.y + b.p.h + 1.1);
      b.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      b.el.style.opacity = String(Math.min(1, b.t * 2));
      if (b.t <= 0) b.el.remove();
    }
    this.barks = this.barks.filter(b => b.t > 0);
    if (!this.debug.hidden) this.updateDebug(world, fps);
  }

  updatePanels(world) {
    const seen = new Set();
    for (const p of world.players) {
      seen.add(p.slot);
      let P = this.panels.get(p.slot);
      if (!P) {
        const el = h('div', `panel p${p.slot}`);
        el.style.setProperty('--pc', PLAYER_COLORS[p.slot]);
        el.innerHTML = `<div class="ptop"><span class="mark"></span><span class="name"></span><span class="role"></span></div>
          <div class="bar hp"><i class="strain"></i><i class="fill"></i></div><div class="sub"></div>`;
        this.hud.appendChild(el);
        P = { el, name: $('.name', el), role: $('.role', el), mark: $('.mark', el), fill: $('.hp .fill', el), strain: $('.hp .strain', el), sub: $('.sub', el), key: '' };
        this.panels.set(p.slot, P);
      }
      P.mark.textContent = `${PLAYER_MARKS[p.slot]} P${p.slot + 1}`;
      P.name.textContent = CHARS[p.char].name; P.role.textContent = CHARS[p.char].role;
      P.fill.style.width = `${Math.max(0, p.hp / p.maxHp) * 100}%`;
      P.strain.style.width = `${Math.max(0, (p.hp + p.strain) / p.maxHp) * 100}%`;
      let sub;
      if (p.state === 'downed') sub = p.autoRevive > 0 ? 'Second Wind…' : `Down · revive ${Math.floor(p.revive / 1.2)}% · ${Math.ceil(p.downedT / 60)}s`;
      else if (p.state === 'dead') sub = `Respawning in ${Math.ceil(p.respawnT / 60)}s`;
      else if (p.char === 'nova') {
        const bulwark = `<span class="chip ${p.bulwarkCd === 0 ? 'ready' : ''}">Bulwark ${p.bulwarkCd === 0 ? 'ready' : Math.ceil(p.bulwarkCd / 60) + 's'}</span>`;
        const vb = vbTier(p) ? `<span class="chip vb">VB ${vbTier(p)}</span>` : '';
        if (SETTINGS.novaKit === 'marksman') sub = marksmanChips(p) + bulwark + vb + commonChips(p);
        else {
          const ch = p.chargeT >= NOVA.charge2 ? 'RAIL' : p.chargeT >= NOVA.charge1 ? 'LANCE' : p.chargeT > 0 ? 'charging' : '';
          sub = bulwark + (ch ? `<span class="chip ready">${ch}</span>` : '') + vb + commonChips(p);
        }
      } else if (SETTINGS.echoKit === 'hunter') {
        sub = `<span class="res"><i style="width:${p.resolve}%"></i></span>${scarfChip(p)}${scarfCharges(p)}` +
          `<span class="chip ${p.snares ? 'ready' : ''}">Snares ${'◆'.repeat(p.snares)}${'◇'.repeat(HUNTER.snareCharges - p.snares)}</span>` +
          rifleChip(p) + (p.leash ? '<span class="chip vb">Reeling</span>' : '') + (vbTier(p) ? `<span class="chip vb">VB ${vbTier(p)}</span>` : '') + commonChips(p);
      } else {
        const mode = SETTINGS.echoRanged;
        const ranged = mode === 'B' ? `<span class="chip">Bolts ${'●'.repeat(p.cells)}${'○'.repeat(ECHO.cellsMax - p.cells)}</span>`
          : mode === 'A' ? `<span class="chip ${p.tracerCd === 0 ? 'ready' : ''}">Tracer ${p.tracerCd === 0 ? 'ready' : ''}</span>` : '';
        sub = `<span class="res"><i style="width:${p.resolve}%"></i></span>${scarfChip(p)}${scarfCharges(p)}${ranged}` +
          (vbTier(p) ? `<span class="chip vb">VB ${vbTier(p)}</span>` : '') + commonChips(p);
      }
      if (sub !== P.key) { P.sub.innerHTML = sub; P.key = sub; }
    }
    for (const [slot, P] of this.panels) if (!seen.has(slot)) { P.el.remove(); this.panels.delete(slot); }
  }

  updateMarkers(world, view) {
    const seen = new Set();
    for (const p of world.players) {
      seen.add(p.slot);
      let m = this.markers.get(p.slot);
      if (!m) { m = h('div', 'pmarker'); m.style.setProperty('--pc', PLAYER_COLORS[p.slot]); this.labels.appendChild(m); this.markers.set(p.slot, m); }
      const s = view.screenOf(p.x, p.y + p.h + 0.45);
      const r = view.canvas.getBoundingClientRect();
      const x = Math.max(16, Math.min(r.width - 16, s.x)), y = Math.max(16, Math.min(r.height - 16, s.y));
      m.textContent = `${PLAYER_MARKS[p.slot]} P${p.slot + 1}` + (p.state === 'downed' ? ' · DOWN' : p.veiled ? ' · hidden' : '');
      m.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      m.hidden = p.state === 'dead';
    }
    for (const [slot, m] of this.markers) if (!seen.has(slot)) { m.remove(); this.markers.delete(slot); }
    // Lock-on reticles, one per locking player; several on one target nest inside each other
    this.reticles = this.reticles || new Map();
    const onTarget = new Map();
    for (const p of world.players) {
      let r = this.reticles.get(p.slot);
      const t = p.lockT && p.state !== 'dead' && p.state !== 'downed' ? p.lockT : null;
      if (!t) { if (r) r.el.hidden = true; continue; }
      if (!r) {
        const el = h('div', 'reticle', '<div class="spin"><i></i><i></i><i></i><i></i></div><b></b>');
        el.style.setProperty('--pc', PLAYER_COLORS[p.slot]); this.labels.appendChild(el);
        r = { el, target: null, tag: $('b', el) }; this.reticles.set(p.slot, r);
      }
      const n = onTarget.get(t) || 0; onTarget.set(t, n + 1);
      if (r.target !== t) { r.target = t; r.el.classList.remove('pop'); void r.el.offsetWidth; r.el.classList.add('pop'); }
      const s = view.screenOf(t.x, t.y + t.h * 0.55), size = 46 + Math.min(90, t.h * 18) + n * 14;
      r.el.style.setProperty('--rs', `${size}px`);
      r.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      r.tag.textContent = n === 0 ? `${PLAYER_MARKS[p.slot]} P${p.slot + 1}` : '';
      r.el.hidden = !s.vis;
    }
    for (const [slot, r] of this.reticles) if (!seen.has(slot)) { r.el.remove(); this.reticles.delete(slot); }
    // Rocket jump height readout beside the apex marker while Nova lines one up
    this.apexLabels = this.apexLabels || new Map();
    for (const p of world.players) {
      let l = this.apexLabels.get(p.slot);
      const pv = p.char === 'nova' && p.chargeT > 0 ? world.rocketPreview(p) : null;
      if (!pv) { if (l) l.hidden = true; continue; }
      if (!l) { l = h('div', 'apexlabel'); this.labels.appendChild(l); this.apexLabels.set(p.slot, l); }
      const s = view.screenOf(pv.x, pv.apex);
      l.textContent = `▲ ${(pv.apex - p.y).toFixed(1)} m${pv.perfect ? ' · Perfect' : ''}`;
      l.classList.toggle('perfect', pv.perfect);
      l.style.transform = `translate(${s.x + 34}px, ${s.y}px) translate(0, -50%)`;
      l.hidden = !s.vis;
    }
    for (const [slot, l] of this.apexLabels) if (!seen.has(slot)) { l.remove(); this.apexLabels.delete(slot); }
    // Drill post teaching labels
    for (const e of world.enemies) {
      if (e.type !== 'post') continue;
      let l = this.enemyLabels.get(e);
      if (!l) { l = h('div', 'elabel'); this.labels.appendChild(l); this.enemyLabels.set(e, l); }
      const s = view.screenOf(e.x, e.y + e.h + 0.8);
      l.hidden = Math.abs(e.x - world.cam.x) > world.cam.halfW + 1;
      l.textContent = e.label || 'Sparring post: step close';
      l.dataset.cat = e.state === 'windup' && e.atk ? e.atk.cat : '';
      l.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
  }

  updateDebug(world, fps) {
    const d = world.director.usage();
    const lines = [`fps ${fps.toFixed(0)} · tick ${world.tick} · tokens melee ${d.melee}/${d.meleeCap} ranged ${d.ranged}/${d.rangedCap} · cam dist ${world.cam.dist.toFixed(1)}`];
    for (const p of world.players) {
      lines.push(`P${p.slot + 1} ${p.char} ${p.state}:${p.st} pos ${p.x.toFixed(2)},${p.y.toFixed(2)} v ${p.vx.toFixed(1)},${p.vy.toFixed(1)} ground ${p.onGround ? 1 : 0} wall ${p.wallDir}${p.wallSliding ? ' slide' : ''} vb ${vbTier(p)} air-dash ${p.airDashes} buf j${p.buf.jump} d${p.buf.dash} m${p.buf.melee} p${p.buf.parry}` +
        ` · dashC ${p.dashChargeT} rifle ${p.rifleT}/${p.rifleCd} rocket ${p.rocketT} lock ${p.lockT ? p.lockT.type : '-'}`);
    }
    this.debug.textContent = lines.join('\n');
  }
  toggleDebug() { this.debug.hidden = !this.debug.hidden; }
}
