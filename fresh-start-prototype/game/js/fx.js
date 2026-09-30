// Visual effects: particles, glints, telegraph markers, projectiles, barriers, lasers, scarf.
import * as THREE from 'three';
import { pathFrame } from './level.js';
import { CHARS, HOSTILE, NOVA, SETTINGS, ATTACH_LOOK, DASH_CHARGE } from './config.js';
import { toWorld, planeDir } from './space.js';
import { Ghosts } from './ghosts.js';
import { buildPlayerRig } from './rigs.js';
import { ChargeFX } from './chargefx.js';
export { toWorld, planeDir };

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = () => canvasTex(64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const starTex = () => canvasTex(128, (g, s) => {
  g.translate(s / 2, s / 2); g.fillStyle = '#fff';
  for (let i = 0; i < 2; i++) {
    g.beginPath(); g.moveTo(0, -s * 0.48); g.lineTo(s * 0.05, 0); g.lineTo(0, s * 0.48); g.lineTo(-s * 0.05, 0); g.closePath(); g.fill();
    g.rotate(Math.PI / 2);
  }
  const r = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.18); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, s * 0.18, 0, Math.PI * 2); g.fill();
});
const ringTex = () => canvasTex(128, (g, s) => {
  g.strokeStyle = '#fff'; g.lineWidth = s * 0.07; g.beginPath(); g.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2); g.stroke();
});
const jagTex = () => canvasTex(128, (g, s) => {
  g.fillStyle = 'rgba(255,255,255,0)'; g.fillRect(0, 0, s, s); g.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) { const x = i * s / 4; g.beginPath(); g.moveTo(x, s); g.lineTo(x + s / 8, s * 0.25); g.lineTo(x + s / 4, s); g.closePath(); g.fill(); }
});

const PARTICLE_VS = `
attribute float size; attribute float alpha; attribute vec3 pcolor;
varying float vA; varying vec3 vC;
void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
const PARTICLE_FS = `
uniform sampler2D map; varying float vA; varying vec3 vC;
void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`;
// Smoke and dust are drawn with ordinary blending, so they show against the bright sky and floors
// where glowing (additive) particles wash out
const SMOKE_FS = `
uniform sampler2D map; varying float vA; varying vec3 vC;
void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }`;

export class FX {
  constructor(scene, rigs = new Map()) {
    this.scene = scene; this.rigs = rigs;
    this.tex = { glow: glowTex(), star: starTex(), ring: ringTex(), jag: jagTex() };
    this.tex.jag.wrapS = THREE.RepeatWrapping;
    // Particles (one draw call)
    const N = 1600; this.N = N; this.pi = 0;
    const g = new THREE.BufferGeometry();
    this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3);
    this.pSize = new Float32Array(N); this.pAlpha = new Float32Array(N);
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.pCol, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1));
    this.parts = Array.from({ length: N }, () => ({ life: 0, max: 1, v: new THREE.Vector3(), drag: 0.9, grav: 0, size: 0.3 }));
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: this.tex.glow } }, vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; scene.add(this.points);
    // Smoke/dust pool (ordinary blending)
    const SN = 500; this.SN = SN; this.si = 0;
    const sg = new THREE.BufferGeometry();
    this.sPos = new Float32Array(SN * 3); this.sCol = new Float32Array(SN * 3); this.sSize = new Float32Array(SN); this.sAlpha = new Float32Array(SN);
    sg.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3)); sg.setAttribute('pcolor', new THREE.BufferAttribute(this.sCol, 3));
    sg.setAttribute('size', new THREE.BufferAttribute(this.sSize, 1)); sg.setAttribute('alpha', new THREE.BufferAttribute(this.sAlpha, 1));
    this.sparts = Array.from({ length: SN }, () => ({ life: 0, max: 1, v: new THREE.Vector3(), drag: 0.9, grav: 0, size: 0.5, grow: 1, op: 0.5 }));
    const sm = new THREE.ShaderMaterial({ uniforms: { map: { value: this.tex.glow } }, vertexShader: PARTICLE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false });
    this.smokePts = new THREE.Points(sg, sm); this.smokePts.frustumCulled = false; this.smokePts.renderOrder = 1; scene.add(this.smokePts);
    // Billboard sprites (glints, rings)
    this.sprites = [];
    for (let i = 0; i < 48; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.star, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false; scene.add(s); this.sprites.push({ s, life: 0, max: 1, grow: 1, base: 1 });
    }
    // Enemy status glyphs ('?' lost track, '!' taunted): normal blending so they read on bright skies
    this.glyphTex = {}; this.glyphs = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
      s.visible = false; s.renderOrder = 10; scene.add(s); this.glyphs.push({ s, life: 0, max: 1, e: null });
    }
    this.arcs = []; this.projMeshes = new Map(); this.barrierMeshes = new Map(); this.lasers = new Map();
    this.shockMeshes = new Map(); this.markers = []; this.scarves = new Map(); this.telegraphs = [];
    this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3();
    this.buildProjectileTemplates();
    this.ghosts = new Ghosts(scene);
    this.charge = new ChargeFX(this);
    // Flat rings on the ground (shockwaves); a small pool
    this.rings = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.tex.ring, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); this.rings.push({ m, life: 0 });
    }
    this.ghostTick = new Map();
  }

  // Smoke or dust puffs (ordinary blending): they grow as they fade. opts: dir, spread, drag, grav, grow, op
  smoke(x, y, color, n = 6, speed = 2, size = 0.6, life = 0.6, opts = {}) {
    const c = new THREE.Color(color), w = toWorld(x, y, opts.depth ?? 0.15, this.tmp);
    for (let i = 0; i < n; i++) {
      const P = this.sparts[this.si], idx = this.si; this.si = (this.si + 1) % this.SN;
      const a = opts.dir !== undefined ? opts.dir + (Math.random() - 0.5) * (opts.spread || 1) : Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      planeDir(x, Math.cos(a) * sp, Math.sin(a) * sp, P.v);
      const f = pathFrame(x); P.v.x += f.nx * (Math.random() - 0.5) * sp * 0.3; P.v.z += f.nz * (Math.random() - 0.5) * sp * 0.3;
      this.sPos.set([w.x, w.y, w.z], idx * 3); this.sCol.set([c.r, c.g, c.b], idx * 3);
      P.life = P.max = life * (0.7 + Math.random() * 0.6); P.size = size * (0.7 + Math.random() * 0.6);
      P.drag = opts.drag ?? 0.92; P.grav = opts.grav ?? -0.6; P.grow = opts.grow ?? 1.8; P.op = opts.op ?? 0.5;
    }
  }
  updateSmoke(dt) {
    for (let i = 0; i < this.SN; i++) {
      const P = this.sparts[i];
      if (P.life <= 0) { this.sAlpha[i] = 0; continue; }
      P.life -= dt; P.v.multiplyScalar(Math.pow(P.drag, dt * 60)); P.v.y -= P.grav * dt;
      this.sPos[i * 3] += P.v.x * dt; this.sPos[i * 3 + 1] += P.v.y * dt; this.sPos[i * 3 + 2] += P.v.z * dt;
      const k = Math.max(0, P.life / P.max);
      this.sAlpha[i] = P.op * Math.min(1, k * 1.6); this.sSize[i] = P.size * (1 + (P.grow - 1) * (1 - k));
    }
    const g = this.smokePts.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.pcolor.needsUpdate = true;
  }

  // Compile every effect material once at start-up (with a stand-in of each effect briefly visible), so
  // the first rocket jump, charge or afterimage does not stall on shader compilation mid-fight
  warm(renderer, camera, target = null) {
    const keep = [], shown = [];
    const show = o => { o.traverse(q => { if (!q.visible) { q.visible = true; shown.push(q); } }); };
    // Stand-ins sit in front of the (not yet placed) camera, so warming also draws each one once
    const at = new THREE.Vector3(0, 0, -9), put = o => o.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0));
    const dummy = { char: 'nova' };
    const S = this.charge.of(dummy);
    for (const o of [S.orb, S.core, S.halo, S.crystal, S.sight, S.laser, S.laserDot, S.dots, S.aura, S.land, S.apex.group, S.apex.beam, ...S.motes, ...S.apex.ticks]) { put(o); show(o); }
    const stand = buildPlayerRig('nova'); stand.root.position.copy(at); this.scene.add(stand.root); stand.root.updateMatrixWorld(true);
    const g = this.ghosts.spawn(stand, '#ffb547', 0.01, 0.01); this.scene.remove(stand.root);
    // Its geometry goes; its materials stay referenced so their compiled shaders stay cached for the real rigs
    stand.root.traverse(q => { if (q.geometry) q.geometry.dispose(); });
    this.warmMats = []; stand.root.traverse(q => { if (q.material) this.warmMats.push(q.material); });
    for (const k in this.tmpl) { const m = this.tmpl[k](); put(m); this.scene.add(m); keep.push(m); }
    for (const it of this.sprites.slice(0, 3)) { put(it.s); it.s.visible = true; shown.push(it.s); }
    this.charge.shockRing(at, new THREE.Vector3(1, 0, 0), '#ffffff', 0.1, 0.2, 0.01, 0);
    this.charge.flash(at, 'glow', '#ffffff', 0.1, 0.01, 1);
    this.charge.trail({ kind: 'lance', team: 'p', level: 2 }, at);
    put(this.rings[0].m); show(this.rings[0].m); show(this.smokePts);
    this.particle(at, '#ffffff', 0.2, 0.01); this.smoke(0, 0, '#888888', 1, 0, 0.2, 0.01);
    // Compile for the target the scene is really drawn into (the bloom chain renders offscreen in linear
    // colour without tone mapping, which is a different shader variant from drawing to the screen)
    try {
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(target); renderer.compile(this.scene, camera); renderer.render(this.scene, camera);
      if (target) { renderer.setRenderTarget(null); renderer.compile(this.scene, camera); }   // low quality draws straight to the screen
      renderer.setRenderTarget(prev);
    } catch (e) { /* warm-up is best effort */ }
    for (const q of shown) q.visible = false;
    for (const m of keep) this.scene.remove(m);
    g.life = 0; g.root.visible = false;
    // The stand-ins stay (hidden): disposing their materials would let the renderer drop the compiled
    // shaders again, and the first real effect would recompile them
    this.charge.state.delete(dummy); this.charge.warmState = S;
    for (const [pr, r] of this.charge.trails) { r.mesh.visible = false; this.charge.trails.delete(pr); }
    this.smokePts.visible = true;
  }

  // One particle at a world-space point; the caller sets its velocity (P.v), drag and gravity
  particle(v, color, size, life) {
    const P = this.parts[this.pi], idx = this.pi; this.pi = (this.pi + 1) % this.N;
    const c = typeof color === 'string' ? new THREE.Color(color) : color;
    this.pPos.set([v.x, v.y, v.z], idx * 3); this.pCol.set([c.r, c.g, c.b], idx * 3);
    P.life = P.max = life; P.size = size; P.drag = 0.9; P.grav = 0; P.v.set(0, 0, 0);
    return P;
  }
  // A flat shockwave ring on the ground at a sim point, growing from r0 to r1 m
  groundRing(x, y, color, r0, r1, life, opacity = 0.9) {
    const it = this.rings.find(q => q.life <= 0) || this.rings.reduce((a, b) => (a.life < b.life ? a : b));
    toWorld(x, y + 0.05, 0, it.m.position); it.m.material.color.set(color);
    Object.assign(it, { life, max: life, r0, r1, op: opacity }); it.m.scale.setScalar(r0); it.m.visible = true;
    return it;
  }
  updateRings(dt) {
    for (const it of this.rings) {
      if (it.life <= 0) { it.m.visible = false; continue; }
      it.life -= dt; const k = 1 - Math.max(0, it.life) / it.max, e = 1 - (1 - k) * (1 - k);
      it.m.scale.setScalar(it.r0 + (it.r1 - it.r0) * e); it.m.material.opacity = it.op * (1 - k);
    }
  }

  // ---- Particles and sprites ----
  burst(x, y, color, n = 10, speed = 5, size = 0.35, life = 0.35, opts = {}) {
    const c = new THREE.Color(color), w = toWorld(x, y, 0, this.tmp);
    for (let i = 0; i < n; i++) {
      const P = this.parts[this.pi]; const idx = this.pi; this.pi = (this.pi + 1) % this.N;
      const a = opts.dir !== undefined ? opts.dir + (Math.random() - 0.5) * (opts.spread || 1) : Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      planeDir(x, Math.cos(a) * sp, Math.sin(a) * sp, P.v);
      const f = pathFrame(x); P.v.x += f.nx * (Math.random() - 0.5) * sp * 0.4; P.v.z += f.nz * (Math.random() - 0.5) * sp * 0.4;
      this.pPos.set([w.x, w.y, w.z], idx * 3); this.pCol.set([c.r, c.g, c.b], idx * 3);
      P.life = P.max = life * (0.7 + Math.random() * 0.6); P.size = size * (0.6 + Math.random() * 0.8);
      P.drag = opts.drag ?? 0.9; P.grav = opts.grav ?? 0;
    }
  }
  sprite(x, y, tex, color, size, life, grow = 1.6, depth = 0.3) {
    const it = this.sprites.find(q => q.life <= 0) || this.sprites[0];
    if (it.normal) { it.s.material.blending = THREE.AdditiveBlending; it.normal = false; }
    it.s.material.map = this.tex[tex]; it.s.material.color.set(color); it.s.material.needsUpdate = true;
    toWorld(x, y, depth, it.s.position); it.life = it.max = life; it.grow = grow; it.base = size; it.s.visible = true;
    return it;
  }
  // Particles at a world-space point, drifting upward (embers)
  burstAt(v, color, n = 1, speed = 1, size = 0.2, life = 0.3) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const P = this.parts[this.pi]; const idx = this.pi; this.pi = (this.pi + 1) % this.N;
      P.v.set((Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed);
      this.pPos.set([v.x, v.y, v.z], idx * 3); this.pCol.set([c.r, c.g, c.b], idx * 3);
      P.life = P.max = life * (0.7 + Math.random() * 0.6); P.size = size * (0.6 + Math.random() * 0.8); P.drag = 0.9; P.grav = -1.5;
    }
  }
  glyph(e, ch, color, life = 0.9) {
    const tex = this.glyphTex[ch] || (this.glyphTex[ch] = canvasTex(128, (g, s) => {
      g.font = `900 ${Math.round(s * 0.8)}px "Arial Black", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = s * 0.12; g.strokeStyle = 'rgba(12,16,26,0.92)'; g.strokeText(ch, s / 2, s * 0.54);
      g.fillStyle = '#ffffff'; g.fillText(ch, s / 2, s * 0.54);
    }));
    const it = this.glyphs.find(q => q.e === e && q.life > 0) || this.glyphs.find(q => q.life <= 0) || this.glyphs[0];
    it.s.material.map = tex; it.s.material.color.set(color); it.s.material.needsUpdate = true;
    it.e = e; it.life = it.max = life; it.s.visible = true;
  }
  updateGlyphs(dt) {
    for (const it of this.glyphs) {
      if (it.life <= 0) { it.s.visible = false; continue; }
      it.life -= dt;
      const e = it.e; if (!e || e.dead) { it.life = 0; continue; }
      const k = 1 - Math.max(0, it.life) / it.max;
      toWorld(e.x, e.y + e.h + 0.6 + k * 0.25, 0.4, it.s.position);
      const sc = 0.8 * Math.min(1, k / 0.12); it.s.scale.set(sc, sc, 1);
      it.s.material.opacity = Math.min(1, Math.max(0, it.life) / 0.25);
    }
  }

  // ---- Event reactions ----
  onEvent(ev, world) {
    const pc = ev.p ? CHARS[ev.p.char].energy : '#ffffff';
    switch (ev.type) {
      case 'hit': {
        const col = ev.owner && ev.owner.kind === 'player' ? CHARS[ev.owner.char].energy : '#ffffff';
        this.burst(ev.x, ev.y, col, ev.heavy ? 18 : 9, ev.heavy ? 9 : 6, ev.heavy ? 0.5 : 0.35, 0.3);
        if (ev.heavy) this.sprite(ev.x, ev.y, 'ring', col, 0.8, 0.22, 3);
        if (ev.tier) this.sprite(ev.x, ev.y, 'ring', '#ffffff', 1 + ev.tier * 0.5, 0.25, 3.5);
        break;
      }
      case 'blocked': this.burst(ev.x, ev.y, '#cfe8ff', 8, 6, 0.3, 0.25); this.sprite(ev.x, ev.y, 'star', '#dff2ff', 0.6, 0.15, 1.2); break;
      case 'guardBreak': this.burst(ev.x, ev.y, '#ffffff', 22, 10, 0.5, 0.45); this.sprite(ev.x, ev.y, 'ring', '#ffffff', 1.2, 0.3, 3); break;
      case 'armorBreak': this.burst(ev.x, ev.y + 0.4, '#e6e9f0', 26, 11, 0.55, 0.6, { grav: 14 }); this.sprite(ev.x, ev.y, 'ring', HOSTILE, 1.5, 0.35, 3); break;
      case 'armorHit': this.burst(ev.x, ev.y, '#b9c3d6', 5, 4, 0.25, 0.2); break;
      case 'stagger': this.sprite(ev.x, ev.y + 0.6, 'star', '#fff4c2', 0.9, 0.5, 1.4); this.burst(ev.x, ev.y + 0.5, '#fff4c2', 12, 4, 0.3, 0.6); break;
      case 'kill': this.burst(ev.x, ev.y, HOSTILE, 24, 9, 0.45, 0.55, { grav: 6 }); this.burst(ev.x, ev.y, '#ffffff', 10, 5, 0.3, 0.3); break;
      case 'parry': {
        const col = ev.perfect ? '#fff6d8' : '#cfe8ff';
        this.sprite(ev.x, ev.y, 'ring', col, ev.perfect ? 1.4 : 0.9, ev.perfect ? 0.3 : 0.2, ev.perfect ? 3.2 : 2.2);
        this.sprite(ev.x, ev.y, 'star', col, ev.perfect ? 1.6 : 0.9, 0.25, 1.3);
        this.burst(ev.x, ev.y, ev.perfect ? pc : '#cfe8ff', ev.perfect ? 22 : 10, ev.perfect ? 10 : 6, 0.4, 0.35);
        break;
      }
      case 'parryFail': this.burst(ev.x, ev.y, HOSTILE, 10, 5, 0.3, 0.3); break;
      case 'playerHit': this.burst(ev.x, ev.y, '#ffffff', 10, 6, 0.35, 0.25); break;
      case 'intercept': this.burst(ev.x, ev.y, '#ffd28a', 16, 8, 0.4, 0.3); this.sprite(ev.x, ev.y, 'star', '#ffe7b5', 0.9, 0.18, 1.5); break;
      case 'interceptFail': this.burst(ev.x, ev.y, '#ffd28a', 5, 4, 0.2, 0.15); break;
      case 'barrierBlock': this.burst(ev.x, ev.y, '#ffd28a', 12, 6, 0.35, 0.3); break;
      case 'erase': this.burst(ev.x, ev.y, '#ffe2a8', 8, 5, 0.3, 0.25); break;
      case 'amplify': this.sprite(ev.x, ev.y, 'ring', '#ffe2a8', 0.5, 0.15, 2); break;
      case 'bulwark': {
        this.sprite(ev.x + ev.ax * 1.2, ev.y + ev.ay * 1.2, 'ring', NOVA_GOLD, 1.4, 0.3, 3);
        this.burst(ev.x + ev.ax * 1.5, ev.y + ev.ay * 1.5, NOVA_GOLD, 26, 10, 0.4, 0.35, { dir: Math.atan2(ev.ay, ev.ax), spread: 1.6 });
        break;
      }
      case 'boost': this.sprite(ev.x, ev.y, 'ring', '#ffe2a8', 1.2, 0.25, 2.5); this.burst(ev.x, ev.y, '#ffe2a8', 14, 8, 0.35, 0.3); break;
      case 'vbStart': this.burst(ev.p.x, ev.p.y + 0.8, pc, 6 + ev.tier * 6, 4 + ev.tier * 3, 0.35, 0.25); break;
      case 'lashPull': case 'lashZip': this.burst(ev.e.x, ev.e.y + ev.e.h / 2, CHARS.echo.energy, 14, 6, 0.35, 0.3); break;
      case 'tag': this.sprite(ev.x, ev.y + 0.3, 'star', '#ffb347', 0.7, 0.4, 1.2); break;
      case 'land':
        if (!ev.p) break;
        if (ev.vy < -16) {   // a hard landing (after a rocket jump or a long fall) kicks up a ring of dust
          const k = Math.min(1, (-ev.vy - 16) / 12);
          this.groundRing(ev.p.x, ev.p.y, '#e6ecf2', 0.4, 1.4 + k, 0.3, 0.6);
          for (const dir of [Math.PI, 0]) this.smoke(ev.p.x, ev.p.y + 0.1, '#9aa3ae', 5 + k * 6, 4 + k * 3, 0.45 + k * 0.2, 0.5, { dir, spread: 0.6, drag: 0.88, op: 0.5 });
        } else this.burst(ev.p.x, ev.p.y + 0.05, '#c9d3de', 5, 2.5, 0.35, 0.3, { dir: Math.PI / 2, spread: 2.4 });
        break;
      case 'jump': case 'djump': if (ev.p) this.burst(ev.p.x, ev.p.y + 0.1, '#e8eef5', 5, 2.5, 0.3, 0.25, { dir: -Math.PI / 2, spread: 2 }); break;
      case 'walljump': {
        // Kick-off puff where the boot left the wall; Nova's skate blades throw sparks
        const wx = ev.p.x - ev.dir * ev.p.w / 2;
        this.smoke(wx, ev.p.y + 0.3, '#a3abb5', ev.climb ? 4 : 6, 2.5, 0.35, 0.4, { dir: ev.dir > 0 ? 0 : Math.PI, spread: 1.6, op: 0.5 });
        if (ev.p.char === 'nova') this.burst(wx, ev.p.y + 0.1, '#ffe2a8', 8, 5, 0.16, 0.25, { dir: ev.dir > 0 ? -0.6 : Math.PI + 0.6, spread: 1, grav: 8 });
        this.sprite(wx, ev.p.y + 0.5, 'ring', '#ffffff', 0.35, 0.14, 2.4);
        break;
      }
      case 'wallSlide': if (ev.on) this.burst(ev.p.x + ev.dir * ev.p.w / 2, ev.p.y + ev.p.h * 0.8, '#e8eef5', 6, 2, 0.3, 0.3); break;
      case 'dash': {
        if (!ev.p) break;
        const L = ev.level || 0, a = Math.atan2(ev.dy || 0, ev.dx || ev.p.facing);
        if (!L) { this.burst(ev.p.x, ev.p.y + 0.9, pc, 10, 4, 0.3, 0.25); break; }
        // A charged dash bursts away: a ring behind, streaks thrown back, a ground ring; level 3 flashes
        const col = new THREE.Color(pc).lerp(new THREE.Color('#ffffff'), L >= 3 ? 0.55 : L * 0.15);
        this.sprite(ev.p.x, ev.p.y + 0.9, 'ring', col, 0.6 + L * 0.2, 0.18 + L * 0.03, 2.2);
        this.smoke(ev.p.x, ev.p.y + 0.15, '#9aa3ae', 4 + L * 3, 3 + L, 0.4, 0.45, { dir: a + Math.PI, spread: 0.8, op: 0.45 });
        this.burst(ev.p.x, ev.p.y + 0.9, col, 12 + L * 8, 8 + L * 3, 0.32, 0.3, { dir: a + Math.PI, spread: 1.1 });
        if (ev.p.onGround || ev.p.y - ev.p.lastSafeY < 0.2) this.groundRing(ev.p.x, ev.p.y, col, 0.3, 1.2 + L * 0.5, 0.3, 0.8);
        if (L >= 3) this.sprite(ev.p.x, ev.p.y + 0.9, 'star', '#ffffff', 1.6, 0.16, 1.5);
        break;
      }
      case 'dashChargeStart': break;
      case 'dashLevel': this.charge.levelUp(ev.p, this.rigs.get(ev.p), ev.level, 'dash'); break;
      case 'rifleRaise': this.charge.levelUp(ev.p, this.rigs.get(ev.p), 1, 'rifle'); break;
      case 'rifleMark': this.charge.levelUp(ev.p, this.rigs.get(ev.p), 3, 'rifle'); break;
      case 'rifleShot': {
        const rig = this.rigs.get(ev.p);
        this.charge.release({ level: ev.mark ? 3 : 1, rifle: true, mark: ev.mark, ax: ev.ax, ay: ev.ay }, ev.p, rig);
        break;
      }
      case 'shot':
        if (ev.level > 0 && ev.p) this.charge.release(ev, ev.p, this.rigs.get(ev.p));
        break;
      case 'downed': this.burst(ev.p.x, ev.p.y + 0.4, '#ffffff', 16, 5, 0.35, 0.5); break;
      case 'revived': this.sprite(ev.p.x, ev.p.y + 1, 'ring', '#9cf5c8', 1.2, 0.4, 2.5); this.burst(ev.p.x, ev.p.y + 1, '#9cf5c8', 18, 5, 0.35, 0.5); break;
      case 'recall': case 'respawn': case 'join': if (ev.p) { this.sprite(ev.p.x, ev.p.y + 1, 'ring', '#bfe9ff', 1.1, 0.35, 2.4); this.burst(ev.p.x, ev.p.y + 1, '#bfe9ff', 16, 4, 0.3, 0.5); } break;
      case 'slam': this.burst(ev.e.x, ev.e.y + 0.2, HOSTILE, 24, 9, 0.5, 0.45, { dir: Math.PI / 2, spread: 3 }); break;
      case 'telegraph': this.telegraphs.push({ e: ev.e, cat: ev.cat, ticks: ev.ticks, t: 0 }); break;
      case 'lock': this.sprite(ev.e.x + ev.e.facing * 1.3, ev.e.y + 1.35, 'star', '#ffffff', 0.9, 0.2, 1.3); break;
      case 'snareThrow': this.burst(ev.x, ev.y, ECHO_ORANGE, 6, 3, 0.25, 0.2); break;
      case 'snarePlant': this.sprite(ev.x, ev.y + 0.1, 'ring', ECHO_ORANGE, 0.9, 0.3, 2); break;
      case 'snareTrigger': this.sprite(ev.x, ev.y + 0.3, 'ring', ECHO_ORANGE, 1.4, 0.3, 2.6); this.burst(ev.x, ev.y + 0.3, ECHO_ORANGE, 20, 7, 0.35, 0.35); break;
      case 'snared': this.burst(ev.x, ev.y, ECHO_ORANGE, ev.weak ? 6 : 14, 5, 0.3, 0.35); break;
      case 'leash': this.sprite(ev.e.x, ev.e.y + ev.e.h / 2, 'ring', ECHO_ORANGE, 0.8, 0.25, 2); break;
      case 'yank': this.burst(ev.e.x, ev.e.y + ev.e.h / 2, ECHO_ORANGE, 18, 8, 0.4, 0.35); this.sprite(ev.e.x, ev.e.y + ev.e.h / 2, 'ring', '#ffffff', 1.3, 0.25, 2.8); break;
      // Scarf modes
      case 'scarfMode': this.burst(ev.p.x, ev.p.y + 1.4, ev.mode === 'veil' ? VEIL_PALE : ECHO_ORANGE, ev.mode === 'flare' ? 18 : 12, 3, 0.3, 0.3); break;
      case 'veilOn': this.burst(ev.p.x, ev.p.y + 1, VEIL_PALE, 14, 2.5, 0.35, 0.45); break;
      case 'veilBreak': if (ev.wasHidden) this.burst(ev.p.x, ev.p.y + 1, VEIL_PALE, 12, 5, 0.3, 0.3); break;
      case 'vanish': this.sprite(ev.p.x, ev.p.y + 1, 'ring', VEIL_PALE, 1.2, 0.3, 2.4); this.burst(ev.p.x, ev.p.y + 1, VEIL_PALE, 20, 6, 0.35, 0.4); break;
      case 'ambush': this.sprite(ev.x, ev.y, 'star', '#ffffff', 2.0, 0.28, 1.6); this.burst(ev.x, ev.y, ECHO_ORANGE, 26, 10, 0.45, 0.45); break;
      case 'challenge': this.sprite(ev.x, ev.y, 'ring', ECHO_ORANGE, 2.2, 0.45, 4.2); this.burst(ev.x, ev.y, ECHO_ORANGE, 30, 9, 0.4, 0.45); break;
      case 'lostTrack': this.glyph(ev.e, '?', '#ffffff', 1.0); break;
      case 'taunted': this.glyph(ev.e, '!', ECHO_ORANGE, 0.9); break;
      // Nova, Marksman kit
      case 'attach': {
        const c = ATTACH_LOOK[ev.attach].tint, x = ev.p.x + ev.p.facing * 0.35, y = ev.p.y + 1.05;
        this.sprite(x, y, 'ring', c, 0.5, 0.2, 2); this.burst(x, y, c, 6, 2.5, 0.25, 0.25);
        break;
      }
      case 'chargeLevel': case 'burstLevel':
        if (ev.p.char === 'nova') this.charge.levelUp(ev.p, this.rigs.get(ev.p), ev.level, ev.type === 'burstLevel' ? 'burst' : 'shot');
        break;
      case 'splash':
        this.sprite(ev.x, ev.y, 'ring', NOVA_GOLD, 0.35 + ev.r * 0.7, 0.2, 2.2);
        this.burst(ev.x, ev.y, NOVA_GOLD, 5 + Math.round(ev.r * 6), 3 + ev.r * 3, 0.28, 0.25, { grav: 5 });
        break;
      case 'rocketJump': this.rocketBlast(ev); break;
      case 'mortarShot': this.addLandingMark(ev.x, ev.y, ev.r, ev.ticks / 60); break;
      case 'enemyBlast':
        this.sprite(ev.x, ev.y + 0.3, 'ring', HOSTILE, ev.r * 1.1, 0.3, 2.4); this.sprite(ev.x, ev.y + 0.3, 'star', '#ffd2e4', ev.r, 0.2, 1.3);
        this.burst(ev.x, ev.y + 0.3, HOSTILE, 26, 9, 0.45, 0.45, { grav: 7 }); this.burst(ev.x, ev.y + 0.3, '#ffffff', 8, 5, 0.3, 0.25);
        break;
      case 'chargeStart': this.burst(ev.e.x - ev.e.facing * 0.7, ev.e.y + 0.2, '#c9d3de', 12, 4, 0.4, 0.4, { dir: Math.PI / 2, spread: 1.6 }); break;
      case 'chargeCrash':
        this.sprite(ev.e.x + ev.e.facing * 0.8, ev.e.y + 0.9, 'star', '#ffffff', 1.6, 0.25, 1.5);
        this.burst(ev.e.x + ev.e.facing * 0.8, ev.e.y + 0.9, '#e6e9f0', 20, 8, 0.4, 0.45, { grav: 10 });
        break;
      case 'perfectRelease':
        this.sprite(ev.x, ev.y, 'star', '#ffffff', 1.8, 0.22, 1.5); this.sprite(ev.x, ev.y, 'ring', NOVA_GOLD, 1.0, 0.3, 3);
        this.burst(ev.x, ev.y, '#fff1c9', 14, 7, 0.35, 0.3);
        break;
      case 'blast': {
        const c = ATTACH_LOOK.arc.tint;
        this.sprite(ev.x, ev.y, 'ring', c, ev.r * 0.9, 0.3, 2.4); this.sprite(ev.x, ev.y, 'star', '#fff1d0', ev.r * 0.8, 0.18, 1.3);
        this.burst(ev.x, ev.y, c, 22 + ev.level * 6, 7 + ev.r * 2, 0.45, 0.4, { grav: 6 }); this.burst(ev.x, ev.y, '#ffffff', 8, 4, 0.3, 0.25);
        break;
      }
      case 'split': this.sprite(ev.x, ev.y, 'star', ATTACH_LOOK.prism.tint, 1.1, 0.18, 1.4); this.burst(ev.x, ev.y, ATTACH_LOOK.prism.tint, 10, 6, 0.3, 0.25); break;
      case 'ricochet': this.burst(ev.x, ev.y, ATTACH_LOOK.prism.tint, 4, 4, 0.22, 0.18); break;
      case 'burst':
        this.burst(ev.x, ev.y, '#ffcf7a', ev.charged ? 22 : 14, ev.charged ? 14 : 11, 0.32, 0.16, { dir: Math.atan2(ev.ay, ev.ax), spread: ev.charged ? 0.9 : 0.7 });
        this.sprite(ev.x, ev.y, 'ring', NOVA_GOLD, ev.charged ? 0.8 : 0.5, 0.14, 2.2);
        break;
      case 'carve': this.burst(ev.p.x + Math.sign(ev.p.vx) * 0.2, ev.p.y + 0.05, '#ffe2a8', 8, 4, 0.22, 0.25, { dir: ev.p.vx > 0 ? 0.5 : Math.PI - 0.5, spread: 0.9, grav: 8 }); break;
      case 'focusUp': this.sprite(ev.p.x, ev.p.y + ev.p.h + 0.35, 'star', NOVA_GOLD, 0.45 + ev.level * 0.08, 0.3, 1.3); break;
      case 'focusLost': this.burst(ev.p.x, ev.p.y + 1.2, '#9aa6b8', 8, 3, 0.25, 0.3); break;
    }
  }

  // Rocket jump launch: a white flash and a shock ring where it burst, a ground shockwave, dust thrown
  // out along the ground both ways, sparks and debris, and a column of smoke. Everything scales with the
  // launch power, so a Perfect Release reads as the biggest blast.
  rocketBlast(ev) {
    const k = ev.power || 0.5, x = ev.x, y = ev.y, gold = NOVA_GOLD;
    const vertical = (ev.dy ?? 1) > 0.6;
    this.sprite(x, y + 0.1, 'star', '#ffffff', 1.4 + k * 2.2, 0.16, 1.6);
    this.sprite(x, y + 0.1, 'glow', ev.perfect ? '#ffffff' : '#ffe2a8', 2 + k * 3, 0.22, 1.8);
    this.fireball(x, y + 0.25, ev.perfect ? '#ffd27a' : '#ff9a2e', 0.9 + k * 1.4, 0.3 + k * 0.1);
    this.sprite(x, y + 0.2, 'ring', '#fff1c9', 0.9 + k * 1.2, 0.28, 3.4);
    if (vertical) {
      this.groundRing(x, y, '#fff1c9', 0.3, 2.4 + k * 3.2, 0.42 + k * 0.1, 0.95);
      this.groundRing(x, y, gold, 0.2, 1.4 + k * 2, 0.3, 0.8);
      // Dust thrown out low along the ground in both directions
      for (const dir of [0.12, Math.PI - 0.12]) {
        this.burst(x, y + 0.1, '#dfe6ee', 8 + k * 10, 7 + k * 8, 0.45, 0.45, { dir, spread: 0.45, drag: 0.9, grav: 1.5 });
        this.smoke(x, y + 0.2, '#9aa3ae', 7 + k * 8, 6 + k * 7, 0.7 + k * 0.4, 0.55 + k * 0.3, { dir, spread: 0.35, drag: 0.88, grav: -0.3, op: 0.55 });
      }
    }
    // Sparks and burning debris, most of them thrown down and out from under his boots
    const away = Math.atan2(-(ev.dy ?? 1), -(ev.dx ?? 0));
    this.burst(x, y + 0.2, gold, 18 + k * 22, 9 + k * 9, 0.28, 0.45, { dir: away, spread: 2.6, grav: 16 });
    this.burst(x, y + 0.2, '#ffffff', 8 + k * 10, 6 + k * 6, 0.22, 0.25, { dir: away, spread: 3 });
    this.burst(x, y + 0.2, '#5d6674', 6 + k * 8, 6 + k * 5, 0.3, 0.7, { dir: away, spread: 2.2, grav: 20 });
    // A column of smoke that rises and spreads slowly
    this.smoke(x, y + 0.4, '#7d8692', 10 + k * 12, 1.4 + k, 0.9 + k * 0.6, 1.1 + k * 0.5, { dir: Math.PI / 2, spread: 1.3, drag: 0.94, grav: -1.2, grow: 2.4, op: 0.5 });
    if (ev.perfect) this.sprite(x, y + 0.4, 'ring', '#ffffff', 1.6, 0.35, 4.2);
  }

  // A short-lived ball of fire drawn with ordinary blending (reads on bright backgrounds), bright core on top
  fireball(x, y, color, size, life) {
    const it = this.sprite(x, y, 'glow', color, size, life, 2.2, 0.35);
    it.s.material.blending = THREE.NormalBlending; it.s.material.needsUpdate = true; it.normal = true;
    this.sprite(x, y, 'glow', '#fff4d6', size * 0.55, life * 0.7, 1.8, 0.4);
  }

  // Afterimages: charged dashes leave more, brighter and longer-lived ghosts with each level; strong rocket
  // launches leave a trail of gold ones on the way up
  updateGhosts(world, view) {
    for (const p of world.players) {
      const rig = view.rigs.get(p); if (!rig || !rig.root.visible) continue;
      const last = this.ghostTick.get(p) ?? -99, dt = world.tick - last;
      const col = new THREE.Color(CHARS[p.char].energy);
      if (p.state === 'dash' && p.dash) {
        const L = p.dash.level || 0, every = [5, 4, 3, 2][L];
        if (dt >= every) {
          this.ghostTick.set(p, world.tick);
          // Stronger with each level: more of them, more opaque, longer-lived, and at level 3 hot enough to glow
          const c = col.clone().lerp(new THREE.Color('#fff6e0'), [0, 0.05, 0.2, 0.35][L]).multiplyScalar([1, 1, 1.3, 2.2][L]);
          this.ghosts.spawn(rig, c, [0.16, 0.3, 0.45, 0.62][L], [0.12, 0.2, 0.28, 0.4][L]);
        }
      } else if (p.rocketT > 0 && p.vy > 8 && (p.rocketPow || 0) > 0.55 && dt >= 3) {
        this.ghostTick.set(p, world.tick);
        this.ghosts.spawn(rig, new THREE.Color('#ffb547').multiplyScalar(1 + p.rocketPow), 0.2 + 0.25 * p.rocketPow, 0.3);
      }
    }
  }

  // Rocket climb: a jet of sparks and smoke from his boots while he is still going up fast
  rocketTrails(world) {
    for (const p of world.players) {
      if (!(p.rocketT > 0 && p.vy > 6 && !p.onGround)) continue;
      const k = Math.min(1, p.vy / 30) * (p.rocketPow || 0.5);
      for (let i = 0; i < 1 + k * 3; i++) {
        this.burst(p.x + (Math.random() - 0.5) * 0.25, p.y - 0.05, Math.random() < 0.5 ? '#fff1c9' : NOVA_GOLD, 1, 2, 0.3 + k * 0.2, 0.22, { dir: -Math.PI / 2, spread: 0.6 });
      }
      if (Math.random() < 0.7) this.smoke(p.x, p.y - 0.2, '#8e97a3', 1, 0.8, 0.45 + k * 0.35, 0.7, { dir: -Math.PI / 2, spread: 1, drag: 0.93, grav: -0.4, op: 0.4 });
    }
  }

  // Wall slides: grit off the wall at the hand and boot; Nova's skate blades grind sparks
  wallGrit(world) {
    for (const p of world.players) {
      if (!p.wallSliding) continue;
      const wx = p.x + p.wallDir * p.w / 2, speed = Math.min(1, -p.vy / 6);
      if (Math.random() < 0.2 + speed * 0.4) this.smoke(wx, p.y + p.h * 0.85, '#aab2bc', 1, 1.0, 0.22, 0.35, { dir: Math.PI / 2, spread: 1, op: 0.45 });
      if (Math.random() < 0.3 + speed * 0.5) this.smoke(wx, p.y + 0.08, '#a3abb5', 1, 1.4, 0.28, 0.4, { dir: Math.PI / 2 + p.wallDir * 0.6, spread: 0.8, op: 0.5 });
      if (p.char === 'nova' && SETTINGS.novaKit === 'marksman' && Math.random() < 0.35 + speed * 0.5) {
        this.burst(wx, p.y + 0.05, '#ffe2a8', 1, 3 + speed * 2, 0.15, 0.22, { dir: p.wallDir > 0 ? Math.PI - 0.5 : 0.5, spread: 0.8, grav: 10 });
      }
    }
  }

  // ---- Per-frame update ----
  update(dt, world, view) {
    this.updateRings(dt);
    this.updateSmoke(dt);
    this.updateGhosts(world, view);
    this.ghosts.update(dt);
    this.rocketTrails(world);
    this.wallGrit(world);
    this.charge.update(dt, world, view);
    this.updateParticles(dt);
    this.updateSprites(dt);
    this.updateTelegraphs(world);
    this.updateArcs(dt, world);
    this.syncProjectiles(world, view.alpha);
    this.syncBarriers(world);
    this.syncLasers(world);
    this.syncShockwaves(world);
    this.syncScarves(dt, world, view);
    this.syncSnares(world);
    this.syncSnaredRings(world);
    this.updateGlyphs(dt);
    this.skateSparks(world);
    this.updateMarks(dt);
    this.thrusterJets(world, view);
  }
  // Marksman Nova's light boosters: two small jets under the boots while they fire
  thrusterJets(world, view) {
    for (const p of world.players) {
      if (!p.thrusting) continue;
      for (const dz of [-0.13, 0.13]) {
        const v = toWorld(p.x + (Math.random() - 0.5) * 0.1, p.y - 0.05, dz, this.tmp2);
        const P = this.parts[this.pi], idx = this.pi; this.pi = (this.pi + 1) % this.N;
        P.v.set((Math.random() - 0.5) * 0.6, -5 - Math.random() * 3, (Math.random() - 0.5) * 0.6);
        this.pPos.set([v.x, v.y, v.z], idx * 3); const c = new THREE.Color(Math.random() < 0.5 ? '#fff1c9' : NOVA_GOLD); this.pCol.set([c.r, c.g, c.b], idx * 3);
        P.life = P.max = 0.16 + Math.random() * 0.08; P.size = 0.26; P.drag = 0.86; P.grav = 0;
      }
    }
  }
  // Marksman Nova: a few sparks trail from the skate blades at speed
  skateSparks(world) {
    if (SETTINGS.novaKit !== 'marksman') return;
    for (const p of world.players) {
      if (p.char !== 'nova' || !p.onGround || Math.abs(p.vx) < 6 || Math.random() > 0.35) continue;
      this.burst(p.x - Math.sign(p.vx) * 0.15, p.y + 0.03, '#ffe2a8', 1, 1.5, 0.16, 0.2, { dir: p.vx > 0 ? Math.PI - 0.3 : 0.3, spread: 0.6, grav: 4 });
    }
  }
  updateParticles(dt) {
    for (let i = 0; i < this.N; i++) {
      const P = this.parts[i];
      if (P.life <= 0) { this.pAlpha[i] = 0; continue; }
      P.life -= dt; P.v.multiplyScalar(Math.pow(P.drag, dt * 60)); P.v.y -= P.grav * dt;
      this.pPos[i * 3] += P.v.x * dt; this.pPos[i * 3 + 1] += P.v.y * dt; this.pPos[i * 3 + 2] += P.v.z * dt;
      const k = Math.max(0, P.life / P.max);
      this.pAlpha[i] = k; this.pSize[i] = P.size * (0.5 + k * 0.5);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.pcolor.needsUpdate = true;
  }
  updateSprites(dt) {
    for (const it of this.sprites) {
      if (it.life <= 0) { it.s.visible = false; continue; }
      it.life -= dt; const k = 1 - Math.max(0, it.life) / it.max;
      const sc = it.base * (1 + (it.grow - 1) * k); it.s.scale.set(sc, sc, 1); it.s.material.opacity = 1 - k;
    }
  }
  updateTelegraphs(world) {
    for (const tg of this.telegraphs) {
      const e = tg.e; tg.t++;
      const eye = { x: e.x + e.facing * e.w * 0.35, y: e.y + e.h * 0.8 };
      const pops = tg.cat === 'standard' ? [0, tg.ticks - 7] : tg.cat === 'heavy' ? [0, 7, tg.ticks - 7] : [];
      if (pops.includes(tg.t - 1)) this.sprite(eye.x, eye.y, 'star', tg.cat === 'heavy' ? '#fff3cf' : '#ffffff', tg.cat === 'heavy' ? 1.5 : 1.0, 0.2, 1.2, 0.8);
      if (tg.cat === 'unblockable' && tg.t === 1 && e.type !== 'mortar') this.addMarker(e, tg.ticks);   // mortars mark the landing spot instead
    }
    this.telegraphs = this.telegraphs.filter(tg => tg.t < tg.ticks && !tg.e.dead);
    for (const mk of this.markers) {
      mk.t++; const k = mk.t / mk.ticks;
      mk.mesh.material.opacity = 0.35 + 0.45 * Math.abs(Math.sin(mk.t * 0.35));
      mk.mesh.material.map.offset.x = -mk.t * 0.04;
      mk.mesh.scale.x = 0.3 + 0.7 * Math.min(1, k * 2);
      if (mk.t >= mk.ticks || mk.e.dead) { this.scene.remove(mk.mesh); mk.dead = true; }
    }
    this.markers = this.markers.filter(m => !m.dead);
  }
  // Mortar landing marker: a pulsing magenta ring on the ground where the shell will burst
  addLandingMark(x, y, r, secs) {
    const mat = new THREE.MeshBasicMaterial({ map: this.tex.ring, color: HOSTILE, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.4, r * 2.4), mat);
    toWorld(x, y + 0.04, 0, mesh.position); mesh.rotation.x = -Math.PI / 2;
    this.scene.add(mesh);
    (this.marks = this.marks || []).push({ mesh, life: secs, max: secs });
  }
  updateMarks(dt) {
    if (!this.marks) return;
    for (const m of this.marks) {
      m.life -= dt; const k = 1 - Math.max(0, m.life) / m.max;
      m.mesh.material.opacity = 0.35 + 0.5 * k * (0.6 + 0.4 * Math.sin(k * 40));
      m.mesh.scale.setScalar(1.25 - 0.25 * k);
      if (m.life <= 0) { this.scene.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose(); m.dead = true; }
    }
    this.marks = this.marks.filter(m => !m.dead);
  }
  addMarker(e, ticks) {
    const len = e.type === 'post' ? 7 : 12;
    const tex = this.tex.jag.clone(); tex.needsUpdate = true; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 1.2, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: HOSTILE, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.5), mat);
    const f = pathFrame(e.x); toWorld(e.x, e.y + 0.26, 0.9, mesh.position);
    mesh.rotation.y = Math.atan2(-f.tz, f.tx);
    this.scene.add(mesh); this.markers.push({ e, mesh, t: 0, ticks });
  }
  updateArcs(dt, world) {
    for (const p of world.players) {
      if (p.state === 'attack' && p.move && p.st === p.move.su && p.lastArc !== p.instance) {
        p.lastArc = p.instance; this.spawnArc(p);
      }
    }
    for (const a of this.arcs) {
      a.life -= dt; const k = Math.max(0, a.life / a.max);
      a.mesh.material.opacity = k * 0.9; a.mesh.scale.setScalar(1 + (1 - k) * 0.25);
      if (a.life <= 0) { this.scene.remove(a.mesh); a.dead = true; }
    }
    this.arcs = this.arcs.filter(a => !a.dead);
  }
  spawnArc(p) {
    const m = p.move, big = m.staff || m.heavy;
    const r0 = big ? 0.9 : 0.55, r1 = big ? 1.6 : 1.05;
    const up = m.launcher ? 1 : 0;
    const geo = new THREE.RingGeometry(r0, r1, 24, 1, up ? -0.3 : -0.9, up ? 2.2 : 1.9);
    const mat = new THREE.MeshBasicMaterial({ color: CHARS[p.char].energy, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    const f = pathFrame(p.x);
    toWorld(p.x + p.facing * 0.3, p.y + m.box.y, 0.35, mesh.position);
    mesh.rotation.y = Math.atan2(-f.tz, f.tx);
    mesh.scale.x = p.facing;
    mesh.rotateY(0);
    if (p.facing < 0) { mesh.rotation.y += Math.PI; mesh.scale.x = 1; }
    this.scene.add(mesh); this.arcs.push({ mesh, life: 0.14, max: 0.14 });
  }

  // ---- Projectiles ----
  buildProjectileTemplates() {
    const em = (c, i = 3) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
    const nova = CHARS.nova.energy, echo = CHARS.echo.energy;
    this.tmpl = {
      shot: () => new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.34, 3, 8), em(nova, 4)),
      lance: () => new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.9, 3, 8), em(nova, 5)),
      rail: () => new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 1.9, 3, 8), em('#fff1d0', 6)),
      bolt: () => new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 3, 8), em(echo, 4)),
      tracer: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 14), em(echo, 5))); g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 3, 8), em(echo, 5))); return g; },
      snare: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 16), em(echo, 4))); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), em('#fff1d0', 4)); b.position.set(Math.cos(i * 2.1) * 0.22, Math.sin(i * 2.1) * 0.22, 0); g.add(b); } return g; },
      std: () => new THREE.Mesh(new THREE.OctahedronGeometry(0.2), em(HOSTILE, 3)),
      heavy: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.34), em(HOSTILE, 3))); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), em('#ffffff', 4))); return g; },
      // Nova, Marksman kit: each attachment has its own shape
      dart: () => new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 3, 6), em(ATTACH_LOOK.volley.tint, 5)),
      shell: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), em(ATTACH_LOOK.arc.tint, 3.5))); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.03, 6, 18), em('#fff1d0', 4))); return g; },
      prism: () => new THREE.Mesh(new THREE.OctahedronGeometry(0.22), em(ATTACH_LOOK.prism.tint, 4)),
      shard: () => new THREE.Mesh(new THREE.TetrahedronGeometry(0.12), em(ATTACH_LOOK.prism.tint, 5)),
      pellet: () => new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), em('#ffcf7a', 5)),
      // Echo's staff-rifle rounds: a slim orange slug, and a brighter, heavier marking shot
      rifle: () => new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.5, 3, 6), em(echo, 5)),
      markShot: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.8, 3, 8), em('#ffe0b0', 6))); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 16), em(echo, 5))); return g; },
      mortar: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), em('#2b2f3a', 0.2))); g.add(new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.05, 6, 18), em(HOSTILE, 4))); return g; },
    };
    // Each look is built once; projectiles are clones that share its geometry and materials
    const build = this.tmpl; this.tmpl = {}; this.protos = {};
    for (const k in build) this.tmpl[k] = () => (this.protos[k] || (this.protos[k] = build[k]())).clone();
  }
  syncProjectiles(world, alpha) {
    const seen = new Set();
    const Y = new THREE.Vector3(0, 1, 0);
    for (const pr of world.projectiles) {
      seen.add(pr);
      let m = this.projMeshes.get(pr);
      if (!m) { m = (this.tmpl[pr.kind] || this.tmpl.std)(); this.scene.add(m); this.projMeshes.set(pr, m); }
      const x = pr.px + (pr.x - pr.px) * alpha, y = pr.py + (pr.y - pr.py) * alpha;
      toWorld(x, y, 0.1, m.position);
      const d = planeDir(x, pr.vx, pr.vy, this.tmp).normalize();
      if (SPIN.has(pr.kind)) { m.rotation.x += 0.2; m.rotation.y += 0.15; }
      else m.quaternion.setFromUnitVectors(Y, d);
      if (pr.amplified) m.scale.setScalar(1.35);
      if (this.charge.wantsTrail(pr)) this.charge.trail(pr, m.position);
      if (Math.random() < (pr.kind === 'pellet' ? 0.25 : 0.6)) this.burst(x, y, trailColor(pr), 1, 0.6, pr.kind === 'rail' ? 0.5 : 0.22, 0.18);
    }
    for (const [pr, m] of this.projMeshes) if (!seen.has(pr)) { this.scene.remove(m); this.projMeshes.delete(pr); }
    this.charge.orphanUnseen(seen);
  }
  syncBarriers(world) {
    const seen = new Set();
    for (const b of world.barriers) {
      seen.add(b);
      let m = this.barrierMeshes.get(b);
      if (!m) {
        const mat = new THREE.MeshStandardMaterial({ color: '#fff0cc', emissive: NOVA_GOLD, emissiveIntensity: 2.2, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
        m = new THREE.Mesh(new THREE.BoxGeometry(b.half * 2, 0.22, 1.6), mat);
        const T = planeDir(b.x, -b.ny, b.nx, new THREE.Vector3()).normalize();
        const Nn = planeDir(b.x, b.nx, b.ny, new THREE.Vector3()).normalize();
        const Z = new THREE.Vector3().crossVectors(T, Nn).normalize();
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, Nn, Z));
        toWorld(b.x, b.y, 0, m.position);
        this.scene.add(m); this.barrierMeshes.set(b, m);
      }
      const k = b.ttl / b.max;
      m.material.opacity = 0.25 + 0.4 * k + (b.ttl % 10 < 5 && k < 0.25 ? 0.2 : 0);
    }
    for (const [b, m] of this.barrierMeshes) if (!seen.has(b)) { this.scene.remove(m); this.barrierMeshes.delete(b); }
  }
  syncLasers(world) {
    const seen = new Set();
    for (const e of world.enemies) {
      if (e.type !== 'sniper' || e.dead || (e.state !== 'aim' && e.state !== 'lock')) continue;
      seen.add(e);
      let m = this.lasers.get(e);
      if (!m) {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), new THREE.MeshBasicMaterial({ color: HOSTILE, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.scene.add(m); this.lasers.set(e, m);
      }
      const sx = e.x + e.facing * 1.3, sy = e.y + 1.35;
      const dx = e.aimX - sx, dy = e.aimY - sy, d = Math.hypot(dx, dy) || 1;
      const len = 26, ex = sx + dx / d * len, ey = sy + dy / d * len;
      const a = toWorld(sx, sy, 0.25, new THREE.Vector3()), b = toWorld(ex, ey, 0.25, new THREE.Vector3());
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.scale.set(e.state === 'lock' ? 2.6 : 1, a.distanceTo(b), e.state === 'lock' ? 2.6 : 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.material.color.set(e.state === 'lock' ? '#ffffff' : HOSTILE);
    }
    for (const [e, m] of this.lasers) if (!seen.has(e)) { this.scene.remove(m); this.lasers.delete(e); }
  }
  syncShockwaves(world) {
    const seen = new Set();
    for (const s of world.shockwaves) {
      seen.add(s);
      let m = this.shockMeshes.get(s);
      if (!m) {
        m = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 4), new THREE.MeshStandardMaterial({ color: HOSTILE, emissive: HOSTILE, emissiveIntensity: 3, transparent: true, opacity: 0.85 }));
        this.scene.add(m); this.shockMeshes.set(s, m);
      }
      toWorld(s.x, s.y + 0.5, 0.2, m.position);
      m.rotation.y += 0.4;
      if (Math.random() < 0.8) this.burst(s.x, s.y + 0.2, HOSTILE, 2, 3, 0.35, 0.25, { dir: Math.PI / 2, spread: 1.5 });
    }
    for (const [s, m] of this.shockMeshes) if (!seen.has(s)) { this.scene.remove(m); this.shockMeshes.delete(s); }
  }

  // ---- Echo's nano-scarf: a spring chain that becomes the lash ----
  syncScarves(dt, world, view) {
    const seen = new Set();
    for (const p of world.players) {
      if (p.char !== 'echo') continue;
      const rig = view.rigs.get(p); if (!rig) continue;
      seen.add(p);
      let S = this.scarves.get(p);
      if (!S) S = this.makeScarf(p, rig);
      const anchor = rig.collar.getWorldPosition(this.tmp2);
      const pts = S.pts, n = pts.length;
      const fast = Math.hypot(p.vx, p.vy) > 10 || p.state === 'dash' || p.state === 'zip';
      const seg = fast ? 0.16 : 0.12;
      pts[0].copy(anchor);
      const reel = p.leash && !p.leash.e.dead ? p.leash.e : null;
      if (((p.state === 'lash' || p.state === 'zip') && p.lash) || reel) {
        const L = reel ? { tx: reel.x, ty: reel.y + reel.h * 0.55, len: 1 } : p.lash, tgt = toWorld(L.tx, L.ty, 0.2, new THREE.Vector3());
        const k = p.state === 'zip' || reel ? 1 : L.len;
        for (let i = 1; i < n; i++) { const u = i / (n - 1) * k; S.prev[i].copy(pts[i]); pts[i].copy(anchor).lerp(tgt, u); }
      } else {
        const g = fast ? -2 : -9.5;
        const back = planeDir(p.x, -p.facing, 0, new THREE.Vector3());
        const sway = Math.sin(view.camera.position.x * 0.2 + performance.now() * 0.003) * 0.0012;
        for (let i = 1; i < n; i++) {
          const v = this.tmp.copy(pts[i]).sub(S.prev[i]).multiplyScalar(0.92);
          S.prev[i].copy(pts[i]); pts[i].add(v); pts[i].y += g * dt * dt;
          pts[i].addScaledVector(back, 0.0016 * i); pts[i].y += sway * i;
        }
        for (let it = 0; it < 3; it++) for (let i = 1; i < n; i++) {
          const a = pts[i - 1], b = pts[i], d = b.distanceTo(a) || 1e-4;
          b.sub(a).multiplyScalar(seg / d).add(a);
        }
      }
      // Rebuild the ribbon facing the camera
      const cam = view.camera.position, pos = S.geo.attributes.position.array;
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        const dir = this.tmp.copy(b).sub(a).normalize();
        const toCam = new THREE.Vector3().copy(cam).sub(pts[i]).normalize();
        const side = new THREE.Vector3().crossVectors(dir, toCam).normalize().multiplyScalar(0.09 * (1 - i / n * 0.55));
        pos.set([pts[i].x + side.x, pts[i].y + side.y, pts[i].z + side.z, pts[i].x - side.x, pts[i].y - side.y, pts[i].z - side.z], i * 6);
      }
      S.geo.attributes.position.needsUpdate = true; S.geo.computeVertexNormals();
      // The scarf shows its mode to everyone: off-white with orange edges (Tether), slate and
      // fading with the body (Veil), glowing along its whole length with rising embers (Flare)
      const mode = p.scarfMode || 'tether';
      if (S.mode !== mode) { S.mode = mode; S.mesh.material = S.mats[mode]; }
      if (mode === 'flare') {
        S.mats.flare.emissiveIntensity = 1.2 + Math.sin(performance.now() * 0.009) * 0.35;
        if (Math.random() < 0.45) this.burstAt(pts[1 + Math.floor(Math.random() * (n - 1))], ECHO_ORANGE, 1, 1.2, 0.18, 0.45);
      } else if (mode === 'veil') S.mats.veil.opacity = 1 - 0.8 * (rig.cloak || 0);
      else S.mat.emissiveIntensity = fast || p.state === 'lash' || reel ? 1.6 : 0.5;
    }
    for (const [p, S] of this.scarves) if (!seen.has(p)) { this.scene.remove(S.mesh); this.scarves.delete(p); }
  }
  syncSnares(world) {
    this.snareMeshes = this.snareMeshes || new Map();
    const seen = new Set();
    for (const s of world.snares) {
      seen.add(s);
      let m = this.snareMeshes.get(s);
      if (!m) {
        m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.08, 20), new THREE.MeshStandardMaterial({ color: '#2a2a31', roughness: 0.5 })));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 24), new THREE.MeshStandardMaterial({ color: ECHO_ORANGE, emissive: ECHO_ORANGE, emissiveIntensity: 2 }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; m.add(ring); m.userData.ring = ring;
        toWorld(s.x, s.y + 0.04, 0.35, m.position); this.scene.add(m); this.snareMeshes.set(s, m);
      }
      const armed = s.armT <= 0;
      m.userData.ring.material.emissiveIntensity = armed ? 1.6 + Math.sin(performance.now() * 0.012) * 0.9 : 0.4;
    }
    for (const [s, m] of this.snareMeshes) if (!seen.has(s)) { this.scene.remove(m); this.snareMeshes.delete(s); }
  }
  syncSnaredRings(world) {
    this.bands = this.bands || new Map();
    const seen = new Set();
    for (const e of world.enemies) {
      if (e.dead || e.state !== 'snared') continue;
      seen.add(e);
      let g = this.bands.get(e);
      if (!g) {
        g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: ECHO_ORANGE, emissive: ECHO_ORANGE, emissiveIntensity: 2.4, transparent: true, opacity: 0.85 });
        for (const f of [0.25, 0.55]) { const r = new THREE.Mesh(new THREE.TorusGeometry(e.w * 0.75, 0.04, 6, 24), mat); r.rotation.x = Math.PI / 2; r.position.y = e.h * f; g.add(r); }
        this.scene.add(g); this.bands.set(e, g);
      }
      toWorld(e.x, e.y, 0, g.position);
      g.rotation.y += 0.08;
    }
    for (const [e, g] of this.bands) if (!seen.has(e)) { this.scene.remove(g); this.bands.delete(e); }
  }

  makeScarf(p, rig) {
    const n = 14, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    const uv = [], idx = [];
    for (let i = 0; i < n; i++) { uv.push(0, i / (n - 1), 1, i / (n - 1)); if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2)); geo.setIndex(idx);
    const tex = canvasTex(64, (g, s) => { g.fillStyle = '#ecebe6'; g.fillRect(0, 0, s, s); g.fillStyle = '#ff9a1f'; g.fillRect(0, 0, s * 0.12, s); g.fillRect(s * 0.88, 0, s * 0.12, s); });
    // Only the edges glow; the off-white fabric stays unlit
    const edges = canvasTex(64, (g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); g.fillStyle = '#fff'; g.fillRect(0, 0, s * 0.12, s); g.fillRect(s * 0.88, 0, s * 0.12, s); });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ff9a1f', emissiveMap: edges, emissiveIntensity: 1.2, side: THREE.DoubleSide, roughness: 0.6 });
    const veilTex = canvasTex(64, (g, s) => { g.fillStyle = '#7d8896'; g.fillRect(0, 0, s, s); g.fillStyle = '#e4f1ff'; g.fillRect(0, 0, s * 0.1, s); g.fillRect(s * 0.9, 0, s * 0.1, s); });
    const mats = {
      tether: mat,
      veil: new THREE.MeshStandardMaterial({ map: veilTex, emissive: '#cde8ff', emissiveMap: edges, emissiveIntensity: 0.8, side: THREE.DoubleSide, roughness: 0.4, transparent: true }),
      flare: new THREE.MeshStandardMaterial({ color: '#ff9f3a', emissive: '#ff7a00', emissiveIntensity: 1.3, side: THREE.DoubleSide, roughness: 0.5 }),
    };
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = true; this.scene.add(mesh);
    const a = rig.collar.getWorldPosition(new THREE.Vector3());
    const pts = Array.from({ length: n }, (_, i) => a.clone().add(new THREE.Vector3(0, -i * 0.1, 0)));
    const S = { geo, mat, mats, mode: 'tether', mesh, pts, prev: pts.map(v => v.clone()) };
    this.scarves.set(p, S); return S;
  }
}

const NOVA_GOLD = CHARS.nova.energy;
const ECHO_ORANGE = CHARS.echo.energy;
const VEIL_PALE = '#dcecff';
const SPIN = new Set(['std', 'heavy', 'snare', 'shell', 'prism', 'mortar']);
const KIND_TINT = { dart: ATTACH_LOOK.volley.tint, shell: ATTACH_LOOK.arc.tint, prism: ATTACH_LOOK.prism.tint, shard: ATTACH_LOOK.prism.tint, pellet: '#ffcf7a' };
function trailColor(pr) {
  if (pr.team === 'e') return HOSTILE;
  if (pr.kind === 'bolt' || pr.kind === 'tracer' || pr.kind === 'rifle' || pr.kind === 'markShot') return ECHO_ORANGE;
  return KIND_TINT[pr.kind] || NOVA_GOLD;
}

// Comic "impact frame" (Q-C test): ink shadows, paper highlights, warm accents survive.
export const InkShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0 }, res: { value: new THREE.Vector2(1280, 720) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float amount; uniform vec2 res; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (amount <= 0.0) { gl_FragColor = c; return; }
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec2 px = vUv * res / 5.0; float dots = length(fract(px) - 0.5);
      float ink = l < 0.28 ? 0.0 : (l < 0.55 ? step(0.32, dots) : 1.0);
      vec3 paper = vec3(1.0, 0.97, 0.9), inkc = vec3(0.06, 0.05, 0.08);
      vec3 comic = mix(inkc, paper, ink);
      float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
      comic = mix(comic, c.rgb * 1.2, smoothstep(0.35, 0.6, sat) * step(0.5, l));
      gl_FragColor = vec4(mix(c.rgb, comic, amount), 1.0);
    }`,
};
