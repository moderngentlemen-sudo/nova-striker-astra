// Procedural character rigs for Nova and Echo (placeholder art that keeps each silhouette's
// defining features: Nova's Sentinel Bracer and visor helmet; Echo's scarf, collar, gauntlets, staff).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CHARS, MOVES, SCARF, SETTINGS, ATTACH_LOOK, DASH_CHARGE, HUNTER } from './config.js';
import { chargeStage, burstStage } from './player.js';

const rbox = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 12);

// Fresnel rim so characters separate from bright backgrounds (readability, especially in 4P)
// The uniforms persist on mat.userData.rim so Echo's Veil can turn the rim into a shimmering outline;
// rimAlpha keeps that outline visible while the rest of the body fades out.
export function addRim(mat, color, strength = 0.45, power = 2.4) {
  const u = { rimColor: { value: new THREE.Color(color) }, rimStrength: { value: strength }, rimAlpha: { value: 0 } };
  mat.userData.rim = u; mat.userData.rimBase = strength; mat.userData.rimCol = new THREE.Color(color);
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = 'uniform vec3 rimColor; uniform float rimStrength; uniform float rimAlpha;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      vec3 rimV = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
      float rimF = pow(1.0 - clamp(abs(dot(normal, rimV)), 0.0, 1.0), ${power.toFixed(2)});
      totalEmissiveRadiance += rimColor * rimF * rimStrength;
      diffuseColor.a = max(diffuseColor.a, rimF * rimAlpha);`);
  };
  mat.customProgramCacheKey = () => 'rim-' + power.toFixed(2);
}

function mats(c) {
  const std = (color, rough, metal = 0.08) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  return {
    base: std(c.base, 0.36), trim: std(c.trim, 0.42, 0.18), under: std(c.under, 0.72),
    energy: new THREE.MeshStandardMaterial({ color: c.energy, emissive: c.energy, emissiveIntensity: 2.4, roughness: 0.3 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x0b1018, roughness: 0.12, metalness: 0.7 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffa53a, emissive: 0xff8a1a, emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.72 }),
  };
}
function rimAll(M) { for (const k of ['base', 'trim', 'under']) addRim(M[k], '#d6ecff', k === 'under' ? 0.35 : 0.5); return M; }

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m;
}
function group(x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); return g; }

function limb(parent, M, upperLen, lowerLen, r, z, isArm) {
  const top = group(0, 0, z); parent.add(top);
  top.add(mesh(cap(r, upperLen - r), isArm ? M.under : M.under, 0, -upperLen / 2));
  const joint = group(0, -upperLen, 0); top.add(joint);
  joint.add(mesh(cap(r * 0.92, lowerLen - r), M.under, 0, -lowerLen / 2));
  const end = group(0, -lowerLen, 0); joint.add(end);
  return { top, joint, end };
}

export function buildPlayerRig(charId) {
  const c = CHARS[charId], M = rimAll(mats(c)), nova = charId === 'nova';
  const root = group(), flip = group(), body = group();
  root.add(flip); flip.add(body);
  const hips = group(0, 0.95, 0); body.add(hips);
  hips.add(mesh(rbox(0.34, 0.2, 0.38, 0.07), M.trim, 0, 0.02));
  const spine = group(0, 0.08, 0); hips.add(spine);
  // Torso: armored chest over the undersuit
  spine.add(mesh(rbox(0.3, 0.3, 0.34, 0.08), M.under, 0, 0.18));
  const chestW = nova ? 0.5 : 0.44;
  spine.add(mesh(rbox(nova ? 0.38 : 0.34, 0.34, chestW, 0.1), M.base, 0.02, 0.42));
  spine.add(mesh(rbox(0.05, 0.05, chestW * 0.7, 0.02), M.energy, nova ? 0.2 : 0.18, 0.44));   // chest seam
  // Shoulders
  for (const z of [0.28, -0.28]) spine.add(mesh(rbox(0.26, 0.16, 0.2, 0.07), nova ? M.base : M.trim, 0, 0.55, z * (nova ? 1.05 : 0.95)));
  // Head
  const head = group(0, 0.66, 0); spine.add(head);
  const heads = {};
  if (nova) head.add(mesh(new THREE.SphereGeometry(0.15, 20, 16), M.base, 0, 0.1));
  if (nova) {
    head.add(mesh(rbox(0.2, 0.08, 0.28, 0.03), M.visor, 0.07, 0.11));
    head.add(mesh(rbox(0.04, 0.02, 0.26, 0.01), M.energy, 0.17, 0.11));
    head.add(mesh(rbox(0.18, 0.05, 0.1, 0.02), M.trim, -0.05, 0.25));      // helmet crest
  } else {
    // Neutral face core: his face and hair come from your approved reference, not from here
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xc9bdb1, roughness: 0.85 });
    head.add(mesh(new THREE.SphereGeometry(0.14, 24, 18), faceMat, 0, 0.1));
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.4 });
    for (const z of [0.045, -0.045]) head.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat, 0.128, 0.125, z));
    // Short, messy blond hair (shown with the bare face and the mask; tucked away under the helmet)
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xd9b464, roughness: 0.8 });
    const hair = group(0, 0.1, 0); head.add(hair);
    const hairCap = mesh(new THREE.SphereGeometry(0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat);
    hairCap.rotation.z = 0.35; hair.add(hairCap);   // tilted back: hairline above the brow, fuller at the back
    for (const [x, y, z, rz] of [[0.09, 0.1, 0.05, -0.9], [0.1, 0.09, -0.04, -1.05], [0.05, 0.13, 0.0, -0.6], [0.0, 0.14, -0.06, -0.3]]) {
      const tuft = mesh(new THREE.ConeGeometry(0.035, 0.09, 5), hairMat, x, y, z); tuft.rotation.z = rz; hair.add(tuft);
    }
    // Full helmet: open-faced shell with a semi-transparent amber visor (face stays visible)
    const helmet = group(); head.add(helmet);
    helmet.add(mesh(new THREE.SphereGeometry(0.165, 28, 18, Math.PI + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.78), M.base, 0, 0.1));
    const visor = mesh(new THREE.SphereGeometry(0.17, 20, 14, Math.PI - 0.98, 1.96, 0.62, 1.2), M.amber, 0, 0.1);
    helmet.add(visor);
    for (const z of [0.15, -0.15]) helmet.add(mesh(rbox(0.07, 0.03, 0.02, 0.008), M.energy, 0.02, 0.17, z));
    // Survival mask: covers the lower face and both ears; eyes stay visible
    const mask = group(); head.add(mask);
    mask.add(mesh(new THREE.SphereGeometry(0.152, 24, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), M.base, 0, 0.1));
    for (const z of [0.148, -0.148]) {
      const ear = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), M.trim, -0.01, 0.1, z); ear.rotation.x = Math.PI / 2; mask.add(ear);
    }
    for (const z of [0.03, -0.03]) mask.add(mesh(rbox(0.02, 0.018, 0.03, 0.006), M.energy, 0.148, 0.03, z));
    heads.helmet = helmet; heads.mask = mask; heads.hair = hair;
    // Protective collar the scarf is built into
    const ring = mesh(new THREE.TorusGeometry(0.17, 0.06, 10, 20), M.trim, 0.0, 0.62);
    ring.rotation.x = Math.PI / 2; spine.add(ring);
  }
  const collar = group(-0.2, 0.58, 0.16); spine.add(collar);

  const armN = limb(spine, M, 0.3, 0.29, 0.065, 0.3, true);
  const armF = limb(spine, M, 0.3, 0.29, 0.065, -0.3, true);
  armN.top.position.y = 0.53; armF.top.position.y = 0.53;
  for (const a of [armN, armF]) a.end.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), M.under, 0, -0.03));
  const legN = limb(hips, M, 0.46, 0.46, 0.085, 0.13, false);
  const legF = limb(hips, M, 0.46, 0.46, 0.085, -0.13, false);
  for (const l of [legN, legF]) {
    l.top.add(mesh(rbox(0.2, 0.26, 0.2, 0.07), M.base, 0.02, -0.18));                  // thigh plate
    l.joint.add(mesh(rbox(0.19, 0.3, 0.18, 0.06), nova ? M.base : M.trim, 0.03, -0.24)); // shin guard
    l.end.add(mesh(rbox(0.26, 0.1, 0.16, 0.04), M.trim, 0.06, -0.02));                   // boot
  }
  // Marksman kit: skate blades kept subtle, just a fine gold line along each side of the sole;
  // light-booster jets under the boots, shown only while they fire
  const blades = [], jets = [];
  if (nova) {
    const jetMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const l of [legN, legF]) {
      const j = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 10, 1, true), jetMat); j.rotation.z = Math.PI; j.position.set(0.04, -0.26, 0);
      j.visible = false; l.end.add(j); jets.push(j);
    }
    const bladeMat = new THREE.MeshStandardMaterial({ color: c.energy, emissive: c.energy, emissiveIntensity: 1.6, roughness: 0.3 });
    for (const l of [legN, legF]) for (const z of [0.083, -0.083]) {
      const b = mesh(rbox(0.28, 0.018, 0.01, 0.004), bladeMat, 0.06, -0.066, z); l.end.add(b); blades.push(b);
    }
  }

  const extra = {};
  if (nova) {
    // CP-07: the Sentinel Bracer, gun and shield in one device
    const bracer = group(0, -0.14, 0); armN.joint.add(bracer);
    bracer.add(mesh(rbox(0.16, 0.34, 0.2, 0.04), M.base, 0.02, 0));
    bracer.add(mesh(rbox(0.05, 0.3, 0.14, 0.02), M.trim, 0.1, 0));
    bracer.add(mesh(rbox(0.03, 0.22, 0.03, 0.01), M.energy, 0.12, -0.02, 0.06));
    const muzzle = mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.08, 12), M.energy, 0.0, -0.2, 0); bracer.add(muzzle);
    extra.muzzle = muzzle;   // charge effects gather here
    const shield = group(0.14, -0.1, 0); bracer.add(shield);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: c.energy, emissiveIntensity: 1.6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.2 });
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.55, 6), plateMat); plate.rotation.y = Math.PI / 2; shield.add(plate);
    shield.scale.setScalar(0.001);
    extra.bracer = bracer; extra.shield = shield; extra.plateMat = plateMat;
    // Marksman kit: the loaded attachment, tinted to match the HUD
    const moduleMat = new THREE.MeshStandardMaterial({ color: ATTACH_LOOK.lance.tint, emissive: ATTACH_LOOK.lance.tint, emissiveIntensity: 2.2, roughness: 0.3 });
    const module = mesh(rbox(0.07, 0.1, 0.09, 0.02), moduleMat, 0.11, 0.09, 0); bracer.add(module);
    extra.module = module; extra.moduleMat = moduleMat;
    // Back pack
    spine.add(mesh(rbox(0.14, 0.3, 0.3, 0.05), M.trim, -0.22, 0.4));
  } else {
    // Gauntlet multi-tools
    for (const a of [armN, armF]) {
      a.joint.add(mesh(rbox(0.15, 0.24, 0.16, 0.04), M.trim, 0.01, -0.15));
      a.joint.add(mesh(rbox(0.03, 0.2, 0.03, 0.01), M.energy, 0.09, -0.15));
    }
    // Hunter kit: hard-light combat blades that extend from both gauntlets past the fist
    const bladeGeo = new THREE.BoxGeometry(0.035, 0.62, 0.11);
    const bladeN = mesh(bladeGeo, M.energy, 0.02, -0.36, 0), bladeF = mesh(bladeGeo, M.energy, 0.02, -0.36, 0);
    armN.end.add(bladeN); armF.end.add(bladeF); bladeN.visible = bladeF.visible = false;
    extra.blade = bladeN; extra.bladeF = bladeF;
    // Staff: stowed diagonally on the back, drawn into the hands for staff moves and rifle shots
    const staffGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.5, 10);
    const back = mesh(staffGeo, M.trim, -0.24, 0.42, 0); back.rotation.z = 0.9; spine.add(back);
    const bt1 = mesh(new THREE.ConeGeometry(0.06, 0.4, 4), M.energy, 0, 0.95, 0), bt2 = mesh(new THREE.ConeGeometry(0.06, 0.4, 4), M.energy, 0, -0.95, 0);
    bt2.rotation.z = Math.PI; bt1.scale.z = bt2.scale.z = 0.35; back.add(bt1); back.add(bt2); extra.backTips = [bt1, bt2];
    const hand = group(0, -0.02, 0); armN.end.add(hand);
    const hs = mesh(staffGeo, M.trim, 0, 0, 0); hs.rotation.z = Math.PI / 2; hand.add(hs);
    for (const s of [-0.75, 0.75]) hand.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), M.energy, s, 0, 0));
    // Glaive edges on both ends (Hunter kit)
    const tipGeo = new THREE.ConeGeometry(0.07, 0.5, 4);
    const tipA = mesh(tipGeo, M.energy, 1.0, 0, 0), tipB = mesh(tipGeo, M.energy, -1.0, 0, 0);
    tipA.rotation.z = -Math.PI / 2; tipB.rotation.z = Math.PI / 2; tipA.scale.z = tipB.scale.z = 0.35;
    hand.add(tipA); hand.add(tipB); extra.glaive = [tipA, tipB];
    const staffTip = group(1.05, 0, 0); hand.add(staffTip); extra.staffTip = staffTip;   // rifle muzzle (front tip)
    hand.visible = false; extra.hand = hand;
    extra.backStaff = back; extra.handStaff = hand;
    // Utility belt
    hips.add(mesh(rbox(0.36, 0.07, 0.4, 0.03), M.under, 0, 0.1));
    for (const z of [-0.12, 0.12]) hips.add(mesh(rbox(0.08, 0.09, 0.07, 0.02), M.trim, 0.17, 0.08, z));
    // Hunter kit: two energy snares clipped to the belt
    extra.beltSnares = [];
    for (const z of [0.22, -0.22]) {
      const g = group(-0.03, 0.05, z); hips.add(g);
      const disc = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.035, 18), M.under); disc.rotation.x = Math.PI / 2; g.add(disc);
      const ring = mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 18), M.energy, 0, 0, z > 0 ? 0.02 : -0.02); g.add(ring);
      extra.beltSnares.push(g);
    }
  }

  extra.blades = blades; extra.jets = jets;
  root.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
  const rig = { root, flip, body, hips, spine, head, collar, armN, armF, legN, legF, extra, mats: M, char: charId, phase: 0, cur: {}, scarf: null, heads, headMode: null,
    flipAng: 0, stretch: 0, lastVy: 0, wasGround: true, lastRocketT: 0 };
  rig.setHead = mode => {
    if (nova || rig.headMode === mode) return;
    rig.headMode = mode; heads.helmet.visible = mode === 'helmet'; heads.mask.visible = mode === 'mask'; heads.hair.visible = mode !== 'helmet';
  };
  rig.setHead('helmet');

  // Veil (Echo): the body turns glassy and a pale rim outlines it. Collected before render.js adds the
  // player-colour ring, so the ring stays solid for teammates.
  const SHIMMER = new THREE.Color('#e6f4ff');
  const cloakMats = new Set(); root.traverse(o => { if (o.isMesh) cloakMats.add(o.material); });
  const cloakBase = [...cloakMats].map(m => ({ m, op: m.opacity, tr: m.transparent, energy: m === M.energy }));
  rig.cloak = 0;
  rig.setCloak = k => {
    k = Math.max(0, Math.min(1, k));
    if (k === rig.cloak) return;
    const flip = (rig.cloak > 0.001) !== (k > 0.001); rig.cloak = k;
    for (const b of cloakBase) {
      if (flip) { b.m.transparent = k > 0.001 || b.tr; b.m.needsUpdate = true; }
      b.m.opacity = b.op * (1 - (b.energy ? 0.55 : 0.88) * k);
      const r = b.m.userData.rim;
      if (r) {
        r.rimStrength.value = b.m.userData.rimBase + 1.8 * k; r.rimAlpha.value = 0.95 * k;
        r.rimColor.value.copy(b.m.userData.rimCol).lerp(SHIMMER, k);
      }
    }
  };
  return rig;
}

// ---- Procedural animation --------------------------------------------------------------

const J = ['spine', 'shN', 'elN', 'shF', 'elF', 'hipN', 'knN', 'hipF', 'knF', 'hipY', 'bodyZ'];

function basePose() {
  return { spine: 0.04, shN: 0.12, elN: 0.3, shF: -0.1, elF: 0.3, hipN: 0.04, knN: -0.08, hipF: -0.04, knF: -0.08, hipY: 0.95, bodyZ: 0 };
}

function staffMove(id) { return id && MOVES[id] && MOVES[id].staff; }
// Rocket backflip: a big, near-vertical launch, while he is not busy shooting
function rocketFlipping(p) { return !!p.rocketFlip && p.rocketT > 0 && p.rocketT <= 50 && !p.onGround && !(p.chargeT > 0 || p.burstT > 0 || p.fireCd > 0 || p.recoilT > 0); }
const dashLevelOf = p => (p.state !== 'dashCharge' ? 0 : p.dashChargeT >= DASH_CHARGE.charge[2] ? 3 : p.dashChargeT >= DASH_CHARGE.charge[1] ? 2 : p.dashChargeT >= DASH_CHARGE.charge[0] ? 1 : 0);

export function animatePlayer(rig, p, dt, t) {
  const P = basePose();
  const run = Math.abs(p.vx);
  let snap = 0.3;
  const st = p.state;
  const aimAng = Math.atan2(p.aimY, Math.abs(p.aimX) < 1e-3 ? 1e-3 : p.aimX * p.facing);
  const moveId = p.moveId;
  if (st === 'downed' || st === 'dead') {
    P.bodyZ = 1.45; P.hipY = 0.2; P.shN = 2.6; P.shF = 2.2; P.hipN = 0.2; P.hipF = -0.1; snap = 0.2;
  } else if (st === 'slide') {
    P.hipY = 0.5; P.spine = -0.35; P.hipN = 1.4; P.knN = -0.15; P.hipF = -0.2; P.knF = -1.5; P.shN = -0.6; P.shF = -0.9; snap = 0.5;
  } else if (st === 'dashCharge') {
    // Coiled low, weight forward, arms swept back; trembling once the charge is strong
    const k = Math.min(1, p.dashChargeT / DASH_CHARGE.charge[0]);
    P.hipY = 0.95 - 0.3 * k; P.spine = 0.1 + 0.45 * k; P.hipN = 0.4 + 0.9 * k; P.knN = -0.3 - 1.5 * k; P.hipF = -0.2 - 0.45 * k; P.knF = -0.2 - 0.5 * k;
    P.shN = -0.4 - 0.7 * k; P.elN = 0.5; P.shF = -0.6 - 0.7 * k; P.elF = 0.5; snap = 0.35;
    if (p.dashChargeT >= DASH_CHARGE.charge[1]) P.hipY += (Math.random() - 0.5) * (p.dashChargeT >= DASH_CHARGE.charge[2] ? 0.035 : 0.018);
  } else if (st === 'dash' || st === 'zip') {
    P.spine = 0.55; P.hipN = -0.4; P.knN = -0.9; P.hipF = -0.9; P.knF = -0.5; P.shN = -1.0; P.shF = -1.2; P.elN = 0.2; snap = 0.5;
    const dy = st === 'dash' && p.dash ? p.dash.dy : Math.sign(p.vy) * 0.4;
    P.bodyZ = Math.atan2(dy, 1) * 0.8;
  } else if (st === 'dive') {
    P.spine = 1.0; P.bodyZ = -0.7; P.hipN = -0.3; P.hipF = -0.6; P.knN = -1.0; P.knF = -1.2; P.shN = 2.4; P.shF = 2.2; snap = 0.5;
  } else if (st === 'vb') {
    const k = Math.min(1, p.st / 3);
    P.spine = 0.35 * k; P.hipN = 0.7; P.knN = -0.6; P.hipF = -0.6; P.knF = -0.3; P.hipY = 0.82;
    if (p.char === 'nova') { P.shN = 1.57; P.elN = 0.05; P.shF = 0.9; P.elF = 1.2; }
    else { P.shN = 2.6 - 1.6 * k; P.shF = 2.4 - 1.5 * k; P.elN = 0.3; P.elF = 0.4; }
    snap = 0.65;
  } else if (st === 'attack' && p.move) {
    const m = p.move, u = p.st;
    const wind = u < m.su, act = u >= m.su && u < m.su + m.ac;
    const k = wind ? u / m.su : act ? 1 : 1 - Math.min(1, (u - m.su - m.ac) / m.rc) * 0.6;
    snap = 0.6;
    if (moveId === 'nova_air' ) { P.hipN = wind ? 0.4 : 1.6 * k; P.knN = -0.1; P.hipF = -0.3; P.knF = -0.8; P.shN = 0.8; P.shF = 1.2; }
    else if (moveId === 'nova_shove' || moveId === 'nova_brace') { P.spine = wind ? -0.1 : 0.35; P.shN = wind ? 0.6 : 1.55; P.shF = wind ? 0.5 : 1.45; P.elN = wind ? 1.4 : 0.15; P.elF = wind ? 1.4 : 0.2; P.hipN = 0.6; P.knN = -0.5; P.hipF = -0.5; }
    else if (m.cross) { P.shN = wind ? 0.4 : 1.65 * k; P.shF = wind ? 0.3 : 1.55 * k; P.elN = wind ? 1.4 : 0.15; P.elF = wind ? 1.5 : 0.2; P.spine = wind ? 0 : 0.28; }
    else if (m.offhand || moveId === 'nova_jab2' || moveId === 'echo_g2' || moveId === 'echo_air2') { P.shF = wind ? 0.3 : 1.6 * k; P.elF = wind ? 1.5 : 0.1; P.shN = 0.4; P.elN = 1.2; P.spine = 0.2; }
    else if (m.launcher) { P.shN = wind ? -0.3 : 2.9 * k; P.shF = wind ? -0.2 : 2.7 * k; P.elN = 0.2; P.elF = 0.3; P.spine = wind ? 0.3 : -0.2; P.hipY = wind ? 0.8 : 0.95; }
    else if (moveId === 'echo_charged') { P.shN = wind ? 3.0 : 0.7; P.shF = wind ? 2.9 : 0.6; P.elN = 0.2; P.elF = 0.3; P.spine = wind ? -0.25 : 0.55; P.hipN = 0.7; P.knN = -0.7; P.hipF = -0.5; P.hipY = 0.85; }
    else if (staffMove(moveId)) { P.shN = wind ? 2.4 : 0.5 + 1.2 * (1 - k); P.shF = wind ? 2.3 : 0.4 + 1.1 * (1 - k); P.elN = 0.2; P.elF = 0.2; P.spine = wind ? -0.15 : 0.4; }
    else { P.shN = wind ? 0.3 : 1.6 * k; P.elN = wind ? 1.5 : 0.1; P.shF = 0.5; P.elF = 1.2; P.spine = wind ? 0 : 0.22; }
  } else if (st === 'parry') {
    P.shN = 1.3; P.elN = 1.7; P.shF = 1.1; P.elF = 1.8; P.spine = -0.08; P.hipN = 0.3; P.knN = -0.4; P.hipY = 0.9; snap = 0.7;
  } else if (st === 'hitstun') {
    P.spine = -0.4; P.shN = 0.9; P.shF = 1.3; P.elN = 0.6; P.hipN = 0.3; P.knN = -0.5; snap = 0.5;
  } else if (st === 'bulwark') {
    P.spine = 0.15; P.shN = aimAng + Math.PI / 2 + P.spine; P.elN = 0.02; P.shF = 0.7; P.elF = 1.1; P.hipN = 0.5; P.knN = -0.4; P.hipF = -0.4; snap = 0.7;
  } else if (st === 'lash') {
    P.spine = 0.2; P.shN = aimAng + Math.PI / 2 + P.spine; P.elN = 0.05; P.shF = 0.3; snap = 0.6;
  } else if (!p.onGround) {
    const flipping = rocketFlipping(p);
    // Back to the wall: the far hand reaches back to it, the near (weapon) arm stays free, one boot drags
    if (flipping) { P.hipN = 1.7; P.knN = -2.3; P.hipF = 1.5; P.knF = -2.1; P.shN = 0.9; P.elN = 1.7; P.shF = 0.7; P.elF = 1.8; P.spine = 0.4; snap = 0.5; }
    else if (p.wallSliding) { P.shF = -2.2; P.elF = 0.35; P.shN = 0.55; P.elN = 0.9; P.hipN = 0.75; P.knN = -1.25; P.hipF = -0.35; P.knF = -0.45; P.spine = -0.12; snap = 0.4; }
    else if (p.rocketT > 0 && p.vy > 4) { P.hipN = 0.5; P.knN = -0.9; P.hipF = -0.2; P.knF = -0.6; P.shN = -0.5; P.shF = -0.7; P.elN = 0.2; P.elF = 0.2; P.spine = -0.05; }
    else if (p.vy > 0) { P.hipN = 0.9; P.knN = -1.4; P.hipF = 0.25; P.knF = -0.8; P.shN = 1.6; P.shF = 1.2; P.spine = 0.1; }
    else { P.hipN = 0.35; P.knN = -0.45; P.hipF = -0.25; P.knF = -0.7; P.shN = 1.0; P.shF = 0.8; P.spine = 0.06; }
  } else if (p.crouch) {
    P.hipY = 0.62; P.hipN = 1.1; P.knN = -1.9; P.hipF = 0.8; P.knF = -1.7; P.spine = 0.25; P.shN = 0.4; P.shF = 0.3;
  } else if (run > 0.6) {
    const back = p.vx * p.facing < 0;
    rig.phase += dt * run * 1.75 * (back ? -1 : 1);
    const s = Math.sin(rig.phase), c = Math.cos(rig.phase), amp = Math.min(1, run / 7);
    P.hipN = s * 0.85 * amp; P.hipF = -s * 0.85 * amp;
    P.knN = -Math.max(0, -c) * 1.3 * amp - 0.12; P.knF = -Math.max(0, c) * 1.3 * amp - 0.12;
    P.shN = -s * 0.75 * amp; P.shF = s * 0.75 * amp; P.elN = 0.8; P.elF = 0.8;
    P.spine = (back ? 0.02 : 0.2) * amp; P.hipY = 0.95 - Math.abs(c) * 0.05;
  } else {
    P.spine = 0.04 + Math.sin(t * 2) * 0.012;
  }

  // Aiming layer: Nova's bracer arm and Echo's staff-rifle follow the aim while shooting
  const rifle = p.char === 'echo' && (p.rifleT >= HUNTER.rifle.raise || (p.rifleCd > 0 && (p.rifleCdMax || 0) - p.rifleCd < 14));
  const shooting = (p.chargeT > 0 || p.fireCd > 0 || p.recoilT > 0 || rifle || (p.aimFree && p.char === 'nova')) && ['normal', 'dash', 'slide'].includes(st) && !rocketFlipping(p);
  if (p.recoilT > 4) P.spine -= 0.15 * (p.recoilT - 4) / 6;   // Recoil Burst kick
  if (shooting) {
    P.shN = aimAng + Math.PI / 2 + P.spine; P.elN = 0.02;
    if (p.char === 'echo') { P.shF = aimAng + Math.PI / 2 + P.spine - 0.25; P.elF = 0.5; }
  }

  const cur = rig.cur;
  for (const k of J) cur[k] = cur[k] === undefined ? P[k] : cur[k] + (P[k] - cur[k]) * snap;
  // Rocket backflip: one full turn in the first part of a big launch. If something cuts it short, the
  // body finishes the turn forward instead of unwinding.
  if (rocketFlipping(p)) {
    const e = Math.min(1, (50 - p.rocketT) / 28);
    rig.flipAng = Math.PI * 2 * (1 - (1 - e) * (1 - e));
    cur.bodyZ = rig.flipAng;
    if (e >= 1) { rig.flipAng = 0; cur.bodyZ = 0; }
  } else if (rig.flipAng > 0) { cur.bodyZ = rig.flipAng - Math.PI * 2; rig.flipAng = 0; }
  // Squash and stretch: a stretch on a rocket launch, a squash on a hard landing
  if (p.rocketT > rig.lastRocketT) rig.stretch = 0.12 + 0.14 * (p.rocketPow || 0);
  if (p.onGround && !rig.wasGround && rig.lastVy < -15) rig.stretch = -Math.min(0.16, (-rig.lastVy - 12) * 0.012);
  rig.lastRocketT = p.rocketT; rig.wasGround = p.onGround; if (!p.onGround) rig.lastVy = p.vy;
  rig.stretch *= Math.exp(-dt * 9);
  const sy = 1 + rig.stretch, sxz = 1 / Math.sqrt(sy);
  rig.body.scale.set(sxz, sy, sxz);
  rig.spine.rotation.z = -cur.spine;
  rig.armN.top.rotation.z = cur.shN; rig.armN.joint.rotation.z = cur.elN;
  rig.armF.top.rotation.z = cur.shF; rig.armF.joint.rotation.z = cur.elF;
  rig.legN.top.rotation.z = cur.hipN; rig.legN.joint.rotation.z = cur.knN;
  rig.legF.top.rotation.z = cur.hipF; rig.legF.joint.rotation.z = cur.knF;
  rig.hips.position.y = cur.hipY;
  rig.body.rotation.z = cur.bodyZ;
  rig.body.position.y = st === 'downed' || st === 'dead' ? 0.1 : 0;

  // Suit details
  if (p.char === 'nova') {
    const ex = rig.extra;
    const open = st === 'bulwark' ? Math.min(1, p.st / 3) * (p.st < 12 ? 1 : Math.max(0, 1 - (p.st - 12) / 3)) : 0;
    const s = Math.max(0.001, open);
    ex.shield.scale.set(s, s, s);
    // The suit's energy lines brighten with each charge level (either weapon) and flash during a Perfect Release window
    const mk = SETTINGS.novaKit === 'marksman';
    const LV = { L1: 1, L2: 2, L3: 3, perfect: 3 };
    const stage = chargeStage(p), bstage = mk ? burstStage(p) : '';
    const charge = Math.max(LV[stage] || 0, LV[bstage] || 0, dashLevelOf(p)), flash = stage === 'perfect' || bstage === 'perfect';
    rig.mats.energy.emissiveIntensity = 2.2 + charge * 1.2 + (p.chargeT > 0 || p.burstT > 0 || p.dashChargeT > 0 ? Math.sin(t * 30) * 0.4 : 0) + (flash ? 2.5 : 0);
    ex.jets.forEach(j => { j.visible = !!p.thrusting; j.scale.set(1, 0.8 + Math.random() * 0.5, 1); });
    ex.module.visible = mk; ex.blades.forEach(b => { b.visible = mk; });
    if (mk && ex.moduleTint !== p.attachment) {
      const c = ATTACH_LOOK[p.attachment].tint; ex.moduleTint = p.attachment; ex.moduleMat.color.set(c); ex.moduleMat.emissive.set(c);
    }
  } else {
    const ex = rig.extra;
    const staffOut = (st === 'attack' && staffMove(moveId)) || (st === 'vb') || st === 'dive' || ((p.fireCd > 0 || p.chargeT > 0 || p.tracerCd > 60 || rifle) && ['normal', 'dash', 'slide'].includes(st));
    ex.handStaff.visible = staffOut; ex.backStaff.visible = !staffOut;
    // Rifle hold: the staff turns to lie along the forearm, pushed forward like a rifle barrel
    const rifleHold = rifle && staffOut && !(st === 'attack' || st === 'vb' || st === 'dive');
    ex.hand.rotation.z = rifleHold ? -Math.PI / 2 : 0; ex.hand.position.y = rifleHold ? -0.32 : -0.02;
    ex.glaive[1].visible = !rifleHold && SETTINGS.echoKit === 'hunter';
    const hunter = SETTINGS.echoKit === 'hunter';
    const bladeOut = st === 'attack' && p.move && p.move.blade;
    ex.blade.visible = !!bladeOut && (hunter ? true : !p.move.offhand);
    ex.bladeF.visible = !!bladeOut && hunter;
    ex.glaive[0].visible = hunter;
    ex.backTips.forEach(g => { g.visible = hunter; });
    ex.beltSnares.forEach((g, i) => { g.visible = hunter && i < p.snares; });
    rig.setHead(SETTINGS.echoHead || 'helmet');
    const flare = p.scarfMode === 'flare' && p.state !== 'downed';
    rig.mats.energy.emissiveIntensity = 2.0 + p.resolve / 50 + (flare ? 1.1 + Math.sin(t * 9) * 0.45 : 0) + dashLevelOf(p) * 1.1
      + (p.rifleT >= HUNTER.rifle.mark ? 1.2 + Math.sin(t * 24) * 0.5 : 0);
    const veil = p.scarfMode === 'veil' && p.state !== 'downed' ? Math.min(1, p.veilCharge / SCARF.veilFade) : 0;
    let ck = rig.cloak + (veil - rig.cloak) * (veil > rig.cloak ? 0.25 : 0.45);
    if (Math.abs(ck - veil) < 0.01) ck = veil;
    rig.setCloak(ck);
  }
}
