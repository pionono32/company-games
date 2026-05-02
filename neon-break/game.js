// ══════════════════════════════════════════════════════
//  NEON BREAK  –  Complete Game Engine
// ══════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

const W = 800, H = 580;
canvas.width  = W;
canvas.height = H;

// ── Brick grid constants ────────────────────────────────────────────────────
const COLS         = 12;
const BRICK_W      = 54;
const BRICK_H      = 20;
const BRICK_GAP    = 5;
const GRID_W       = COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP;
const OFFSET_X     = (W - GRID_W) / 2;
const OFFSET_Y     = 60;

// ── Neon palette ────────────────────────────────────────────────────────────
const PALETTE = ['#ff00aa','#00f5ff','#ffee00','#00ff88','#aa00ff','#ff6600','#ff2244'];

// ── Level layouts  (0=air 1=normal 2=hard 3=explosive 4=wall) ──────────────
const LEVELS = [
  // 1 – Tutorial
  [
    [0,0,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,2,1,1,1,1,1,1,2,1,1],
    [1,1,1,1,2,1,1,2,1,1,1,1],
    [0,1,1,1,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,1,1,1,0,0],
  ],
  // 2 – Checkers
  [
    [4,1,1,1,1,1,1,1,1,1,1,4],
    [1,2,1,2,1,2,1,2,1,2,1,2],
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [3,1,3,1,3,1,3,1,3,1,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [4,1,1,2,1,1,1,1,2,1,1,4],
    [0,0,1,1,1,1,1,1,1,1,0,0],
  ],
  // 3 – Diamond
  [
    [0,0,0,0,0,1,1,0,0,0,0,0],
    [0,0,0,1,1,2,2,1,1,0,0,0],
    [0,0,1,2,2,3,3,2,2,1,0,0],
    [0,1,2,3,3,4,4,3,3,2,1,0],
    [0,0,1,2,2,3,3,2,2,1,0,0],
    [0,0,0,1,1,2,2,1,1,0,0,0],
    [0,0,0,0,0,1,1,0,0,0,0,0],
  ],
  // 4 – Fortress
  [
    [2,2,2,2,2,2,2,2,2,2,2,2],
    [2,0,3,0,3,0,0,3,0,3,0,2],
    [2,1,1,1,1,1,1,1,1,1,1,2],
    [4,1,4,1,4,1,1,4,1,4,1,4],
    [2,1,1,1,1,1,1,1,1,1,1,2],
    [2,0,3,0,3,0,0,3,0,3,0,2],
    [2,2,2,2,2,2,2,2,2,2,2,2],
  ],
  // 5 – The Gauntlet
  [
    [4,3,2,1,3,2,1,3,2,1,3,4],
    [3,2,1,2,1,3,3,1,2,1,2,3],
    [2,1,3,1,2,4,4,2,1,3,1,2],
    [1,3,1,2,4,2,2,4,2,1,3,1],
    [2,1,3,1,2,4,4,2,1,3,1,2],
    [3,2,1,2,1,3,3,1,2,1,2,3],
    [4,3,2,1,3,2,1,3,2,1,3,4],
  ],
];

// ══════════════════════════════════════════════════════
//  PARTICLE SYSTEM
// ══════════════════════════════════════════════════════
const particles = [];

function spawnParticles(x, y, color, count = 16) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const speed = 1.5 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 1,
      decay: 0.018 + Math.random() * 0.025,
      r: 2.5 + Math.random() * 3.5,
      color,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.12;
    p.vx *= 0.98;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life * p.life;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = p.color;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ── Floating score text ──────────────────────────────────────────────────────
const floaters = [];

function spawnFloater(x, y, text, color) {
  floaters.push({ x, y, text, color, life: 1, vy: -1.2 });
}

function updateFloaters() {
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].y    += floaters[i].vy;
    floaters[i].life -= 0.022;
    if (floaters[i].life <= 0) floaters.splice(i, 1);
  }
}

function drawFloaters() {
  floaters.forEach(f => {
    ctx.globalAlpha = f.life;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = f.color;
    ctx.fillStyle   = f.color;
    ctx.font        = 'bold 13px Orbitron, monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(f.text, f.x, f.y);
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ══════════════════════════════════════════════════════
//  POWER-UP SYSTEM
// ══════════════════════════════════════════════════════
const PWUPS = [
  { id:'wide',      label:'PADDLE+',  color:'#00f5ff', chance: 0.22 },
  { id:'multiball', label:'×3 BOLAS', color:'#ff00aa', chance: 0.18 },
  { id:'fireball',  label:'FUEGO🔥',  color:'#ff6600', chance: 0.20 },
  { id:'life',      label:'♥ VIDA',   color:'#ff2244', chance: 0.15 },
  { id:'slow',      label:'LENTO⏱',  color:'#ffee00', chance: 0.25 },
];

const fallingPwups = [];
const activeTimers  = {};

function maybeDrop(x, y) {
  let roll = Math.random();
  if (roll > 0.30) return;       // 30% overall drop chance
  let acc = 0;
  for (const p of PWUPS) {
    acc += p.chance;
    if (roll < acc * 0.30) {
      fallingPwups.push({ x: x - 22, y, vy: 1.8, pw: p, tick: 0 });
      return;
    }
  }
}

function applyPowerUp(pw) {
  clearTimeout(activeTimers[pw.id]);
  switch (pw.id) {
    case 'wide':
      paddle.width = 190;
      activeTimers.wide = setTimeout(() => { paddle.width = 120; }, 10000);
      break;
    case 'multiball':
      const extra = balls.map(b => new Ball(b.x, b.y, -b.vx * 0.9, b.vy));
      balls.push(...extra.slice(0, 2));
      break;
    case 'fireball':
      balls.forEach(b => { b.fire = true; b.fireTimer = 280; });
      break;
    case 'life':
      lives = Math.min(lives + 1, 5);
      updateHUD();
      break;
    case 'slow':
      balls.forEach(b => { b.vx *= 0.55; b.vy *= 0.55; normalizeSpeed(b, 3); });
      activeTimers.slow = setTimeout(() => balls.forEach(b => normalizeSpeed(b, 5 + level * 0.4)), 8000);
      break;
  }
  flashPwupLabel(pw);
}

function normalizeSpeed(ball, target) {
  const s = Math.hypot(ball.vx, ball.vy);
  if (s === 0) return;
  ball.vx = (ball.vx / s) * target;
  ball.vy = (ball.vy / s) * target;
}

function flashPwupLabel(pw) {
  const el = document.getElementById('powerup-label');
  el.textContent = pw.label;
  el.style.color  = pw.color;
  el.style.opacity = 1;
  clearTimeout(flashPwupLabel._t);
  flashPwupLabel._t = setTimeout(() => { el.style.opacity = 0; }, 2200);
}

function updateFallingPwups() {
  for (let i = fallingPwups.length - 1; i >= 0; i--) {
    const fp = fallingPwups[i];
    fp.y   += fp.vy;
    fp.tick++;
    const hit =
      fp.x < paddle.x + paddle.width  &&
      fp.x + 44 > paddle.x &&
      fp.y < paddle.y + paddle.height  &&
      fp.y + 20 > paddle.y;
    if (hit) {
      applyPowerUp(fp.pw);
      spawnParticles(fp.x + 22, fp.y, fp.pw.color, 14);
      fallingPwups.splice(i, 1);
    } else if (fp.y > H + 30) {
      fallingPwups.splice(i, 1);
    }
  }
}

function drawFallingPwups() {
  fallingPwups.forEach(fp => {
    const blink = 0.65 + 0.35 * Math.sin(fp.tick * 0.18);
    ctx.globalAlpha = blink;
    ctx.shadowBlur  = 14;
    ctx.shadowColor = fp.pw.color;
    ctx.fillStyle   = fp.pw.color + '33';
    ctx.strokeStyle = fp.pw.color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(fp.x, fp.y, 44, 20, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle   = '#fff';
    ctx.font        = 'bold 8px Orbitron, monospace';
    ctx.textAlign   = 'center';
    ctx.shadowBlur  = 0;
    ctx.fillText(fp.pw.label, fp.x + 22, fp.y + 13);
    ctx.globalAlpha = 1;
  });
}

// ══════════════════════════════════════════════════════
//  BALL CLASS
// ══════════════════════════════════════════════════════
class Ball {
  constructor(x, y, vx, vy) {
    this.x  = x; this.y  = y;
    this.vx = vx; this.vy = vy;
    this.r  = 8;
    this.trail = [];
    this.fire  = false;
    this.fireTimer = 0;
  }

  update() {
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 11) this.trail.pop();

    this.x += this.vx;
    this.y += this.vy;

    if (this.fire && --this.fireTimer <= 0) this.fire = false;

    if (this.x - this.r <= 0)  { this.x = this.r;     this.vx =  Math.abs(this.vx); }
    if (this.x + this.r >= W)  { this.x = W - this.r; this.vx = -Math.abs(this.vx); }
    if (this.y - this.r <= 0)  { this.y = this.r;     this.vy =  Math.abs(this.vy); }

    return this.y - this.r > H;   // true = lost
  }

  draw() {
    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const a = (i / this.trail.length) * 0.55;
      const s = this.r * (i / this.trail.length) * 0.75;
      ctx.globalAlpha = a;
      ctx.shadowBlur  = 5;
      ctx.shadowColor = this.fire ? '#ff6600' : '#00f5ff';
      ctx.fillStyle   = this.fire ? '#ff8800' : '#00cfff';
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Glow + ball
    ctx.shadowBlur  = 28;
    ctx.shadowColor = this.fire ? '#ff4500' : '#ffffff';

    if (this.fire) {
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
      g.addColorStop(0,   '#ffffff');
      g.addColorStop(0.4, '#ff8800');
      g.addColorStop(1,   '#ff2200');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = '#ffffff';
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ══════════════════════════════════════════════════════
//  PADDLE
// ══════════════════════════════════════════════════════
const paddle = {
  x: W / 2 - 60, y: H - 36,
  width: 120, height: 14,
  tx: W / 2 - 60,

  reset() {
    this.width = 120;
    this.tx = W / 2 - this.width / 2;
    this.x  = this.tx;
  },

  update() {
    this.x += (this.tx - this.x) * 0.22;
    this.x  = Math.max(0, Math.min(W - this.width, this.x));
  },

  draw() {
    ctx.shadowBlur  = 22;
    ctx.shadowColor = '#00f5ff';

    const g = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
    g.addColorStop(0,   '#0077bb');
    g.addColorStop(0.5, '#00f5ff');
    g.addColorStop(1,   '#0077bb');
    ctx.fillStyle = g;

    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 7);
    ctx.fill();

    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.roundRect(this.x + 6, this.y + 3, this.width - 12, 5, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
};

// ══════════════════════════════════════════════════════
//  BRICKS
// ══════════════════════════════════════════════════════
let bricks     = [];
let bricksLeft = 0;

function buildLevel(lvl) {
  bricks     = [];
  bricksLeft = 0;
  const layout = LEVELS[(lvl - 1) % LEVELS.length];
  layout.forEach((row, r) => {
    row.forEach((type, c) => {
      if (!type) return;
      const x = OFFSET_X + c * (BRICK_W + BRICK_GAP);
      const y = OFFSET_Y + r * (BRICK_H + BRICK_GAP);
      const color =
        type === 4 ? '#555566' :
        type === 2 ? '#ffdd00' :
        PALETTE[(r + c * 3) % PALETTE.length];
      bricks.push({ x, y, type, hp: type === 2 ? 2 : type === 4 ? Infinity : 1, color, alive: true });
      if (type !== 4) bricksLeft++;
    });
  });
}

function drawBricks() {
  bricks.forEach(b => {
    if (!b.alive) return;
    ctx.shadowBlur  = b.type === 4 ? 4 : 14;
    ctx.shadowColor = b.color;

    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BRICK_H);
    g.addColorStop(0, b.color + 'cc');
    g.addColorStop(1, b.color + '44');
    ctx.fillStyle   = g;
    ctx.strokeStyle = b.color;
    ctx.lineWidth   = 1.5;

    ctx.beginPath();
    ctx.roundRect(b.x, b.y, BRICK_W, BRICK_H, 4);
    ctx.fill();
    ctx.stroke();

    // shine strip
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(b.x + 5, b.y + 3, BRICK_W - 10, 5, 2);
    ctx.fill();

    // 2nd hp bar
    if (b.type === 2 && b.hp === 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.roundRect(b.x + 5, b.y + BRICK_H - 6, BRICK_W - 10, 3, 1);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  });
}

// ══════════════════════════════════════════════════════
//  COLLISION
// ══════════════════════════════════════════════════════
function collidePaddle(ball) {
  const { x, y, width, height } = paddle;
  if (
    ball.x + ball.r > x &&
    ball.x - ball.r < x + width &&
    ball.y + ball.r > y &&
    ball.y + ball.r < y + height + 6 &&
    ball.vy > 0
  ) {
    const rel   = (ball.x - (x + width / 2)) / (width / 2);
    const angle = rel * (Math.PI / 3);
    const spd   = Math.hypot(ball.vx, ball.vy);
    ball.vx = Math.sin(angle) * spd;
    ball.vy = -Math.cos(angle) * spd;
    ball.y  = y - ball.r;
    resetCombo();
    spawnParticles(ball.x, y, '#00f5ff', 7);
  }
}

function collideBricks(ball) {
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    if (!b.alive) continue;

    const overL = ball.x + ball.r - b.x;
    const overR = b.x + BRICK_W   - (ball.x - ball.r);
    const overT = ball.y + ball.r - b.y;
    const overB = b.y + BRICK_H   - (ball.y - ball.r);

    if (overL > 0 && overR > 0 && overT > 0 && overB > 0) {
      if (!ball.fire || b.type === 4) {
        const minH = Math.min(overL, overR);
        const minV = Math.min(overT, overB);
        if (minH < minV) ball.vx *= -1;
        else             ball.vy *= -1;
      }
      hitBrick(b, ball.x, ball.y);
      break;
    }
  }
}

function hitBrick(b, bx, by) {
  if (b.type === 4) return;
  b.hp--;
  if (b.hp <= 0) {
    b.alive = false;
    bricksLeft--;
    const pts = (b.type === 3 ? 50 : b.type === 2 ? 30 : 10) * combo;
    score += pts;
    incrementCombo();
    spawnParticles(b.x + BRICK_W / 2, b.y + BRICK_H / 2, b.color, 18);
    spawnFloater(b.x + BRICK_W / 2, b.y, '+' + pts, b.color);
    maybeDrop(b.x + BRICK_W / 2, b.y + BRICK_H / 2);

    // chain explosion
    if (b.type === 3) {
      bricks.forEach(n => {
        if (!n.alive || n === b || n.type === 4) return;
        const dx = (n.x + BRICK_W / 2) - (b.x + BRICK_W / 2);
        const dy = (n.y + BRICK_H / 2) - (b.y + BRICK_H / 2);
        if (Math.hypot(dx, dy) < 110) {
          n.alive = false;
          bricksLeft--;
          score += 5 * combo;
          spawnParticles(n.x + BRICK_W / 2, n.y + BRICK_H / 2, n.color, 10);
        }
      });
    }

    updateHUD();
    if (bricksLeft <= 0) setTimeout(onLevelClear, 600);
  } else {
    spawnParticles(b.x + BRICK_W / 2, b.y + BRICK_H / 2, b.color, 5);
  }
}

// ══════════════════════════════════════════════════════
//  COMBO SYSTEM
// ══════════════════════════════════════════════════════
let combo = 1, comboT = null;

function incrementCombo() {
  combo++;
  clearTimeout(comboT);
  comboT = setTimeout(() => { combo = 1; }, 3200);
}

function resetCombo() {
  combo = 1;
  clearTimeout(comboT);
}

// ══════════════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════════════
let state     = 'menu';
let score     = 0;
let highScore = +(localStorage.getItem('neonBreak_hs') || 0);
let lives     = 3;
let level     = 1;
let balls     = [];

function launchBall() {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
  const spd   = 4.8 + level * 0.3;
  balls = [new Ball(paddle.x + paddle.width / 2, paddle.y - 10,
    Math.cos(angle) * spd, Math.sin(angle) * spd)];
}

function startGame() {
  score = 0; lives = 3; level = 1; combo = 1;
  particles.length = 0; floaters.length = 0;
  fallingPwups.length = 0;
  paddle.reset();
  buildLevel(level);
  launchBall();
  updateHUD();
  showOverlay(null);
  state = 'playing';
}

function nextLevel() {
  level++;
  combo = 1;
  particles.length = 0; floaters.length = 0;
  fallingPwups.length = 0;
  paddle.reset();
  buildLevel(level);
  launchBall();
  updateHUD();
  showOverlay(null);
  state = 'playing';
}

function onLevelClear() {
  state = 'paused';
  if (score > highScore) { highScore = score; localStorage.setItem('neonBreak_hs', highScore); }
  if (level >= LEVELS.length) {
    document.getElementById('win-score').textContent = score.toString().padStart(6,'0');
    showOverlay('win-screen');
  } else {
    document.getElementById('level-clear-score').textContent = score.toString().padStart(6,'0');
    document.getElementById('next-level-num').textContent = level + 1;
    showOverlay('level-clear-screen');
  }
}

function onGameOver() {
  state = 'paused';
  if (score > highScore) { highScore = score; localStorage.setItem('neonBreak_hs', highScore); }
  document.getElementById('final-score').textContent = score.toString().padStart(6,'0');
  showOverlay('game-over-screen');
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; showOverlay('pause-screen'); }
  else if (state === 'paused') { state = 'playing'; showOverlay(null); }
}

// ══════════════════════════════════════════════════════
//  HUD + OVERLAY
// ══════════════════════════════════════════════════════
function updateHUD() {
  document.getElementById('score-display').textContent = score.toString().padStart(6,'0');
  document.getElementById('hs-display').textContent    = Math.max(score,highScore).toString().padStart(6,'0');
  document.getElementById('level-display').textContent = level;
  document.getElementById('lives-display').textContent = '♥'.repeat(Math.max(0, lives));
}

function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
  if (id) document.getElementById(id).classList.add('active');
}

// ══════════════════════════════════════════════════════
//  BACKGROUND
// ══════════════════════════════════════════════════════
let bgStars = Array.from({ length: 60 }, () => ({
  x: Math.random() * W, y: Math.random() * H,
  r: Math.random() * 1.2 + 0.3,
  a: Math.random(),
  speed: Math.random() * 0.3 + 0.05,
}));

function drawBackground() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = 'rgba(0,80,160,0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // stars
  bgStars.forEach(s => {
    s.a += s.speed * 0.02;
    const alpha = 0.3 + 0.5 * Math.abs(Math.sin(s.a));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#aaccff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ══════════════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════════════
canvas.addEventListener('mousemove', e => {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  paddle.tx    = (e.clientX - rect.left) * scaleX - paddle.width / 2;
});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const rect   = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  paddle.tx    = (e.touches[0].clientX - rect.left) * scaleX - paddle.width / 2;
}, { passive: false });

document.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
});

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-next-level').addEventListener('click', nextLevel);
document.getElementById('btn-restart-go').addEventListener('click', startGame);
document.getElementById('btn-restart-win').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', togglePause);

// ══════════════════════════════════════════════════════
//  GAME LOOP
// ══════════════════════════════════════════════════════
function gameLoop() {
  drawBackground();

  if (state === 'playing') {
    paddle.update();

    // Update + cull balls
    for (let i = balls.length - 1; i >= 0; i--) {
      const lost = balls[i].update();
      if (lost) {
        spawnParticles(balls[i].x, H - 10, '#ff0044', 20);
        balls.splice(i, 1);
      }
    }

    // Last ball lost = life down
    if (balls.length === 0) {
      lives--;
      updateHUD();
      if (lives <= 0) { onGameOver(); }
      else            { paddle.reset(); launchBall(); }
    }

    // Collisions
    balls.forEach(b => { collidePaddle(b); collideBricks(b); });

    // Power-ups
    updateFallingPwups();
    updateParticles();
    updateFloaters();

    // Gradually increase speed each level
    balls.forEach(b => {
      const spd = Math.hypot(b.vx, b.vy);
      const max = 5 + level * 0.45;
      if (spd < max - 0.5) {
        b.vx *= 1.0008;
        b.vy *= 1.0008;
      }
    });
  }

  // Draw everything
  drawBricks();
  drawFallingPwups();
  balls.forEach(b => b.draw());
  paddle.draw();
  drawParticles();
  drawFloaters();

  // Combo banner
  if (combo > 2 && state === 'playing') {
    const alpha = 0.6 + 0.4 * Math.sin(Date.now() * 0.008);
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 18;
    ctx.shadowColor = '#ffee00';
    ctx.fillStyle   = '#ffee00';
    ctx.font        = `bold ${15 + Math.min(combo, 10)}px Orbitron, monospace`;
    ctx.textAlign   = 'center';
    ctx.fillText(`× ${combo}  COMBO!`, W / 2, H - 12);
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  requestAnimationFrame(gameLoop);
}

// ── Kick off ─────────────────────────────────────────────────────────────────
updateHUD();
showOverlay('menu-screen');
gameLoop();
