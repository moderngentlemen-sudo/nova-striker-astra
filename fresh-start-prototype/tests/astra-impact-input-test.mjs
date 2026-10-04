// Quick gamepad edges must survive presentation hitPause without advancing the simulation.
// This uses the production Input mapping/chords and a real World for resumed actions.
import { Input } from '../game/js/input.js';
import { World } from '../game/js/world.js';
import { SETTINGS, DEFAULT_SETTINGS } from '../game/js/config.js';
Object.assign(SETTINGS, DEFAULT_SETTINGS);
const assert = (ok, text) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${text}`); if (!ok) process.exitCode = 1; };
function surface() {
  const listeners = {};
  return { addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, getBoundingClientRect() { return { left: 0, top: 0 }; },
    fire(type, values = {}) { const ev = { code: '', repeat: false, preventDefault() {}, ...values }; for (const fn of listeners[type] || []) fn(ev); } };
}
function setup() {
  globalThis.window = surface();
  const input = new Input(surface());
  const pads = [0, 1].map(index => ({ index, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }));
  let connected = pads, menu = false, time = 0;
  input.pads = () => connected; input.setMenuActive(() => menu);
  for (const dev of ['pad0', 'pad1', 'kbm']) input.sample(dev);
  const down = (buttons = [], index = 0) => pads[index].buttons.forEach((b, i) => { b.pressed = buttons.includes(i); b.value = b.pressed ? 1 : 0; });
  const capture = (buttons = [], index = 0, assigned = ['pad0', 'pad1'], elapsed = 16) => {
    down(buttons, index); time += elapsed; input.pollPadMenus(time); input.capturePadEdges(assigned);
  };
  return { input, pads, down, capture, menu: value => { menu = value; }, connected: value => { connected = value; } };
}
const edges = cmd => Object.values(cmd.pressed).some(Boolean) || Object.values(cmd.released).some(Boolean);

{
  const t = setup(), w = new World(), p = w.addPlayer('pad0', 'nova');
  w.enemies = []; w.updateEncounters = () => {};
  for (let i = 0; i < 5; i++) w.step({ 0: t.input.sample('pad0') });
  w.events.length = 0;
  const tick = w.tick, y = p.y;
  t.capture([0]); t.capture(); for (let i = 0; i < 40; i++) t.capture();
  assert(w.tick === tick && p.y === y, 'Capturing a tap during presentation hitPause never advances the world or moves its actors');
  const cmd = t.input.sample('pad0');
  assert(cmd.pressed.jump && cmd.released.jump && !cmd.held.jump, 'A jump pressed and released entirely inside a long impact pause retains both edges');
  w.step({ 0: cmd }); for (let i = 0; i < 8; i++) w.step({ 0: t.input.sample('pad0') });
  assert(w.events.filter(e => e.type === 'jump').length === 1 && p.y > y, 'The buffered tap triggers one real jump on resumption and never repeats');
}
{
  const t = setup(); t.down([7]); const held = t.input.sample('pad0');
  t.capture(); const released = t.input.sample('pad0'), again = t.input.sample('pad0');
  assert(held.held.fire && released.released.fire && !released.held.fire && !released.pressed.fire && !edges(again), 'A charged-fire release survives the impact pause without manufacturing another press');
}
{
  const t = setup(); t.capture([6]); t.capture([6]);
  const first = t.input.sample('pad0'), held = t.input.sample('pad0');
  assert(first.pressed.parry && first.held.parry && !held.pressed.parry && held.held.parry, 'A defense button still held at resume presses once and remains held normally');
  t.down(); const released = t.input.sample('pad0');
  assert(released.released.parry && !released.pressed.parry, 'Physical release after resumed defense produces its normal single release edge');
}
for (const [button, action] of [[10, 'strike'], [1, 'dash'], [12, 'interact']]) {
  const t = setup(); t.capture([button]); t.capture(); const cmd = t.input.sample('pad0');
  assert(cmd.pressed[action] && cmd.released[action] && !cmd.held[action] && !edges(t.input.sample('pad0')), `${action} taps retain their logical action and are consumed once`);
}
for (const [button, action, original] of [[2, 'secondary', 'melee'], [3, 'relocate', 'sig'], [5, 'quick', 'mode']]) {
  const t = setup(); t.capture([4, button]); t.capture([button]); t.capture(); const cmd = t.input.sample('pad0');
  assert(cmd.pressed[action] && cmd.released[action] && !cmd.pressed[original] && !cmd.pressed.sub && !edges(t.input.sample('pad0')),
    `Buffered LB chord keeps ${action} without leaking ${original} or a utility cycle`);
}
{
  const t = setup(); t.capture([4]); t.capture(); const cmd = t.input.sample('pad0');
  assert(cmd.pressed.sub && !cmd.held.sub && !edges(t.input.sample('pad0')), 'A quick LB utility tap during impact pause cycles once on release');
}
{
  const t = setup(); t.capture([4, 12]); t.capture();
  const orders = t.input.takeMenuEvents().filter(e => e.type === 'order'), cmd = t.input.sample('pad0');
  assert(orders.length === 1 && orders[0].order === 'attack' && !cmd.pressed.interact && !cmd.pressed.sub,
    'Squad order taps remain menu events and do not leak buffered interaction or utility actions');
}
{
  const t = setup(); t.capture([0]); t.capture(); t.capture([10], 1); t.capture([], 1);
  const a = t.input.sample('pad0'), b = t.input.sample('pad1');
  assert(a.pressed.jump && !a.pressed.strike && b.pressed.strike && !b.pressed.jump, 'Each assigned controller owns an independent pause buffer');
}
{
  const t = setup(); t.capture([0], 1, ['pad0']); t.capture([], 1, ['pad0']);
  assert(!edges(t.input.sample('pad1')), 'Unassigned controllers cannot accumulate gameplay taps during a pause');
}
{
  const t = setup(); t.capture([0]); t.menu(true); t.input.swallowAll(); t.capture([10]); t.capture(); t.menu(false);
  assert(!edges(t.input.sample('pad0')), 'Opening a menu discards pending gameplay taps and menu navigation cannot refill them');
  t.capture([0]); t.capture(); assert(t.input.sample('pad0').pressed.jump, 'Fresh gameplay taps work after the menu closes');
}
{
  const t = setup(); t.capture([7]); t.input.swallowAll();
  const first = t.input.sample('pad0'), held = t.input.sample('pad0');
  assert(!edges(first) && !first.held.fire && !held.held.fire, 'Session reset discards pending fire and suppresses a still-held trigger');
  t.capture(); t.capture([7]); assert(t.input.sample('pad0').pressed.fire, 'A reset trigger works after a physical release and new press');
}
{
  const t = setup(); t.capture([10]); t.capture(); t.input.resetDevice('pad0');
  assert(!edges(t.input.sample('pad0')), 'A controller changing human owners cannot inherit the buffered strike from its previous owner');
  t.capture([0]); t.input.resetDevice('pad0');
  assert(!t.input.sample('pad0').held.jump && !t.input.sample('pad0').pressed.jump, 'A reassigned controller swallows its held join button until release');
}
{
  const t = setup(); t.capture([10]); t.connected([]); t.input.capturePadEdges(['pad0']);
  t.connected(t.pads); const cmd = t.input.sample('pad0');
  assert(!edges(cmd) && !cmd.held.strike, 'Disconnecting clears pending taps and reconnecting does not inherit a held attack');
}
{
  const t = setup(); window.fire('keydown', { code: 'KeyX' }); window.fire('keyup', { code: 'KeyX' });
  t.capture([0], 0, ['pad0', 'kbm']); t.capture([], 0, ['pad0', 'kbm']);
  assert(t.input.sample('kbm').pressed.strike && !t.input.sample('kbm').pressed.strike, 'Gamepad pause capture leaves the existing keyboard fast-tap buffer intact');
}
