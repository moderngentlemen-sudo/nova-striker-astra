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
