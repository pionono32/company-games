'use strict';
// ═══════════════════════════════════════════════════════════
//  TETRA  –  Classic block puzzle game
// ═══════════════════════════════════════════════════════════

const CELL = 30;
const COLS = 10;
const ROWS = 20;
const W    = COLS * CELL;  // 300
const H    = ROWS * CELL;  // 600

// ── Tetromino data ──────────────────────────────────────────
// Each entry: 4 rotation states, each state a 2D binary array
const SHAPES = [
  // 0 I – cyan
  [[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
   [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
   [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
   [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]],
  // 1 J – blue
  [[[1,0,0],[1,1,1],[0,0,0]],
   [[0,1,1],[0,1,0],[0,1,0]],
   [[0,0,0],[1,1,1],[0,0,1]],
   [[0,1,0],[0,1,0],[1,1,0]]],
  // 2 L – orange
  [[[0,0,1],[1,1,1],[0,0,0]],
   [[0,1,0],[0,1,0],[0,1,1]],
   [[0,0,0],[1,1,1],[1,0,0]],
   [[1,1,0],[0,1,0],[0,1,0]]],
  // 3 O – yellow (4-wide to keep spawn logic uniform)
  [[[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
   [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
   [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
   [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]]],
  // 4 S – green
  [[[0,1,1],[1,1,0],[0,0,0]],
   [[0,1,0],[0,1,1],[0,0,1]],
   [[0,0,0],[0,1,1],[1,1,0]],
   [[1,0,0],[1,1,0],[0,1,0]]],
  // 5 T – purple
  [[[0,1,0],[1,1,1],[0,0,0]],
   [[0,1,0],[0,1,1],[0,1,0]],
   [[0,0,0],[1,1,1],[0,1,0]],
   [[0,1,0],[1,1,0],[0,1,0]]],
  // 6 Z – red
  [[[1,1,0],[0,1,1],[0,0,0]],
   [[0,0,1],[0,1,1],[0,1,0]],
   [[0,0,0],[1,1,0],[0,1,1]],
   [[0,1,0],[1,1,0],[1,0,0]]],
];

const COLORS = [
  '#00e8f0', // I  cyan
  '#3060f8', // J  blue
  '#f8a020', // L  orange
  '#f8e020', // O  yellow
  '#20e840', // S  green
  '#c040ff', // T  purple
  '#f03040', // Z  red
];

// SRS wall kicks – non-I pieces: kicks[fromRot] = list of [dx,dy] to try
const KICKS = [
  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],  // 0→1
  [[0,0],[1,0],[1,-1],[0,2],[1,2]],       // 1→2
  [[0,0],[1,0],[1,1],[0,-2],[1,-2]],      // 2→3
  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],   // 3→0
];
// SRS wall kicks – I piece
const KICKS_I = [
  [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],    // 0→1
  [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],    // 1→2
  [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],    // 2→3
  [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],    // 3→0
];

// ── Canvas ──────────────────────────────────────────────────
const canvas    = document.getElementById('gameCanvas');
const ctx       = canvas.getContext('2d');
const holdCvs   = document.getElementById('hold-cvs');
const holdCtx   = holdCvs.getContext('2d');
const nextCvs   = document.getElementById('next-cvs');
const nextCtx   = nextCvs.getContext('2d');

// ── HUD elements ────────────────────────────────────────────
const elScore  = document.getElementById('v-score');
const elHi     = document.getElementById('v-hi');
const elLevel  = document.getElementById('v-level');
const elLines  = document.getElementById('v-lines');
const elMenuHi = document.getElementById('menu-hi');

// ── Overlays ─────────────────────────────────────────────────
const ovMenu     = document.getElementById('ov-menu');
const ovPause    = document.getElementById('ov-pause');
const ovGameover = document.getElementById('ov-gameover');

document.getElementById('btn-start').onclick  = startGame;
document.getElementById('btn-retry').onclick  = startGame;
document.getElementById('btn-resume').onclick = resumeGame;
document.getElementById('btn-quit').onclick   = () => { phase = 'menu'; showOnly(ovMenu); };

// ── Game state ───────────────────────────────────────────────
let board;          // ROWS × COLS: null | color string
let current;        // { type, rot, x, y }
let held;           // piece type index or null
let holdUsed;       // bool – can only hold once per piece
let bag;            // remaining types in current 7-bag
let nextQ;          // array of 3 next type indices
let score, hiScore, level, lines, combo, btb;
let phase;          // 'menu'|'play'|'lineclear'|'pause'|'gameover'
let dropTimer;      // ms until auto-drop
let lockTimer;      // ms until auto-lock
let lockActive;     // whether lock delay is counting
let lockMoves;      // lock delay move resets remaining (max 15)
let lcTimer;        // line-clear animation timer (ms)
let lcRows;         // rows being cleared
let shakeT;         // screen shake timer
let lvlUpT;         // level-up flash timer
let particles;      // []
let lastTs;
let loopId;

hiScore = parseInt(localStorage.getItem('tetra-hi') || '0', 10);
elHi.textContent     = hiScore;
elMenuHi.textContent = hiScore;

// ── 7-bag randomizer ─────────────────────────────────────────
function refillBag() {
  bag = [0,1,2,3,4,5,6];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}
function nextType() {
  if (!bag.length) refillBag();
  return bag.pop();
}

// ── Speed (ms per row) ────────────────────────────────────────
function dropInterval() {
  // Level 1 = 800ms → Level 15 = ~80ms
  return Math.max(80, 800 - (level - 1) * 52);
}

// ── Board helpers ─────────────────────────────────────────────
function makeBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
}

function shape(type, rot) {
  return SHAPES[type][rot];
}

// Returns true if piece at (px,py) with rotation pr collides
function collides(type, rot, px, py) {
  const s = shape(type, rot);
  for (let r = 0; r < s.length; r++) {
    for (let c = 0; c < s[r].length; c++) {
      if (!s[r][c]) continue;
      const br = py + r, bc = px + c;
      if (bc < 0 || bc >= COLS || br >= ROWS) return true;
      if (br >= 0 && board[br][bc]) return true;
    }
  }
  return false;
}

// Stamp current piece onto board
function stamp() {
  const s = shape(current.type, current.rot);
  for (let r = 0; r < s.length; r++) {
    for (let c = 0; c < s[r].length; c++) {
      if (!s[r][c]) continue;
      const br = current.y + r, bc = current.x + c;
      if (br >= 0) board[br][bc] = COLORS[current.type];
    }
  }
}

// Compute ghost Y
function ghostRow() {
  let gy = current.y;
  while (!collides(current.type, current.rot, current.x, gy + 1)) gy++;
  return gy;
}

// ── Spawn ─────────────────────────────────────────────────────
function makePiece(type) {
  const s = shape(type, 0);
  const w = s[0].length;
  return { type, rot: 0, x: Math.floor((COLS - w) / 2), y: 0 };
}

// ── Rotation (SRS) ────────────────────────────────────────────
function tryRotate(dir) {  // dir: 1=CW, -1=CCW
  const newRot = ((current.rot + dir) + 4) % 4;
  const table  = current.type === 0 ? KICKS_I : KICKS;
  // For CCW we mirror the kick offsets
  for (let [dx, dy] of table[current.rot]) {
    if (dir === -1) { dx = -dx; dy = -dy; }
    if (!collides(current.type, newRot, current.x + dx, current.y + dy)) {
      current.rot = newRot;
      current.x  += dx;
      current.y  += dy;
      nudgeLock();
      return;
    }
  }
}

// ── Movement ──────────────────────────────────────────────────
function moveH(d) {
  if (!collides(current.type, current.rot, current.x + d, current.y)) {
    current.x += d;
    nudgeLock();
  }
}
function softDrop() {
  if (!collides(current.type, current.rot, current.x, current.y + 1)) {
    current.y++;
    score++;
    dropTimer = dropInterval();
    nudgeLock();
  }
}
function hardDrop() {
  const gy  = ghostRow();
  score    += (gy - current.y) * 2;
  current.y = gy;
  lock();
}
function hold() {
  if (holdUsed) return;
  holdUsed = true;
  const t  = current.type;
  current  = makePiece(held !== null ? held : nextQ.shift());
  if (held === null) nextQ.push(nextType());
  held     = t;
  dropTimer = dropInterval();
  lockActive = false;
}

// ── Lock delay ────────────────────────────────────────────────
function nudgeLock() {
  if (lockActive && lockMoves > 0) {
    lockTimer = 500;
    lockMoves--;
  }
}

function lock() {
  stamp();
  lockActive = false;
  holdUsed   = false;
  findClears();
}

// ── Line clearing ─────────────────────────────────────────────
function findClears() {
  lcRows = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(c => c !== null)) lcRows.push(r);
  }
  if (lcRows.length) {
    // Score
    const n = lcRows.length;
    const isTetris = n === 4;
    const base    = [0, 100, 300, 500, 800][n];
    const btbMul  = (isTetris && btb) ? 1.5 : 1;
    score += Math.floor(base * btbMul * level) + combo * 50 * level;
    combo++;
    btb   = isTetris;
    lines += n;

    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel > level) { level = newLevel; lvlUpT = 1800; }

    shakeT  = n === 4 ? 350 : 150;
    lcTimer = 180;
    phase   = 'lineclear';
    spawnLineParticles();
    updateHUD();
  } else {
    combo = 0;
    spawnNext();
  }
}

function applyClears() {
  for (const r of [...lcRows].sort((a, b) => b - a)) {
    board.splice(r, 1);
    board.unshift(new Array(COLS).fill(null));
  }
  lcRows = [];
  phase  = 'play';
  spawnNext();
}

// ── Next piece ────────────────────────────────────────────────
function spawnNext() {
  if (phase !== 'play') return;
  current   = makePiece(nextQ.shift());
  nextQ.push(nextType());
  dropTimer = dropInterval();
  lockActive = false;
  // Game over if spawn collides
  if (collides(current.type, current.rot, current.x, current.y)) {
    triggerGameOver();
  }
}

// ── Particles ─────────────────────────────────────────────────
function spawnLineParticles() {
  for (const r of lcRows) {
    for (let c = 0; c < COLS; c++) {
      const col = board[r][c] || '#fff';
      for (let i = 0; i < 4; i++) {
        particles.push({
          x:    c * CELL + CELL / 2,
          y:    r * CELL + CELL / 2,
          vx:   (Math.random() - 0.5) * 240,
          vy:   (Math.random() - 0.7) * 220,
          r:    Math.random() * 4 + 2,
          col,
          life: 1,
        });
      }
    }
  }
}

// ── HUD ───────────────────────────────────────────────────────
function updateHUD() {
  elScore.textContent = score;
  elLevel.textContent = level;
  elLines.textContent = lines;
  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem('tetra-hi', hiScore);
    elHi.textContent     = hiScore;
    elMenuHi.textContent = hiScore;
  }
}

// ── Drawing helpers ───────────────────────────────────────────
function drawCell(cx, x, y, size, color, ghost = false) {
  if (ghost) {
    cx.globalAlpha = 0.2;
    cx.strokeStyle = color;
    cx.lineWidth   = 1.5;
    cx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    cx.globalAlpha = 1;
    return;
  }
  // Base fill
  cx.fillStyle = color;
  cx.fillRect(x + 1, y + 1, size - 2, size - 2);
  // Top/left highlight
  cx.fillStyle = 'rgba(255,255,255,0.32)';
  cx.fillRect(x + 1, y + 1, size - 2, 3);
  cx.fillRect(x + 1, y + 1, 3, size - 2);
  // Bottom/right shadow
  cx.fillStyle = 'rgba(0,0,0,0.28)';
  cx.fillRect(x + 1, y + size - 4, size - 2, 3);
  cx.fillRect(x + size - 4, y + 1, 3, size - 2);
}

function drawPiece(cx, type, rot, px, py, cellSize, ghost = false) {
  const s = shape(type, rot);
  for (let r = 0; r < s.length; r++) {
    for (let c = 0; c < s[r].length; c++) {
      if (!s[r][c]) continue;
      drawCell(cx, (px + c) * cellSize, (py + r) * cellSize, cellSize, COLORS[type], ghost);
    }
  }
}

// ── Main board draw ───────────────────────────────────────────
function drawBoard() {
  // Background
  ctx.fillStyle = '#080812';
  ctx.fillRect(0, 0, W, H);
  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth   = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
  }
  // Placed cells
  for (let r = 0; r < ROWS; r++) {
    const flash = lcRows.includes(r) && lcTimer > 60;
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        if (flash) {
          ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(lcTimer * 0.08) * 0.35})`;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        } else {
          drawCell(ctx, c * CELL, r * CELL, CELL, board[r][c]);
        }
      }
    }
  }
}

function drawCurrent() {
  if (!current) return;
  // Ghost
  const gy = ghostRow();
  if (gy !== current.y) drawPiece(ctx, current.type, current.rot, current.x, gy, CELL, true);
  // Piece
  const s = shape(current.type, current.rot);
  for (let r = 0; r < s.length; r++) {
    for (let c = 0; c < s[r].length; c++) {
      if (!s[r][c]) continue;
      const br = current.y + r;
      if (br < 0) continue;
      drawCell(ctx, (current.x + c) * CELL, br * CELL, CELL, COLORS[current.type]);
    }
  }
}

function drawParticles(dt) {
  for (const p of particles) {
    p.x   += p.vx * dt / 1000;
    p.y   += p.vy * dt / 1000;
    p.vy  += 500 * dt / 1000;
    p.life -= dt * 0.0018;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.shadowColor = p.col;
    ctx.shadowBlur  = 6;
    ctx.fillStyle   = p.col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
  particles = particles.filter(p => p.life > 0);
}

function drawPieceInBox(cx, bw, bh, type) {
  cx.clearRect(0, 0, bw, bh);
  if (type === null || type === undefined) return;
  const s    = shape(type, 0);
  const rows = s.length, cols = s[0].length;
  const cs   = Math.min(Math.floor((bw - 10) / cols), Math.floor((bh - 10) / rows));
  const ox   = Math.floor((bw - cols * cs) / 2);
  const oy   = Math.floor((bh - rows * cs) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!s[r][c]) continue;
      drawCell(cx, ox + c * cs, oy + r * cs, cs, COLORS[type]);
    }
  }
  // Dim if holdUsed
  if (holdUsed && cx === holdCtx) {
    cx.fillStyle = 'rgba(0,0,0,0.5)';
    cx.fillRect(0, 0, bw, bh);
  }
}

function drawNextPanel() {
  const bh = Math.floor(nextCvs.height / 3);
  nextCtx.clearRect(0, 0, nextCvs.width, nextCvs.height);
  for (let i = 0; i < 3; i++) {
    const type = nextQ[i];
    if (type === undefined) continue;
    const s    = shape(type, 0);
    const rows = s.length, cols = s[0].length;
    const cs   = Math.min(Math.floor((nextCvs.width - 10) / cols), Math.floor((bh - 10) / rows));
    const ox   = Math.floor((nextCvs.width - cols * cs) / 2);
    const oy   = i * bh + Math.floor((bh - rows * cs) / 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!s[r][c]) continue;
        drawCell(nextCtx, ox + c * cs, oy + r * cs, cs, COLORS[type]);
      }
    }
  }
}

// ── Input (with DAS) ──────────────────────────────────────────
const DAS_DELAY = 155;  // ms before repeat starts
const DAS_RATE  = 40;   // ms per repeat step
const dasState  = {};   // code → { timeout, interval }

function dasStart(code, fn) {
  if (dasState[code]) return;
  fn();
  dasState[code] = {
    timeout: setTimeout(() => {
      dasState[code].interval = setInterval(fn, DAS_RATE);
    }, DAS_DELAY),
  };
}
function dasStop(code) {
  if (!dasState[code]) return;
  clearTimeout(dasState[code].timeout);
  clearInterval(dasState[code].interval);
  delete dasState[code];
}

window.addEventListener('keydown', e => {
  if (phase === 'menu' || phase === 'gameover') return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (phase === 'play' || phase === 'lineclear') pauseGame();
    else if (phase === 'pause') resumeGame();
    return;
  }
  if (phase === 'pause') return;
  if (phase !== 'play' && phase !== 'lineclear') return;
  if (phase === 'lineclear' && e.code !== 'Escape') return;

  switch (e.code) {
    case 'ArrowLeft':  e.preventDefault(); dasStart('ArrowLeft',  () => moveH(-1)); break;
    case 'ArrowRight': e.preventDefault(); dasStart('ArrowRight', () => moveH(1));  break;
    case 'ArrowDown':  e.preventDefault(); dasStart('ArrowDown',  softDrop);        break;
    case 'ArrowUp':    e.preventDefault(); tryRotate(1);  break;
    case 'KeyZ':       e.preventDefault(); tryRotate(-1); break;
    case 'KeyX':       e.preventDefault(); tryRotate(1);  break;
    case 'Space':      e.preventDefault(); hardDrop();    break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight': e.preventDefault(); hold(); break;
  }
});
window.addEventListener('keyup', e => {
  dasStop('ArrowLeft');
  dasStop('ArrowRight');
  dasStop('ArrowDown');
});

// ── Game flow ─────────────────────────────────────────────────
function startGame() {
  showOnly(null);
  board      = makeBoard();
  particles  = [];
  lcRows     = [];
  score = lines = combo = 0;
  level      = 1;
  btb        = false;
  held       = null;
  holdUsed   = false;
  shakeT     = 0;
  lvlUpT     = 0;
  bag        = [];

  nextQ = [nextType(), nextType(), nextType()];
  current    = makePiece(nextQ.shift());
  nextQ.push(nextType());
  dropTimer  = dropInterval();
  lockActive = false;
  lockMoves  = 15;

  phase  = 'play';
  lastTs = 0;
  updateHUD();
  cancelAnimationFrame(loopId);
  loopId = requestAnimationFrame(loop);
}

function pauseGame()  {
  if (phase !== 'play' && phase !== 'lineclear') return;
  phase = 'pause';
  showOnly(ovPause);
}
function resumeGame() {
  showOnly(null);
  phase  = 'play';
  lastTs = 0;
  loopId = requestAnimationFrame(loop);
}

function triggerGameOver() {
  phase = 'gameover';
  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem('tetra-hi', hiScore);
    elMenuHi.textContent = hiScore;
  }
  document.getElementById('go-score').textContent = score;
  document.getElementById('go-level').textContent = level;
  document.getElementById('go-lines').textContent = lines;
  document.getElementById('go-hi').textContent    = hiScore;
  elHi.textContent = hiScore;
  setTimeout(() => showOnly(ovGameover), 500);
}

function showOnly(el) {
  [ovMenu, ovPause, ovGameover].forEach(o => o.classList.remove('active'));
  if (el) el.classList.add('active');
}

// ── Main loop ─────────────────────────────────────────────────
function loop(ts) {
  if (phase === 'menu' || phase === 'gameover') return;
  loopId = requestAnimationFrame(loop);

  const dt  = Math.min(ts - (lastTs || ts), 100);
  lastTs    = ts;

  // ── Physics update ──
  if (phase === 'play') {
    dropTimer -= dt;
    if (dropTimer <= 0) {
      if (!collides(current.type, current.rot, current.x, current.y + 1)) {
        current.y++;
        dropTimer  = dropInterval();
        lockActive = false;
        lockMoves  = 15;
      } else {
        if (!lockActive) { lockActive = true; lockTimer = 500; lockMoves = 15; }
        dropTimer = dropInterval();
      }
    }

    if (lockActive) {
      lockTimer -= dt;
      if (lockTimer <= 0) lock();
    } else if (collides(current.type, current.rot, current.x, current.y + 1)) {
      lockActive = true;
      lockTimer  = 500;
      lockMoves  = 15;
    }
  }

  if (phase === 'lineclear') {
    lcTimer -= dt;
    if (lcTimer <= 0) applyClears();
  }

  if (shakeT  > 0) shakeT  -= dt;
  if (lvlUpT > 0) lvlUpT -= dt;

  // ── Render ──
  const sx = shakeT > 0 ? (Math.random() - 0.5) * 7 : 0;
  const sy = shakeT > 0 ? (Math.random() - 0.5) * 7 : 0;
  ctx.save();
  ctx.translate(sx, sy);

  drawBoard();
  if (phase === 'play') drawCurrent();
  drawParticles(dt);

  if (lvlUpT > 0) {
    const a = Math.min(1, lvlUpT / 400);
    ctx.fillStyle   = `rgba(255,255,255,${a * 0.12})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ctx.font        = '900 26px Orbitron, sans-serif';
    ctx.fillStyle   = '#fff';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#c040ff';
    ctx.shadowBlur  = 20;
    ctx.fillText('NIVEL ' + level, W / 2, H / 2 - 10);
    ctx.font        = '700 11px Orbitron, sans-serif';
    ctx.fillText('¡SUBISTE DE NIVEL!', W / 2, H / 2 + 16);
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  ctx.restore();
  drawNextPanel();
  drawPieceInBox(holdCtx, holdCvs.width, holdCvs.height, held);
}

// ── Boot ──────────────────────────────────────────────────────
phase = 'menu';
showOnly(ovMenu);
