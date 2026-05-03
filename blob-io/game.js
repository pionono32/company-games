// ══════════════════════════════════════════════════════
//  BLOB.IO  –  Agar.io style
// ══════════════════════════════════════════════════════

const canvas   = document.getElementById('gameCanvas');
const ctx      = canvas.getContext('2d');
const minicanv = document.getElementById('minimap');
const minictx  = minicanv.getContext('2d');
const MM = 130;
minicanv.width = minicanv.height = MM;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

// ── World ─────────────────────────────────────────────
const WW = 5000, WH = 5000;

// ── Camera ────────────────────────────────────────────
const cam = { x: WW/2, y: WH/2, zoom: 1, tz: 1 };

// ── Colors ────────────────────────────────────────────
const PALETTE = [
  '#e74c3c','#e67e22','#f1c40f','#48e082','#1abc9c',
  '#3498db','#9b59b6','#e91e63','#ff5722','#00bcd4',
  '#ff9800','#8bc34a','#673ab7','#f06292','#26c6da',
];

let playerColor = '#3498db';
let playerName  = 'Jugador';

// Build color picker
const picks = document.getElementById('color-picks');
PALETTE.forEach(c => {
  const el = document.createElement('div');
  el.className = 'color-pick';
  el.style.background = c;
  if (c === playerColor) el.classList.add('active');
  el.onclick = () => {
    document.querySelectorAll('.color-pick').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    playerColor = c;
  };
  picks.appendChild(el);
});

// ── Bot names ─────────────────────────────────────────
const BOT_NAMES = [
  'NomNom','Glotón','BigBlob','CellKing','Chomper',
  'Absorber','Agar','Slurpy','BlobZilla','Devorador',
  'Amoeba','Proteus','MegaMass','Destroyer','PinkBlob',
  'Tsunami','Leviathan','Coloso','Titán','Sombra',
];

// ── Utils ─────────────────────────────────────────────
const rand  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => (bx-ax)**2 + (by-ay)**2;

function massToRadius(mass) { return Math.sqrt(mass / Math.PI); }
function radiusToMass(r)    { return Math.PI * r * r; }

// ── Food ──────────────────────────────────────────────
const FOOD_TARGET = 650;
const food = [];

function spawnFood(n = 1) {
  for (let i = 0; i < n; i++) {
    food.push({
      x: rand(30, WW-30),
      y: rand(30, WH-30),
      r: rand(5, 9),
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      alpha: rand(0.7, 1),
    });
  }
}

// ── Viruses ────────────────────────────────────────────
const VIRUS_COUNT = 22;
const viruses = [];
function spawnVirus() {
  viruses.push({ x: rand(80, WW-80), y: rand(80, WH-80), r: 46 });
}

// ── Cells ─────────────────────────────────────────────
let cells       = [];   // all blobs: player pieces + bots
let playerPieces = [];  // references to player's cells
let bots        = [];   // bot state objects

let gameState   = 'menu';
let sessionTime = 0;
let maxMass     = 0;
let blobsEaten  = 0;
let bestRank    = 99;
let aliveTime   = 0;
let lastTime    = 0;

const mouse = { x: 0, y: 0 };
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

// ── Cell class ────────────────────────────────────────
class Blob {
  constructor(x, y, mass, color, name, isPlayer = false, botRef = null) {
    this.x = x; this.y = y;
    this.mass   = mass;
    this.color  = color;
    this.name   = name;
    this.isPlayer = isPlayer;
    this.botRef   = botRef;
    this.vx = 0; this.vy = 0;
    this.mergeTimer = 0;   // >0: can't merge yet
    this.alive  = true;
    this.eatAnim = 0;
  }

  get r()    { return massToRadius(this.mass); }
  get speed() {
    const r = this.r;
    return clamp(280 * Math.pow(30 / r, 0.55), 28, 280);
  }

  moveTo(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const spd = this.speed;
    this.vx += (dx/d * spd - this.vx) * Math.min(1, 6 * dt);
    this.vy += (dy/d * spd - this.vy) * Math.min(1, 6 * dt);
    this.x = clamp(this.x + this.vx * dt, this.r, WW - this.r);
    this.y = clamp(this.y + this.vy * dt, this.r, WH - this.r);
  }

  driftToward(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.x += (dx/d) * this.speed * dt * 0.55;
    this.y += (dy/d) * this.speed * dt * 0.55;
    this.x = clamp(this.x, this.r, WW - this.r);
    this.y = clamp(this.y, this.r, WH - this.r);
  }

  draw(camX, camY, zoom) {
    const sx = (this.x - camX) * zoom + canvas.width  / 2;
    const sy = (this.y - camY) * zoom + canvas.height / 2;
    const sr = this.r * zoom;
    if (sx + sr < -50 || sx - sr > canvas.width  + 50) return;
    if (sy + sr < -50 || sy - sr > canvas.height + 50) return;

    const pulse = 1 + 0.04 * Math.sin(this.eatAnim);
    const dr = sr * pulse;

    // Shadow
    ctx.shadowBlur  = 18 * zoom;
    ctx.shadowColor = this.color + '66';

    // Body gradient
    const g = ctx.createRadialGradient(sx - dr*0.25, sy - dr*0.25, 0, sx, sy, dr);
    g.addColorStop(0, lighten(this.color, 60));
    g.addColorStop(0.55, this.color);
    g.addColorStop(1, darken(this.color, 40));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, dr, 0, Math.PI*2); ctx.fill();

    // Border
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = darken(this.color, 50);
    ctx.lineWidth   = Math.max(1.5, 2 * zoom);
    ctx.stroke();

    // Name + mass
    if (dr > 18) {
      const fontSize = clamp(dr * 0.36, 10, 28);
      ctx.fillStyle = '#fff';
      ctx.font      = `900 ${fontSize}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.fillText(this.name, sx, sy + fontSize * 0.35);
      if (dr > 32) {
        ctx.font = `700 ${fontSize*0.62}px Nunito, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillText(Math.floor(this.mass), sx, sy + fontSize * 0.35 + fontSize * 0.7);
      }
      ctx.shadowBlur = 0;
    }
  }
}

// ── Color helpers ─────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${clamp(r+amt,0,255)},${clamp(g+amt,0,255)},${clamp(b+amt,0,255)})`;
}
function darken(hex, amt) { return lighten(hex, -amt); }

// ── Virus ─────────────────────────────────────────────
function drawVirus(v, camX, camY, zoom) {
  const sx = (v.x - camX) * zoom + canvas.width  / 2;
  const sy = (v.y - camY) * zoom + canvas.height / 2;
  const sr = v.r * zoom;
  if (sx+sr < -50 || sx-sr > canvas.width+50 || sy+sr < -50 || sy-sr > canvas.height+50) return;

  ctx.shadowBlur = 12; ctx.shadowColor = '#00cc44';
  ctx.fillStyle  = '#1a4a1a';
  ctx.strokeStyle = '#00ee55';
  ctx.lineWidth  = 2.5 * zoom;
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill(); ctx.stroke();

  // Spikes
  const spikes = 14;
  ctx.fillStyle  = '#00ee55';
  ctx.shadowColor = '#00ee55'; ctx.shadowBlur = 8;
  for (let i = 0; i < spikes; i++) {
    const a = (Math.PI*2 / spikes) * i;
    const ox = sx + Math.cos(a) * sr;
    const oy = sy + Math.sin(a) * sr;
    ctx.beginPath(); ctx.arc(ox, oy, 4.5 * zoom, 0, Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// ── Background ────────────────────────────────────────
function drawBackground(camX, camY, zoom) {
  ctx.fillStyle = '#e8f4e8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const GRID = 60 * zoom;
  const ox = ((-camX * zoom) % GRID + GRID) % GRID + canvas.width/2 % GRID;
  const oy = ((-camY * zoom) % GRID + GRID) % GRID + canvas.height/2 % GRID;

  ctx.strokeStyle = 'rgba(0,0,0,0.055)';
  ctx.lineWidth   = 1;
  for (let x = ox - GRID; x < canvas.width + GRID; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
  }
  for (let y = oy - GRID; y < canvas.height + GRID; y += GRID) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }

  // World border
  const bx1 = (0     - camX) * zoom + canvas.width/2;
  const by1 = (0     - camY) * zoom + canvas.height/2;
  const bx2 = (WW    - camX) * zoom + canvas.width/2;
  const by2 = (WH    - camY) * zoom + canvas.height/2;
  ctx.strokeStyle = 'rgba(255,80,80,0.5)';
  ctx.lineWidth   = 3;
  ctx.strokeRect(bx1, by1, bx2-bx1, by2-by1);
}

// ── Food draw ─────────────────────────────────────────
function drawFood(camX, camY, zoom) {
  for (const f of food) {
    const sx = (f.x - camX) * zoom + canvas.width/2;
    const sy = (f.y - camY) * zoom + canvas.height/2;
    const sr = f.r * zoom;
    if (sx+sr < 0 || sx-sr > canvas.width || sy+sr < 0 || sy-sr > canvas.height) continue;
    ctx.globalAlpha = f.alpha;
    ctx.shadowBlur  = 5; ctx.shadowColor = f.color;
    ctx.fillStyle   = f.color;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// ── Player split ──────────────────────────────────────
const MAX_PIECES = 8;

function splitPlayer() {
  if (playerPieces.length >= MAX_PIECES) return;
  const toSplit = [...playerPieces].filter(p => p.mass > radiusToMass(25) * 2);
  if (!toSplit.length) return;
  for (const piece of toSplit) {
    if (playerPieces.length >= MAX_PIECES) break;
    const halfMass = piece.mass / 2;
    piece.mass    = halfMass;
    const cx = playerCentroid().x, cy = playerCentroid().y;
    const dx = piece.x - cx, dy = piece.y - cy;
    const d  = Math.hypot(dx, dy) || 1;
    const spd = 450;
    const newBlob = new Blob(piece.x, piece.y, halfMass, piece.color, piece.name, true);
    newBlob.vx = (dx/d) * spd;
    newBlob.vy = (dy/d) * spd;
    newBlob.mergeTimer = 15;
    piece.mergeTimer   = 15;
    cells.push(newBlob);
    playerPieces.push(newBlob);
  }
}

function ejectMass() {
  for (const piece of playerPieces) {
    if (piece.mass < radiusToMass(35)) continue;
    piece.mass -= radiusToMass(16);
    const cx = playerCentroid().x, cy = playerCentroid().y;
    const dx = piece.x - cx || 1, dy = piece.y - cy || 0;
    const d = Math.hypot(dx, dy) || 1;
    const ejected = new Blob(
      piece.x + (dx/d)*(piece.r+12), piece.y + (dy/d)*(piece.r+12),
      radiusToMass(14), piece.color, '', false
    );
    ejected.vx = (dx/d) * 380; ejected.vy = (dy/d) * 380;
    ejected.isEjected = true;
    cells.push(ejected);
    // Don't add to food[] — the ejected blob itself is the pellet
  }
}

function playerCentroid() {
  if (!playerPieces.length) return { x: WW/2, y: WH/2 };
  let tx = 0, ty = 0, tm = 0;
  for (const p of playerPieces) { tx += p.x * p.mass; ty += p.y * p.mass; tm += p.mass; }
  return { x: tx/tm, y: ty/tm };
}

function totalPlayerMass() { return playerPieces.reduce((s,p) => s + p.mass, 0); }

// ── Keys ──────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (gameState !== 'playing') return;
  if (e.code === 'Space')     { e.preventDefault(); splitPlayer(); }
  if (e.key  === 'w' || e.key === 'W') ejectMass();
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {} // no pause in .io
});

// ── Bot AI ────────────────────────────────────────────
class Bot {
  constructor(name, color) {
    this.name   = name;
    this.color  = color;
    this.tx = rand(200, WW-200);
    this.ty = rand(200, WH-200);
    this.thinkTimer = rand(0, 2);
    this.blob = null;  // set when cell is created
  }

  think(dt) {
    this.thinkTimer -= dt;
    if (this.thinkTimer > 0) return;
    this.thinkTimer = rand(0.8, 2.0);

    const b = this.blob;
    if (!b || !b.alive) return;

    let bestFoodDist = Infinity, bestFood = null;
    let bestPrey = null,  bestPreyDist  = Infinity;
    let closestThreat = null, closestThreatDist = Infinity;

    // Scan food nearby
    for (const f of food) {
      const d2 = dist2(b.x, b.y, f.x, f.y);
      if (d2 < bestFoodDist && d2 < 300**2) { bestFoodDist = d2; bestFood = f; }
    }

    // Scan other cells
    for (const c of cells) {
      if (c === b || !c.alive) continue;
      const d2 = dist2(b.x, b.y, c.x, c.y);
      if (d2 > 600**2) continue;
      if (c.mass < b.mass * 0.8 && d2 < bestPreyDist) { bestPreyDist = d2; bestPrey = c; }
      if (c.mass > b.mass * 1.15 && d2 < closestThreatDist) { closestThreatDist = d2; closestThreat = c; }
    }

    if (closestThreat) {
      // Flee
      const dx = b.x - closestThreat.x, dy = b.y - closestThreat.y;
      const d = Math.hypot(dx, dy) || 1;
      this.tx = clamp(b.x + (dx/d)*700, 50, WW-50);
      this.ty = clamp(b.y + (dy/d)*700, 50, WH-50);
    } else if (bestPrey) {
      this.tx = bestPrey.x; this.ty = bestPrey.y;
    } else if (bestFood) {
      this.tx = bestFood.x; this.ty = bestFood.y;
    } else {
      // Wander
      this.tx = clamp(b.x + rand(-300,300), 50, WW-50);
      this.ty = clamp(b.y + rand(-300,300), 50, WH-50);
    }
  }
}

// ── Eating / Collision ────────────────────────────────
function eatFood() {
  for (let i = food.length - 1; i >= 0; i--) {
    const f = food[i];
    for (const b of cells) {
      if (!b.alive) continue;
      const d2 = dist2(b.x, b.y, f.x, f.y);
      if (d2 < (b.r + f.r * 0.5) ** 2) {
        b.mass += radiusToMass(f.r) * 0.4;
        b.eatAnim = Math.PI * 2;
        if (b.isPlayer) { /* mass updated */ }
        food.splice(i, 1);
        break;
      }
    }
  }
}

function eatCells(dt) {
  for (let i = cells.length - 1; i >= 0; i--) {
    const eater = cells[i];
    if (!eater.alive || eater.isEjected) continue; // ejected blobs don't eat
    for (let j = cells.length - 1; j >= 0; j--) {
      if (i === j) continue;
      const prey = cells[j];
      if (!prey.alive) continue;
      if (eater.mass < prey.mass * 1.12) continue;
      // Same player pieces can't eat each other when mergeTimer active
      if (eater.isPlayer && prey.isPlayer && (eater.mergeTimer > 0 || prey.mergeTimer > 0)) continue;

      const d2 = dist2(eater.x, eater.y, prey.x, prey.y);
      const eatDist = eater.r * 0.85;
      if (d2 < eatDist ** 2) {
        eater.mass += prey.mass;
        eater.eatAnim = Math.PI * 1.5;
        prey.alive = false;

        if (prey.isPlayer) {
          playerPieces = playerPieces.filter(p => p !== prey);
          if (playerPieces.length === 0) {
            onGameOver(eater.name);
            return;
          }
        }
        if (eater.isPlayer && !prey.isPlayer) blobsEaten++;
        if (prey.botRef) {
          // Respawn bot after a delay
          setTimeout(() => respawnBot(prey.botRef), rand(3000, 7000));
        }
      }
    }
  }
  cells = cells.filter(c => c.alive);
}

function checkViruses() {
  // Snapshot cells before iterating — virusSplit pushes to cells and would
  // cause newly created pieces to be split again in the same frame.
  const snapshot = [...cells];
  for (const v of viruses) {
    for (const b of snapshot) {
      if (!b.alive || b.r < v.r * 0.95) continue;
      const d2 = dist2(b.x, b.y, v.x, v.y);
      if (d2 < (b.r + v.r * 0.5) ** 2) {
        virusSplit(b);
      }
    }
  }
}

function virusSplit(b) {
  const pieces = Math.min(8, Math.floor(b.r / 20));
  if (pieces < 2) return;
  if (b.isPlayer && playerPieces.length >= MAX_PIECES) return;
  const massPer = b.mass / pieces;
  b.mass = massPer;
  for (let i = 1; i < pieces; i++) {
    const a = rand(0, Math.PI*2);
    const spd = rand(180, 320);
    // Split pieces don't inherit botRef — only the original blob keeps it,
    // preventing each piece from triggering a separate respawn when eaten.
    const nb = new Blob(b.x, b.y, massPer, b.color, b.name, b.isPlayer, null);
    nb.vx = Math.cos(a)*spd; nb.vy = Math.sin(a)*spd;
    nb.mergeTimer = 12;
    b.mergeTimer  = 12;
    cells.push(nb);
    if (b.isPlayer && playerPieces.length < MAX_PIECES) playerPieces.push(nb);
  }
}

// ── Merge player pieces ────────────────────────────────
function mergePlayerPieces(dt) {
  for (const p of playerPieces) {
    if (p.mergeTimer > 0) p.mergeTimer -= dt;
  }
  for (let i = 0; i < playerPieces.length; i++) {
    for (let j = i+1; j < playerPieces.length; j++) {
      const a = playerPieces[i], b = playerPieces[j];
      if (a.mergeTimer > 0 || b.mergeTimer > 0) continue;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 < (a.r * 0.9) ** 2) {
        a.mass += b.mass; b.alive = false;
        playerPieces = playerPieces.filter(p => p !== b);
        cells = cells.filter(c => c !== b);
      }
    }
  }
}

// ── Apply physics / damping ────────────────────────────
function applyPhysics(dt) {
  for (const c of cells) {
    const friction = 1 - 5*dt;
    c.vx *= Math.max(0, friction);
    c.vy *= Math.max(0, friction);
    c.x = clamp(c.x + c.vx * dt, c.r, WW - c.r);
    c.y = clamp(c.y + c.vy * dt, c.r, WH - c.r);
    if (c.eatAnim > 0) c.eatAnim -= dt * 8;
  }
}

// ── Game setup ────────────────────────────────────────
function startGame() {
  playerName  = document.getElementById('name-input').value.trim() || 'Jugador';
  cells       = [];
  playerPieces = [];
  bots        = [];
  food.length = 0;
  viruses.length = 0;
  sessionTime = 0; maxMass = 0; blobsEaten = 0; bestRank = 99; aliveTime = 0;

  spawnFood(FOOD_TARGET);
  for (let i = 0; i < VIRUS_COUNT; i++) spawnVirus();

  // Player
  const startMass = radiusToMass(30);
  const pBlob = new Blob(WW/2 + rand(-200,200), WH/2 + rand(-200,200), startMass, playerColor, playerName, true);
  cells.push(pBlob);
  playerPieces = [pBlob];

  // Bots
  const used = new Set();
  for (let i = 0; i < 18; i++) {
    let name;
    do { name = BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)]; } while (used.has(name));
    used.add(name);
    const color  = PALETTE.filter(c => c !== playerColor)[i % (PALETTE.length-1)];
    const bot    = new Bot(name, color);
    const botMass = radiusToMass(rand(25, 55));
    const bBlob  = new Blob(rand(100, WW-100), rand(100, WH-100), botMass, color, name, false, bot);
    bot.blob     = bBlob;
    cells.push(bBlob);
    bots.push(bot);
  }

  cam.x = WW/2; cam.y = WH/2; cam.zoom = 1;
  lastTime = 0;
  showOverlay(null);
  gameState = 'playing';
}

function respawnBot(bot) {
  if (gameState !== 'playing') return;
  // Safety cap: if too many cells exist, skip respawn to prevent runaway growth
  if (cells.filter(c => c.alive).length > 120) return;
  const color  = bot.color;
  const botMass = radiusToMass(rand(22, 40));
  const bBlob  = new Blob(rand(100, WW-100), rand(100, WH-100), botMass, color, bot.name, false, bot);
  bot.blob     = bBlob;
  bot.thinkTimer = rand(0.5, 2);
  cells.push(bBlob);
}

function onGameOver(killerName) {
  gameState = 'gameover';
  const fmt = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  document.getElementById('go-killer').textContent = killerName || '???';
  document.getElementById('go-mass').textContent   = Math.floor(maxMass);
  document.getElementById('go-time').textContent   = fmt(aliveTime);
  document.getElementById('go-eaten').textContent  = blobsEaten;
  document.getElementById('go-rank').textContent   = '#' + bestRank;
  showOverlay('gameover-screen');
}

// ── Leaderboard ───────────────────────────────────────
let lbUpdateTimer = 0;
function updateLeaderboard(dt) {
  lbUpdateTimer -= dt;
  if (lbUpdateTimer > 0) return;
  lbUpdateTimer = 1.5;

  const entries = [];
  // Player
  if (playerPieces.length) entries.push({ name: playerName, mass: totalPlayerMass(), isPlayer: true });
  // Bots
  for (const bot of bots) {
    if (bot.blob && bot.blob.alive) entries.push({ name: bot.name, mass: bot.blob.mass, isPlayer: false });
  }
  entries.sort((a,b) => b.mass - a.mass);

  const rank = entries.findIndex(e => e.isPlayer) + 1;
  if (rank > 0) { bestRank = Math.min(bestRank, rank); document.getElementById('rank-display').textContent = '#' + rank; }

  const list = document.getElementById('lb-list');
  list.innerHTML = '';
  entries.slice(0,10).forEach((e, i) => {
    const li = document.createElement('li');
    if (e.isPlayer) li.classList.add('is-player');
    li.style.color = e.isPlayer ? playerColor : '';
    li.innerHTML = `<span>${i+1}. ${e.name}</span><span class="lb-mass">${Math.floor(e.mass)}</span>`;
    list.appendChild(li);
  });
}

// ── Minimap ───────────────────────────────────────────
function drawMinimap() {
  minictx.fillStyle = '#1a2e1a';
  minictx.fillRect(0, 0, MM, MM);

  const scaleX = MM / WW, scaleY = MM / WH;

  // World border
  minictx.strokeStyle = 'rgba(255,255,255,0.2)';
  minictx.lineWidth = 1;
  minictx.strokeRect(0, 0, MM, MM);

  // Food dots
  minictx.fillStyle = 'rgba(255,255,255,0.2)';
  for (const f of food) {
    minictx.fillRect(f.x*scaleX-0.5, f.y*scaleY-0.5, 1, 1);
  }

  // Cells
  for (const c of cells) {
    const mx = c.x*scaleX, my = c.y*scaleY, mr = Math.max(1, c.r*scaleX*1.5);
    minictx.fillStyle = c.isPlayer ? '#fff' : c.color;
    minictx.beginPath(); minictx.arc(mx, my, mr, 0, Math.PI*2); minictx.fill();
  }

  // Viewport rect
  const vx1 = (cam.x - canvas.width /2/cam.zoom) * scaleX;
  const vy1 = (cam.y - canvas.height/2/cam.zoom) * scaleY;
  const vx2 = (cam.x + canvas.width /2/cam.zoom) * scaleX;
  const vy2 = (cam.y + canvas.height/2/cam.zoom) * scaleY;
  minictx.strokeStyle = 'rgba(255,255,255,0.45)';
  minictx.lineWidth = 1;
  minictx.strokeRect(vx1, vy1, vx2-vx1, vy2-vy1);
}

// ── HUD update ────────────────────────────────────────
function updateHUD() {
  const m = Math.floor(totalPlayerMass());
  document.getElementById('mass-display').textContent = 'MASA: ' + m;
  if (m > maxMass) maxMass = m;
}

// ── Overlay ───────────────────────────────────────────
function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
  if (id) document.getElementById(id).classList.add('active');
}

// ── Button bindings ───────────────────────────────────
document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-respawn').addEventListener('click', startGame);

// ── Main loop ─────────────────────────────────────────
function gameLoop(ts) {
  const dt = Math.min((ts - (lastTime || ts)) / 1000, 0.05);
  lastTime = ts;

  if (gameState === 'playing') {
    aliveTime += dt;

    // Refill food
    if (food.length < FOOD_TARGET) spawnFood(Math.min(5, FOOD_TARGET - food.length));

    // Move player pieces toward mouse (in world coords)
    if (playerPieces.length) {
      const centroid = playerCentroid();
      const wx = centroid.x + (mouse.x - canvas.width/2)  / cam.zoom;
      const wy = centroid.y + (mouse.y - canvas.height/2) / cam.zoom;
      for (const p of playerPieces) p.moveTo(wx, wy, dt);
    }

    // Bots
    for (const bot of bots) {
      bot.think(dt);
      if (bot.blob && bot.blob.alive) bot.blob.moveTo(bot.tx, bot.ty, dt);
    }

    applyPhysics(dt);
    eatFood();
    eatCells(dt);
    checkViruses();
    mergePlayerPieces(dt);
    updateLeaderboard(dt);
    updateHUD();

    // Camera
    if (playerPieces.length) {
      const c = playerCentroid();
      cam.x += (c.x - cam.x) * Math.min(1, 5*dt);
      cam.y += (c.y - cam.y) * Math.min(1, 5*dt);
      const totalR = playerPieces.reduce((s,p) => s+p.r, 0);
      const tz = clamp(0.95 / Math.sqrt(totalR / 30), 0.2, 1.2);
      cam.zoom += (tz - cam.zoom) * Math.min(1, 4*dt);
    }
  }

  // Draw
  drawBackground(cam.x, cam.y, cam.zoom);
  drawFood(cam.x, cam.y, cam.zoom);
  for (const v of viruses) drawVirus(v, cam.x, cam.y, cam.zoom);

  // Draw cells: smaller first so bigger appear on top
  const sorted = [...cells].filter(c=>c.alive).sort((a,b)=>a.r-b.r);
  for (const c of sorted) c.draw(cam.x, cam.y, cam.zoom);

  drawMinimap();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
