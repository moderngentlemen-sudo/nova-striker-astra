import { UI } from './ui.js';
import { SETTINGS, saveSettings, CHARS, ROSTER, PLAYER_COLORS } from './config.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls || ''; if (text !== undefined) e.textContent = text; return e; };
const button = (text, fn, cls = '') => { const b = el('button', `btn ${cls}`, text); b.type = 'button'; b.onclick = fn; return b; };
const ROLES = {
  nova: ['THE STRIKER', 'Momentum is a weapon.', 'Charge your bracer, skate through the crossfire, then switch your loadout without losing your rhythm.', 'Z · quick swap   X · strike   C · secondary'],
  echo: ['THE HUNTER', 'Own the space between.', 'Launch into aerial strings, tether your next target and choose the direction of your release.', 'E · tether   W + strike · launcher'],
  ram: ['THE VANGUARD', 'Make your own entrance.', 'Catch the barrage behind your shield. Carry enemies into a wall or throw them exactly where you want.', 'Q · guard   Shift · charge   strike · release'],
  fix: ['THE ENGINEER', 'Build the advantage.', 'Turn the battlefield into your workshop. Upgrade and relocate gadgets, then detonate your rivets with the wrench.', 'E · build   B · relocate   X · wrench'],
};
const ICONS = {
  nova: '<path d="M32 11 45 20 42 35 32 42 22 35 19 20Z"/><path d="m19 45 13-5 13 5 8 26-14-5-7 21-7-21-14 5Z"/><path class="light" d="m23 25 18 0-4 6-10 0Z"/>',
  echo: '<path d="M32 8 45 22 40 39 24 39 19 22Z"/><path d="m24 43 16 0 6 26-8-3-6 23-6-23-8 3Z"/><path class="light" d="m20 24 24 0-12 7Z"/><path class="light" d="m39 40 18 13-11 0 13 22-23-22Z"/>',
  ram: '<path d="M24 14 41 14 47 30 41 41 24 41 18 30Z"/><path d="m18 43 29 0 9 26-16-4-1 23-14 0-1-23-16 4Z"/><path class="light" d="M24 24h17v7H24Z"/><path class="light" d="m7 39 16 3-1 35L6 66Z"/>',
  fix: '<path d="M22 17 41 17 47 29 40 41 24 41 18 29Z"/><path d="m23 43 19 0 5 23-9 0 2 22-12 0-2-22-9 0Z"/><path class="light" d="M20 23h24v9H20Z"/><path class="light" d="m50 38 7-7 5 9-7 7-3 25-7-1 3-25Z"/>',
};
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class AstraUI extends UI {
  constructor(root, handlers) {
    super(root, handlers);
    this.objective = el('section', 'mission-hud'); this.objective.setAttribute('aria-live', 'polite'); root.append(this.objective);
    this.context = el('div', 'context-hint'); root.append(this.context);
    this.results = el('div', 'overlay results'); this.results.hidden = true; root.append(this.results);
    this.resultsOpen = false; this.completedMission = null;
    this.extendHelp();
    const back=button('Back to game / menu',()=>this.toggleHelp(false)); back.onclick=e=>{e.stopPropagation();this.toggleHelp(false);}; this.help.querySelector('.helphead').append(back);
    for(const [panel,name] of [[this.help,'Controls'],[this.pause,'Field menu'],[this.results,'Mission results']]){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',name);}
    root.addEventListener('keydown',e=>{
      if(e.key!=='Tab')return;
      const panel=this.helpOpen?this.help:this.paused?this.pause:this.resultsOpen?this.results:!this.start.hidden?this.start:null;
      if(!panel)return;
      const items=[...panel.querySelectorAll('button,select,input,summary')].filter(x=>x.getClientRects().length);if(!items.length)return;
      const idx=items.indexOf(document.activeElement);
      if(idx<0 || (e.shiftKey&&idx===0) || (!e.shiftKey&&idx===items.length-1)){e.preventDefault();items[e.shiftKey?items.length-1:0].focus();}
    });
  }
  buildStart() {
    this.selectedChar = 'nova'; this.menuDevice = 'kbm';
    const s = el('div', 'overlay start astra-start');
    s.innerHTML = `<div class="start-wash"></div><div class="start-content"><p class="eyebrow"><span class="signal-dot"></span> ASTRA DIVISION / OPERATION 01</p><h1>NOVA<br><span>STRIKER</span></h1><p class="start-tag">TAKE BACK THE SKYLINE.</p><p class="start-copy">Four specialists. One city on the brink.<br>Break the lockdown and bring the relay back online.</p><div class="roster" aria-label="Choose your character"></div><div class="hero-description"><span></span><h2></h2><p></p><small></small></div><div class="start-actions"></div><p class="join-note">1–4 PLAYERS · LOCAL CO-OP <span>Extra controllers can join during play.</span></p><p class="fine notice" hidden></p></div><div class="start-stamp"><b>SKYLINE RELAY</b><span>RESTORATION PROTOCOL</span><i>34.08 / SECTOR 07</i></div>`;
    ROSTER.forEach((c, i) => {
      const b = button('', () => this.selectHero(c), 'hero-card'); b.dataset.char = c; b.style.setProperty('--hero', PLAYER_COLORS[i]);
      b.innerHTML = `<svg viewBox="0 0 64 96" aria-hidden="true">${ICONS[c]}</svg><strong>${CHARS[c].name}</strong><span>0${i + 1}</span>`;
      b.setAttribute('aria-label', `Select ${CHARS[c].name}`); s.querySelector('.roster').append(b);
    });
    const actions = s.querySelector('.start-actions');
    actions.append(button('DEPLOY TO SKYLINE  →', () => this.H.start('mission', this.selectedChar, this.menuDevice), 'primary deploy'), button('Training', () => this.H.start('training', this.selectedChar, this.menuDevice)), button('Settings', () => this.H.settings()), button('Controls', () => this.toggleHelp(true)));
    this.start = s; this.root.append(s); this.selectHero('nova');
    s.addEventListener('pointerdown', () => { this.menuDevice = 'kbm'; });
    s.addEventListener('keydown', () => { this.menuDevice = 'kbm'; });
    this.titleFocus = 4;
  }
  selectHero(c) {
    this.selectedChar = c;
    for (const b of this.start.querySelectorAll('.hero-card')) { const on = b.dataset.char === c; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); }
    const d = this.start.querySelector('.hero-description'), r = ROLES[c];
    d.children[0].textContent = r[0]; d.children[1].textContent = r[1]; d.children[2].textContent = r[2]; d.children[3].textContent = r[3];
  }
  hideStart() { super.hideStart(); this.resultsOpen = false; if (this.results) this.results.hidden = true; }
  showStart() { this.start.hidden = false; this.results.hidden = true; this.resultsOpen = false; this.completedMission = null; this.titleFocus=4; this.start.querySelector('.deploy').focus(); }
  titleNav(ev) {
    if (ev.dev) this.menuDevice = ev.dev;
    if (ev.type === 'pick') this.selectHero(ev.char);
    else if (ev.type === 'swap') this.selectHero(ROSTER[(ROSTER.indexOf(this.selectedChar) + (ev.dir || 1) + 4) % 4]);
    else if (ev.type === 'help') this.toggleHelp(true);
    else if (ev.type === 'pause' && ev.dev !== 'kbm') this.H.start('mission', this.selectedChar, this.menuDevice);
    else {
      const buttons = [...this.start.querySelectorAll('button')];
      const focused=buttons.indexOf(document.activeElement); if(focused>=0)this.titleFocus=focused;
      if (ev.type === 'up' || ev.type === 'down') this.titleFocus = (this.titleFocus + (ev.type === 'down' ? 1 : -1) + buttons.length) % buttons.length;
      if (ev.type === 'confirm') buttons[this.titleFocus].click();
      else if (['up', 'down'].includes(ev.type)) buttons[this.titleFocus].focus();
    }
  }
  buildPause() {
    const p = el('div', 'overlay pause'); p.hidden = true;
    const card = el('div', 'card wide astra-settings'); p.append(card);
    card.innerHTML = '<p class="eyebrow">ASTRA DIVISION / FIELD MENU</p><h2>Take a breath.</h2>';
    const row = el('div', 'actions');
    row.append(button('Resume', () => this.H.resume(), 'primary'), button('Restart mission', () => this.H.restart()), button('Training', () => this.H.start('training')), button('Controls', () => this.toggleHelp(true)), button('Title screen', () => this.H.title())); card.append(row);
    this.playerList = el('div', 'players'); card.append(this.playerList);
    const grid = el('div', 'settings'); card.append(grid);
    const defs = [
      ['difficulty', 'Difficulty', [['easy','Relaxed'],['normal','Standard'],['hard','Expert']]],
      ['quality', 'Rendering', [['high','High · bloom & shadows'],['low','Performance']]],
      ['p1Aim', 'Keyboard aiming', [['mouse','Mouse'],['keys','Movement direction']]],
      ['lockMode', 'Target lock', [['auto','Automatic'],['manual','Manual']]],
      ['hudDetail', 'Combat HUD', [['compact','Essential'],['full','All resources']]],
      ['volume', 'Effects volume', [0,1,.05]], ['music','Music volume',[0,1,.05]],
      ['uiScale','HUD scale',[.85,1.3,.05]], ['hapticStrength','Vibration strength',[0,1,.05]],
      ['aimAssist','Controller aim assist',true], ['shake','Camera shake',true], ['reducedEffects','Reduced flashes & effects',true], ['haptics','Controller vibration',true], ['barks','Character dialogue',true],
    ];
    for (const [key, label, spec] of defs) this.addSetting(grid, key, label, spec);
    const lab = el('details', 'training-lab'); lab.append(el('summary', '', 'Training lab · zones and experiments'));
    const zones = el('div', 'actions');
    for (const [id,label] of [['gym','Movement gym'],['arena','Concourse'],['tower','Storm spire'],['skyline','Skyline']]) zones.append(button(label, () => this.H.zone(id)));
    zones.append(button('Lockwarden', () => this.H.boss('warden')), button('Stormcaller', () => this.H.boss('stormcaller'))); lab.append(zones);
    const experiments = el('div', 'settings'); lab.append(experiments);
    for (const [key,label,spec] of [['novaKit','Nova kit',[['marksman','Marksman'],['sentinel','Legacy Sentinel']]],['echoKit','Echo kit',[['hunter','Hunter'],['pursuit','Legacy Pursuit']]],['camera','Projection',[['persp','Perspective'],['ortho','Orthographic']]],['dashIframes','Dash invulnerability',true],['dashCharge','Charged dash',true],['impactFrames','Impact frames',true]]) this.addSetting(experiments,key,label,spec);
    card.append(lab, el('p','fine','Settings and your best mission time are saved on this device. Keyboard or controller required.'));
    this.root.append(p); this.pause = p;
  }
  addSetting(parent, key, label, spec) {
    const wrap = el('label','setting'); const name = el('span','',label); wrap.append(name);
    let input;
    if (spec === true) { input = el('input'); input.type = 'checkbox'; input.checked = !!SETTINGS[key]; }
    else if (typeof spec[0] === 'number') { input = el('input'); input.type='range'; [input.min,input.max,input.step] = spec; input.value=SETTINGS[key] ?? 1; }
    else { input = el('select'); for (const [v,t] of spec) { const o=el('option','',t); o.value=v; input.append(o); } input.value=SETTINGS[key] ?? spec[0][0]; }
    input.oninput = () => { SETTINGS[key] = input.type==='checkbox' ? input.checked : input.type==='range' ? +input.value : input.value; saveSettings(); this.applyPreferences(); };
    input.onchange = input.oninput; wrap.append(input); parent.append(wrap);
  }
  applyPreferences() {
    this.root.style.setProperty('--hud-scale', SETTINGS.uiScale || 1);
    this.root.classList.toggle('compact-hud', SETTINGS.hudDetail !== 'full');
    this.root.classList.toggle('reduced-effects', !!SETTINGS.reducedEffects);
  }
  setPaused(on, world) { super.setPaused(on, world); this.applyPreferences(); }
  menuNav(ev) {
    const panel = this.resultsOpen ? this.results : this.pause;
    const f = [...panel.querySelectorAll('button,select,input,summary')].filter(e => e.getClientRects().length);
    if (!f.length) return;
    let idx = f.indexOf(document.activeElement); if(idx < 0) idx = 0;
    if (ev.type === 'up' || ev.type === 'down') f[(idx + (ev.type==='down'?1:-1) + f.length) % f.length].focus();
    else if (ev.type==='confirm') {
      const e=f[idx];
      if(e.tagName==='SELECT') {e.selectedIndex=(e.selectedIndex+1)%e.options.length;e.dispatchEvent(new Event('change'));}
      else if(e.type==='range'){e.value=+e.value + +e.step > +e.max ? e.min : +e.value + +e.step;e.dispatchEvent(new Event('input'));}
      else e.click();
    } else if(ev.type==='back') this.resultsOpen ? this.H.title() : this.H.resume();
  }
  toggleHelp(on) {
    const was=this.helpOpen; if(!was && on!==false)this.helpReturn=document.activeElement; super.toggleHelp(on);
    if(was!==this.helpOpen)this.H.helpChanged?.(this.helpOpen);
    if(this.helpOpen){const c=this.help.querySelector('.card');c.tabIndex=-1;c.focus();}
    else if(was && this.helpReturn?.isConnected && this.helpReturn.getClientRects().length)this.helpReturn.focus();
  }
  extendHelp() {
    const body = this.help.querySelector('tbody');
    const rows = document.createElement('tbody');
    rows.innerHTML = `<tr><th colspan="3">Astra field controls</th></tr><tr><td>Interact with a nearby fixture, relay or launch surface</td><td>D-pad up</td><td>G</td></tr><tr><td>Explicit strike (always melee, including Nova and Fix)</td><td>Left stick click</td><td>X</td></tr><tr><td>Explicit Nova secondary weapon</td><td>LB + X</td><td>C</td></tr><tr><td>Nova: quick swap paired weapon loadouts</td><td>LB + RB</td><td>Z</td></tr><tr><td>Fix: pick up/place a nearby owned gadget, retaining its level and remaining lifetime</td><td>LB + Y</td><td>B</td></tr><tr><td>Echo: hold tether and press strike to throw; aerial finishers steer with up/down</td><td>Direction + hold Y + strike</td><td>WASD + hold E + X</td></tr><tr><td>RAM: deliberately release carried enemies during a charge</td><td>Strike during charge</td><td>X during charge</td></tr>`;
    body.before(rows);
  }
  showResults(world) {
    this.resultsOpen=true; this.results.hidden=false;
    const s=world.mission.stats, time=s.elapsedSeconds || 0; let old=0;
    try { old=+localStorage.getItem('nova-striker-astra-best') || 0; if(!old || time<old) localStorage.setItem('nova-striker-astra-best',String(time)); } catch {}
    const card=el('div','card results-card'); card.innerHTML=`<p class="eyebrow">OPERATION COMPLETE / SKYLINE RELAY</p><h2>The city is<br><em>back online.</em></h2><p>Your team broke the lockdown and restored the signal.</p><div class="result-stats"><div><b>${fmtTime(time)}</b><span>MISSION TIME</span></div><div><b>${Math.round(s.score || 0).toLocaleString()}</b><span>TEAM SCORE</span></div><div><b>${s.kills || 0}</b><span>HOSTILES CLEARED</span></div><div><b>${s.interactions || 0}</b><span>FIELD INTERACTIONS</span></div></div><p class="personal-best">${!old || time<old ? 'NEW PERSONAL BEST' : 'PERSONAL BEST  '+fmtTime(old)} · ${s.revives || 0} revives · ${s.retries || 0} retries</p>`;
    const support=el('p','support-stats',`${Math.round(s.healing || 0)} health restored  /  ${s.blocks || 0} defensive saves  /  ${s.optionalRoutes || 0} discoveries`); card.append(support);
    const party=el('div','result-party');
    for(const p of world.players){ const ps=s.perPlayer?.[p.slot] || {}; const row=el('div',''); row.append(el('b','',`P${p.slot+1} ${CHARS[p.char].name}`),el('span','',`${Math.round(ps.damageDealt || 0)} damage / ${Math.round(ps.healing || 0)} healing / ${ps.blocks || 0} defenses / ${ps.interactions || 0} interactions`)); party.append(row); } card.append(party);
    const actions=el('div','actions'); actions.append(button('Deploy again',()=>this.H.restart(),'primary'),button('Training',()=>this.H.start('training')),button('Title screen',()=>this.H.title())); card.append(actions); this.results.replaceChildren(card); actions.firstChild.focus();
  }
  update(dt,world,view,fps) {
    super.update(dt,world,view,fps); this.applyPreferences();
    const m=world.mission, live=this.start.hidden && !!world.players.length;
    this.hud.hidden=!live; this.labels.hidden=!live; this.objective.hidden=!live || !m || m.mode==='training'; this.context.hidden=!live || this.resultsOpen || this.paused || this.helpOpen;
    if(m && !this.objective.hidden){
      const key=`${m.objective}|${m.hint}|${m.stageIndex}`;
      if(key!==this.objectiveKey){this.objectiveKey=key;this.objective.replaceChildren(el('span','',`SKYLINE RELAY / 0${(m.stageIndex || 0)+1}`),el('strong','',m.objective || m.title),el('small','',m.hint || ''));}
      this.objective.classList.toggle('boss-active',!this.bossBar.hidden);
    }
    if(live){
      const p=world.players[0]; const nearby=m?.nearby;
      const hint=nearby ? `${p.device==='kbm'?'G':'D-PAD ↑'}  ·  ${nearby.label || nearby.type}${nearby.state==='connecting' ? ' · '+Math.round(nearby.charge*100)+'% · Stay close' : ''}` : m?.mode==='training' ? 'TRAINING  ·  Experiment freely   /   Esc: field menu   /   H: controls' : `${p.device==='kbm'?'G: interact  ·  X: strike  ·  H: controls':'D-pad ↑: interact  ·  L3: strike  ·  View: controls'}`;
      if(this.context.textContent!==hint)this.context.textContent=hint;
    }
    if(m?.completed && this.completedMission!==m){this.completedMission=m;this.showResults(world);}
    // Dispose DOM labels for enemies removed on a mission restart.
    for(const [enemy,entry] of this.enemyLabels) if(!world.enemies.includes(enemy)){entry.remove();this.enemyLabels.delete(enemy);}
  }
}
