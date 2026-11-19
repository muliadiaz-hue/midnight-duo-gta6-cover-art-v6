// Midnight Duo — editor shell.
//
// Owns the app state (words, grade, size, one photo slot per panel with
// its zoom/pan), wires the controls in index.html, and repaints the stage
// canvas through cover.js. It also serves the screenshot harness: with
// ?shot=cover the chrome is hidden and only the cover is drawn at the
// requested size; with ?shot=editor the full editor is shown with the
// sample photos loaded. Nothing is ever uploaded — photos are read on
// this machine only.

import { SIZES, GRADES, paintCover, bandRects, defaultHeroFraming } from './cover.js';

const SAMPLES = {
  hero: 'samples/duo.jpg',
  car: 'samples/car.jpg',
  heli: 'samples/heli.jpg',
  dj: 'samples/dj.jpg',
  boat: 'samples/boat.jpg',
};
const PANELS = ['hero', 'car', 'heli', 'dj', 'boat'];
const PANEL_LABELS = { hero: 'Hero · duo', car: 'Car', heli: 'Helicopter', dj: 'DJ', boat: 'Boat' };

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot') || '';
const isCoverShot = shotMode === 'cover';

const state = {
  size: params.get('size') || 'wide',
  grade: params.get('grade') || 'photo',
  words: {
    title: 'MIDNIGHT DUO',
    city: 'AZURA BAY',
    tagline: 'TWO LEADS · ONE SCORE',
    sash: 'ONE NIGHT ONLY',
    showSash: true,
  },
  photos: {},
  selected: 'hero',
};

// One history stack for undo/redo of words + framing (not photo swaps).
const history = [];
let historyAt = -1;

function snapshot() {
  return JSON.stringify({
    words: state.words,
    grade: state.grade,
    size: state.size,
    framing: Object.fromEntries(PANELS.map((p) => [p, { zoom: state.photos[p].zoom, dx: state.photos[p].dx, dy: state.photos[p].dy }])),
  });
}

function pushHistory() {
  history.length = historyAt + 1;
  history.push(snapshot());
  if (history.length > 60) history.shift();
  historyAt = history.length - 1;
  syncHistoryButtons();
}

function restoreHistory(json) {
  const data = JSON.parse(json);
  state.words = data.words;
  state.grade = data.grade;
  state.size = data.size;
  for (const p of PANELS) Object.assign(state.photos[p], data.framing[p]);
  syncControls();
  repaint();
}

function syncHistoryButtons() {
  const undo = document.getElementById('undoBtn');
  const redo = document.getElementById('redoBtn');
  if (!undo) return;
  undo.disabled = historyAt <= 0;
  redo.disabled = historyAt >= history.length - 1;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${src}`));
    img.src = src;
  });
}

async function loadSamples() {
  for (const p of PANELS) {
    const img = await loadImage(SAMPLES[p]);
    const framing = p === 'hero' ? defaultHeroFraming(state.size) : { zoom: 1, dx: 0, dy: 0 };
    state.photos[p] = { img, ...framing };
  }
}

function currentWords() {
  return { ...state.words };
}

function repaint() {
  const stage = document.getElementById('stage');
  paintCover(stage, state.photos, currentWords(), state.size, state.grade);
  if (!isCoverShot) fitStageToBox();
  window.__midnightDuoReady = true;
}

// Scale the stage canvas (drawn at export resolution) into its box.
function fitStageToBox() {
  const stage = document.getElementById('stage');
  const box = document.getElementById('stageBox');
  if (!box) return;
  const size = SIZES[state.size];
  const boxW = box.clientWidth;
  const boxH = box.clientHeight;
  const scale = Math.min(boxW / size.w, boxH / size.h);
  stage.style.width = `${Math.floor(size.w * scale)}px`;
  stage.style.height = `${Math.floor(size.h * scale)}px`;
}

// Which panel rect sits under a point on the displayed canvas.
function panelAtPoint(clientX, clientY) {
  const stage = document.getElementById('stage');
  const rect = stage.getBoundingClientRect();
  const size = SIZES[state.size];
  const px = ((clientX - rect.left) / rect.width) * size.w;
  const py = ((clientY - rect.top) / rect.height) * size.h;
  const { hero, grid } = bandRects(state.size, size.w, size.h);
  const inside = (r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  if (inside(hero)) return 'hero';
  const order = ['car', 'heli', 'dj', 'boat'];
  for (let i = 0; i < grid.length; i++) if (inside(grid[i])) return order[i];
  return null;
}

function selectPanel(name) {
  state.selected = name;
  document.querySelectorAll('.thumb').forEach((el) => {
    el.classList.toggle('active', el.dataset.panel === name);
  });
  const hint = document.getElementById('panelHint');
  if (hint) hint.textContent = `Selected: ${PANEL_LABELS[name]} — drag to pan, scroll to zoom.`;
}

function bindCanvasGestures() {
  const stage = document.getElementById('stage');
  let drag = null;
  stage.addEventListener('pointerdown', (ev) => {
    const panel = panelAtPoint(ev.clientX, ev.clientY);
    if (!panel) return;
    selectPanel(panel);
    drag = { x: ev.clientX, y: ev.clientY, panel };
    stage.setPointerCapture(ev.pointerId);
  });
  stage.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const rect = stage.getBoundingClientRect();
    const size = SIZES[state.size];
    const photo = state.photos[drag.panel];
    // Pan in fractions of the dragged panel: stage pixels -> cover pixels
    // -> panel fractions, applied incrementally from the last pointer spot.
    const { hero, grid } = bandRects(state.size, size.w, size.h);
    const target = drag.panel === 'hero' ? hero : grid[['car', 'heli', 'dj', 'boat'].indexOf(drag.panel)];
    photo.dx += ((ev.clientX - drag.x) / rect.width) * (size.w / target.w);
    photo.dy += ((ev.clientY - drag.y) / rect.height) * (size.h / target.h);
    drag.x = ev.clientX;
    drag.y = ev.clientY;
    repaint();
  });
  stage.addEventListener('pointerup', () => {
    if (drag) { drag = null; pushHistory(); }
  });
  stage.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const panel = panelAtPoint(ev.clientX, ev.clientY) || state.selected;
    const photo = state.photos[panel];
    photo.zoom = Math.min(3, Math.max(0.5, photo.zoom * (ev.deltaY < 0 ? 1.08 : 0.93)));
    repaint();
  }, { passive: false });
}

function bindControls() {
  const byId = (id) => document.getElementById(id);

  // Caption fields.
  for (const key of ['title', 'city', 'tagline', 'sash']) {
    const input = byId(`${key}Input`);
    if (!input) continue;
    input.addEventListener('input', () => {
      state.words[key] = input.value;
      repaint();
    });
    input.addEventListener('change', pushHistory);
  }
  const sashBox = byId('sashToggle');
  if (sashBox) {
    sashBox.addEventListener('change', () => {
      state.words.showSash = sashBox.checked;
      repaint();
      pushHistory();
    });
  }

  // Grade + size.
  const gradeSel = byId('gradeSelect');
  if (gradeSel) {
    gradeSel.addEventListener('change', () => {
      state.grade = gradeSel.value;
      repaint();
      pushHistory();
    });
  }
  document.querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.size === btn.dataset.size) return;
      state.size = btn.dataset.size;
      state.photos.hero = { ...state.photos.hero, ...defaultHeroFraming(state.size) };
      document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b === btn));
      syncControls();
      repaint();
      pushHistory();
    });
  });

  // Photo thumbnails + upload.
  document.querySelectorAll('.thumb').forEach((el) => {
    el.addEventListener('click', () => selectPanel(el.dataset.panel));
  });
  const upload = byId('uploadInput');
  if (upload) {
    upload.addEventListener('change', async () => {
      const file = upload.files && upload.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        state.photos[state.selected] = { img, zoom: 1, dx: 0, dy: 0 };
        const thumb = document.querySelector(`.thumb[data-panel="${state.selected}"] img`);
        if (thumb) thumb.src = url;
        repaint();
        pushHistory();
      } finally {
        upload.value = '';
      }
    });
  }

  // Undo / redo / export.
  const undo = byId('undoBtn');
  if (undo) undo.addEventListener('click', () => {
    if (historyAt <= 0) return;
    historyAt -= 1;
    restoreHistory(history[historyAt]);
    syncHistoryButtons();
  });
  const redo = byId('redoBtn');
  if (redo) redo.addEventListener('click', () => {
    if (historyAt >= history.length - 1) return;
    historyAt += 1;
    restoreHistory(history[historyAt]);
    syncHistoryButtons();
  });
  const exportBtn = byId('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportPng);
}

function syncControls() {
  const byId = (id) => document.getElementById(id);
  for (const key of ['title', 'city', 'tagline', 'sash']) {
    const input = byId(`${key}Input`);
    if (input) input.value = state.words[key];
  }
  const sashBox = byId('sashToggle');
  if (sashBox) sashBox.checked = state.words.showSash;
  const gradeSel = byId('gradeSelect');
  if (gradeSel) gradeSel.value = state.grade;
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
  selectPanel(state.selected);
}

function exportPng() {
  const off = document.createElement('canvas');
  paintCover(off, state.photos, currentWords(), state.size, state.grade);
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `midnight-duo-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

async function boot() {
  window.__midnightDuoReady = false;
  await document.fonts.load('100px "Passion One"');
  await document.fonts.load('100px Anton');
  await document.fonts.ready;
  await loadSamples();

  if (isCoverShot) {
    document.body.classList.add('shot-cover');
    const stage = document.getElementById('stage');
    // The shot harness sizes the viewport to the cover's aspect; the
    // canvas keeps its export resolution internally and fills the box.
    stage.style.width = '100%';
    stage.style.height = '100%';
    repaint();
    return;
  }

  bindControls();
  bindCanvasGestures();
  syncControls();
  repaint();
  pushHistory();
  window.addEventListener('resize', fitStageToBox);
}

boot().catch((err) => {
  console.error(err);
  const stage = document.getElementById('stage');
  if (stage) stage.insertAdjacentHTML('afterend', `<p class="error">Failed to start: ${err.message}</p>`);
});
