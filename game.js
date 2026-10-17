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

// theme is a user preference, not game state: deliberately not reset by init()
let theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo, maxCombo, lastRecord;

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
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  updateCombo(cleared);
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
  const light = theme === 'light';
  const color = (light ? COLORS_LIGHT : COLORS)[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = light ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
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
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (recordsKeydown(e)) return;
  if (e.code === 'KeyP') { togglePause(); return; }
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
});

applyTheme();

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

showStartScreen();
