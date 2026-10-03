// Astra's civic architecture and reactive machinery. All state belongs to the simulation;
// this module only dresses the route and reads interaction/mission state.
import * as THREE from 'three';
import { BOXES, pathFrame } from './level.js';
import { toWorld } from './space.js';
import { buildPlayerRig } from './rigs.js';

const PALETTE = { navy: '#152c49', steel: '#476883', ivory: '#d9e4e8', gold: '#f6ba56', cyan: '#64d8e5', mint: '#5eebbb' };
const yawAt = x => { const f = pathFrame(x); return Math.atan2(-f.tz, f.tx); };
const glowing = color => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.65, roughness: 0.65 });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function texture(draw, w = 512, h = 128) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function labelTexture(title, subtitle, tint = PALETTE.cyan) {
  return texture((g, w, h) => {
    g.fillStyle = '#102740'; g.fillRect(0, 0, w, h);
    g.fillStyle = tint; g.fillRect(0, 0, 9, h); g.fillRect(22, 18, 38, 5);
    g.font = 'bold 40px Arial'; g.fillStyle = '#eff5f4'; g.fillText(title, 23, 68, 455);
    g.font = '16px Arial'; g.fillStyle = tint; g.fillText(subtitle, 25, 104, 454);
  });
}

export class AstraVisuals {
  constructor(view) {
    this.view = view; this.scene = view.scene; this.objects = new Map(); this.shadows = new Map(); this.rotors = [];
    this.mats = Object.fromEntries(Object.entries(PALETTE).map(([k,v]) => [k, k === 'cyan' || k === 'mint' ? glowing(v) : new THREE.MeshStandardMaterial({ color:v, roughness:0.8, metalness:0.08, flatShading:true })]));
    this.signs = [];
    this.shadowTex = texture((g,w,h) => { const r=g.createRadialGradient(w/2,h/2,1,w/2,h/2,w/2); r.addColorStop(0,'rgba(7,19,34,0.65)'); r.addColorStop(0.45,'rgba(7,19,34,0.35)'); r.addColorStop(1,'rgba(7,19,34,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); },64,64);
    this.buildDistricts(); this.buildShowcase();
  }

  fixed(geometry, mat, x, y, depth = 0, rz = 0) {
    const m = new THREE.Mesh(geometry, mat); toWorld(x, y, depth, m.position); m.rotation.set(0,yawAt(x),0); m.rotateZ(rz); this.view.bake(m, false); return m;
  }

  sign(x,y,title,sub,tint=PALETTE.cyan,w=5.8) {
    const mat = new THREE.MeshBasicMaterial({ map:labelTexture(title,sub,tint), side:THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),mat); toWorld(x,y,-2.35,m.position); m.rotation.y=yawAt(x); this.scene.add(m); this.signs.push(m);
    const frame=new THREE.Mesh(box(w+0.2,w/4+0.18,0.18),this.mats.navy);frame.position.z=-0.15;m.add(frame);
  }

  buildDistricts() {
    const M=this.mats;
    // A structural front fascia, recessed ventilation and a quiet rail behind the action plane.
    for(const b of BOXES) {
      const w=b.x1-b.x0, h=b.y1-b.y0, mid=(b.x0+b.x1)/2;
      // New routes have their own landmarks. Destructible meshes must never receive baked trim.
      if(b.type==='g'||b.type==='d'||mid>=400||b.tag==='bound'||w<2||b.tag==='tunnel') continue;
      const depth=b.type==='o'?1.34:2.26;
      const accent=mid<60?M.cyan:mid<97?M.gold:mid<162?M.steel:M.cyan;
      for(let x=b.x0+0.5;x<b.x1-0.3;x+=2.2) {
        const span=Math.min(1.82,b.x1-x-0.15);
        this.fixed(box(span,0.14,0.08),accent,x+span/2,b.y1-0.35,depth);
        if(h>1.1) {
          this.fixed(box(span,0.46,0.08),M.navy,x+span/2,b.y1-0.83,depth);
          for(let k=0;k<3;k++)this.fixed(box(0.09,0.27,0.06),M.steel,x+0.28+k*0.28,b.y1-0.82,depth+0.045,-0.3);
        }
      }
      if(b.type==='o') {
        for(const x of [b.x0+0.28,b.x1-0.28])this.fixed(box(0.28,0.48,1.4),M.navy,x,b.y0-0.12,0);
      } else if(w>7&&b.tag!=='cover') {
        for(let x=b.x0+1;x<b.x1-0.5;x+=4) {
          this.fixed(box(0.1,1.05,0.12),M.steel,x,b.y1+0.52,-1.9);
          this.fixed(box(Math.min(3.9,b.x1-x),0.065,0.12),M.ivory,x+Math.min(3.9,b.x1-x)/2,b.y1+1.0,-1.9);
        }
        // Pillars and diagonals make suspended decks feel engineered instead of floating boxes.
        for(let x=b.x0+2;x<b.x1-1;x+=7) {
          this.fixed(box(0.45,Math.min(4,h),0.3),M.navy,x,b.y1-1.1-Math.min(4,h)/2,depth+0.04);
          this.fixed(box(3,0.2,0.22),M.steel,x+1.25,b.y1-2.2,depth+0.05,0.55);
        }
      }
      // White landing chevrons are inset on the surface, not hovering collectible-like objects.
      for(const x of [b.x0+0.55,b.x1-0.65]) {
        if(w<3)continue;
        const arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.35,0.65),M.ivory);
        toWorld(x,b.y1+0.015,0.2,arrow.position); arrow.rotation.set(-Math.PI/2,0,-yawAt(x)); this.view.bake(arrow,false);
      }
    }
    this.sign(6,3.55,'SKYPORT  /  01','CIVIC TRANSIT • EAST CONCOURSE',PALETTE.cyan,7);
    this.sign(37,8.05,'UPPER WALK','BOOST ACCESS  →',PALETTE.cyan,4.4);
    this.sign(51,4.2,'SERVICE ROUTE','EQUIPMENT ACCESS',PALETTE.gold,4.2);
    this.sign(80,7.4,'CONCOURSE LOCK','SECURITY CONTROL  /  02',PALETTE.gold,7.6);
    this.sign(109,6.8,'STORM SPIRE','CLIMB TO THE RELAY',PALETTE.cyan,5.8);
    this.sign(177,19.3,'SKYLINE RELAY','UPLINK  /  04   →',PALETTE.cyan,6.4);
    this.sign(233,17.25,'SERVICE YARD','KEEP CLEAR • HEAVY MACHINERY',PALETTE.gold,5.5);
    this.sign(279,26.8,'NORTH RELAY','RESTORE CIVIC POWER',PALETTE.cyan,7.4);
    // Transit equipment and angular façades: distinct silhouette landmarks per district.
    for(const [x,y] of [[9,0],[24,0],[68,0],[93,0],[170,15.6],[208,15.6],[253,18.6],[302,18.6]]) {
      this.fixed(box(1.6,0.45,1.2),M.navy,x,y+0.22,-4.2);
      this.fixed(box(1.1,2.8,0.8),M.ivory,x,y+1.85,-4.2);
      this.fixed(box(1.15,0.14,0.85),M.gold,x,y+2.7,-4.2);
      for(let i=0;i<4;i++)this.fixed(box(0.75,0.11,0.1),i<2?M.cyan:M.navy,x,y+1.1+i*0.32,-3.73);
    }
    for(const [x,y] of [[73,0],[87,0],[193,15.6],[218,12.6],[290,18.6]]) {
      const hub=new THREE.Group(); toWorld(x,y+4.5,-7.0,hub.position); hub.rotation.y=yawAt(x); this.scene.add(hub);
      const casing=new THREE.Mesh(new THREE.TorusGeometry(2.4,0.24,6,24),M.ivory); hub.add(casing);
      const center=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.6,0.55,8),M.navy); center.rotation.x=Math.PI/2; hub.add(center);
      const fan=new THREE.Group(); hub.add(fan);
      for(let j=0;j<5;j++){const blade=new THREE.Mesh(box(0.34,1.8,0.1),M.steel); blade.position.y=1.2; const g=new THREE.Group();g.rotation.z=j*Math.PI*2/5;g.add(blade);fan.add(g);}
      this.rotors.push(fan);
      this.fixed(box(0.3,5,0.5),M.navy,x,y+2.5,-7.5);
    }
    // The storm district has large copper conduit bands and diagonal machinery braces.
    for(let x=112;x<145;x+=5) {
      this.fixed(box(0.3,25,0.3),M.navy,x,11,-3.7);
      this.fixed(box(0.2,19,0.18),M.gold,x+0.4,9,-3.5);
      for(const y of [3,9,15])this.fixed(box(4.6,0.14,0.22),M.steel,x+2.3,y,-3.6);
    }
    // Graphic distant towers are deliberately quiet; the inhabited middle distance carries detail.
    for(let i=0;i<16;i++) {
      const x=-35+i*23, h=20+(i*13%39), z=-70-(i%4)*13;
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(2.6,4.0,h,5),new THREE.MeshStandardMaterial({color:i%2?'#819daf':'#a0b6c5',roughness:1}));
      tower.position.set(x,h/2-24,z); this.view.bake(tower,false);
      for(let k=0;k<4;k++){
        const win=new THREE.Mesh(box(0.45,h*0.62,0.12),M.cyan);win.position.set(x-1.5+k,h/2-24,z+2.6);this.view.bake(win,false);
      }
    }
  }

  buildShowcase() {
    this.showcase=new THREE.Group(); this.scene.add(this.showcase); this.showRigs=[];
    const chars=['nova','echo','ram','fix'];
    chars.forEach((char,i)=>{
      const rig=buildPlayerRig(char); rig.root.position.set(5.0+i*1.65,0,0); rig.root.rotation.y=-0.36;
      rig.hips.position.y=0.95;rig.armN.top.rotation.z=0.2;rig.armF.top.rotation.z=-0.12;
      rig.legN.top.rotation.z=0.16;rig.legF.top.rotation.z=-0.15; rig.head.rotation.z=0.05;
      if(char==='nova'){rig.armN.top.rotation.z=0.62;rig.armN.joint.rotation.z=1.05;rig.armF.top.rotation.z=-0.28;}
      if(char==='echo'){
        rig.armN.top.rotation.z=0.3;rig.armN.joint.rotation.z=0.25;rig.extra.blade.visible=true;
        const scarf=new THREE.Mesh(new THREE.PlaneGeometry(1.05,0.17),new THREE.MeshBasicMaterial({color:'#e9a54c',side:THREE.DoubleSide}));
        scarf.position.set(-0.55,0.6,0.22);scarf.rotation.z=0.12;rig.spine.add(scarf);
      }
      if(char==='ram'){rig.extra.shield.position.set(0.4,0.65,0.46);rig.armF.top.rotation.z=0.2;rig.armF.joint.rotation.z=0.6;}
      if(char==='fix'){rig.extra.wrench.visible=true;rig.extra.slung.visible=false;rig.armN.top.rotation.z=2.2;rig.armN.joint.rotation.z=2.05;}
      this.showcase.add(rig.root);this.showRigs.push(rig);
    });
  }

  machine(obj) {
    const g=new THREE.Group(); const parts={}; const M=this.mats;
    const mat=new THREE.MeshStandardMaterial({color:PALETTE.gold,emissive:PALETTE.gold,emissiveIntensity:0.55,roughness:0.55});
    const add=(geo,m,x=0,y=0,z=0)=>{const q=new THREE.Mesh(geo,m);q.position.set(x,y,z);q.castShadow=true;g.add(q);return q;};
    const type=obj.type||obj.kind, w=obj.w||1.2,h=obj.h||1.8;
    add(box(Math.max(w,1.2)+0.3,0.18,1.2),M.navy,0,0.07);
    if(type==='breach') {
      parts.panel=add(box(w,Math.max(1.5,h),0.4),M.steel,0,h/2);
      for(const x of [-w/2,w/2])add(box(0.14,h+0.2,0.55),M.navy,x,h/2);
      for(let i=0;i<4;i++){const q=new THREE.Mesh(box(w*0.72,0.11,0.06),i%2?M.navy:mat);q.position.set(0,(i+1)*h/5,0.25);q.rotation.z=-0.18;parts.panel.add(q);q.position.y-=h/2;}
    } else if(type==='anchor') {
      add(new THREE.CylinderGeometry(0.12,0.18,0.22,6),M.navy,0,-0.03);
      parts.rotor=add(new THREE.TorusGeometry(0.36,0.08,6,8),mat,0,h/2);parts.rotor.rotation.z=Math.PI/8;
      add(new THREE.OctahedronGeometry(0.16),M.ivory,0,h/2);
    } else if(type==='launch') {
      add(box(1.35,0.2,1.15),M.steel,0,0.2);
      parts.pad=add(box(1.13,0.09,0.92),mat,0,0.18);
      for(const x of [-0.44,0.44])add(new THREE.CylinderGeometry(0.09,0.11,0.25,6),M.ivory,x,0.2);
      const arrow=add(new THREE.ConeGeometry(0.2,0.4,3),mat,0,0.85);arrow.rotation.y=Math.PI/2;parts.arrow=arrow;
    } else {
      add(box(0.85,1.45,0.65),M.navy,0,0.85);
      add(box(0.65,1.2,0.12),M.steel,0,0.88,0.37);
      parts.core=add(new THREE.OctahedronGeometry(0.29),mat,0,1.08,0.5);
      const ring=add(new THREE.TorusGeometry(0.39,0.045,6,16),M.ivory,0,1.08,0.5);parts.rotor=ring;
      for(let i=0;i<3;i++)add(box(0.12,0.19,0.08),mat,-0.21+i*0.21,0.36,0.48);
      if(type==='relay'){
        add(new THREE.CylinderGeometry(0.08,0.12,2.1,6),M.ivory,0,2.55,-0.1);
        parts.dish=add(new THREE.TorusGeometry(0.62,0.085,6,20),mat,0,3.5,-0.1);
        add(box(1.2,0.07,0.15),M.ivory,0,3.5,-0.1);
      }
    }
    const icon=type==='breach'?'BREACH':type==='power'?'CHARGE':type==='anchor'?'TETHER':type==='repair'?'REPAIR':type==='launch'?'BOOST':'RESTORE';
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.6,0.4),new THREE.MeshBasicMaterial({map:labelTexture(icon,'',PALETTE.gold)}));
    sign.position.set(0,type==='anchor'?1.12:type==='launch'?1.4:type==='relay'?4.35:2.18,0.2);g.add(sign);parts.sign=sign;
    // State bar is geometric so charge and cooldown progress is visible without reading a tooltip.
    const bar=add(box(0.85,0.045,0.06),M.navy,0,type==='launch'?0.18:0.23,0.66);
    parts.fill=add(box(0.8,0.035,0.075),mat,0,bar.position.y,0.7);
    this.scene.add(g); return {g,parts,mat,type,obj,icon,flash:0,state:null};
  }

  update(world,dt,time) {
    const noPlayers=!world.players.length;
    this.showcase.visible=noPlayers;
    this.signs[0].visible=!noPlayers; // The roster owns the title composition; civic signage returns in play.
    if(noPlayers)this.showRigs.forEach((r,i)=>{r.spine.rotation.z=Math.sin(time*1.7+i)*0.018;r.head.rotation.z=-0.025+Math.sin(time+i)*0.025;});
    for(const fan of this.rotors)fan.rotation.z+=dt*(world.mission?.completed?0.65:0.24);
    const seen=new Set();
    for(const obj of world.interactables||[]) {
      const id=obj.id||obj;seen.add(id);let V=this.objects.get(id);
      if(!V){V=this.machine(obj);this.objects.set(id,V);}V.obj=obj;
      toWorld(obj.x,obj.y,0,V.g.position);V.g.rotation.y=yawAt(obj.x);
      const active=obj.state==='restored'||obj.state==='charged'||obj.state==='active'||obj.state==='open';
      const off=obj.state==='disabled'||obj.state==='locked'||obj.state==='cooldown';
      const col=active?PALETTE.mint:off?'#617080':V.type==='anchor'?'#ffaa61':PALETTE.gold;
      V.mat.color.set(col);V.mat.emissive.set(col);V.mat.emissiveIntensity=off?0.05:0.45+Math.sin(time*3)*0.12+V.flash;
      V.flash=Math.max(0,V.flash-dt*3);
      if(V.state!==obj.state){
        V.state=obj.state;
        const status=obj.state==='restored'?'ONLINE':obj.state==='open'?'CLEARED':obj.state==='disabled'?'NO POWER':obj.state==='locked'?'LOCKED':obj.state==='connecting'?'LINKING':obj.state==='cooldown'?'RECHARGING':V.icon;
        V.parts.sign.material.map.dispose();V.parts.sign.material.map=labelTexture(status,obj.optional?'OPTIONAL ROUTE':'CITY RELAY',col);V.parts.sign.material.needsUpdate=true;
      }
      if(V.parts.panel){V.parts.panel.visible=obj.state!=='open';V.parts.panel.rotation.z=obj.state==='cracked'?0.055:0;}
      if(V.parts.rotor)V.parts.rotor.rotation.z+=dt*(active?0.9:0.22);
      if(V.parts.core){V.parts.core.rotation.y=time*0.6;V.parts.core.scale.setScalar(1+Math.sin(time*3)*0.04);}
      if(V.parts.arrow){V.parts.arrow.visible=!off;V.parts.arrow.position.y=0.82+Math.sin(time*3)*0.08;}
      if(V.parts.pad)V.parts.pad.position.y=0.18+(obj.state==='active'?Math.sin(time*14)*0.055:0);
      const fraction=active?1:V.type==='breach'&&obj.maxHp?1-obj.hp/obj.maxHp:obj.maxCharge?clamp((obj.charge||0)/obj.maxCharge,0,1):0.15;
      V.parts.fill.scale.x=Math.max(0.02,fraction);V.parts.fill.position.x=-0.4+fraction*0.4;
      V.g.visible=Math.abs(obj.x-world.cam.x)<world.cam.halfW+25;
    }
    for(const [id,V]of this.objects)if(!seen.has(id)) {this.scene.remove(V.g);V.g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material?.map){o.material.map.dispose();o.material.dispose();}});V.mat.dispose();this.objects.delete(id);}
    this.updateShadows(world);
    const restoration=world.mission?.restoration;const city=world.mission?.completed||restoration?.city;
    this.mats.cyan.emissiveIntensity=city?1.2:0.65;
  }

  updateShadows(world) {
    const seen=new Set();
    for(const p of [...world.players,...world.enemies]) {
      seen.add(p); let shadow=this.shadows.get(p);
      if(!shadow){shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.shadowTex,transparent:true,depthWrite:false,opacity:0.6,polygonOffset:true,polygonOffsetFactor:-1}));shadow.rotation.x=-Math.PI/2;this.scene.add(shadow);this.shadows.set(p,shadow);}
      let floor=-100;
      for(const b of BOXES)if(b.type!=='g'&&!b.broken&&p.x>=b.x0&&p.x<=b.x1&&b.y1<=p.y+0.2)floor=Math.max(floor,b.y1);
      const height=p.y-floor;
      shadow.visible=!p.dead&&p.state!=='dead'&&height<12&&Math.abs(p.x-world.cam.x)<world.cam.halfW+4;
      if(!shadow.visible)continue;
      toWorld(p.x,floor+0.018,0,shadow.position);shadow.rotation.z=-yawAt(p.x);
      const size=(p.char==='ram'?1.35:p.boss?2.6:0.95)*(1+Math.min(0.75,height*0.06));
      shadow.scale.set(size*1.6,size*0.85,1);shadow.material.opacity=(p.kind==='player'?0.74:0.52)*Math.max(0.15,1-height/14);
    }
    for(const [p,m]of this.shadows)if(!seen.has(p)){this.scene.remove(m);m.geometry.dispose();m.material.dispose();this.shadows.delete(p);}
  }

  onEvent(ev) {
    if(ev.obj){const V=this.objects.get(ev.obj.id||ev.obj);if(V)V.flash=0.7;}
  }
}
