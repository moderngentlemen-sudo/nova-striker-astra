// Native keyboard navigation must remain native while gameplay input is blocked.
// This exercises the real event listeners and physical gamepad sampler without a browser.
import { Input } from '../game/js/input.js';
const assert = (ok, message) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`); if (!ok) process.exitCode = 1; };
function surface() {
  const listeners = new Map();
  return { addEventListener(type, listener) { const list = listeners.get(type) || []; list.push(listener); listeners.set(type, list); },
    fire(type, extras = {}) {
      const event = { code: '', repeat: false, button: 0, prevented: false, preventDefault() { this.prevented = true; }, ...extras };
      for (const listener of listeners.get(type) || []) listener(event);
      return event;
    }, getBoundingClientRect() { return { left: 0, top: 0 }; } };
}
globalThis.window = surface();
const canvas = surface(), input = new Input(canvas);
let menu = true;
input.setMenuActive(() => menu);
for (const code of ['Tab', 'Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
  const event = window.fire('keydown', { code });
  assert(!event.prevented && !input.keys.has(code) && !input.kbPressed.has(code) && !input.anyKbm && !input.takeMenuEvents().length,
    `${code} remains available to native menu controls without gameplay or joining`);
}
{
  const help = window.fire('keydown', { code: 'KeyH' });
  const helpEvents = input.takeMenuEvents();
  const escape = window.fire('keydown', { code: 'Escape' });
  assert(help.prevented && helpEvents[0]?.type === 'help' && escape.prevented && input.takeMenuEvents()[0]?.type === 'pause',
    'Menu H/Escape shortcuts still reach the overlay controller');
}
{
  window.fire('pointerdown', { target: { tagName: 'BUTTON' } });
  assert(!input.anyKbm, 'Clicking a UI button never requests keyboard player join');
}
menu = false;
input.sample('kbm'); // initial neutral sample; joining buttons are swallowed
{
  window.fire('keydown', { code: 'Escape' }); input.takeMenuEvents();
  assert(!input.anyKbm, 'In-game Escape opens a menu without requesting a keyboard join');
  window.fire('keyup', { code: 'Escape' });
  const down = window.fire('keydown', { code: 'Space' });
  const command = input.sample('kbm');
  assert(down.prevented && command.pressed.jump && input.anyKbm, 'Space remains a gameplay jump outside menus');
  input.swallowAll(); const closed = input.sample('kbm'), held = input.sample('kbm');
  assert(!closed.held.jump && !closed.pressed.jump && !closed.released.jump && !held.held.jump,
    'A modal-closing held action is suppressed until physical release, without synthetic edges');
  window.fire('keyup', { code: 'Space' }); input.sample('kbm');
  window.fire('keydown', { code: 'Space' });
  assert(input.sample('kbm').pressed.jump, 'The first fresh jump press after release works normally');
  window.fire('keyup', { code: 'Space' }); input.sample('kbm');
}
{
  window.fire('keydown', { code: 'KeyX' }); window.fire('keyup', { code: 'KeyX' });
  window.fire('blur');
  assert(!input.sample('kbm').pressed.strike && !input.anyKbm, 'Window blur discards queued taps and pending joins');
}
const pad = { index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
input.pads = () => [pad];
function padDown(...buttons) { pad.buttons.forEach((b, i) => { b.pressed = buttons.includes(i); b.value = b.pressed ? 1 : 0; }); }
{
  padDown(0);
  const first = input.sample('pad0'), still = input.sample('pad0');
  assert(!first.held.jump && !still.held.jump, 'A controller join/confirm button cannot jump on its first gameplay frames');
  padDown(); input.sample('pad0'); padDown(0);
  assert(input.sample('pad0').pressed.jump, 'New controller gameplay activates after the join button is released');
  padDown(); input.sample('pad0');
}
{
  menu = true; padDown(0); input.pollPadMenus(); input.takeMenuEvents();
  menu = false;
  assert(input.pollJoins(new Set()).length === 0, 'A controller that dismisses a menu does not also join the party');
  padDown(); input.pollJoins(new Set()); padDown(0);
  assert(input.pollJoins(new Set())[0] === 'pad0', 'That controller can deliberately join with a fresh press');
  padDown(); input.sample('pad0');
}
{
  padDown(4); input.sample('pad0'); input.swallowAll(); input.sample('pad0');
  padDown();
  assert(!input.sample('pad0').pressed.sub, 'Releasing LB after a modal does not cycle the weapon or power-up');
}

// Reconciled branch controls: orders must never also activate Astra abilities.
input.sample('kbm'); input.takeMenuEvents(); // neutral frame after the preceding modal test
for (const [code, action] of [['KeyX', 'strike'], ['KeyC', 'secondary'], ['KeyZ', 'quick'], ['KeyG', 'interact'], ['KeyB', 'relocate']]) {
  window.fire('keydown', { code }); const cmd = input.sample('kbm');
  assert(cmd.pressed[action] && !input.takeMenuEvents().length, `${code} keeps Astra's ${action} action without a team order`);
  window.fire('keyup', { code }); input.sample('kbm');
}
input.anyKbm = false;
for (const [digit, order] of [[1, 'attack'], [2, 'cover'], [3, 'regroup'], [4, 'hold']]) {
  const event = window.fire('keydown', { code: 'Digit' + digit, altKey: true }), ev = input.takeMenuEvents();
  assert(event.prevented && ev.length === 1 && ev[0].type === 'order' && ev[0].order === order && !input.anyKbm,
    `Alt+${digit} issues ${order} without character selection or joining`);
  window.fire('keyup', { code: 'Digit' + digit });
}
window.fire('keydown', { code: 'Digit1', altKey: true, repeat: true });
assert(!input.takeMenuEvents().length, 'Holding an order shortcut never issues repeated orders');
window.fire('keydown', { code: 'Digit2' });
assert(input.takeMenuEvents()[0]?.char === 'echo', 'Unmodified character-selection shortcuts remain available');
window.fire('keyup', { code: 'Digit2' });

let time = 0;
function poll(buttons = [], elapsed = 16) { time += elapsed; padDown(...buttons); input.pollPadMenus(time); return input.takeMenuEvents(); }
function orders(ev) { return ev.filter(e => e.type === 'order').map(e => e.order); }
poll(); input.sample('pad0');
{
  const ev = poll([12]), cmd = input.sample('pad0');
  assert(!orders(ev).length && cmd.pressed.interact && cmd.my === 1, 'Plain D-pad up still interacts and aims upward without ordering bots');
  poll(); input.sample('pad0');
  assert(!orders(poll([13])).length && input.sample('pad0').my === -1, 'Plain D-pad down crouches without ordering bots');
  poll(); input.sample('pad0');
}
for (const [direction, tap, hold] of [[12, 'attack', 'cover'], [13, 'regroup', 'hold']]) {
  assert(!orders(poll([4, direction])).length, `LB+D-pad ${direction === 12 ? 'up' : 'down'} waits to distinguish tap from hold`);
  const chord = input.sample('pad0');
  assert(chord.my === 0 && !chord.held.interact && !chord.pressed.sub, 'An order chord never also interacts, aims vertically or cycles a utility');
  const tapped = orders(poll([], 100)), release = input.sample('pad0');
  assert(tapped.length === 1 && tapped[0] === tap && !release.pressed.sub, `A short order chord issues only ${tap}`);
  poll([4, direction]); input.sample('pad0');
  const held = orders(poll([4, direction], 400));
  const repeated = orders(poll([4, direction], 400));
  const ended = orders(poll()); input.sample('pad0');
  assert(held.length === 1 && held[0] === hold && !repeated.length && !ended.length, `A held order chord issues ${hold} once, with no tap on release`);
}
{
  poll([4, 12]); input.sample('pad0');
  const ev = orders(poll([12], 100)), cmd = input.sample('pad0');
  assert(ev[0] === 'attack' && !cmd.held.interact && !cmd.pressed.sub && cmd.my === 0,
    'Releasing LB first issues the tap without exposing Interact or utility cycle');
  assert(!orders(poll([4, 12], 500)).length, 'Re-pressing LB while the same direction stays held cannot duplicate the order');
  poll(); input.sample('pad0');
}
{
  poll([4]); input.sample('pad0');
  poll([4, 12]); const ev = orders(poll([4], 100)); // no simulation sample between the chord's press and release
  poll(); const cmd = input.sample('pad0');
  assert(ev[0] === 'attack' && !cmd.pressed.sub, 'A complete order tap between simulation ticks still consumes the LB utility tap');
}
{
  poll([4, 12]); input.sample('pad0');
  menu = true; poll([4, 12], 100); input.swallowAll();
  menu = false; const resumed = orders(poll([4, 12], 500)), cmd = input.sample('pad0');
  const released = orders(poll()); input.sample('pad0');
  assert(!resumed.length && !released.length && !cmd.held.interact, 'Opening and closing a menu cancels an unfinished order until physical release');
}
{
  menu = true; pad.axes[1] = -1;
  const first = poll(), early = poll([], 200), repeat = poll([], 130);
  assert(first.some(e => e.type === 'up') && !early.length && repeat.some(e => e.type === 'up' && e.repeat),
    'Menu stick navigation moves immediately, waits, then repeats');
  pad.axes[1] = 0; poll(); pad.axes[0] = 1;
  assert(poll().some(e => e.type === 'swap' && e.dir === 1), 'Menu horizontal stick navigation sends an adjustable right direction');
  pad.axes[0] = 0; poll();
  assert(poll([4]).some(e => e.type === 'prevTab') && poll([5]).some(e => e.type === 'nextTab'), 'Menu shoulder buttons navigate sections');
  poll([15]); input.swallowAll(); menu = false;
  assert(!poll([15]).some(e => e.type === 'swap') && !poll([15], 500).some(e => e.type === 'swap'),
    'A horizontal menu direction held during dismissal never changes the gameplay character');
  poll();
  assert(poll([15]).some(e => e.type === 'swap' && e.dir === 1), 'A fresh horizontal D-pad press can still select a gameplay character');
  poll(); menu = false;
  assert(!poll([4]).some(e => e.type === 'prevTab'), 'Gameplay LB never emits a menu-section event');
  poll(); input.sample('pad0');
}
