// Midnight Duo — cover painter.
//
// Draws one GTA-style band poster onto a canvas: a big hero photo on one
// side (or on top), a 2x2 grid of scene photos, and the wordmark block
// (city, one-line title, tagline) plus the corner sash. Everything is
// computed from the canvas size, so the same painter serves the live
// preview and the PNG export at any of the four post sizes.
//
// Photos arrive as { img, zoom, dx, dy } per panel. dx/dy are pan offsets
// in fractions of the panel; zoom is a multiplier on the cover fit.
// Grades: "photo" leaves pixels alone, "sunset" warms them, "neon" pushes
// saturation and a magenta/cyan split. Grain comes from a fixed seed, so
// two renders of the same state are byte-identical.

export const SIZES = {
  wide: { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
  square: { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  story: { w: 1080, h: 1920, label: 'Story 1080 × 1920' },
};

export const GRADES = {
  photo: { label: 'Photographic', filter: 'none' },
  sunset: { label: 'Sunset', filter: 'saturate(1.18) sepia(0.22) contrast(1.04)' },
  neon: { label: 'Neon', filter: 'saturate(1.38) contrast(1.08)' },
};

const TITLE_GRADIENT = ['#7b2ff7', '#e0218a', '#ff9a3d'];
const INK = '#170a26';
const SASH_PINK = '#e0218a';
const TAGLINE_YELLOW = '#ffd23e';

// Fixed-seed PRNG (mulberry32) so the grain pass is deterministic.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cover-fit a photo into a rectangle, honouring zoom and pan.
function paintPhoto(ctx, photo, x, y, w, h) {
  const img = photo.img;
  if (!img || !img.naturalWidth) {
    ctx.fillStyle = '#241533';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const zoom = photo.zoom || 1;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const ox = x + (w - dw) / 2 + (photo.dx || 0) * w;
  const oy = y + (h - dh) / 2 + (photo.dy || 0) * h;
  ctx.drawImage(img, ox, oy, dw, dh);
}

// A five-point star centred at (cx, cy) with outer radius r.
function paintStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function fitFont(ctx, text, fontFamily, maxWidth, startPx) {
  let px = startPx;
  ctx.font = `${px}px ${fontFamily}`;
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = `${px}px ${fontFamily}`;
  }
  return px;
}

// The wordmark block: city line with stars, the one-line gradient title,
// and the tagline. Anchored to the hero rectangle.
function paintWordmark(ctx, hero, words) {
  const { x: hx, y: hy, w: hw, h: hh } = hero;

  // Darken the hero's lower third so the lettering reads on any photo.
  const scrim = ctx.createLinearGradient(0, hy + hh * 0.52, 0, hy + hh);
  scrim.addColorStop(0, 'rgba(8,2,18,0)');
  scrim.addColorStop(1, 'rgba(8,2,18,0.62)');
  ctx.fillStyle = scrim;
  ctx.fillRect(hx, hy + hh * 0.52, hw, hh * 0.48);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // City line: ★ AZURA BAY ★ in Anton, tracked out, white.
  const citySize = Math.round(hh * 0.052);
  ctx.font = `${citySize}px Anton, sans-serif`;
  const cityText = (words.city || '').toUpperCase();
  const gap = citySize * 0.42;
  const cityW = ctx.measureText(cityText).width;
  const starR = citySize * 0.42;
  const totalW = cityW + (starR * 2 + gap) * 2;
  const cy = hy + hh * 0.735;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = citySize * 0.25;
  ctx.fillText(cityText, hx + hw / 2, cy);
  paintStar(ctx, hx + hw / 2 - totalW / 2 + starR, cy - citySize * 0.32, starR);
  paintStar(ctx, hx + hw / 2 + totalW / 2 - starR, cy - citySize * 0.32, starR);
  ctx.shadowBlur = 0;

  // Title: one line, Passion One, sunset gradient, heavy ink outline.
  const titleText = (words.title || '').toUpperCase();
  const titlePx = fitFont(ctx, titleText, '"Passion One", sans-serif', hw * 0.96, Math.round(hh * 0.19));
  const titleY = hy + hh * 0.885;
  const grad = ctx.createLinearGradient(0, titleY - titlePx, 0, titleY + titlePx * 0.12);
  grad.addColorStop(0, TITLE_GRADIENT[0]);
  grad.addColorStop(0.55, TITLE_GRADIENT[1]);
  grad.addColorStop(1, TITLE_GRADIENT[2]);
  ctx.font = `${titlePx}px "Passion One", sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(4, titlePx * 0.085);
  ctx.strokeText(titleText, hx + hw / 2, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(titleText, hx + hw / 2, titleY);

  // Tagline: Anton, tracked out, sunset yellow.
  const tagSize = Math.round(hh * 0.036);
  ctx.font = `${tagSize}px Anton, sans-serif`;
  ctx.fillStyle = TAGLINE_YELLOW;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = tagSize * 0.3;
  const tagText = (words.tagline || '').toUpperCase();
  ctx.fillText(tagText, hx + hw / 2, hy + hh * 0.955);
  ctx.shadowBlur = 0;
}

// The magenta corner sash: a band rotated across the hero's top-left corner.
function paintSash(ctx, hero, words) {
  if (!words.showSash) return;
  const { x: hx, y: hy, w: hw, h: hh } = hero;
  const bandH = hh * 0.072;
  const text = (words.sash || '').toUpperCase();
  ctx.save();
  // Cross the top-left corner on a shallow diagonal (~-21 deg), so the
  // whole word stays inside the frame: left end near the left edge,
  // right end just under the top edge.
  ctx.translate(hx + hw * 0.14, hy + hh * 0.09);
  ctx.rotate(-0.36);
  ctx.fillStyle = SASH_PINK;
  ctx.fillRect(-hw * 0.55, -bandH / 2, hw * 1.1, bandH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(bandH * 0.52)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, bandH * 0.04);
  ctx.restore();
}

// Fixed-seed grain so two runs of the same state match byte for byte.
function paintGrain(ctx, w, h) {
  const rnd = seededRandom(20261119);
  const dots = Math.round((w * h) / 520);
  ctx.save();
  for (let i = 0; i < dots; i++) {
    const light = rnd() > 0.5;
    ctx.fillStyle = light ? `rgba(255,255,255,${0.02 + rnd() * 0.05})` : `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
  }
  ctx.restore();
}

// Split the canvas into the hero rect and the four grid rects (band layout).
// Wide covers put the hero on the left; every other size stacks it on top.
export function bandRects(sizeKey, W, H) {
  const gap = Math.max(4, Math.round(Math.min(W, H) * 0.005));
  if (sizeKey === 'wide') {
    const heroW = Math.round(W * 0.56);
    const gx = heroW + gap;
    const gw = W - gx;
    const gh = (H - gap) / 2;
    return {
      hero: { x: 0, y: 0, w: heroW, h: H },
      grid: [
        { x: gx, y: 0, w: (gw - gap) / 2, h: gh },
        { x: gx + (gw - gap) / 2 + gap, y: 0, w: (gw - gap) / 2, h: gh },
        { x: gx, y: gh + gap, w: (gw - gap) / 2, h: gh },
        { x: gx + (gw - gap) / 2 + gap, y: gh + gap, w: (gw - gap) / 2, h: gh },
      ],
    };
  }
  const heroH = Math.round(H * 0.52);
  const gy = heroH + gap;
  const gh = (H - gy - gap) / 2;
  const gw = (W - gap) / 2;
  return {
    hero: { x: 0, y: 0, w: W, h: heroH },
    grid: [
      { x: 0, y: gy, w: gw, h: gh },
      { x: gw + gap, y: gy, w: gw, h: gh },
      { x: 0, y: gy + gh + gap, w: gw, h: gh },
      { x: gw + gap, y: gy + gh + gap, w: gw, h: gh },
    ],
  };
}

// Default hero framing for the duo photo: tight on the two leads, man's
// head top ~16% of the hero height, head height ~29%, woman's face whole
// at the left edge. These are the defaults the editor starts from.
export function defaultHeroFraming(sizeKey) {
  if (sizeKey === 'wide') return { zoom: 1.08, dx: 0.24, dy: -0.06 };
  if (sizeKey === 'portrait') return { zoom: 1.10, dx: 0.015, dy: -0.10 };
  if (sizeKey === 'story') return { zoom: 1.08, dx: 0.17, dy: -0.10 };
  return { zoom: 1.0, dx: 0.0, dy: -0.03 }; // square
}

// Paint the whole cover. `photos` is { hero, car, heli, dj, boat } and
// `words` is { title, city, tagline, sash, showSash }.
export function paintCover(canvas, photos, words, sizeKey, gradeKey) {
  const size = SIZES[sizeKey] || SIZES.wide;
  const grade = GRADES[gradeKey] || GRADES.photo;
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  const { hero, grid } = bandRects(sizeKey, size.w, size.h);

  ctx.fillStyle = '#0b0614';
  ctx.fillRect(0, 0, size.w, size.h);

  ctx.filter = grade.filter;
  paintPhoto(ctx, photos.hero, hero.x, hero.y, hero.w, hero.h);
  const order = ['car', 'heli', 'dj', 'boat'];
  grid.forEach((rect, i) => paintPhoto(ctx, photos[order[i]], rect.x, rect.y, rect.w, rect.h));
  ctx.filter = 'none';

  // Thin ink gutters between panels.
  ctx.strokeStyle = 'rgba(10,4,20,0.9)';
  ctx.lineWidth = Math.max(3, Math.round(Math.min(size.w, size.h) * 0.004));
  grid.forEach((rect) => ctx.strokeRect(rect.x, rect.y, rect.w, rect.h));
  ctx.strokeRect(hero.x, hero.y, hero.w, hero.h);

  paintWordmark(ctx, hero, words);
  paintSash(ctx, hero, words);

  // Warm / neon tint wash over the lettering zone only for graded looks.
  if (gradeKey === 'sunset') {
    const wash = ctx.createLinearGradient(0, hero.y + hero.h * 0.5, 0, hero.y + hero.h);
    wash.addColorStop(0, 'rgba(255,122,40,0)');
    wash.addColorStop(1, 'rgba(255,122,40,0.10)');
    ctx.fillStyle = wash;
    ctx.fillRect(hero.x, hero.y + hero.h * 0.5, hero.w, hero.h * 0.5);
  } else if (gradeKey === 'neon') {
    ctx.fillStyle = 'rgba(224,33,138,0.06)';
    ctx.fillRect(hero.x, hero.y, hero.w, hero.h * 0.5);
    ctx.fillStyle = 'rgba(0,229,255,0.05)';
    ctx.fillRect(hero.x, hero.y + hero.h * 0.5, hero.w, hero.h * 0.5);
  }

  paintGrain(ctx, size.w, size.h);
  return { w: size.w, h: size.h };
}
