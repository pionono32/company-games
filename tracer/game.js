'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const CELL = 16;
const COLS = 52;
const ROWS = 38;
const W = COLS * CELL;  // 832
const H = ROWS * CELL;  // 608
const WIN_PCT = 0.70;

const TILE_EMPTY    = 0;
const TILE_OWNED    = 1;
const TILE_TRAIL    = 2;

const COLORS = {
  bg:       '#060818',
  grid:     'rgba(0,200,255,0.05)',
  owned:    'rgba(0,200,255,0.22)',
  ownedBrd: 'rgba(0,200,255,0.45)',
  trail:    '#00ffc8',
  trailGlow:'rgba(0,255,200,0.5)',
  player:   '#00c8ff',
  sentinel: '#ff3355',
  sentGlow: 'rgba(255,50,80,0.6)',
  food:     '#ffe040',
  shield:   '#7b5cff',
  freeze:   '#40cfff',
  speed:    '#ffaa00',
};

// ── Canvas setup ────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width  = W;
canvas.height = H;

// ── HUD refs ────────────────────────────────────────────────────────────────
const hudScore      = document.getElementById('score-display');
const hudPct        = document.getElementById('territory-pct');
const hudBar        = document.getElementById('territory-bar');
const hudLives      = document.getElementById('lives-display');
const hudLevel      = document.getElementById('level-display');
const powerStatus   = document.getElementById('power-status');

const menuScreen    = document.getElementById('menu-screen');
const goScreen      = document.getElementById('gameover-screen');
const lcScreen      = document.getElementById('levelclear-screen');

document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);
document.getElementById('btn-next').addEventListener('click', nextLevel);

// ── State ───────────────────────────────────────────────────────────────────
let grid, player, sentinels, powerUps;
let score, lives, level, hiScore;
let ownedCount, totalCells;
let phase; // 'menu' | 'play' | 'dead' | 'levelclear' | 'gameover'
let shakeTimer = 0;
let flashTimer = 0;
let deathReason = '';

// ── Input ───────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ── Helpers ─────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function rnd(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Grid ─────────────────────────────────────────────────────────────────────
function makeGrid() {
  const g = [];
  for (let r = 0; r < ROWS; r++) {
    g.push(new Uint8Array(COLS));
  }
  return g;
}

function countOwned() {
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] === TILE_OWNED) n++;
  return n;
}

// Flood-fill from all border cells that are EMPTY, mark reachable cells.
// Then flip TRAIL cells reachable from border back to EMPTY (not enclosed).
// Everything enclosed (TRAIL + unreachable EMPTY) becomes OWNED.
function claimEnclosed() {
  // Build reachability map from border
  const reached = [];
  for (let r = 0; r < ROWS; r++) reached.push(new Uint8Array(COLS));

  const queue = [];
  function enq(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    if (reached[r][c]) return;
    if (grid[r][c] === TILE_OWNED) return; // owned cells block flood
    reached[r][c] = 1;
    queue.push(r, c);
  }

  // Seed from all border cells that are not OWNED
  for (let c = 0; c < COLS; c++) { enq(0, c); enq(ROWS - 1, c); }
  for (let r = 0; r < ROWS; r++) { enq(r, 0); enq(r, COLS - 1); }

  let i = 0;
  while (i < queue.length) {
    const r = queue[i++], c = queue[i++];
    enq(r - 1, c); enq(r + 1, c); enq(r, c - 1); enq(r, c + 1);
  }

  // Convert: unreached non-owned cells → OWNED; trail on border → OWNED
  let gained = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== TILE_OWNED && !reached[r][c]) {
        grid[r][c] = TILE_OWNED;
        gained++;
      }
    }
  }
  return gained;
}

// ── Player ───────────────────────────────────────────────────────────────────
function makePlayer() {
  const startC = Math.floor(COLS / 2);
  const startR = Math.floor(ROWS / 2);
  // Mark starting 5×5 territory
  for (let r = startR - 2; r <= startR + 2; r++)
    for (let c = startC - 2; c <= startC + 2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS)
        grid[r][c] = TILE_OWNED;

  return {
    c: startC, r: startR,
    dc: 0, dr: 0,          // queued direction
    curDc: 1, curDr: 0,    // moving direction
    inTrail: false,
    moveTimer: 0,
    moveInterval: 90,       // ms per cell
    shieldTimer: 0,
    freezeTimer: 0,
    speedTimer: 0,
    alive: true,
  };
}

// ── Sentinels ─────────────────────────────────────────────────────────────────
class Sentinel {
  constructor(c, r, speed) {
    this.c = c; this.r = r;
    this.x = c * CELL + CELL / 2;
    this.y = r * CELL + CELL / 2;
    this.speed = speed; // pixels per second
    this.dx = (Math.random() < 0.5 ? 1 : -1);
    this.dy = (Math.random() < 0.5 ? 1 : -1) * 0.6;
    // normalize
    const len = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
    this.dx /= len; this.dy /= len;
    this.angleOffset = Math.random() * Math.PI * 2;
    this.frozen = false;
    this.size = 7;
    this.pulseT = Math.random() * Math.PI * 2;
  }

  update(dt, frozen) {
    this.pulseT += dt * 3;
    if (frozen) return;

    const spd = this.speed * (dt / 1000);

    this.x += this.dx * spd;
    this.y += this.dy * spd;

    // Bounce off walls
    if (this.x < this.size) { this.x = this.size; this.dx = Math.abs(this.dx); }
    if (this.x > W - this.size) { this.x = W - this.size; this.dx = -Math.abs(this.dx); }
    if (this.y < this.size) { this.y = this.size; this.dy = Math.abs(this.dy); }
    if (this.y > H - this.size) { this.y = H - this.size; this.dy = -Math.abs(this.dy); }

    // Occasionally nudge direction randomly
    if (Math.random() < 0.005) {
      const angle = Math.atan2(this.dy, this.dx) + (Math.random() - 0.5) * 1.2;
      this.dx = Math.cos(angle);
      this.dy = Math.sin(angle);
    }

    this.c = Math.floor(this.x / CELL);
    this.r = Math.floor(this.y / CELL);
  }

  draw() {
    const pulse = 1 + Math.sin(this.pulseT) * 0.18;
    const r = this.size * pulse;
    const spikes = 5;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Glow
    ctx.shadowColor = COLORS.sentGlow;
    ctx.shadowBlur = 14;

    // Star / spike shape
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.4;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = COLORS.sentinel;
    ctx.fill();

    // Core dot
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.restore();
  }
}

// ── Power-ups ─────────────────────────────────────────────────────────────────
const POWERUP_TYPES = ['shield', 'freeze', 'speed'];
class PowerUp {
  constructor() {
    this.type = POWERUP_TYPES[rnd(0, POWERUP_TYPES.length - 1)];
    // Place in empty area away from player start
    let attempts = 0;
    do {
      this.c = rnd(2, COLS - 3);
      this.r = rnd(2, ROWS - 3);
      attempts++;
    } while (grid[this.r][this.c] !== TILE_EMPTY && attempts < 60);
    this.x = this.c * CELL + CELL / 2;
    this.y = this.r * CELL + CELL / 2;
    this.alive = true;
    this.t = Math.random() * Math.PI * 2;
  }

  update(dt) { this.t += dt * 0.003; }

  draw() {
    const bob = Math.sin(this.t) * 3;
    const col = this.type === 'shield' ? COLORS.shield
               : this.type === 'freeze' ? COLORS.freeze
               : COLORS.speed;
    const icon = this.type === 'shield' ? '🛡' : this.type === 'freeze' ? '❄' : '⚡';

    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.shadowColor = col;
    ctx.shadowBlur = 16;

    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '13px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText(icon, 0, 1);

    ctx.restore();
  }
}

// ── Spawn helpers ──────────────────────────────────────────────────────────────
function spawnSentinels(count, speed) {
  const s = [];
  const margin = 4;
  for (let i = 0; i < count; i++) {
    let c, r;
    let tries = 0;
    do {
      c = rnd(margin, COLS - margin - 1);
      r = rnd(margin, ROWS - margin - 1);
      tries++;
    } while (grid[r][c] === TILE_OWNED && tries < 80);
    s.push(new Sentinel(c, r, speed));
  }
  return s;
}

function spawnPowerUps(count) {
  const p = [];
  for (let i = 0; i < count; i++) p.push(new PowerUp());
  return p;
}

// ── Game init ──────────────────────────────────────────────────────────────────
hiScore = parseInt(localStorage.getItem('tracer-hi') || '0');
document.getElementById('hi-score').textContent = hiScore;

function startGame() {
  hideAll();
  level = 1;
  score = 0;
  lives = 3;
  initLevel();
  phase = 'play';
  loop();
}

function nextLevel() {
  hideAll();
  level++;
  initLevel();
  phase = 'play';
}

function initLevel() {
  grid = makeGrid();
  totalCells = COLS * ROWS;
  player = makePlayer();
  ownedCount = countOwned();

  const sentCount = 3 + (level - 1) * 2;
  const sentSpeed = 80 + (level - 1) * 18;
  sentinels = spawnSentinels(Math.min(sentCount, 16), sentSpeed);
  powerUps = spawnPowerUps(3);
}

function hideAll() {
  menuScreen.classList.remove('active');
  goScreen.classList.remove('active');
  lcScreen.classList.remove('active');
}

// ── Direction input ────────────────────────────────────────────────────────────
function readInput() {
  if (!player.alive) return;
  if (keys['ArrowLeft'] || keys['KeyA'])  { player.dc = -1; player.dr = 0; }
  if (keys['ArrowRight'] || keys['KeyD']) { player.dc = 1;  player.dr = 0; }
  if (keys['ArrowUp'] || keys['KeyW'])    { player.dc = 0;  player.dr = -1; }
  if (keys['ArrowDown'] || keys['KeyS'])  { player.dc = 0;  player.dr = 1; }
}

// ── Player update ──────────────────────────────────────────────────────────────
function updatePlayer(dt) {
  if (!player.alive) return;

  // Timers
  if (player.shieldTimer > 0) player.shieldTimer -= dt;
  if (player.freezeTimer > 0) player.freezeTimer -= dt;
  if (player.speedTimer  > 0) player.speedTimer  -= dt;

  const interval = player.speedTimer > 0 ? player.moveInterval * 0.5 : player.moveInterval;
  player.moveTimer += dt;
  if (player.moveTimer < interval) return;
  player.moveTimer -= interval;

  // Accept queued direction only if not reversing
  if (player.dc !== 0 || player.dr !== 0) {
    const notReverse = !(player.dc === -player.curDc && player.dr === -player.curDr);
    if (notReverse) {
      player.curDc = player.dc;
      player.curDr = player.dr;
    }
  }

  const nc = player.c + player.curDc;
  const nr = player.r + player.curDr;

  // Wall clamp
  if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return;

  // Moving into trail = death (unless shield)
  if (grid[nr][nc] === TILE_TRAIL) {
    if (player.shieldTimer > 0) {
      player.shieldTimer = 0;
      clearTrail();
      return;
    }
    killPlayer('Cortaste tu propio trazo');
    return;
  }

  player.c = nc;
  player.r = nr;

  const cell = grid[nr][nc];
  if (cell === TILE_OWNED) {
    // Returned to territory
    if (player.inTrail) {
      claimTerritory();
    }
    player.inTrail = false;
  } else {
    // In open space
    player.inTrail = true;
    grid[nr][nc] = TILE_TRAIL;
  }
}

function clearTrail() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] === TILE_TRAIL) grid[r][c] = TILE_EMPTY;
  player.inTrail = false;
}

function claimTerritory() {
  const gained = claimEnclosed();
  if (gained > 0) {
    const bonus = Math.floor(gained * 10 * (1 + (level - 1) * 0.2));
    score += bonus;
    ownedCount = countOwned();
    showFloatingText('+' + bonus, player.c * CELL, player.r * CELL - 10, '#00ffc8');
    checkWin();
  }
  // Convert remaining trail to owned
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] === TILE_TRAIL) grid[r][c] = TILE_OWNED;
  ownedCount = countOwned();
}

function checkWin() {
  const pct = ownedCount / totalCells;
  if (pct >= WIN_PCT) {
    const bonus = Math.floor(score * 0.3 + level * 500);
    score += bonus;
    saveHi();
    phase = 'levelclear';
    document.getElementById('lc-pct').textContent = Math.floor(pct * 100) + '%';
    document.getElementById('lc-bonus').textContent = '+' + bonus;
    document.getElementById('lc-score').textContent = score;
    lcScreen.classList.add('active');
  }
}

// ── Kill player ────────────────────────────────────────────────────────────────
function killPlayer(reason) {
  deathReason = reason;
  clearTrail();
  shakeTimer = 400;
  flashTimer = 300;
  lives--;
  updateLivesHUD();

  if (lives <= 0) {
    saveHi();
    phase = 'gameover';
    setTimeout(() => {
      document.getElementById('go-reason').textContent = reason;
      document.getElementById('go-pct').textContent =
        Math.floor((ownedCount / totalCells) * 100) + '%';
      document.getElementById('go-score').textContent = score;
      document.getElementById('go-level').textContent = level;
      document.getElementById('go-hi').textContent = hiScore;
      goScreen.classList.add('active');
    }, 600);
  } else {
    // Respawn at edge of owned territory
    respawnPlayer();
  }
}

function respawnPlayer() {
  // Find a cell that is OWNED next to the player's last position, or center
  player.alive = false;
  setTimeout(() => {
    let placed = false;
    outer:
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === TILE_OWNED) {
          player.c = c; player.r = r;
          player.curDc = 1; player.curDr = 0;
          player.dc = 0; player.dr = 0;
          player.inTrail = false;
          player.moveTimer = 0;
          player.alive = true;
          placed = true;
          break outer;
        }
      }
    }
    if (!placed) {
      // Last resort: center
      player.c = Math.floor(COLS / 2);
      player.r = Math.floor(ROWS / 2);
      player.alive = true;
    }
  }, 700);
}

// ── Sentinel vs player collision ───────────────────────────────────────────────
function checkSentinelCollisions() {
  if (!player.alive) return;
  const px = player.c * CELL + CELL / 2;
  const py = player.r * CELL + CELL / 2;

  for (const s of sentinels) {
    // Hit trail?
    const sc = Math.floor(s.x / CELL);
    const sr = Math.floor(s.y / CELL);
    if (sc >= 0 && sc < COLS && sr >= 0 && sr < ROWS) {
      if (grid[sr][sc] === TILE_TRAIL) {
        if (player.shieldTimer > 0) {
          player.shieldTimer = 0;
          clearTrail();
          return;
        }
        killPlayer('Un centinela destruyó tu trazo');
        return;
      }
    }
    // Hit player body?
    if (dist(s.x, s.y, px, py) < CELL * 0.9) {
      if (player.shieldTimer > 0) {
        player.shieldTimer = 0;
        return;
      }
      killPlayer('Un centinela te absorbió');
      return;
    }
  }
}

// ── Power-up pickup ─────────────────────────────────────────────────────────────
function checkPowerUps() {
  if (!player.alive) return;
  const px = player.c * CELL + CELL / 2;
  const py = player.r * CELL + CELL / 2;
  for (const p of powerUps) {
    if (!p.alive) continue;
    if (dist(px, py, p.x, p.y) < CELL * 1.1) {
      p.alive = false;
      applyPowerUp(p.type);
    }
  }
  powerUps = powerUps.filter(p => p.alive);
}

function applyPowerUp(type) {
  if (type === 'shield') {
    player.shieldTimer = 8000;
    showPowerStatus('🛡 ESCUDO ACTIVO');
  } else if (type === 'freeze') {
    player.freezeTimer = 4000;
    showPowerStatus('❄ CENTINELAS CONGELADOS');
  } else if (type === 'speed') {
    player.speedTimer = 6000;
    showPowerStatus('⚡ VELOCIDAD BOOST');
  }
  score += 50;
  // Respawn a new power-up after delay
  setTimeout(() => powerUps.push(new PowerUp()), 5000);
}

let powerStatusTimeout;
function showPowerStatus(msg) {
  powerStatus.textContent = msg;
  clearTimeout(powerStatusTimeout);
  powerStatusTimeout = setTimeout(() => { powerStatus.textContent = ''; }, 3500);
}

// ── Floating text ───────────────────────────────────────────────────────────────
const floats = [];
function showFloatingText(text, x, y, color) {
  floats.push({ text, x, y, color, life: 1.0 });
}

function updateFloats(dt) {
  for (const f of floats) {
    f.life -= dt * 0.0012;
    f.y -= dt * 0.04;
  }
  floats.splice(0, floats.length, ...floats.filter(f => f.life > 0));
}

function drawFloats() {
  for (const f of floats) {
    ctx.save();
    ctx.globalAlpha = f.life;
    ctx.font = 'bold 13px Orbitron, sans-serif';
    ctx.fillStyle = f.color;
    ctx.textAlign = 'center';
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 8;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

// ── HUD update ─────────────────────────────────────────────────────────────────
function updateHUD() {
  const pct = Math.floor((ownedCount / totalCells) * 100);
  hudPct.textContent = pct + '%';
  hudBar.style.width = pct + '%';
  hudScore.textContent = score;
  hudLevel.textContent = 'NIV ' + level;
}

function updateLivesHUD() {
  hudLives.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('div');
    d.className = 'life-icon' + (i >= lives ? ' lost' : '');
    hudLives.appendChild(d);
  }
}

// ── Draw grid ──────────────────────────────────────────────────────────────────
function drawGrid() {
  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, H);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(W, r * CELL);
    ctx.stroke();
  }
}

function drawTiles() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      const x = c * CELL, y = r * CELL;

      if (t === TILE_OWNED) {
        ctx.fillStyle = COLORS.owned;
        ctx.fillRect(x, y, CELL, CELL);
      } else if (t === TILE_TRAIL) {
        ctx.fillStyle = COLORS.trail;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Owned cell borders (draw after for layering)
  ctx.strokeStyle = COLORS.ownedBrd;
  ctx.lineWidth = 0.8;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== TILE_OWNED) continue;
      const x = c * CELL, y = r * CELL;
      // Only draw edges adjacent to non-owned
      if (r === 0 || grid[r-1][c] !== TILE_OWNED) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); ctx.stroke();
      }
      if (r === ROWS-1 || grid[r+1][c] !== TILE_OWNED) {
        ctx.beginPath(); ctx.moveTo(x, y+CELL); ctx.lineTo(x+CELL, y+CELL); ctx.stroke();
      }
      if (c === 0 || grid[r][c-1] !== TILE_OWNED) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y+CELL); ctx.stroke();
      }
      if (c === COLS-1 || grid[r][c+1] !== TILE_OWNED) {
        ctx.beginPath(); ctx.moveTo(x+CELL, y); ctx.lineTo(x+CELL, y+CELL); ctx.stroke();
      }
    }
  }
}

function drawTrailGlow() {
  // Draw a glowing trail line connecting trail cells
  ctx.shadowColor = COLORS.trailGlow;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = COLORS.trail;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== TILE_TRAIL) continue;
      const cx = c * CELL + CELL / 2;
      const cy = r * CELL + CELL / 2;
      // Connect to neighbors
      if (c + 1 < COLS && grid[r][c+1] === TILE_TRAIL) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + CELL, cy);
        ctx.stroke();
      }
      if (r + 1 < ROWS && grid[r+1][c] === TILE_TRAIL) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy + CELL);
        ctx.stroke();
      }
    }
  }
  ctx.shadowBlur = 0;
}

function drawPlayer() {
  if (!player.alive) return;
  const x = player.c * CELL + CELL / 2;
  const y = player.r * CELL + CELL / 2;
  const r = CELL / 2 - 1;

  ctx.save();

  // Shield aura
  if (player.shieldTimer > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.shield;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.01) * 0.3;
    ctx.shadowColor = COLORS.shield;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Speed glow
  if (player.speedTimer > 0) {
    ctx.shadowColor = COLORS.speed;
    ctx.shadowBlur = 18;
  } else {
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 14;
  }

  // Body
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = player.speedTimer > 0 ? COLORS.speed : COLORS.player;
  ctx.fill();

  // Direction indicator
  const dirX = x + player.curDc * (r * 0.55);
  const dirY = y + player.curDr * (r * 0.55);
  ctx.beginPath();
  ctx.arc(dirX, dirY, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 0;
  ctx.fill();

  ctx.restore();
}

// ── Score save ─────────────────────────────────────────────────────────────────
function saveHi() {
  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem('tracer-hi', hiScore);
    document.getElementById('hi-score').textContent = hiScore;
  }
}

// ── Main loop ──────────────────────────────────────────────────────────────────
let last = 0;
let loopRunning = false;

function loop(ts = 0) {
  if (phase === 'gameover') { loopRunning = false; return; }
  requestAnimationFrame(loop);

  const dt = Math.min(ts - last, 64); // cap at ~15fps
  last = ts;

  if (phase !== 'play') return;

  readInput();
  updatePlayer(dt);

  const frozen = player.freezeTimer > 0;
  for (const s of sentinels) s.update(dt, frozen);
  for (const p of powerUps) p.update(dt);

  checkSentinelCollisions();
  checkPowerUps();
  updateFloats(dt);
  ownedCount = countOwned();
  updateHUD();

  // Draw
  shakeTimer = Math.max(0, shakeTimer - dt);
  flashTimer = Math.max(0, flashTimer - dt);

  const sx = shakeTimer > 0 ? (Math.random() - 0.5) * 5 : 0;
  const sy = shakeTimer > 0 ? (Math.random() - 0.5) * 5 : 0;

  ctx.save();
  ctx.translate(sx, sy);

  if (flashTimer > 0) {
    ctx.fillStyle = 'rgba(255,50,80,0.18)';
    ctx.fillRect(0, 0, W, H);
  }

  drawGrid();
  drawTiles();
  drawTrailGlow();

  for (const p of powerUps) p.draw();
  for (const s of sentinels) s.draw();
  drawPlayer();
  drawFloats();

  // Freeze overlay
  if (player.freezeTimer > 0) {
    ctx.fillStyle = 'rgba(60,180,255,0.07)';
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();

  // Win % progress bar fill color nudge
  const pct = ownedCount / totalCells;
  if (pct >= 0.5) {
    hudBar.style.background = 'linear-gradient(90deg, #00ffc8, #ffe040)';
  } else {
    hudBar.style.background = 'linear-gradient(90deg, #00c8ff, #00ffc8)';
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────────
updateLivesHUD();
document.getElementById('hi-score').textContent = hiScore;
// Menu screen is already active via HTML
