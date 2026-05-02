// ══════════════════════════════════════════════════════
//  NOVA BLITZ  –  Space Shooter
// ══════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = 520, H = 680;
canvas.width = W; canvas.height = H;

// ── Utils ─────────────────────────────────────────────────────────────────────
const clamp  = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp   = (a, b, t) => a + (b - a) * t;
const dist   = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const rand   = (a, b) => a + Math.random() * (b - a);

// ── Stars ─────────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 160 }, () => ({
  x: rand(0, W), y: rand(0, H),
  vy: rand(0.4, 2.4),
  r: rand(0.25, 1.7),
  phase: rand(0, Math.PI * 2),
}));

function updateStars() {
  STARS.forEach(s => {
    s.y += s.vy;
    s.phase += 0.014;
    if (s.y > H) { s.y = 0; s.x = rand(0, W); }
  });
}

function drawStars() {
  STARS.forEach(s => {
    ctx.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(s.phase));
    ctx.fillStyle = '#b8d0ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ── Particles ─────────────────────────────────────────────────────────────────
const particles = [];

function spawnParticles(x, y, color, n = 14, maxSpd = 4.5, maxR = 5) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(1, maxSpd);
    particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.8,
      life: 1,
      decay: rand(0.018, 0.034),
      r: rand(2, maxR),
      color,
    });
  }
}

function spawnBoom(x, y, color, big = false) {
  spawnParticles(x, y, color, big ? 28 : 14, big ? 6 : 4.5, big ? 7 : 5);
  spawnParticles(x, y, '#ffffff', big ? 10 : 5, 2.5, 3);
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.97; p.vy += 0.09;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life * p.life;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = p.color;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ── Floaters ──────────────────────────────────────────────────────────────────
const floaters = [];

function spawnFloat(x, y, text, color) {
  floaters.push({ x, y, text, color, life: 1 });
}

function updateFloaters() {
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].y -= 1.1;
    floaters[i].life -= 0.02;
    if (floaters[i].life <= 0) floaters.splice(i, 1);
  }
}

function drawFloaters() {
  for (const f of floaters) {
    ctx.globalAlpha = f.life;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = f.color;
    ctx.fillStyle   = f.color;
    ctx.font        = 'bold 13px Orbitron, monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ── Screen shake ──────────────────────────────────────────────────────────────
let shakeAmt = 0;
const shake = amt => { shakeAmt = Math.max(shakeAmt, amt); };

// ══════════════════════════════════════════════════════
//  PLAYER
// ══════════════════════════════════════════════════════
const player = {
  x: W / 2, y: H - 70,
  tx: W / 2,
  hp: 3, maxHp: 3,
  shield: false, shieldTimer: 0,
  invincible: false, invTimer: 0,
  fireRate: 18, fireCooldown: 0,
  weaponLv: 1,
  trail: [],

  reset() {
    this.x = W / 2; this.tx = W / 2;
    this.hp = 3; this.maxHp = 3;
    this.shield = false; this.shieldTimer = 0;
    this.invincible = false; this.invTimer = 0;
    this.fireCooldown = 0; this.fireRate = 18;
    this.weaponLv = 1;
    this.trail = [];
  },

  hit() {
    if (this.shield) {
      this.shield = false;
      shake(7); spawnBoom(this.x, this.y, '#00f5ff');
      spawnFloat(this.x, this.y - 35, '¡ESCUDO!', '#00f5ff');
      return;
    }
    if (this.invincible) return;
    this.hp--;
    this.invincible = true; this.invTimer = 120;
    shake(14); spawnBoom(this.x, this.y, '#ff2244', true);
    updateHUD();
    if (this.hp <= 0) onGameOver();
  },

  update() {
    this.x += (this.tx - this.x) * 0.2;
    this.x = clamp(this.x, 22, W - 22);
    if (this.invincible && --this.invTimer <= 0) this.invincible = false;
    if (this.shield    && --this.shieldTimer <= 0) this.shield = false;

    this.trail.unshift({ x: this.x, y: this.y + 22 });
    if (this.trail.length > 12) this.trail.pop();

    if (gameState === 'playing' && --this.fireCooldown <= 0) {
      this.shoot();
      this.fireCooldown = this.fireRate;
    }
  },

  shoot() {
    const cx = this.x, cy = this.y - 22;
    const B  = (x, y, vx, vy) => playerBullets.push(new PBullet(x, y, vx, vy));
    switch (this.weaponLv) {
      case 1: B(cx, cy, 0, -13); break;
      case 2: B(cx - 11, cy, 0, -13); B(cx + 11, cy, 0, -13); break;
      case 3: B(cx, cy, 0, -13); B(cx - 13, cy, -1.5, -12.5); B(cx + 13, cy, 1.5, -12.5); break;
      case 4:
        B(cx, cy, 0, -14);
        B(cx - 14, cy, -0.5, -13.5); B(cx + 14, cy, 0.5, -13.5);
        B(cx - 24, cy + 6, -2, -11); B(cx + 24, cy + 6, 2, -11);
        break;
    }
  },

  draw() {
    if (this.invincible && Math.floor(this.invTimer / 6) % 2 === 0) return;

    // Engine exhaust trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i], a = (1 - i / this.trail.length) * 0.65;
      ctx.globalAlpha = a;
      ctx.shadowBlur  = 12;
      ctx.shadowColor = i < 4 ? '#ff9900' : '#ff4400';
      ctx.fillStyle   = i < 4 ? '#ffcc00' : '#ff5500';
      ctx.beginPath();
      ctx.arc(t.x, t.y, (1 - i / this.trail.length) * 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const x = this.x, y = this.y;

    // Shield ring
    if (this.shield) {
      const pulse = 0.45 + 0.3 * Math.sin(Date.now() * 0.01);
      ctx.shadowBlur  = 22; ctx.shadowColor = '#00f5ff';
      ctx.strokeStyle = `rgba(0,245,255,${pulse})`;
      ctx.lineWidth   = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.shadowBlur  = 24; ctx.shadowColor = '#00f5ff';

    // Wings
    ctx.fillStyle = '#003d7a';
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x - 24, y + 16);
    ctx.lineTo(x - 9,  y + 9);
    ctx.lineTo(x,      y);
    ctx.closePath(); ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x + 24, y + 16);
    ctx.lineTo(x + 9,  y + 9);
    ctx.lineTo(x,      y);
    ctx.closePath(); ctx.fill();

    // Hull
    const g = ctx.createLinearGradient(x, y - 24, x, y + 18);
    g.addColorStop(0, '#00f5ff');
    g.addColorStop(0.55, '#0088cc');
    g.addColorStop(1, '#003366');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x,     y - 24);
    ctx.lineTo(x - 11, y + 16);
    ctx.lineTo(x,      y + 9);
    ctx.lineTo(x + 11, y + 16);
    ctx.closePath(); ctx.fill();

    // Cockpit
    ctx.fillStyle = 'rgba(200,245,255,0.82)';
    ctx.beginPath(); ctx.ellipse(x, y - 9, 5, 10, 0, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur = 0;
  }
};

// ══════════════════════════════════════════════════════
//  BULLETS
// ══════════════════════════════════════════════════════
const playerBullets = [];
const enemyBullets  = [];

class PBullet {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.alive = true;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.y < -20 || this.x < -10 || this.x > W + 10) this.alive = false;
  }
  draw() {
    ctx.shadowBlur  = 14; ctx.shadowColor = '#00f5ff';
    const g = ctx.createLinearGradient(this.x, this.y - 7, this.x, this.y + 7);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#00f5ff');
    g.addColorStop(1, '#004488');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(this.x - 2, this.y - 8, 4, 16, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class EBullet {
  constructor(x, y, vx, vy, color = '#ff5500') {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.r = 5; this.color = color; this.alive = true;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.y > H + 20 || this.y < -20 || this.x < -20 || this.x > W + 20) this.alive = false;
  }
  draw() {
    ctx.shadowBlur  = 10; ctx.shadowColor = this.color;
    ctx.fillStyle   = this.color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ══════════════════════════════════════════════════════
//  ENEMIES
// ══════════════════════════════════════════════════════
const enemies = [];

class Drone {
  constructor(x, y, phase = 0) {
    this.x = x; this.y = y; this.phase = phase;
    this.hp = 1; this.maxHp = 1;
    this.r = 12; this.color = '#ff2244';
    this.points = 100; this.alive = true;
    this.angle = 0; this.vy = 1.9;
    this.entered = false; this.enterY = 75;
    this.canShoot = false;
  }
  update(frame) {
    this.angle += 0.06;
    if (!this.entered) {
      this.y += this.vy * 1.8;
      if (this.y >= this.enterY) this.entered = true;
    } else {
      this.x += Math.sin(frame * 0.032 + this.phase) * 2.0;
      this.y += 0.45;
      this.x = clamp(this.x, this.r + 5, W - this.r - 5);
    }
    if (this.y > H + 30) this.alive = false;
  }
  hit(dmg = 1) {
    this.hp -= dmg;
    spawnParticles(this.x, this.y, this.color, 5);
    if (this.hp <= 0) this.die();
  }
  die() {
    this.alive = false;
    spawnBoom(this.x, this.y, this.color);
    score += this.points * scoreMulti();
    spawnFloat(this.x, this.y, '+' + this.points * scoreMulti(), this.color);
    maybeDrop(this.x, this.y);
    updateHUD();
  }
  draw() {
    ctx.shadowBlur = 15; ctx.shadowColor = this.color;
    ctx.fillStyle  = this.color;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(0, -this.r);
    ctx.lineTo(this.r * 0.55, 0);
    ctx.lineTo(0, this.r);
    ctx.lineTo(-this.r * 0.55, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.shadowBlur = 0;
  }
}

class Fighter extends Drone {
  constructor(x, y, phase = 0) {
    super(x, y, phase);
    this.hp = 2; this.maxHp = 2;
    this.r = 17; this.color = '#ff6600';
    this.points = 250; this.vy = 1.2;
    this.canShoot = true;
    this.shootCD = 70 + Math.random() * 80;
    this.enterY = 90;
  }
  update(frame) {
    this.angle -= 0.025;
    if (!this.entered) {
      this.y += this.vy * 2;
      if (this.y >= this.enterY) this.entered = true;
    } else {
      this.x += Math.sin(frame * 0.028 + this.phase) * 2.3;
      this.y += 0.5;
      this.x = clamp(this.x, this.r + 5, W - this.r - 5);
      if (--this.shootCD <= 0) {
        this.shootCD = 90 + Math.random() * 70;
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        enemyBullets.push(new EBullet(this.x, this.y, Math.cos(angle) * 3.8, Math.sin(angle) * 3.8, '#ff8800'));
      }
    }
    if (this.y > H + 30) this.alive = false;
  }
  draw() {
    ctx.shadowBlur = 15; ctx.shadowColor = this.color;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle + Math.PI);
    const g = ctx.createLinearGradient(0, -this.r, 0, this.r);
    g.addColorStop(0, '#ffaa44'); g.addColorStop(1, '#cc3300');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -this.r);
    ctx.lineTo(-this.r * 0.75, this.r * 0.55);
    ctx.lineTo(0, this.r * 0.2);
    ctx.lineTo(this.r * 0.75, this.r * 0.55);
    ctx.closePath(); ctx.fill();
    // Side winglets
    ctx.fillStyle = '#aa2200';
    ctx.beginPath();
    ctx.moveTo(-this.r * 0.7, 0); ctx.lineTo(-this.r * 1.45, this.r * 0.85); ctx.lineTo(-this.r * 0.6, this.r * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(this.r * 0.7, 0); ctx.lineTo(this.r * 1.45, this.r * 0.85); ctx.lineTo(this.r * 0.6, this.r * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.shadowBlur = 0;
  }
}

class Heavy extends Drone {
  constructor(x, y, phase = 0) {
    super(x, y, phase);
    this.hp = 4; this.maxHp = 4;
    this.r = 23; this.color = '#aa00ff';
    this.points = 500; this.vy = 0.8;
    this.canShoot = true;
    this.shootCD = 50 + Math.random() * 50;
    this.enterY = 110;
  }
  update(frame) {
    this.angle += 0.018;
    if (!this.entered) {
      this.y += this.vy * 2;
      if (this.y >= this.enterY) this.entered = true;
    } else {
      this.x += Math.sin(frame * 0.018 + this.phase) * 1.1;
      this.y += 0.32;
      this.x = clamp(this.x, this.r + 5, W - this.r - 5);
      if (--this.shootCD <= 0) {
        this.shootCD = 55 + Math.random() * 45;
        for (let i = -1; i <= 1; i++) {
          const a = Math.PI / 2 + i * 0.38;
          enemyBullets.push(new EBullet(this.x, this.y + this.r, Math.cos(a) * 3.2, Math.sin(a) * 3.2, '#cc44ff'));
        }
      }
    }
    if (this.y > H + 40) this.alive = false;
  }
  draw() {
    ctx.shadowBlur = 18; ctx.shadowColor = this.color;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r);
    g.addColorStop(0, '#dd88ff'); g.addColorStop(0.6, '#880acc'); g.addColorStop(1, '#330077');
    ctx.fillStyle = g;
    ctx.strokeStyle = this.color; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      i === 0 ? ctx.moveTo(Math.cos(a) * this.r, Math.sin(a) * this.r)
              : ctx.lineTo(Math.cos(a) * this.r, Math.sin(a) * this.r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // HP arc segments
    for (let i = 0; i < this.maxHp; i++) {
      ctx.strokeStyle = i < this.hp ? this.color : 'rgba(100,0,150,0.3)';
      ctx.lineWidth = 2; ctx.beginPath();
      const a1 = (Math.PI * 2 / this.maxHp) * i;
      const a2 = a1 + (Math.PI * 2 / this.maxHp) * 0.78;
      ctx.arc(0, 0, this.r + 5, a1, a2); ctx.stroke();
    }
    ctx.restore(); ctx.shadowBlur = 0;
  }
}

// ══════════════════════════════════════════════════════
//  BOSS
// ══════════════════════════════════════════════════════
let boss = null;

class Boss {
  constructor(waveNum) {
    this.x = W / 2; this.y = -90;
    this.w = 130; this.h = 90;
    this.maxHp = 450 + waveNum * 120;
    this.hp = this.maxHp;
    this.alive = true; this.entered = false;
    this.phase = 1; this.angle = 0;
    this.patternT = 0; this.shootT = 0;
    this.color = '#ff00aa'; this.points = 2500 + waveNum * 400;
  }
  update(frame) {
    this.angle += 0.02;
    if (!this.entered) {
      this.y += 1.6;
      if (this.y >= 95) this.entered = true;
      return;
    }
    if (this.hp < this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2;
      spawnFloat(W / 2, this.y + 55, '¡FASE 2!', '#ff0000');
      shake(16);
    }
    this.patternT++;
    const period = this.phase === 2 ? 140 : 210;
    this.x = lerp(85, W - 85, (Math.sin((this.patternT / period) * Math.PI * 2) + 1) / 2);

    if (++this.shootT >= (this.phase === 2 ? 22 : 38)) {
      this.shootT = 0;
      const cy = this.y + this.h / 2;
      const aimed = Math.atan2(player.y - cy, player.x - this.x);
      const spread = this.phase === 2 ? 3 : 2;
      for (let i = -(spread - 1) / 2; i <= (spread - 1) / 2; i++) {
        const a = aimed + i * 0.22;
        enemyBullets.push(new EBullet(this.x, cy, Math.cos(a) * 4.2, Math.sin(a) * 4.2, '#ff00aa'));
      }
      if (this.phase === 2) {
        const sa = (frame * 0.09) % (Math.PI * 2);
        for (let i = 0; i < 4; i++) {
          const a = sa + (Math.PI / 2) * i;
          enemyBullets.push(new EBullet(this.x, cy, Math.cos(a) * 3, Math.sin(a) * 3, '#ff55bb'));
        }
      }
    }
  }
  hit(dmg = 1) {
    this.hp = Math.max(0, this.hp - dmg);
    spawnParticles(this.x + rand(-45, 45), this.y + rand(-20, 20), this.color, 7);
    const pct = this.hp / this.maxHp;
    const fill = document.getElementById('boss-fill');
    fill.style.width = (pct * 100) + '%';
    fill.style.background = pct > 0.5 ? '#ff00aa' : pct > 0.25 ? '#ff6600' : '#ff2244';
    if (this.hp <= 0) this.die();
  }
  die() {
    this.alive = false;
    score += this.points * scoreMulti();
    spawnFloat(this.x, this.y, '+' + this.points * scoreMulti(), '#ffee00');
    updateHUD(); shake(22);
    document.getElementById('boss-bar-wrap').style.display = 'none';
    for (let i = 0; i < 6; i++) {
      setTimeout(() => spawnBoom(
        this.x + rand(-55, 55), this.y + rand(-35, 35),
        ['#ff00aa', '#ff6600', '#ffee00'][i % 3], true
      ), i * 160);
    }
    setTimeout(onWaveClear, 1400);
  }
  draw() {
    ctx.shadowBlur = 28; ctx.shadowColor = this.color;
    const x = this.x, y = this.y + this.h / 2;
    ctx.save(); ctx.translate(x, y);

    // Main body
    const g = ctx.createLinearGradient(0, -this.h / 2, 0, this.h / 2);
    g.addColorStop(0, '#bb0077'); g.addColorStop(0.5, '#ff00aa'); g.addColorStop(1, '#770044');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -this.h / 2);
    ctx.lineTo(this.w / 2, -this.h / 4);
    ctx.lineTo(this.w / 2 + 22, 0);
    ctx.lineTo(this.w / 2, this.h / 4);
    ctx.lineTo(this.w / 4, this.h / 2);
    ctx.lineTo(0, this.h / 3);
    ctx.lineTo(-this.w / 4, this.h / 2);
    ctx.lineTo(-this.w / 2, this.h / 4);
    ctx.lineTo(-this.w / 2 - 22, 0);
    ctx.lineTo(-this.w / 2, -this.h / 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.stroke();

    // Cockpit
    const cpColor = this.phase === 2 ? '#ff6666' : '#ff99dd';
    ctx.fillStyle = cpColor; ctx.shadowColor = cpColor; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.ellipse(0, -this.h / 6, 20, 13, 0, 0, Math.PI * 2); ctx.fill();

    // Cannons
    ctx.fillStyle = '#550033'; ctx.shadowColor = '#ff00aa'; ctx.shadowBlur = 10;
    [-this.w / 3.5, 0, this.w / 3.5].forEach(cx => {
      ctx.beginPath(); ctx.roundRect(cx - 5, this.h / 4, 10, 18, 3); ctx.fill();
    });

    // Engine ports (top)
    const ePulse = 4 + 3 * Math.sin(Date.now() * 0.012);
    ctx.fillStyle = this.phase === 2 ? '#ff4400' : '#ff00aa';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 28;
    [-32, 0, 32].forEach(ex => {
      ctx.beginPath(); ctx.arc(ex, -this.h / 2 + 2, ePulse, 0, Math.PI * 2); ctx.fill();
    });

    ctx.restore(); ctx.shadowBlur = 0;
  }
}

// ══════════════════════════════════════════════════════
//  POWER-UPS
// ══════════════════════════════════════════════════════
const PWUP_TYPES = [
  { id: 'rapid',  label: 'RAPID ⚡',  color: '#ffee00', w: 1.8 },
  { id: 'spread', label: 'SPREAD 💥', color: '#ff6600', w: 1.6 },
  { id: 'shield', label: 'ESCUDO 🛡', color: '#00f5ff', w: 1.2 },
  { id: 'life',   label: 'VIDA ❤',   color: '#ff2244', w: 0.7 },
  { id: 'bomb',   label: 'BOMBA 💣',  color: '#aa00ff', w: 0.9 },
];

const fallingPwups = [];
const pwupTimers   = {};

function maybeDrop(x, y, forced = false) {
  if (!forced && Math.random() > 0.14) return;
  const total = PWUP_TYPES.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of PWUP_TYPES) { r -= p.w; if (r <= 0) { fallingPwups.push({ x: x - 22, y, vy: 2, pw: p, tick: 0 }); return; } }
}

function applyPowerUp(pw) {
  clearTimeout(pwupTimers[pw.id]);
  switch (pw.id) {
    case 'rapid':
      player.fireRate = 7;
      pwupTimers.rapid = setTimeout(() => { player.fireRate = 18; }, 8000);
      break;
    case 'spread':
      player.weaponLv = Math.min(player.weaponLv + 1, 4);
      pwupTimers.spread = setTimeout(() => { if (player.weaponLv > 1) player.weaponLv--; }, 12000);
      break;
    case 'shield':
      player.shield = true; player.shieldTimer = 700;
      break;
    case 'life':
      player.hp = Math.min(player.hp + 1, player.maxHp); updateHUD();
      break;
    case 'bomb':
      shake(18); enemyBullets.length = 0;
      enemies.forEach(e => { if (e.alive) { spawnBoom(e.x, e.y, e.color, true); e.alive = false; } });
      break;
  }
  spawnFloat(player.x, player.y - 42, pw.label, pw.color);
  flashPwup(pw.label, pw.color);
}

function flashPwup(text, color) {
  const el = document.getElementById('powerup-label');
  el.textContent = text; el.style.color = color; el.style.opacity = 1;
  clearTimeout(flashPwup._t);
  flashPwup._t = setTimeout(() => { el.style.opacity = 0; }, 2200);
}

function updateFallingPwups() {
  for (let i = fallingPwups.length - 1; i >= 0; i--) {
    const fp = fallingPwups[i];
    fp.y += fp.vy; fp.tick++;
    const hit = fp.x < player.x + 22 && fp.x + 44 > player.x - 22 &&
                fp.y < player.y + 26 && fp.y + 20 > player.y - 26;
    if (hit) { applyPowerUp(fp.pw); spawnParticles(fp.x + 22, fp.y, fp.pw.color, 10); fallingPwups.splice(i, 1); }
    else if (fp.y > H + 30) fallingPwups.splice(i, 1);
  }
}

function drawFallingPwups() {
  for (const fp of fallingPwups) {
    const blink = 0.65 + 0.35 * Math.sin(fp.tick * 0.18);
    ctx.globalAlpha = blink;
    ctx.shadowBlur  = 14; ctx.shadowColor = fp.pw.color;
    ctx.fillStyle   = fp.pw.color + '33'; ctx.strokeStyle = fp.pw.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(fp.x, fp.y, 44, 20, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Orbitron, monospace'; ctx.textAlign = 'center';
    ctx.shadowBlur = 0; ctx.fillText(fp.pw.label, fp.x + 22, fp.y + 13);
    ctx.globalAlpha = 1;
  }
}

// ══════════════════════════════════════════════════════
//  WAVE / SPAWN SYSTEM
// ══════════════════════════════════════════════════════
let spawnQueue   = [];  // { enemy: EnemyInstance, atFrame: number }
let waveActive   = false;
let frameCount   = 0;
let waveCheckAt  = 0;

function queueEnemy(enemy, atFrame) {
  spawnQueue.push({ enemy, atFrame });
}

function queueLine(Type, count, delayPer = 28) {
  const gap = W / (count + 1);
  for (let i = 0; i < count; i++) {
    const e = new Type(gap * (i + 1), -40 - i * 14, i * 0.7);
    queueEnemy(e, frameCount + i * delayPer);
  }
}

function queueV(Type, count, delayPer = 24) {
  const half = Math.ceil(count / 2);
  for (let i = 0; i < count; i++) {
    const side = i < half ? -1 : 1;
    const idx  = i < half ? i : i - half;
    const x = W / 2 + side * (idx + 1) * (W / (half * 2.8));
    const y = -40 - idx * 28;
    const e = new Type(x, y, i * 0.6);
    queueEnemy(e, frameCount + i * delayPer);
  }
}

function queueScatter(Type, count, delayPer = 35) {
  for (let i = 0; i < count; i++) {
    const e = new Type(rand(60, W - 60), -40 - rand(0, 70), i * 0.5);
    queueEnemy(e, frameCount + i * delayPer);
  }
}

const WAVE_DEFS = [
  w => { queueLine(Drone, 8); },
  w => { queueV(Drone, 12); },
  w => { queueLine(Fighter, 5); queueScatter(Drone, 6, 30); },
  w => { queueLine(Heavy, 3, 50); queueScatter(Drone, 8, 28); },
  w => { boss = new Boss(w); document.getElementById('boss-bar-wrap').style.display = 'flex'; document.getElementById('boss-fill').style.width = '100%'; shake(10); },
  w => { queueV(Fighter, 6); queueScatter(Drone, 8, 28); },
  w => { queueLine(Heavy, 4, 45); queueScatter(Fighter, 4, 32); },
  w => { queueV(Drone, 8); queueScatter(Fighter, 4, 30); queueLine(Heavy, 2, 55); },
  w => { queueScatter(Fighter, 6, 28); queueScatter(Heavy, 3, 40); queueScatter(Drone, 8, 22); },
  w => { boss = new Boss(w); document.getElementById('boss-bar-wrap').style.display = 'flex'; document.getElementById('boss-fill').style.width = '100%'; shake(12); },
];

function startWave() {
  spawnQueue = []; waveActive = true;
  enemies.length = 0; enemyBullets.length = 0; boss = null;
  const def = WAVE_DEFS[(wave - 1) % WAVE_DEFS.length];
  def(wave);
  waveCheckAt = frameCount + Math.max(...spawnQueue.map(s => s.atFrame), frameCount) - frameCount + 180;
}

function processSpawnQueue() {
  for (let i = spawnQueue.length - 1; i >= 0; i--) {
    if (frameCount >= spawnQueue[i].atFrame) {
      enemies.push(spawnQueue[i].enemy);
      spawnQueue.splice(i, 1);
    }
  }
}

function checkWaveComplete() {
  if (!waveActive || boss) return;
  if (spawnQueue.length > 0) return;
  if (frameCount < waveCheckAt) return;
  if (enemies.some(e => e.alive)) return;
  waveActive = false;
  setTimeout(onWaveClear, 600);
}

// ══════════════════════════════════════════════════════
//  COLLISION DETECTION
// ══════════════════════════════════════════════════════
function checkCollisions() {
  // Player bullets vs enemies
  for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
    const b = playerBullets[bi];
    for (const e of enemies) {
      if (!e.alive) continue;
      if (dist(b.x, b.y, e.x, e.y) < e.r + 5) { e.hit(1); b.alive = false; break; }
    }
    if (b.alive && boss && boss.entered && boss.alive) {
      const bx = boss.x, by = boss.y + boss.h / 2;
      if (b.x > bx - boss.w / 2 - 12 && b.x < bx + boss.w / 2 + 12 &&
          b.y > by - boss.h / 2 - 10 && b.y < by + boss.h / 2 + 10) {
        boss.hit(1); b.alive = false;
      }
    }
  }

  // Enemy bullets vs player
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    if (dist(b.x, b.y, player.x, player.y) < 19) { player.hit(); b.alive = false; }
  }

  // Enemies touching player
  for (const e of enemies) {
    if (!e.alive) continue;
    if (dist(e.x, e.y, player.x, player.y) < e.r + 17) { player.hit(); }
  }

  // Cull dead
  for (let i = playerBullets.length - 1; i >= 0; i--) { if (!playerBullets[i].alive) playerBullets.splice(i, 1); }
  for (let i = enemyBullets.length - 1; i >= 0; i--)  { if (!enemyBullets[i].alive)  enemyBullets.splice(i, 1); }
  for (let i = enemies.length - 1; i >= 0; i--)        { if (!enemies[i].alive)        enemies.splice(i, 1); }
}

// ══════════════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════════════
let gameState = 'menu';
let score     = 0;
let highScore = +(localStorage.getItem('novaBlitz_hs') || 0);
let wave      = 1;

const scoreMulti = () => 1 + Math.floor((wave - 1) / 5);

function startGame() {
  score = 0; wave = 1;
  particles.length = 0; floaters.length = 0;
  playerBullets.length = 0; enemyBullets.length = 0;
  enemies.length = 0; fallingPwups.length = 0;
  boss = null; frameCount = 0;
  player.reset();
  document.getElementById('boss-bar-wrap').style.display = 'none';
  updateHUD(); showOverlay(null);
  gameState = 'playing';
  announceWave();
  startWave();
}

function onWaveClear() {
  if (score > highScore) { highScore = score; localStorage.setItem('novaBlitz_hs', highScore); }
  document.getElementById('wave-score-display').textContent = score.toString().padStart(6, '0');
  document.getElementById('next-wave-num').textContent = wave + 1;
  showOverlay('wave-clear-screen');
  gameState = 'paused';
  maybeDrop(W / 2, H / 3, true);
}

function nextWave() {
  wave++; fallingPwups.length = 0;
  showOverlay(null); gameState = 'playing';
  announceWave();
  startWave(); updateHUD();
}

function onGameOver() {
  gameState = 'paused';
  if (score > highScore) {
    highScore = score; localStorage.setItem('novaBlitz_hs', highScore);
    document.getElementById('new-record-msg').style.display = 'block';
  } else {
    document.getElementById('new-record-msg').style.display = 'none';
  }
  document.getElementById('final-score-display').textContent = score.toString().padStart(6, '0');
  document.getElementById('final-wave').textContent = wave;
  document.getElementById('boss-bar-wrap').style.display = 'none';
  showOverlay('game-over-screen');
}

function togglePause() {
  if (gameState === 'playing') { gameState = 'paused'; showOverlay('pause-screen'); }
  else if (gameState === 'paused') { gameState = 'playing'; showOverlay(null); }
}

function announceWave() {
  const el = document.getElementById('wave-announce');
  el.textContent = wave === 5 || wave === 10 ? `⚠ JEFE - OLA ${wave}` : `OLA ${wave}`;
  el.style.color = wave % 5 === 0 ? '#ff00aa' : '#aa00ff';
  el.style.textShadow = `0 0 25px ${wave % 5 === 0 ? '#ff00aa' : '#aa00ff'}`;
  el.style.opacity = 1;
  clearTimeout(announceWave._t);
  announceWave._t = setTimeout(() => { el.style.opacity = 0; }, 2000);
}

function updateHUD() {
  document.getElementById('score-display').textContent = score.toString().padStart(6, '0');
  document.getElementById('hs-display').textContent    = Math.max(score, highScore).toString().padStart(6, '0');
  document.getElementById('wave-display').textContent  = wave;
  document.getElementById('lives-display').textContent = '♥'.repeat(Math.max(0, player.hp));
}

function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
  if (id) document.getElementById(id).classList.add('active');
}

// ══════════════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════════════
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  player.tx = (e.clientX - rect.left) * (W / rect.width);
});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  player.tx = (e.touches[0].clientX - rect.left) * (W / rect.width);
}, { passive: false });

document.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
});

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-next-wave').addEventListener('click', nextWave);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', togglePause);

// ══════════════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════════════
function gameLoop() {
  let sx = 0, sy = 0;
  if (shakeAmt > 0.4) {
    sx = (Math.random() - 0.5) * shakeAmt * 2.2;
    sy = (Math.random() - 0.5) * shakeAmt * 2.2;
    shakeAmt *= 0.83;
    ctx.save(); ctx.translate(sx, sy);
  }

  // Background
  ctx.fillStyle = '#030308';
  ctx.fillRect(-15, -15, W + 30, H + 30);
  if (gameState === 'playing') updateStars();
  drawStars();

  if (gameState === 'playing') {
    frameCount++;
    processSpawnQueue();

    player.update();
    enemies.forEach(e => e.update(frameCount));
    if (boss && boss.alive) boss.update(frameCount);
    playerBullets.forEach(b => b.update());
    enemyBullets.forEach(b => b.update());
    updateFallingPwups();
    updateParticles();
    updateFloaters();
    checkCollisions();
    checkWaveComplete();
  }

  // Draw
  playerBullets.forEach(b => b.draw());
  enemyBullets.forEach(b => b.draw());
  enemies.forEach(e => e.draw());
  if (boss && boss.alive) boss.draw();
  player.draw();
  drawFallingPwups();
  drawParticles();
  drawFloaters();

  // Wave multiplier badge
  if (gameState === 'playing' && scoreMulti() > 1) {
    const m = scoreMulti();
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffee00';
    ctx.fillStyle = '#ffee00'; ctx.font = 'bold 11px Orbitron, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`×${m} MULTIPLICADOR`, W - 8, H - 8);
    ctx.shadowBlur = 0;
  }

  if (shakeAmt > 0.4) ctx.restore();
  requestAnimationFrame(gameLoop);
}

// ── Init ──────────────────────────────────────────────────────────────────────
updateHUD();
showOverlay('menu-screen');
gameLoop();
