// Input: keyboard + mouse (one device) and up to four gamepads.
// Each simulation tick, a device produces one command frame with held/pressed/released edges.

const BTNS = ['jump', 'dash', 'melee', 'fire', 'parry', 'sig', 'mode', 'lock', 'sub', 'ult', 'strike', 'secondary', 'quick', 'relocate', 'interact'];

const KEYMAP = {
  Space: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyJ: 'melee', KeyK: 'fire', KeyL: 'parry', KeyQ: 'parry', KeyE: 'sig', KeyI: 'sig',
  KeyR: 'mode', KeyU: 'mode',   // Echo: cycle scarf mode; Nova: cycle bracer attachment
  KeyF: 'lock', KeyO: 'lock',   // lock-on
  KeyT: 'sub', KeyY: 'sub',     // Nova: switch secondary weapon · RAM: Provoke · Fix: switch power-up
  KeyV: 'ult', KeyN: 'ult',     // ultimate (a gamepad pulls both triggers)
  KeyX: 'strike', KeyC: 'secondary', KeyZ: 'quick', // deliberate melee, secondary, paired loadout swap
  KeyB: 'relocate', KeyG: 'interact',             // Fix's gadget move, environmental interaction
};

function deadzone(x, y, dz) {
  const m = Math.hypot(x, y);
  if (m < dz) return [0, 0];
  const s = Math.min(1, (m - dz) / (1 - dz)) / m;
  return [x * s, y * s];
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.kbPressed = new Set();    // presses since last sample (so fast taps aren't lost)
    this.kbReleased = new Set();
    this.mouse = { x: 0, y: 0, moved: false, buttons: 0 };
    this.mousePressed = new Set();
    this.mouseReleased = new Set();
    this.prevPads = {};
    this.joinBlockedPads = new Set();
    this.devices = {};             // deviceId -> { prevHeld, freeAimGrace }
    this.gamepadBlocked = false;
    this.menuEvents = [];          // pause/help/debug/swap toggles for the UI
    this.anyKbm = false;           // any keyboard/mouse input since last join poll
    this.menuActive = () => false; // bootstrap supplies its live overlay state

    window.addEventListener('keydown', e => {
      if (this.menuActive()) {
        // Native Tab, Enter, Space and arrow behavior belongs to focused menu
        // controls. It must not switch characters, queue a jump, or join KBM.
        if (['Escape', 'KeyP', 'KeyH'].includes(e.code)) {
          e.preventDefault();
          if (!e.repeat) this.menuEvents.push({ dev: 'kbm', type: e.code === 'KeyH' ? 'help' : 'pause' });
        }
        return;
      }
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.kbPressed.add(e.code);
      if (KEYMAP[e.code] || ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) this.anyKbm = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.menuEvents.push({ dev: 'kbm', type: 'pause' });
      if (e.code === 'KeyH') this.menuEvents.push({ dev: 'kbm', type: 'help' });
      if (e.code === 'Backquote') this.menuEvents.push({ dev: 'kbm', type: 'debug' });
      if (e.code === 'Tab') this.menuEvents.push({ dev: 'kbm', type: 'swap', dir: 1 });
      if (e.code === 'Digit1') this.menuEvents.push({ dev: 'kbm', type: 'pick', char: 'nova' });
      if (e.code === 'Digit2') this.menuEvents.push({ dev: 'kbm', type: 'pick', char: 'echo' });
      if (e.code === 'Digit3') this.menuEvents.push({ dev: 'kbm', type: 'pick', char: 'ram' });
      if (e.code === 'Digit4') this.menuEvents.push({ dev: 'kbm', type: 'pick', char: 'fix' });
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
      this.kbReleased.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear(); this.mouse.buttons = 0; this.menuEvents = []; this.swallowAll();
    });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; this.mouse.moved = true;
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button >= 3) e.preventDefault();   // back/forward buttons are game buttons here, not navigation
      this.mouse.buttons |= (1 << e.button);
      this.mousePressed.add(e.button);
      this.anyKbm = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button >= 3 && e.target === canvas) e.preventDefault();
      this.mouse.buttons &= ~(1 << e.button);
      this.mouseReleased.add(e.button);
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    // Interface buttons are handled by the menu controller. Only canvas input or
    // keyboard gameplay input should request a device join, not a settings click.
  }

  setMenuActive(readState) { this.menuActive = typeof readState === 'function' ? readState : () => !!readState; }

  pads() {
    if (this.gamepadBlocked) return [];
    try {
      return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
    } catch (e) {
      this.gamepadBlocked = true;
      return [];
    }
  }

  // Devices that pressed something this frame and are not yet assigned.
  pollJoins(assigned) {
    const out = [];
    if (this.anyKbm && !assigned.has('kbm')) out.push('kbm');
    this.anyKbm = false;
    for (const p of this.pads()) {
      const id = 'pad' + p.index;
      if (assigned.has(id)) continue;
      if (this.joinBlockedPads?.has(id)) {
        if (!p.buttons.some(b => b.pressed || b.value > 0.5)) this.joinBlockedPads.delete(id);
        continue;
      }
      if (p.buttons.some(b => b.pressed)) out.push(id);
    }
    return out;
  }

  // Pad menu buttons (Start/View/D-pad) become UI events.
  pollPadMenus() {
    for (const p of this.pads()) {
      const id = 'pad' + p.index;
      const prev = this.prevPads[id] || [];
      const now = p.buttons.map(b => b.pressed);
      if (this.menuActive() && now.some(Boolean)) this.joinBlockedPads.add(id);
      const edge = i => now[i] && !prev[i];
      if (edge(9)) this.menuEvents.push({ dev: id, type: 'pause' });
      if (edge(8)) this.menuEvents.push({ dev: id, type: 'help' });
      if (edge(14)) this.menuEvents.push({ dev: id, type: 'swap', dir: -1 });
      if (edge(15)) this.menuEvents.push({ dev: id, type: 'swap', dir: 1 });
      if (edge(12)) this.menuEvents.push({ dev: id, type: 'up' });
      if (edge(13)) this.menuEvents.push({ dev: id, type: 'down' });
      if (edge(0)) this.menuEvents.push({ dev: id, type: 'confirm' });
      if (edge(1)) this.menuEvents.push({ dev: id, type: 'back' });
      this.prevPads[id] = now;
    }
  }

  // aimFromMouse(screenX, screenY) is supplied by the caller: returns a unit sim-space vector.
  sample(dev, aimFromMouse, p1AimMode) {
    // A newly joined controller is sampled as already held: its join/confirm
    // button cannot also become a jump or attack in the first game frame.
    const st = this.devices[dev] || (this.devices[dev] = { prevHeld: {}, grace: 0, lastFree: [1, 0], swallow: true });
    const held = {};
    let mx = 0, my = 0, aimFree = false, ax = 0, ay = 0;

    if (dev === 'kbm') {
      const k = c => this.keys.has(c);
      mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
      my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
      for (const b of BTNS) held[b] = false;
      for (const [code, b] of Object.entries(KEYMAP)) if (k(code)) held[b] = true;
      // Bits: 1 = left (fire), 2 = middle (signature), 4 = right (melee), 8 = back (mode), 16 = forward (lock-on)
      if (this.mouse.buttons & 1) held.fire = true;
      if (this.mouse.buttons & 2) held.sig = true;
      if (this.mouse.buttons & 4) held.melee = true;
      if (this.mouse.buttons & 8) held.mode = true;
      if (this.mouse.buttons & 16) held.lock = true;
      if (p1AimMode === 'mouse' && aimFromMouse) {
        const v = aimFromMouse(this.mouse.x, this.mouse.y);
        if (v) { aimFree = true; ax = v[0]; ay = v[1]; }
      }
      // Keyboard presses that happened and released between samples still count as presses
      const pressedExtra = {};
      for (const code of this.kbPressed) { const b = KEYMAP[code]; if (b) pressedExtra[b] = true; }
      if (this.mousePressed.has(0)) pressedExtra.fire = true;
      if (this.mousePressed.has(2)) pressedExtra.melee = true;
      if (this.mousePressed.has(1)) pressedExtra.sig = true;
      if (this.mousePressed.has(3)) pressedExtra.mode = true;
      if (this.mousePressed.has(4)) pressedExtra.lock = true;
      this.kbPressed.clear(); this.mousePressed.clear(); this.kbReleased.clear(); this.mouseReleased.clear();
      return this.finish(st, held, pressedExtra, mx, my, aimFree, ax, ay);
    }

    const pad = this.pads().find(p => 'pad' + p.index === dev);
    const padExtra = {};
    for (const b of BTNS) held[b] = false;
    if (pad) {
      const bt = i => (pad.buttons[i] ? pad.buttons[i].pressed || pad.buttons[i].value > 0.5 : false);
      [mx, my] = deadzone(pad.axes[0] || 0, -(pad.axes[1] || 0), 0.22);
      const [rx, ry] = deadzone(pad.axes[2] || 0, -(pad.axes[3] || 0), 0.3);
      if (bt(12)) my = 1; if (bt(13)) my = -1;
      held.jump = bt(0);
      held.sub = bt(4);     // LB: switch secondary weapon
      held.dash = bt(1);
      held.melee = bt(2);
      held.sig = bt(3);
      held.mode = bt(5);
      held.parry = pad.buttons[6] ? pad.buttons[6].value > 0.5 || pad.buttons[6].pressed : false;
      held.fire = pad.buttons[7] ? pad.buttons[7].value > 0.35 || pad.buttons[7].pressed : false;
      held.lock = bt(11);   // right stick click
      held.strike = bt(10); // left stick click: deliberate melee, never a contextual secondary
      held.interact = bt(12);
      // LB is a modifier; releasing it alone still cycles the secondary/power.
      // Deferring that tap prevents LB+X/Y/RB from spending a cycle first.
      const utility = bt(4);
      if (utility && !st.utilityHeld) st.utilityUsed = !!st.swallow;
      if (!st.chordSuppressed) st.chordSuppressed = new Set();
      for (const b of st.chordSuppressed) if (!bt(b)) st.chordSuppressed.delete(b);
      held.sub = false;
      if (utility) {
        if (bt(2)) { held.secondary = true; st.chordSuppressed.add(2); st.utilityUsed = true; }
        if (bt(3)) { held.relocate = true; st.chordSuppressed.add(3); st.utilityUsed = true; }
        if (bt(5)) { held.quick = true; st.chordSuppressed.add(5); st.utilityUsed = true; }
      } else if (st.utilityHeld && !st.utilityUsed) padExtra.sub = true;
      if (st.chordSuppressed.has(2)) held.melee = false;
      if (st.chordSuppressed.has(3)) held.sig = false;
      if (st.chordSuppressed.has(5)) held.mode = false;
      st.utilityHeld = utility;
      const rm = Math.hypot(rx, ry);
      if (rm > 0.35) {
        aimFree = true; ax = rx / rm; ay = ry / rm; st.grace = 18; st.lastFree = [ax, ay];
      } else if (st.grace > 0) {
        st.grace--; aimFree = true; [ax, ay] = st.lastFree;
      }
    }
    return this.finish(st, held, padExtra, mx, my, aimFree, ax, ay);
  }

  // After a menu closes, held action buttons stay suppressed until their
  // physical release. Merely hiding pressed edges still charged weapons and
  // raised guards from the same button used to dismiss a modal.
  swallowAll() {
    for (const st of Object.values(this.devices)) { st.swallow = true; st.utilityUsed = true; }
    this.kbPressed.clear(); this.kbReleased.clear(); this.mousePressed.clear(); this.mouseReleased.clear(); this.anyKbm = false;
  }

  finish(st, held, pressedExtra, mx, my, aimFree, ax, ay) {
    if (st.swallow) {
      st.swallow = false; st.prevHeld = {}; st.suppressed = new Set(BTNS.filter(b => held[b])); pressedExtra = {};
    }
    for (const b of st.suppressed || []) {
      if (!held[b]) st.suppressed.delete(b);
      else held[b] = false;
      delete pressedExtra[b];
    }
    const pressed = {}, released = {};
    for (const b of BTNS) {
      pressed[b] = (held[b] && !st.prevHeld[b]) || !!pressedExtra[b];
      released[b] = !held[b] && !!st.prevHeld[b];
    }
    st.prevHeld = { ...held };
    return { mx, my, aimFree, ax, ay, held, pressed, released };
  }

  takeMenuEvents() {
    const ev = this.menuEvents;
    this.menuEvents = [];
    return ev;
  }
}

const none = () => Object.fromEntries(BTNS.map(b => [b, false]));
export const EMPTY_CMD = { mx: 0, my: 0, aimFree: false, ax: 0, ay: 0, held: none(), pressed: none(), released: none() };
