'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

// Darker variants of COLORS for light backgrounds (same index alignment)
const COLORS_LIGHT = [
  null,
  '#00acc1', // I
  '#f9a825', // O
  '#8e24aa', // T
  '#43a047', // S
  '#e53935', // Z
  '#1e88e5', // J
  '#fb8c00', // L
];

// ---- Skins ----
// Each skin has a palette index-aligned with PIECES (null at 0), an optional
// `colorsLight` used with the light theme, and a drawCell(context, px, py, size, color, alpha)
// painter. drawBlock() sets globalAlpha before delegating, so painters must not apply `alpha` again
// (it is passed for skins that want to tweak effects for translucent ghost cells).
// Board background / grid overrides live in style.css under [data-skin].

// Rounded rectangle path built from arcTo (no reliance on roundRect support)
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  // Retro: the original flat look
  retro: {
    colors: COLORS,
    colorsLight: COLORS_LIGHT,
    drawCell(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = theme === 'light' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  // Neon: the board is always black for this skin, so one saturated palette serves both themes
  neon: {
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff1744', '#2979ff', '#ff9100'],
    // shadowBlur is expensive, so each color/size glow is rendered once into a cached sprite
    sprites: new Map(),
    sprite(size, color) {
      const key = `${size}|${color}`;
      let sprite = this.sprites.get(key);
      if (sprite) return sprite;
      const pad = size; // room for the glow to spread past the cell
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = size + pad * 2;
      const c = sprite.getContext('2d');
      c.shadowColor = color;
      c.shadowBlur = size * 0.5;
      c.fillStyle = color;
      c.fillRect(pad + 2, pad + 2, size - 4, size - 4);
      // reset so the dark core and highlight don't get their own glow
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(pad + 6, pad + 6, size - 12, size - 12);
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillRect(pad + 3, pad + 3, size - 6, 1);
      this.sprites.set(key, sprite);
      return sprite;
    },
    drawCell(context, px, py, size, color) {
      context.drawImage(this.sprite(size, color), px - size, py - size);
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fff1a8', '#d7b8f3', '#b8e6b8', '#f7b2b7', '#b3d4fc', '#ffd3a8'],
    colorsLight: [null, '#7fd3e0', '#f5dc6e', '#c39ce8', '#94d394', '#f08f97', '#8fbcf5', '#ffbd80'],
    drawCell(context, px, py, size, color) {
      const r = size * 0.25;
      roundedRectPath(context, px + 2, py + 2, size - 4, size - 4, r);
      context.fillStyle = color;
      context.fill();
      // soft sheen on the upper half
      roundedRectPath(context, px + 5, py + 4, size - 10, (size - 8) / 2, r / 2);
      context.fillStyle = 'rgba(255,255,255,0.3)';
      context.fill();
    },
  },
  pixel: {
    colors: [null, '#3cbcfc', '#fcd800', '#b853f8', '#58d854', '#f83800', '#0078f8', '#fc9838'],
    colorsLight: [null, '#0088d8', '#d8a800', '#9020d8', '#20a820', '#d82800', '#0058d0', '#e07000'],
    drawCell(context, px, py, size, color) {
      const p = Math.max(2, Math.round(size / 10)); // texture "pixel" (3px at size 30)
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      // bevel: light top/left, dark bottom/right
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(px, py, size, p);
      context.fillRect(px, py, p, size);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(px, py + size - p, size, p);
      context.fillRect(px + size - p, py, p, size);
      // deterministic dither: checkerboard of p×p dots inside the bevel
      context.fillStyle = 'rgba(0,0,0,0.14)';
      for (let i = 2; (i + 3) * p <= size; i++)
        for (let j = 2; (j + 3) * p <= size; j++)
          if ((i + j) % 2 === 0) context.fillRect(px + j * p, py + i * p, p, p);
      // shine pixel
      context.fillStyle = 'rgba(255,255,255,0.8)';
      context.fillRect(px + p, py + p, p, p);
    },
  },
};

function isSkin(name) {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(SKINS, name);
}

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-btn');
const skinSelect = document.getElementById('skin-select');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelItem = document.getElementById('start-level-item');
const startLevelValue = document.getElementById('start-level-value');
const startLevelDec = document.getElementById('start-level-dec');
const startLevelInc = document.getElementById('start-level-inc');
// keyboard-navigable entries of the pause menu, in visual order
const pauseMenuItems = [resumeBtn, pauseRestartBtn, controlsBtn, startLevelItem];

const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 10;

// theme is a user preference, not game state: deliberately not reset by init()
let theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
// skin is a preference too; the inline <head> script pre-applies data-skin from localStorage
let skin = isSkin(document.documentElement.dataset.skin) ? document.documentElement.dataset.skin : 'retro';

// startLevel is also a preference: chosen in the pause menu, applied on the next init()
let startLevel = MIN_START_LEVEL;
try {
  const saved = parseInt(localStorage.getItem('startLevel'), 10);
  if (saved >= MIN_START_LEVEL && saved <= MAX_START_LEVEL) startLevel = saved;
} catch (e) {}

// baseLevel: the startLevel snapshot this game began with (changing the preference mid-game must not affect it)
let board, current, next, score, lines, level, baseLevel, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo, maxCombo, lastRecord;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + baseLevel;
    dropInterval = dropIntervalFor(level);
    updateHUD();
  }
  updateCombo(cleared);
}

function dropIntervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const s = SKINS[skin];
  const palette = theme === 'light' && s.colorsLight ? s.colorsLight : s.colors;
  const a = alpha ?? 1;
  // save/restore so no skin's canvas state (alpha, shadow, ...) leaks into the grid or other cells
  context.save();
  context.globalAlpha = a;
  s.drawCell(context, x * size, y * size, size, palette[colorIndex], a);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, theme === 'light' ? 0.3 : 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    // dropAccum is kept on purpose: zeroing it would let pause-spamming hold a piece in the air
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() may have run inside this frame; its cancelAnimationFrame can't stop the frame already executing
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = dropIntervalFor(level);
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  lastRecord = null;
  lastTime = performance.now();
  hideGameOverRecords();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  closePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (recordsKeydown(e)) return;
  if (handlePauseMenuKey(e)) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat) togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme() {
  const light = theme === 'light';
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  themeBtn.textContent = light ? '🌙' : '☀';
  const label = light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
  themeBtn.setAttribute('aria-label', label);
  themeBtn.title = label;
  themeBtn.setAttribute('aria-pressed', String(light));
}

themeBtn.addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light';
  applyTheme();
  try { localStorage.setItem('theme', theme); } catch (e) {}
  // repaint now: the loop is not running while paused or on game over
  draw();
  drawNext();
  // avoid Space re-triggering the button instead of hardDrop
  themeBtn.blur();
  if (isPauseMenuOpen()) resumeBtn.focus({ preventScroll: true });
});

function applySkin() {
  document.documentElement.dataset.skin = skin;
  skinSelect.value = skin;
}

skinSelect.addEventListener('change', () => {
  if (!isSkin(skinSelect.value)) return;
  skin = skinSelect.value;
  applySkin();
  try { localStorage.setItem('skin', skin); } catch (e) {}
  // repaint now: the loop is not running while paused or on game over
  draw();
  drawNext();
  // hand the keyboard back to the game (Space/arrows must not re-trigger the select)
  skinSelect.blur();
});

// If the select keeps focus (e.g. it was opened and closed without a change), game keys
// must not also drive the select: cancel its default action, release focus, and let the
// event bubble to the game's keydown handler as usual.
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyX', 'KeyP'];
skinSelect.addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.code) || e.code === 'Escape') {
    e.preventDefault();
    skinSelect.blur();
  }
});

applyTheme();
applySkin();

// ---- Local records (top 5 + best combo + max lines) ----

const RECORDS_KEY = 'records';
const RECORDS_MAX = 5;
const DEFAULT_NAME = 'Jugador';

const startScreen = document.getElementById('start-screen');
const startRecordsTable = document.getElementById('start-records-table');
const playBtn = document.getElementById('play-btn');
const startClearBtn = document.getElementById('start-clear-btn');
const gameoverRecords = document.getElementById('gameover-records');
const gameoverStats = document.getElementById('gameover-stats');
const gameoverRecordsTable = document.getElementById('gameover-records-table');
const gameoverClearBtn = document.getElementById('gameover-clear-btn');
const newRecordMsg = document.getElementById('new-record-msg');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || typeof data !== 'object') return emptyRecords();
    const num = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    const top = Array.isArray(data.top) ? data.top
      .filter(r => r && typeof r === 'object' && Number.isFinite(r.score))
      .map(r => ({
        name: String(r.name ?? DEFAULT_NAME).slice(0, 12),
        score: num(r.score),
        lines: num(r.lines),
        combo: num(r.combo),
        date: String(r.date ?? ''),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RECORDS_MAX) : [];
    return { top, bestCombo: num(data.bestCombo), maxLines: num(data.maxLines) };
  } catch (e) {
    return emptyRecords();
  }
}

// In-memory copy is the source of truth for the UI; storage is best-effort (may be blocked or full).
// Persistent data across games, so deliberately not reset by init().
let records = loadRecords();
// UI state: true while the start screen waits for Enter / Jugar
let onStartScreen = false;

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

function qualifiesForTop(s) {
  if (s <= 0) return false;
  return records.top.length < RECORDS_MAX || s > records.top[records.top.length - 1].score;
}

// Inserts entry keeping descending order; ties go after existing entries
function insertRecord(entry) {
  let i = records.top.findIndex(r => entry.score > r.score);
  if (i === -1) i = records.top.length;
  records.top.splice(i, 0, entry);
  records.top = records.top.slice(0, RECORDS_MAX);
}

function updateCombo(cleared) {
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
}

// Builds the table with DOM APIs only: player names are user data, never innerHTML
function renderRecords(container, highlight) {
  container.replaceChildren();
  if (!records.top.length) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Sin records todavía';
    container.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'records-table';
    const head = table.createTHead().insertRow();
    for (const h of ['#', 'Nombre', 'Puntos', 'Lín.', 'Combo']) {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    }
    const body = table.createTBody();
    records.top.forEach((r, i) => {
      const row = body.insertRow();
      if (r === highlight) row.className = 'highlight';
      if (r.date) row.title = new Date(r.date).toLocaleString('es');
      for (const v of [i + 1, r.name, r.score.toLocaleString(), r.lines, r.combo]) {
        row.insertCell().textContent = v;
      }
    });
    container.appendChild(table);
  }
  const stats = document.createElement('p');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${records.bestCombo} · Máx. líneas: ${records.maxLines}`;
  container.appendChild(stats);
}

function renderAllRecords() {
  renderRecords(gameoverRecordsTable, lastRecord);
  renderRecords(startRecordsTable, null);
}

function nameFormOpen() {
  return gameOver && lastRecord !== null && !nameForm.classList.contains('hidden');
}

// Hook called at the end of endGame()
function showGameOverRecords() {
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);

  // A qualifying score is saved right away under the default name, so restarting or closing
  // the tab never loses it; the name form only renames that entry
  const qualifies = qualifiesForTop(score);
  if (qualifies) {
    lastRecord = { name: DEFAULT_NAME, score, lines, combo: maxCombo, date: new Date().toISOString() };
    insertRecord(lastRecord);
    nameInput.value = DEFAULT_NAME;
  }
  saveRecords();

  gameoverStats.textContent = `Líneas: ${lines} · Combo máx.: ${maxCombo}`;
  newRecordMsg.classList.toggle('hidden', !qualifies);
  nameForm.classList.toggle('hidden', !qualifies);
  renderAllRecords();
  gameoverRecords.classList.remove('hidden');
}

// Hook called from init()
function hideGameOverRecords() {
  gameoverRecords.classList.add('hidden');
  nameForm.classList.add('hidden');
  newRecordMsg.classList.add('hidden');
  nameInput.blur();
}

function saveRecordName() {
  if (!lastRecord) return;
  lastRecord.name = nameInput.value.trim().slice(0, 12) || DEFAULT_NAME;
  saveRecords();
  nameForm.classList.add('hidden');
  nameInput.blur();
  renderAllRecords();
}

function clearRecords() {
  if (!confirm('¿Borrar todos los records? Esta acción no se puede deshacer.')) return;
  records = emptyRecords();
  // the current game's entry was erased too: nothing left to rename or highlight
  lastRecord = null;
  nameForm.classList.add('hidden');
  newRecordMsg.classList.add('hidden');
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
  renderAllRecords();
}

function showStartScreen() {
  // init() builds a fresh board/piece so draw() (also used by the theme toggle) has state to paint,
  // then the loop is stopped until the player starts
  init();
  cancelAnimationFrame(animId);
  draw();
  onStartScreen = true;
  renderAllRecords();
  startScreen.classList.remove('hidden');
}

function startGame() {
  if (!onStartScreen) return;
  onStartScreen = false;
  startScreen.classList.add('hidden');
  playBtn.blur();
  init();
}

// Document-level keydown hook. Returns true when the event was consumed and must not reach the game controls
function recordsKeydown(e) {
  const enter = e.code === 'Enter' || e.code === 'NumpadEnter';
  if (onStartScreen) {
    if (enter) {
      e.preventDefault();
      startGame();
    }
    return true;
  }
  // Enter saves the name even when the field isn't focused (it isn't auto-focused, so keys
  // pressed as the game ends can't overwrite the name)
  if (enter && nameFormOpen() && document.activeElement !== restartBtn) {
    e.preventDefault();
    saveRecordName();
    return true;
  }
  return false;
}

// Typing in the name field never reaches the game controls
nameInput.addEventListener('keydown', e => e.stopPropagation());

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  saveRecordName();
});

playBtn.addEventListener('click', startGame);
startClearBtn.addEventListener('click', () => { clearRecords(); startClearBtn.blur(); });
gameoverClearBtn.addEventListener('click', () => { clearRecords(); gameoverClearBtn.blur(); });


// ---- Pause menu ----

function isPauseMenuOpen() {
  // `paused` is the single source of truth; the menu is shown exactly while paused
  return paused && !gameOver;
}

function openPauseMenu() {
  renderStartLevel();
  pauseMenu.classList.remove('hidden');
  resumeBtn.focus({ preventScroll: true });
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
  setControlsVisible(false);
  // drop focus so Space/Enter go to the game instead of re-clicking a menu button
  if (pauseMenu.contains(document.activeElement)) document.activeElement.blur();
}

function setControlsVisible(visible) {
  pauseControls.classList.toggle('hidden', !visible);
  controlsBtn.setAttribute('aria-expanded', String(visible));
  controlsBtn.textContent = visible ? 'Ocultar controles' : 'Ver controles';
}

function renderStartLevel() {
  startLevelValue.textContent = startLevel;
  startLevelItem.setAttribute('aria-valuemin', String(MIN_START_LEVEL));
  startLevelItem.setAttribute('aria-valuemax', String(MAX_START_LEVEL));
  startLevelItem.setAttribute('aria-valuenow', String(startLevel));
  startLevelDec.disabled = startLevel <= MIN_START_LEVEL;
  startLevelInc.disabled = startLevel >= MAX_START_LEVEL;
}

function setStartLevel(value) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, value));
  try { localStorage.setItem('startLevel', String(startLevel)); } catch (e) {}
  renderStartLevel();
}

function focusPauseMenuItem(delta) {
  let idx = pauseMenuItems.indexOf(document.activeElement);
  if (startLevelItem.contains(document.activeElement)) idx = pauseMenuItems.indexOf(startLevelItem);
  idx = idx === -1 ? 0 : (idx + delta + pauseMenuItems.length) % pauseMenuItems.length;
  pauseMenuItems[idx].focus({ preventScroll: true });
}

// Returns true when the open pause menu consumed the key, so the game never sees it.
function handlePauseMenuKey(e) {
  if (!isPauseMenuOpen()) return false;
  const onLevel = startLevelItem.contains(document.activeElement);
  switch (e.code) {
    case 'KeyP':
    case 'Escape':
      e.preventDefault();
      if (!e.repeat) togglePause();
      break;
    case 'Tab':
      // keep focus trapped inside the modal menu
      e.preventDefault();
      focusPauseMenuItem(e.shiftKey ? -1 : 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      focusPauseMenuItem(-1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      focusPauseMenuItem(1);
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault();
      if (onLevel) setStartLevel(startLevel + (e.code === 'ArrowRight' ? 1 : -1));
      break;
    case 'Enter':
    case 'NumpadEnter':
    case 'Space':
      if (onLevel) {
        // cycle 1..10 so Enter alone can reach any level
        e.preventDefault();
        setStartLevel(startLevel >= MAX_START_LEVEL ? MIN_START_LEVEL : startLevel + 1);
      } else if (!pauseMenu.contains(document.activeElement)) {
        // nothing in the menu is focused: don't scroll or activate something outside it
        e.preventDefault();
      }
      // otherwise the focused menu button activates natively (its click handler)
      break;
  }
  return true;
}

resumeBtn.addEventListener('click', () => { if (paused) togglePause(); });
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  setControlsVisible(pauseControls.classList.contains('hidden'));
});
startLevelDec.addEventListener('click', () => {
  setStartLevel(startLevel - 1);
  startLevelItem.focus({ preventScroll: true });
});
startLevelInc.addEventListener('click', () => {
  setStartLevel(startLevel + 1);
  startLevelItem.focus({ preventScroll: true });
});

showStartScreen();
