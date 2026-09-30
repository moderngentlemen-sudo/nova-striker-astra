// Enemy construct rigs: pale ceramic plating, graphite joints, reserved hostile magenta energy.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HOSTILE } from './config.js';
import { addRim } from './rigs.js';

const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);

function mats() {
  return {
    plate: new THREE.MeshStandardMaterial({ color: 0xe6e9f0, roughness: 0.34, metalness: 0.06, emissive: 0xffffff, emissiveIntensity: 0 }),
    joint: new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.6, metalness: 0.2 }),
    energy: new THREE.MeshStandardMaterial({ color: HOSTILE, emissive: HOSTILE, emissiveIntensity: 2.2, roughness: 0.3 }),
  };
}
function rimAll(M) { addRim(M.plate, '#ff9cc5', 0.35); addRim(M.joint, '#ff7fb2', 0.3); return M; }
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

export function buildEnemyRig(e) {
  const M = rimAll(mats());
  const root = new THREE.Group(), flip = grp(root), body = grp(flip);
  const R = { root, flip, body, mats: M, type: e.type, parts: {}, lean: 0, bob: 0 };
  const P = R.parts;
  switch (e.type) {
    case 'swarmer': {
      P.core = grp(body, 0, 0.42, 0);
      add(P.core, rbox(0.62, 0.42, 0.52, 0.16), M.plate);
      add(P.core, rbox(0.3, 0.12, 0.54, 0.05), M.joint, -0.05, 0.2);
      P.eye = add(P.core, new THREE.SphereGeometry(0.11, 14, 10), M.energy, 0.29, 0.03);
      for (const [x, z] of [[0.18, 0.2], [-0.18, 0.2], [0.18, -0.2], [-0.18, -0.2]]) {
        const l = add(body, cap(0.045, 0.3), M.joint, x, 0.2, z); l.rotation.z = x > 0 ? -0.5 : 0.5;
      }
      break;
    }
    case 'shield': {
      for (const z of [0.16, -0.16]) add(body, cap(0.09, 0.62), M.joint, 0, 0.42, z);
      P.torso = grp(body, 0, 1.0, 0);
      add(P.torso, rbox(0.55, 0.78, 0.6, 0.12), M.plate, 0, 0.25);
      P.eye = add(P.torso, rbox(0.06, 0.07, 0.3, 0.02), M.energy, 0.28, 0.58);
      P.shield = grp(P.torso, 0.55, 0.1, 0);
      add(P.shield, rbox(0.14, 1.55, 1.05, 0.08), M.plate);
      for (const y of [-0.74, 0.74]) add(P.shield, rbox(0.16, 0.05, 1.0, 0.02), M.energy, 0.02, y);
      for (const z of [-0.5, 0.5]) add(P.shield, rbox(0.16, 1.45, 0.05, 0.02), M.energy, 0.02, 0, z);
      break;
    }
    case 'sniper': {
      for (const z of [0.12, -0.12]) add(body, cap(0.07, 0.7), M.joint, 0, 0.45, z);
      P.torso = grp(body, 0, 1.05, 0);
      add(P.torso, rbox(0.4, 0.62, 0.46, 0.1), M.plate, 0, 0.2);
      P.eye = add(P.torso, new THREE.SphereGeometry(0.07, 12, 10), M.energy, 0.2, 0.52);
      P.gun = grp(P.torso, 0.05, 0.3, 0.26);
      const barrel = add(P.gun, new THREE.CylinderGeometry(0.05, 0.06, 1.5, 10), M.joint, 0.75, 0, 0); barrel.rotation.z = Math.PI / 2;
      add(P.gun, rbox(0.4, 0.14, 0.12, 0.03), M.plate, 0.1, 0, 0);
      P.muzzle = add(P.gun, new THREE.SphereGeometry(0.06, 10, 8), M.energy, 1.52, 0, 0);
      break;
    }
    case 'brute': {
      for (const z of [0.36, -0.36]) add(body, cap(0.2, 0.8), M.joint, 0, 0.62, z);
      P.torso = grp(body, 0, 1.4, 0);
      add(P.torso, rbox(1.1, 1.05, 1.1, 0.25), M.joint, 0, 0.35);
      P.core = add(P.torso, new THREE.SphereGeometry(0.22, 16, 12), M.energy, 0.5, 0.4);
      P.plates = [
        add(P.torso, rbox(0.3, 0.8, 0.95, 0.12), M.plate, 0.52, 0.35),
        add(P.torso, rbox(0.7, 0.3, 0.45, 0.12), M.plate, 0, 0.98, 0.42),
        add(P.torso, rbox(0.7, 0.3, 0.45, 0.12), M.plate, 0, 0.98, -0.42),
      ];
      P.head = add(P.torso, rbox(0.34, 0.3, 0.36, 0.1), M.plate, 0.3, 1.02);
      add(P.head, rbox(0.06, 0.06, 0.28, 0.02), M.energy, 0.17, 0.02);
      P.armN = grp(P.torso, 0, 0.8, 0.72); P.armF = grp(P.torso, 0, 0.8, -0.72);
      for (const a of [P.armN, P.armF]) {
        add(a, cap(0.17, 0.75), M.joint, 0, -0.45);
        add(a, rbox(0.5, 0.45, 0.45, 0.14), M.plate, 0.05, -1.0);
      }
      break;
    }
    case 'post': {
      add(body, new THREE.CylinderGeometry(0.5, 0.6, 0.25, 20), M.joint, 0, 0.12);
      add(body, cap(0.2, 1.4), M.plate, 0, 1.0);
      P.arm = grp(body, 0, 1.45, 0.3);
      add(P.arm, rbox(1.3, 0.2, 0.2, 0.06), M.plate, 0.6, 0);
      P.eye = add(body, new THREE.SphereGeometry(0.12, 14, 10), M.energy, 0.18, 1.8);
      break;
    }
    case 'turret': {
      add(body, new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.plate, 0, 0);
      P.gun = grp(body, 0, 0.25, 0);
      const b = add(P.gun, new THREE.CylinderGeometry(0.07, 0.09, 0.8, 10), M.joint, 0.4, 0, 0); b.rotation.z = Math.PI / 2;
      P.eye = add(P.gun, new THREE.SphereGeometry(0.07, 10, 8), M.energy, 0.82, 0, 0);
      break;
    }
    case 'drone': {   // a flattened ceramic pod under a spinning rotor ring, one magenta eye
      P.core = grp(body, 0, 0.3, 0);
      add(P.core, new THREE.SphereGeometry(0.3, 18, 12), M.plate).scale.set(1.2, 0.72, 1.2);
      P.eye = add(P.core, new THREE.SphereGeometry(0.1, 12, 10), M.energy, 0.31, -0.02);
      add(P.core, rbox(0.5, 0.04, 0.05, 0.01), M.energy, 0, -0.2);                                 // underglow
      for (const z of [0.26, -0.26]) add(P.core, rbox(0.3, 0.12, 0.05, 0.02), M.joint, -0.12, -0.06, z);   // fins
      P.rotor = grp(P.core, 0, 0.24, 0);
      const ring = add(P.rotor, new THREE.TorusGeometry(0.44, 0.035, 6, 28), M.joint); ring.rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) { const blade = add(P.rotor, rbox(0.82, 0.02, 0.08, 0.01), M.plate); blade.rotation.y = i * Math.PI / 3; }
      break;
    }
    case 'mortar': {  // squat emplacement with a tilted tube; the rim glows when it fires
      add(body, new THREE.CylinderGeometry(0.56, 0.64, 0.3, 20), M.joint, 0, 0.15);
      P.torso = grp(body, 0, 0.55, 0);
      add(P.torso, rbox(0.82, 0.5, 0.82, 0.14), M.plate);
      P.eye = add(P.torso, rbox(0.05, 0.07, 0.5, 0.02), M.energy, 0.41, 0.06);
      P.tube = grp(P.torso, 0.05, 0.22, 0);
      add(P.tube, new THREE.CylinderGeometry(0.17, 0.21, 0.95, 14), M.plate, 0, 0.47);
      P.muzzle = add(P.tube, new THREE.TorusGeometry(0.17, 0.045, 6, 16), M.energy, 0, 0.95); P.muzzle.rotation.x = Math.PI / 2;
      P.tube.rotation.z = -0.45;
      break;
    }
    case 'charger': { // low, wide, four-legged; a ram plate with magenta slits and two energy horns
      P.legs = [];
      for (const [x, z] of [[0.38, 0.3], [-0.38, 0.3], [0.38, -0.3], [-0.38, -0.3]]) {
        const l = grp(body, x, 0.62, z); add(l, cap(0.09, 0.42), M.joint, 0, -0.3); P.legs.push(l);
      }
      P.torso = grp(body, 0, 0.9, 0);
      add(P.torso, rbox(1.1, 0.66, 0.82, 0.2), M.joint, -0.05, 0);
      P.ram = add(P.torso, rbox(0.3, 0.78, 0.92, 0.12), M.plate, 0.56, 0.02);
      for (const y of [-0.12, 0.16]) add(P.ram, rbox(0.04, 0.05, 0.6, 0.02), M.energy, 0.16, y);
      P.horns = [];
      for (const z of [0.3, -0.3]) { const h = add(P.torso, new THREE.ConeGeometry(0.07, 0.4, 6), M.energy, 0.66, 0.46, z); h.rotation.z = -1.0; P.horns.push(h); }
      P.plates = [add(P.torso, rbox(0.72, 0.16, 0.86, 0.07), M.plate, -0.12, 0.4)];   // armor plate: gone once broken
      break;
    }
  }
  return R;
}

export function animateEnemy(R, e, dt, t) {
  const P = R.parts, M = R.mats;
  R.flip.scale.x = e.type === 'shield' ? e.shieldDir : e.facing;
  let lean = 0, glow = 2.2;
  const s = e.state;
  if (s === 'windup' || s === 'slamWindup' || s === 'aim') {
    lean = -0.18; glow = 3.5 + Math.sin(t * 30) * 1.2;
    if (s === 'slamWindup') { lean = -0.3; glow = 5 + Math.sin(t * 45) * 2; R.body.position.x = Math.sin(t * 70) * 0.03; }
  } else if (s === 'lock') { glow = 6; }
  else if (s === 'attack') lean = 0.35;
  else if (s === 'charge') { lean = 0.28; glow = 5; }
  else if (s === 'dazed') { lean = -0.3 + Math.sin(t * 7) * 0.1; glow = 0.5; }
  else if (s === 'stagger') { lean = -0.35 + Math.sin(t * 9) * 0.12; glow = 0.6; }
  else if (s === 'hitstun') lean = -0.2;
  else if (s === 'launched') lean = Math.sin(t * 12) * 0.5;
  else if (s === 'caught') lean = 0.3;
  if (s !== 'slamWindup') R.body.position.x = 0;
  R.lean += (lean - R.lean) * 0.35;
  R.body.rotation.z = -R.lean;
  M.energy.emissiveIntensity = glow;
  M.plate.emissiveIntensity = e.flash > 0 ? 0.9 : 0;

  if (e.type === 'swarmer') {
    const moving = Math.abs(e.vx) > 0.5 && e.onGround;
    R.bob = moving ? Math.abs(Math.sin(t * 16)) * 0.12 : R.bob * 0.8;
    P.core.position.y = 0.42 + R.bob + (s === 'windup' ? -0.1 : 0);
  } else if (e.type === 'sniper') {
    if (s === 'aim' || s === 'lock') {
      const dx = (e.aimX - e.x) * e.facing, dy = e.aimY - (e.y + 1.35);
      P.gun.rotation.z = Math.atan2(dy, Math.max(0.1, dx));
    } else P.gun.rotation.z *= 0.9;
  } else if (e.type === 'brute') {
    P.plates.forEach((pl, i) => { pl.visible = i < e.armor; });
    const swing = s === 'windup' ? -1.2 : s === 'attack' ? 1.4 : s === 'slamWindup' ? -2.6 : s === 'slamRecover' && e.st < 8 ? 1.2 : 0;
    P.armN.rotation.z += (swing - P.armN.rotation.z) * 0.3;
    P.armF.rotation.z += ((s === 'slamWindup' ? -2.6 : s === 'slamRecover' && e.st < 8 ? 1.2 : 0.1) - P.armF.rotation.z) * 0.3;
    M.energy.emissiveIntensity = glow + (3 - e.armor) * 0.8;
  } else if (e.type === 'post') {
    const target = s === 'windup' ? -0.9 : s === 'attack' ? 1.1 : 0;
    P.arm.rotation.z += (target - P.arm.rotation.z) * 0.3;
  } else if (e.type === 'drone') {
    P.rotor.rotation.y += dt * (s === 'windup' ? 40 : 22);
    P.core.rotation.z = -Math.max(-0.4, Math.min(0.4, e.vx * 0.06 * e.facing));
  } else if (e.type === 'mortar') {
    const raise = s === 'windup' ? Math.min(1, e.st / 20) : 0, kick = s === 'recover' && e.st < 10 ? 1 - e.st / 10 : 0;
    P.tube.rotation.z = -0.45 + raise * 0.25 - kick * 0.2;
    P.tube.scale.y = 1 - kick * 0.18;
  } else if (e.type === 'charger') {
    P.plates.forEach(pl => { pl.visible = e.armor > 0; });
    const run = s === 'charge' ? 26 : Math.abs(e.vx) > 0.5 ? 12 : 0, paw = s === 'windup' ? Math.sin(t * 22) * 0.35 : 0;
    P.legs.forEach((l, i) => { l.rotation.z = run ? Math.sin(t * run + i * Math.PI / 2) * 0.55 : i === 0 ? paw : 0; });
  } else if (e.type === 'turret') {
    const tg = e.target;
    if (tg) { const a = Math.atan2(tg.y + 1 - (e.y + 0.25), (tg.x - e.x) * e.facing); P.gun.rotation.z += (a - P.gun.rotation.z) * 0.2; }
  }

  if (e.dead) {
    const k = Math.min(1, e.deathT / 40);
    R.root.scale.setScalar(Math.max(0.01, 1 - k * 0.9));
    R.body.rotation.z = -0.8 * k;
  }
}
