// ══════════════════════════════════════════════════════
//  VOID SWARM  –  Vampire Survivors Style
// ══════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = 800, H = 560;
canvas.width = W; canvas.height = H;

// ── Utils ─────────────────────────────────────────────
const rand  = (a, b) => a + Math.random() * (b - a);
const rInt  = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist  = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// ── Input ─────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true;  if ((e.key==='p'||e.key==='P'||e.key==='Escape') && gameState==='playing') togglePause(); });
document.addEventListener('keyup',   e => { keys[e.key] = false; });

// ── Particles ─────────────────────────────────────────
const particles = [];
function spawnParticles(x, y, color, n = 10, maxSpd = 90) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(20, maxSpd);
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      life: 1, decay: rand(1.4, 3), r: rand(2, 5), color });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= (1 - 5*dt); p.vy *= (1 - 5*dt);
    p.life -= p.decay * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life * p.life;
    ctx.shadowBlur = 8; ctx.shadowColor = p.color;
    ctx.fillStyle  = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// ── Floaters ──────────────────────────────────────────
const floaters = [];
function spawnFloat(x, y, text, color) { floaters.push({ x, y, text, color, life: 1 }); }
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].y -= 55 * dt; floaters[i].life -= 1.5 * dt;
    if (floaters[i].life <= 0) floaters.splice(i, 1);
  }
}
function drawFloaters() {
  for (const f of floaters) {
    ctx.globalAlpha = f.life;
    ctx.shadowBlur = 8; ctx.shadowColor = f.color;
    ctx.fillStyle  = f.color;
    ctx.font = 'bold 13px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// ── Camera ────────────────────────────────────────────
const cam = { x: 0, y: 0 };

// ══════════════════════════════════════════════════════
//  BACKGROUND
// ══════════════════════════════════════════════════════
const GRID = 72;
function drawBackground() {
  ctx.fillStyle = '#04030a';
  ctx.fillRect(0, 0, W, H);

  const sx = ((cam.x % GRID) + GRID) % GRID;
  const sy = ((cam.y % GRID) + GRID) % GRID;

  ctx.strokeStyle = 'rgba(40,0,80,0.35)';
  ctx.lineWidth = 1;
  for (let x = -sx; x < W + GRID; x += GRID) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = -sy; y < H + GRID; y += GRID) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Ambient dots
  ctx.fillStyle = 'rgba(100,0,200,0.06)';
  for (let x = -sx + GRID/2; x < W + GRID; x += GRID) {
    for (let y = -sy + GRID/2; y < H + GRID; y += GRID) {
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ══════════════════════════════════════════════════════
//  XP GEMS
// ══════════════════════════════════════════════════════
const gems = [];
function spawnGem(x, y, val = 1) { gems.push({ x, y, val, r: 6 + val * 1.5, angle: rand(0, Math.PI*2) }); }
function updateGems(dt) {
  const px = player.wx, py = player.wy;
  const pRange = player.pickupRange;
  const magnet = player.hasMagnet;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.angle += dt * 2;
    const d = dist(g.x, g.y, px, py);
    if (magnet || d < pRange) {
      const spd = magnet ? 280 : 200;
      const dx = px - g.x, dy = py - g.y, dd = Math.hypot(dx, dy) || 1;
      g.x += (dx/dd) * spd * dt;
      g.y += (dy/dd) * spd * dt;
    }
    if (d < 14) {
      player.gainXP(g.val);
      spawnParticles(g.x - cam.x, g.y - cam.y, '#aa00ff', 5, 50);
      gems.splice(i, 1);
    }
  }
}
function drawGems() {
  for (const g of gems) {
    const sx = g.x - cam.x, sy = g.y - cam.y;
    if (sx < -20 || sx > W+20 || sy < -20 || sy > H+20) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(g.angle);
    ctx.shadowBlur = 12; ctx.shadowColor = '#aa00ff';
    ctx.fillStyle = '#cc44ff';
    ctx.beginPath();
    ctx.moveTo(0, -g.r); ctx.lineTo(g.r*0.55, 0);
    ctx.lineTo(0, g.r);  ctx.lineTo(-g.r*0.55, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }
}

// ══════════════════════════════════════════════════════
//  PLAYER
// ══════════════════════════════════════════════════════
const player = {
  wx: 0, wy: 0,         // world position
  r: 18,
  speed: 165,
  hp: 100, maxHp: 100,
  xp: 0, xpNeeded: 12,
  level: 1,
  pickupRange: 70,
  hasMagnet: false,
  kills: 0,
  angle: 0,             // visual rotation

  // Weapons
  bulletDmg: 12,
  bulletCount: 8,       // directions
  bulletCooldown: 0,
  bulletRate: 1.8,      // seconds
  bulletRange: 300,

  orbCount: 0,
  orbDmg: 18,
  orbRadius: 72,
  orbSpeed: 2.2,        // rad/s
  orbAngle: 0,

  lightningTargets: 0,
  lightningDmg: 35,
  lightningCooldown: 0,
  lightningRate: 2.0,

  novaActive: false,
  novaDmg: 50,
  novaCooldown: 0,
  novaRate: 5.0,
  novaRadius: 0,
  novaMaxRadius: 160,

  reset() {
    this.wx = 0; this.wy = 0;
    this.hp = 100; this.maxHp = 100;
    this.xp = 0; this.xpNeeded = 12;
    this.level = 1; this.kills = 0;
    this.speed = 165; this.pickupRange = 70; this.hasMagnet = false;
    this.bulletDmg = 12; this.bulletCount = 8; this.bulletRate = 1.8; this.bulletRange = 300;
    this.bulletCooldown = 0;
    this.orbCount = 0; this.orbDmg = 18; this.orbRadius = 72; this.orbAngle = 0;
    this.lightningTargets = 0; this.lightningDmg = 35; this.lightningCooldown = 0; this.lightningRate = 2.0;
    this.novaActive = false; this.novaDmg = 50; this.novaCooldown = 0; this.novaRate = 5.0; this.novaRadius = 0;
  },

  update(dt) {
    // Movement
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) dy -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) dy += 1;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    this.wx += dx * this.speed * dt;
    this.wy += dy * this.speed * dt;
    if (dx || dy) this.angle = Math.atan2(dy, dx) - Math.PI/2;

    // Camera follows player
    cam.x = this.wx - W/2;
    cam.y = this.wy - H/2;

    // Bullet ring weapon
    if ((this.bulletCooldown -= dt) <= 0) {
      this.bulletCooldown = this.bulletRate;
      this.shootBulletRing();
    }

    // Orbs
    this.orbAngle += this.orbSpeed * dt;

    // Lightning
    if (this.lightningTargets > 0 && (this.lightningCooldown -= dt) <= 0) {
      this.lightningCooldown = this.lightningRate;
      this.strikeLightning();
    }

    // Nova
    if (this.novaCooldown > 0) {
      this.novaCooldown -= dt;
      if (this.novaActive) {
        this.novaRadius += 380 * dt;
        // damage enemies in ring
        for (const e of enemies) {
          if (!e.alive) continue;
          const d = dist(e.wx, e.wy, this.wx, this.wy);
          if (Math.abs(d - this.novaRadius) < 22) e.hit(this.novaDmg);
        }
        if (this.novaRadius >= this.novaMaxRadius) {
          this.novaActive = false;
          this.novaRadius = 0;
        }
      }
    } else if (this.novaRate > 0) {
      this.novaCooldown = this.novaRate;
      this.novaActive = true;
      this.novaRadius = 0;
    }

    updateHUD();
  },

  shootBulletRing() {
    for (let i = 0; i < this.bulletCount; i++) {
      const a = (Math.PI * 2 / this.bulletCount) * i;
      const spd = 320;
      playerBullets.push({
        x: this.wx, y: this.wy,
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        dmg: this.bulletDmg, r: 5,
        life: this.bulletRange / spd,
        alive: true
      });
    }
  },

  strikeLightning() {
    const sorted = enemies
      .filter(e => e.alive)
      .sort((a,b) => dist(a.wx,a.wy,this.wx,this.wy) - dist(b.wx,b.wy,this.wx,this.wy))
      .slice(0, this.lightningTargets);
    for (const e of sorted) {
      e.hit(this.lightningDmg);
      lightningArcs.push({ x1: this.wx, y1: this.wy, x2: e.wx, y2: e.wy, life: 0.18 });
      spawnParticles(e.wx - cam.x, e.wy - cam.y, '#ffee00', 8, 60);
    }
  },

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    updateHUD();
    if (this.hp <= 0) onGameOver();
  },

  gainXP(val) {
    this.xp += val;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.xpNeeded = Math.floor(this.xpNeeded * 1.25);
      this.level++;
      onLevelUp();
    }
    updateHUD();
  },

  draw() {
    const sx = this.wx - cam.x, sy = this.wy - cam.y;

    // Nova ring
    if (this.novaActive && this.novaRadius > 0) {
      ctx.shadowBlur  = 20; ctx.shadowColor = '#00ff88';
      ctx.strokeStyle = `rgba(0,255,136,${0.8 * (1 - this.novaRadius/this.novaMaxRadius)})`;
      ctx.lineWidth   = 4;
      ctx.beginPath(); ctx.arc(sx, sy, this.novaRadius, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur  = 0;
    }

    // Orbs
    for (let i = 0; i < this.orbCount; i++) {
      const a  = this.orbAngle + (Math.PI*2 / this.orbCount) * i;
      const ox = sx + Math.cos(a) * this.orbRadius;
      const oy = sy + Math.sin(a) * this.orbRadius;
      ctx.shadowBlur  = 18; ctx.shadowColor = '#00ff88';
      ctx.fillStyle   = '#00ff88';
      ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle   = '#ffffff';
      ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur  = 0;

      // Orbit trail
      for (let t = 1; t <= 5; t++) {
        const ta = a - t * 0.18;
        const tx = sx + Math.cos(ta) * this.orbRadius;
        const ty = sy + Math.sin(ta) * this.orbRadius;
        ctx.globalAlpha = (1 - t/6) * 0.5;
        ctx.fillStyle = '#00ff88';
        ctx.beginPath(); ctx.arc(tx, ty, 4 * (1 - t/6), 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Body glow
    ctx.shadowBlur  = 28; ctx.shadowColor = '#00ff88';

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    // Wings
    ctx.fillStyle = '#005533';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(-22, 14); ctx.lineTo(-9, 8); ctx.lineTo(0, 0);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(22, 14); ctx.lineTo(9, 8); ctx.lineTo(0, 0);
    ctx.closePath(); ctx.fill();

    // Hull
    const g = ctx.createLinearGradient(0, -22, 0, 18);
    g.addColorStop(0, '#00ff88'); g.addColorStop(0.5, '#00aa55'); g.addColorStop(1, '#003322');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0,-22); ctx.lineTo(-11,16); ctx.lineTo(0,10); ctx.lineTo(11,16);
    ctx.closePath(); ctx.fill();

    // Cockpit
    ctx.fillStyle = 'rgba(180,255,220,0.85)';
    ctx.beginPath(); ctx.ellipse(0,-8,5,10,0,0,Math.PI*2); ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
  }
};

// ── Lightning arcs ────────────────────────────────────
const lightningArcs = [];
function updateLightning(dt) {
  for (let i = lightningArcs.length-1; i >= 0; i--) {
    lightningArcs[i].life -= dt;
    if (lightningArcs[i].life <= 0) lightningArcs.splice(i, 1);
  }
}
function drawLightning() {
  for (const arc of lightningArcs) {
    ctx.globalAlpha = arc.life / 0.18;
    ctx.shadowBlur  = 14; ctx.shadowColor = '#ffee00';
    ctx.strokeStyle = '#ffee00';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(arc.x1 - cam.x, arc.y1 - cam.y);
    // Jagged path
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const t  = i / steps;
      const mx = arc.x1 + (arc.x2 - arc.x1) * t - cam.x + rand(-12, 12);
      const my = arc.y1 + (arc.y2 - arc.y1) * t - cam.y + rand(-12, 12);
      ctx.lineTo(mx, my);
    }
    ctx.lineTo(arc.x2 - cam.x, arc.y2 - cam.y);
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
}

// ── Player bullets ────────────────────────────────────
const playerBullets = [];
function updatePlayerBullets(dt) {
  for (let i = playerBullets.length-1; i >= 0; i--) {
    const b = playerBullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || !b.alive) playerBullets.splice(i, 1);
  }
}
function drawPlayerBullets() {
  for (const b of playerBullets) {
    const sx = b.x - cam.x, sy = b.y - cam.y;
    if (sx < -20 || sx > W+20 || sy < -20 || sy > H+20) continue;
    ctx.shadowBlur  = 12; ctx.shadowColor = '#00ff88';
    ctx.fillStyle   = '#00ff88';
    ctx.beginPath(); ctx.arc(sx, sy, b.r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ══════════════════════════════════════════════════════
//  ENEMIES
// ══════════════════════════════════════════════════════
const enemies = [];

class BaseEnemy {
  constructor(x, y) {
    this.wx = x; this.wy = y;
    this.alive = true;
    this.hitFlash = 0;
    this.contactTimer = 0;
  }
  hit(dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.12;
    if (this.hp <= 0) this.die();
  }
  die() {
    this.alive = false;
    spawnParticles(this.wx - cam.x, this.wy - cam.y, this.color, 14, 80);
    spawnGem(this.wx, this.wy, this.gemVal);
    score += this.pts;
    player.kills++;
    updateHUD();
  }
  touchPlayer(dt) {
    const d = dist(this.wx, this.wy, player.wx, player.wy);
    if (d < this.r + player.r) {
      this.contactTimer += dt;
      if (this.contactTimer >= 0.5) {
        player.takeDamage(this.contactDmg);
        this.contactTimer = 0;
      }
    } else {
      this.contactTimer = 0;
    }
  }
  baseDraw(shape = 'circle') {
    const sx = this.wx - cam.x, sy = this.wy - cam.y;
    if (sx < -60 || sx > W+60 || sy < -60 || sy > H+60) return false;
    if (this.hitFlash > 0) { ctx.globalAlpha = 0.4 + 0.6 * Math.sin(this.hitFlash * 80); }
    ctx.shadowBlur  = 14; ctx.shadowColor = this.color;
    return { sx, sy };
  }
}

class Crawler extends BaseEnemy {
  constructor(x, y, scale = 1) {
    super(x, y);
    this.hp = Math.floor(20 * scale); this.maxHp = this.hp;
    this.speed = rand(48, 68); this.r = 13;
    this.color = '#ff2244'; this.pts = 10; this.gemVal = 1;
    this.contactDmg = 8;
    this.angle = 0;
  }
  update(dt) {
    this.angle += dt * 2;
    const dx = player.wx - this.wx, dy = player.wy - this.wy;
    const d = Math.hypot(dx, dy) || 1;
    this.wx += (dx/d) * this.speed * dt;
    this.wy += (dy/d) * this.speed * dt;
    this.touchPlayer(dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }
  draw() {
    const res = this.baseDraw();
    if (!res) { ctx.globalAlpha = 1; return; }
    const { sx, sy } = res;
    ctx.fillStyle = this.color;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(0,-this.r); ctx.lineTo(this.r*0.6,this.r*0.6);
    ctx.lineTo(0,this.r*0.3); ctx.lineTo(-this.r*0.6,this.r*0.6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    this.drawHpBar(sx, sy);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  drawHpBar(sx, sy) {
    const pct = this.hp / this.maxHp;
    if (pct >= 1) return;
    ctx.fillStyle = '#330000';
    ctx.fillRect(sx-16, sy-this.r-8, 32, 4);
    ctx.fillStyle = '#ff2244';
    ctx.fillRect(sx-16, sy-this.r-8, 32*pct, 4);
  }
}

class Runner extends BaseEnemy {
  constructor(x, y, scale = 1) {
    super(x, y);
    this.hp = Math.floor(12 * scale); this.maxHp = this.hp;
    this.speed = rand(115, 145); this.r = 10;
    this.color = '#ff8800'; this.pts = 20; this.gemVal = 1;
    this.contactDmg = 6;
    this.angle = 0;
  }
  update(dt) {
    this.angle -= dt * 3.5;
    const dx = player.wx - this.wx, dy = player.wy - this.wy;
    const d = Math.hypot(dx, dy) || 1;
    this.wx += (dx/d) * this.speed * dt;
    this.wy += (dy/d) * this.speed * dt;
    this.touchPlayer(dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }
  draw() {
    const res = this.baseDraw();
    if (!res) { ctx.globalAlpha = 1; return; }
    const { sx, sy } = res;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI/2)*i;
      ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*this.r, Math.sin(a)*this.r);
      ctx.lineTo(Math.cos(a+0.4)*this.r*0.5, Math.sin(a+0.4)*this.r*0.5);
    }
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
}

class Brute extends BaseEnemy {
  constructor(x, y, scale = 1) {
    super(x, y);
    this.hp = Math.floor(80 * scale); this.maxHp = this.hp;
    this.speed = rand(30, 42); this.r = 26;
    this.color = '#aa00ff'; this.pts = 60; this.gemVal = 4;
    this.contactDmg = 20;
    this.angle = 0;
  }
  update(dt) {
    this.angle += dt * 0.8;
    const dx = player.wx - this.wx, dy = player.wy - this.wy;
    const d = Math.hypot(dx, dy) || 1;
    this.wx += (dx/d) * this.speed * dt;
    this.wy += (dy/d) * this.speed * dt;
    this.touchPlayer(dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }
  draw() {
    const res = this.baseDraw();
    if (!res) { ctx.globalAlpha = 1; return; }
    const { sx, sy } = res;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.angle);
    const g = ctx.createRadialGradient(0,0,0,0,0,this.r);
    g.addColorStop(0,'#dd88ff'); g.addColorStop(0.6,'#8800cc'); g.addColorStop(1,'#330055');
    ctx.fillStyle = g;
    ctx.strokeStyle = this.color; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i=0;i<6;i++) {
      const a=(Math.PI/3)*i;
      i===0?ctx.moveTo(Math.cos(a)*this.r,Math.sin(a)*this.r)
           :ctx.lineTo(Math.cos(a)*this.r,Math.sin(a)*this.r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // HP bar
    const pct = this.hp/this.maxHp;
    ctx.fillStyle='#1a0033'; ctx.fillRect(sx-26,sy-this.r-9,52,5);
    ctx.fillStyle=this.color; ctx.fillRect(sx-26,sy-this.r-9,52*pct,5);
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }
}

class BossEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y);
    const t = Math.floor(surviveTime / 90);
    this.hp = 600 + t * 300; this.maxHp = this.hp;
    this.speed = 38; this.r = 44;
    this.color = '#ff00aa'; this.pts = 500; this.gemVal = 20;
    this.contactDmg = 30;
    this.angle = 0; this.shootCD = 0; this.phase = 1;
  }
  update(dt) {
    this.angle += dt * 0.5;
    if (this.hp < this.maxHp*0.5 && this.phase===1) { this.phase=2; this.speed=55; }
    const dx=player.wx-this.wx, dy=player.wy-this.wy, d=Math.hypot(dx,dy)||1;
    this.wx+=(dx/d)*this.speed*dt; this.wy+=(dy/d)*this.speed*dt;
    this.touchPlayer(dt);
    if (this.hitFlash>0) this.hitFlash-=dt;
    this.shootCD-=dt;
    if (this.shootCD<=0) {
      this.shootCD = this.phase===2 ? 1.5 : 2.5;
      const count = this.phase===2?8:5;
      for (let i=0;i<count;i++) {
        const a=(Math.PI*2/count)*i + this.angle;
        enemyBullets.push({x:this.wx,y:this.wy,vx:Math.cos(a)*130,vy:Math.sin(a)*130,r:7,dmg:18,alive:true,life:4});
      }
    }
  }
  die() {
    this.alive = false;
    for (let i=0;i<5;i++) setTimeout(()=>spawnParticles(this.wx-cam.x,this.wy-cam.y,'#ff00aa',20,100),i*200);
    for (let i=0;i<this.gemVal;i++) spawnGem(this.wx+rand(-60,60),this.wy+rand(-60,60),3);
    score += this.pts; player.kills++; updateHUD();
    spawnFloat(this.wx,this.wy,'JEFE MUERTO +'+this.pts,'#ffee00');
  }
  draw() {
    const res = this.baseDraw();
    if (!res) { ctx.globalAlpha=1; return; }
    const { sx, sy } = res;
    ctx.save(); ctx.translate(sx,sy); ctx.rotate(this.angle);
    const g=ctx.createRadialGradient(0,0,0,0,0,this.r);
    g.addColorStop(0,'#ff88cc'); g.addColorStop(0.5,'#cc0077'); g.addColorStop(1,'#550033');
    ctx.fillStyle=g; ctx.strokeStyle=this.color; ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(0,-this.r);
    ctx.lineTo(this.r*0.7,-this.r*0.5); ctx.lineTo(this.r,this.r*0.3);
    ctx.lineTo(this.r*0.4,this.r);      ctx.lineTo(-this.r*0.4,this.r);
    ctx.lineTo(-this.r,this.r*0.3);     ctx.lineTo(-this.r*0.7,-this.r*0.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Eye
    ctx.fillStyle='#ff00aa'; ctx.shadowColor='#ff00aa'; ctx.shadowBlur=20;
    ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // HP bar
    const pct=this.hp/this.maxHp;
    ctx.fillStyle='#220011'; ctx.fillRect(sx-44,sy-this.r-12,88,7);
    ctx.fillStyle=pct>0.5?'#ff00aa':pct>0.25?'#ff6600':'#ff2244';
    ctx.fillRect(sx-44,sy-this.r-12,88*pct,7);
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }
}

// ── Enemy bullets ─────────────────────────────────────
const enemyBullets = [];
function updateEnemyBullets(dt) {
  for (let i=enemyBullets.length-1;i>=0;i--) {
    const b=enemyBullets[i];
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if (!b.alive || b.life<=0) { enemyBullets.splice(i,1); continue; }
    if (dist(b.x,b.y,player.wx,player.wy)<b.r+player.r) {
      player.takeDamage(b.dmg); b.alive=false;
    }
  }
}
function drawEnemyBullets() {
  for (const b of enemyBullets) {
    const sx=b.x-cam.x, sy=b.y-cam.y;
    if (sx<-20||sx>W+20||sy<-20||sy>H+20) continue;
    ctx.shadowBlur=10; ctx.shadowColor='#ff00aa';
    ctx.fillStyle='#ff44aa';
    ctx.globalAlpha=0.5;
    ctx.beginPath(); ctx.arc(sx,sy,b.r+3,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle='#ff00aa';
    ctx.beginPath(); ctx.arc(sx,sy,b.r,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  }
}

// ── Orb collision ─────────────────────────────────────
function checkOrbCollisions() {
  if (!player.orbCount) return;
  for (let i=0;i<player.orbCount;i++) {
    const a = player.orbAngle + (Math.PI*2/player.orbCount)*i;
    const ox = player.wx + Math.cos(a)*player.orbRadius;
    const oy = player.wy + Math.sin(a)*player.orbRadius;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (dist(ox,oy,e.wx,e.wy) < 9+e.r) e.hit(player.orbDmg * 0.04);
    }
  }
}

// ══════════════════════════════════════════════════════
//  COLLISION: bullets vs enemies
// ══════════════════════════════════════════════════════
function checkBulletCollisions() {
  for (let bi=playerBullets.length-1;bi>=0;bi--) {
    const b=playerBullets[bi];
    for (const e of enemies) {
      if (!e.alive) continue;
      if (dist(b.x,b.y,e.wx,e.wy) < b.r+e.r) {
        e.hit(b.dmg); b.alive=false; break;
      }
    }
  }
  // Cull dead enemies
  for (let i=enemies.length-1;i>=0;i--) { if (!enemies[i].alive) enemies.splice(i,1); }
}

// ══════════════════════════════════════════════════════
//  WAVE / SPAWN SYSTEM
// ══════════════════════════════════════════════════════
const SPAWN_DIST = 430;
let spawnTimer   = 0;
let bossTimer    = 0;

function spawnEnemy() {
  const a = rand(0, Math.PI*2);
  const x = player.wx + Math.cos(a)*SPAWN_DIST;
  const y = player.wy + Math.sin(a)*SPAWN_DIST;
  const t = surviveTime;
  const scale = 1 + Math.floor(t/45)*0.2;

  let roll = Math.random();
  if (t < 20)        { enemies.push(new Crawler(x,y,scale)); }
  else if (t < 50)   { roll < 0.7 ? enemies.push(new Crawler(x,y,scale)) : enemies.push(new Runner(x,y,scale)); }
  else if (t < 90)   { roll < 0.5 ? enemies.push(new Crawler(x,y,scale)) : roll < 0.8 ? enemies.push(new Runner(x,y,scale)) : enemies.push(new Brute(x,y,scale)); }
  else               { roll < 0.4 ? enemies.push(new Crawler(x,y,scale)) : roll < 0.7 ? enemies.push(new Runner(x,y,scale)) : enemies.push(new Brute(x,y,scale)); }
}

function spawnRate() {
  const t = surviveTime;
  if (t < 30)  return 2.0;
  if (t < 60)  return 1.3;
  if (t < 90)  return 0.9;
  if (t < 150) return 0.65;
  return 0.45;
}

// ══════════════════════════════════════════════════════
//  UPGRADE SYSTEM
// ══════════════════════════════════════════════════════
const ALL_UPGRADES = [
  { id:'bullet_dmg',   icon:'⚔️',  name:'DAÑO+',         desc:'Tus balas hacen +8 de daño.',        apply:()=>{ player.bulletDmg+=8; } },
  { id:'bullet_rate',  icon:'⚡',  name:'CADENCIA+',      desc:'Disparás un 25% más rápido.',         apply:()=>{ player.bulletRate=Math.max(0.5,player.bulletRate*0.75); } },
  { id:'bullet_count', icon:'💫',  name:'DISPERSIÓN+',    desc:'+4 balas por disparo.',              apply:()=>{ player.bulletCount+=4; } },
  { id:'bullet_range', icon:'🎯',  name:'RANGO+',         desc:'Tus balas viajan más lejos.',         apply:()=>{ player.bulletRange+=100; } },
  { id:'add_orb',      icon:'🌀',  name:'ORBE',           desc:'Un orbe gira a tu alrededor y daña enemigos.', apply:()=>{ player.orbCount+=1; } },
  { id:'orb_dmg',      icon:'🔥',  name:'ORBE FUERTE',    desc:'Los orbes hacen el doble de daño.',  apply:()=>{ player.orbDmg*=2; }, requires:()=>player.orbCount>0 },
  { id:'add_lightning',icon:'⚡',  name:'RAYO',           desc:'Un rayo fulmina al enemigo más cercano cada 2s.', apply:()=>{ player.lightningTargets+=1; } },
  { id:'lightning_dmg',icon:'☄️',  name:'RAYO FUERTE',    desc:'El rayo hace +25 de daño.',          apply:()=>{ player.lightningDmg+=25; }, requires:()=>player.lightningTargets>0 },
  { id:'add_nova',     icon:'💥',  name:'NOVA',           desc:'Una onda expansiva daña a todos cada 5s.', apply:()=>{ player.novaRate=5.0; player.novaCooldown=0; }, requires:()=>player.novaRate===0 },
  { id:'nova_radius',  icon:'🌊',  name:'NOVA GRANDE',    desc:'La onda expansiva alcanza más lejos.', apply:()=>{ player.novaMaxRadius+=80; player.novaDmg+=20; }, requires:()=>player.novaRate>0 },
  { id:'move_speed',   icon:'👟',  name:'VELOCIDAD+',     desc:'+20% de velocidad de movimiento.',   apply:()=>{ player.speed*=1.2; } },
  { id:'max_hp',       icon:'❤️',  name:'HP MÁXIMO+',     desc:'+35 de HP máximo y cura 20 HP.',     apply:()=>{ player.maxHp+=35; player.hp=Math.min(player.hp+20,player.maxHp); } },
  { id:'heal',         icon:'💊',  name:'CURACIÓN',       desc:'Restaura 40% de tu HP.',             apply:()=>{ player.hp=Math.min(player.maxHp,player.hp+Math.floor(player.maxHp*0.4)); } },
  { id:'magnet',       icon:'🧲',  name:'IMÁN',           desc:'Las gemas de XP vienen solas a vos.',apply:()=>{ player.hasMagnet=true; }, requires:()=>!player.hasMagnet },
  { id:'pickup_range', icon:'📡',  name:'RADAR+',         desc:'Recogés gemas desde más lejos.',     apply:()=>{ player.pickupRange+=60; } },
];

function getUpgradeOptions() {
  const valid = ALL_UPGRADES.filter(u => !u.requires || u.requires());
  const shuffled = valid.sort(()=>Math.random()-0.5);
  return shuffled.slice(0,3);
}

function onLevelUp() {
  gameState = 'levelup';
  document.getElementById('new-level-num').textContent = player.level;
  const opts = getUpgradeOptions();
  const container = document.getElementById('upgrade-cards');
  container.innerHTML = '';
  for (const u of opts) {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `<div class="card-icon">${u.icon}</div><div class="card-name">${u.name}</div><div class="card-desc">${u.desc}</div>`;
    card.onclick = () => { u.apply(); showOverlay(null); gameState='playing'; };
    container.appendChild(card);
  }
  showOverlay('levelup-screen');
}

// ══════════════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════════════
let gameState   = 'menu';
let score       = 0;
let highScore   = +(localStorage.getItem('voidSwarm_hs') || 0);
let surviveTime = 0;
let lastTime    = 0;

function formatTime(s) {
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const ss= Math.floor(s%60).toString().padStart(2,'0');
  return `${m}:${ss}`;
}

function startGame() {
  score=0; surviveTime=0; lastTime=0;
  particles.length=0; floaters.length=0;
  playerBullets.length=0; enemyBullets.length=0;
  enemies.length=0; gems.length=0; lightningArcs.length=0;
  spawnTimer=0; bossTimer=0;
  player.reset();
  cam.x=-W/2; cam.y=-H/2;
  updateHUD(); showOverlay(null);
  gameState='playing';
}

function onGameOver() {
  gameState='paused';
  if (score>highScore) { highScore=score; localStorage.setItem('voidSwarm_hs',highScore); }
  document.getElementById('go-time').textContent  = formatTime(surviveTime);
  document.getElementById('go-level').textContent = player.level;
  document.getElementById('go-kills').textContent = player.kills;
  document.getElementById('go-score').textContent = score + ' pts';
  document.getElementById('go-record').textContent= highScore + ' pts';
  showOverlay('gameover-screen');
}

function togglePause() {
  if (gameState==='playing') { gameState='paused'; showOverlay('pause-screen'); }
  else if (gameState==='paused') { gameState='playing'; showOverlay(null); }
}

function updateHUD() {
  document.getElementById('timer-display').textContent = formatTime(surviveTime);
  document.getElementById('kill-display').textContent  = '💀 '+player.kills;
  document.getElementById('score-display').textContent = score+' pts';
  document.getElementById('level-display').textContent = 'Nv.'+player.level;
  document.getElementById('xp-fill').style.width       = (player.xp/player.xpNeeded*100)+'%';
  const hpPct = player.hp/player.maxHp;
  document.getElementById('hp-fill').style.width       = (hpPct*100)+'%';
  document.getElementById('hp-fill').style.background  = hpPct>0.5?'linear-gradient(90deg,#cc0022,#ff2244,#ff6688)':hpPct>0.25?'linear-gradient(90deg,#882200,#ff4400)':'linear-gradient(90deg,#550000,#ff0000)';
  document.getElementById('hp-text').textContent       = player.hp+'/'+player.maxHp;
}

function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach(el=>el.classList.remove('active'));
  if (id) document.getElementById(id).classList.add('active');
}

// ── Button bindings ───────────────────────────────────
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', togglePause);

// ══════════════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════════════
function gameLoop(ts) {
  const dt = Math.min((ts - (lastTime||ts)) / 1000, 0.05);
  lastTime = ts;

  drawBackground();

  if (gameState === 'playing') {
    surviveTime += dt;
    score = Math.max(score, Math.floor(surviveTime * 10 + player.kills * 15));

    // Spawn enemies
    spawnTimer -= dt;
    if (spawnTimer <= 0 && enemies.length < 200) {
      spawnTimer = spawnRate();
      spawnEnemy();
      // Burst spawn after 60s
      if (surviveTime > 60 && Math.random() < 0.3) spawnEnemy();
    }

    // Boss spawn every 90s
    bossTimer -= dt;
    if (bossTimer <= 0) {
      bossTimer = 90;
      const a  = rand(0, Math.PI*2);
      enemies.push(new BossEnemy(player.wx+Math.cos(a)*SPAWN_DIST, player.wy+Math.sin(a)*SPAWN_DIST));
    }

    player.update(dt);
    enemies.forEach(e => e.update(dt));
    updatePlayerBullets(dt);
    updateEnemyBullets(dt);
    updateGems(dt);
    updateParticles(dt);
    updateFloaters(dt);
    updateLightning(dt);
    checkBulletCollisions();
    checkOrbCollisions();

    updateHUD();
  }

  // Draw world
  drawGems();
  drawPlayerBullets();
  drawEnemyBullets();
  enemies.forEach(e => e.draw());
  player.draw();
  drawLightning();
  drawParticles();
  drawFloaters();

  // Minimap
  drawMinimap();

  requestAnimationFrame(gameLoop);
}

// ── Minimap ───────────────────────────────────────────
function drawMinimap() {
  if (gameState !== 'playing') return;
  const mx=W-90, my=H-90, mw=80, mh=80, mscale=0.06;
  ctx.globalAlpha=0.7;
  ctx.fillStyle='rgba(0,0,0,0.6)';
  ctx.strokeStyle='rgba(0,255,120,0.3)';
  ctx.lineWidth=1;
  ctx.fillRect(mx,my,mw,mh); ctx.strokeRect(mx,my,mw,mh);

  // Player dot
  ctx.fillStyle='#00ff88'; ctx.shadowBlur=6; ctx.shadowColor='#00ff88';
  ctx.beginPath(); ctx.arc(mx+mw/2,my+mh/2,3,0,Math.PI*2); ctx.fill();

  // Enemy dots
  ctx.shadowBlur=0;
  for (const e of enemies) {
    const ex=(e.wx-player.wx)*mscale+mw/2;
    const ey=(e.wy-player.wy)*mscale+mh/2;
    if (ex<0||ex>mw||ey<0||ey>mh) continue;
    ctx.fillStyle=e.color;
    ctx.beginPath(); ctx.arc(mx+ex,my+ey,2,0,Math.PI*2); ctx.fill();
  }

  ctx.globalAlpha=1;
}

// ── Init ─────────────────────────────────────────────
updateHUD();
showOverlay('menu-screen');
requestAnimationFrame(gameLoop);
