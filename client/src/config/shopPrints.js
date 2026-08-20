// AURORA shop — per-product print artworks for product photography.
//
// The RenderPage harness (asset pipeline) draws each product's design onto a
// transparent 1024x1024 canvas and feeds it through the same surface-conforming
// print overlay as the Design Studio, so shop product photos show the actual
// designed print (not a blank garment). Designs are keyed by product slug and
// are layered with dark-underlay / bright-fill ink so they stay legible on every
// colorway (Void Black, Moon White, Emerald Dust, Aurora Green, Nebula).

const SIZE = 1024;
const CX = 512;
const CY = 512;

const INK = {
  white: '#f5f7f6',
  void: '#0a0b0d',
  aurora: '#21f59a',
  teal: '#3fd6bb',
  purple: '#8b7cf6',
  magenta: '#e06bc8',
  dust: '#c9d3cc',
  glow: 'rgba(45,255,159,',
};

function starPath(ctx, cx, cy, spikes, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Draws "AURORA" with a dark rim so the wordmark reads on light and dark garments. */
function wordmark(ctx, cx, cy, size, opts = {}) {
  const color = opts.color ?? INK.white;
  const weight = opts.weight ?? 700;
  ctx.font = `${weight} ${size}px "Space Grotesk", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(6, size * 0.07);
  ctx.strokeStyle = 'rgba(6,8,10,0.85)';
  ctx.strokeText('AURORA', cx, cy);
  ctx.fillStyle = color;
  ctx.fillText('AURORA', cx, cy);
}

function sparkle(ctx, x, y, r) {
  ctx.strokeStyle = 'rgba(245,247,246,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
}

/** The brand mark used by the Aurora Box Tee — glow, spokes, 8-point star, wordmark. */
function auroraMark(ctx, opts = {}) {
  const accent = opts.accent ?? INK.aurora;
  const radius = opts.radius ?? 470;

  const grad = ctx.createRadialGradient(CX, CY, 60, CX, CY, radius);
  grad.addColorStop(0, 'rgba(45,255,159,0.5)');
  grad.addColorStop(1, 'rgba(33,245,154,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(CX, CY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(45,255,159,0.85)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * 130, CY + Math.sin(a) * 130);
    ctx.lineTo(CX + Math.cos(a) * radius, CY + Math.sin(a) * radius);
    ctx.stroke();
  }

  ctx.fillStyle = accent;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 150 : 340;
    ctx.lineTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();

  wordmark(ctx, CX, CY + 250, 96);
}

function drawStars(ctx, count) {
  for (let i = 0; i < count; i++) {
    const x = 90 + Math.random() * 844;
    const y = 90 + Math.random() * 844;
    const r = 1 + Math.random() * 2.6;
    ctx.fillStyle = Math.random() < 0.75 ? 'rgba(245,247,246,0.85)' : 'rgba(63,214,187,0.8)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Nebula — "dye-dipped near Orion": purple/teal cloud, scattered stars, small mark. */
function nebula(ctx) {
  const blobs = [
    [0.36, 0.42, 300, INK.purple, 0.55],
    [0.64, 0.6, 340, INK.magenta, 0.4],
    [0.5, 0.52, 360, INK.teal, 0.35],
    [0.42, 0.68, 260, INK.purple, 0.5],
  ];
  for (const [fx, fy, r, color, a] of blobs) {
    const g = ctx.createRadialGradient(CX * fx, CY * fy, 20, CX * fx, CY * fy, r);
    g.addColorStop(0, color + 'cc');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CX * fx, CY * fy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'screen';
  drawStars(ctx, 46);
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 5; i++) {
    sparkle(ctx, 200 + i * 130, 220 + (i % 3) * 120, 6 + (i % 2) * 4);
  }
  wordmark(ctx, CX, CY + 300, 72);
}

/** Aurora Shell Jacket — a faint northern-light band; the "permanent northern light". */
function auroraBand(ctx) {
  const bandY = CY + 70;
  const wave = (amp, phase) => {
    ctx.beginPath();
    for (let x = 0; x <= SIZE; x += 12) {
      const y = bandY - amp * 0.5 + Math.sin((x / SIZE) * Math.PI * 2.2 + phase) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  ctx.lineCap = 'round';
  // dark rim underlay → reads on the bright Aurora Green fabric
  ctx.strokeStyle = 'rgba(6,8,10,0.8)';
  ctx.lineWidth = 48;
  wave(26, 0);
  ctx.stroke();
  // white core → reads on Void Black
  ctx.strokeStyle = 'rgba(245,247,246,0.92)';
  ctx.lineWidth = 30;
  wave(26, 0);
  ctx.stroke();
  // aurora accent
  ctx.strokeStyle = 'rgba(33,245,154,0.9)';
  ctx.lineWidth = 7;
  wave(26, 0.9);
  ctx.stroke();
  wordmark(ctx, CX, CY - 200, 60);
}

/** Event Horizon — the "blackest black we can legally print": a photon ring. */
function eventHorizon(ctx) {
  const glow = ctx.createRadialGradient(CX, CY, 150, CX, CY, 430);
  glow.addColorStop(0, 'rgba(245,247,246,0.28)');
  glow.addColorStop(0.55, 'rgba(245,247,246,0.08)');
  glow.addColorStop(1, 'rgba(245,247,246,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(CX, CY, 430, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(245,247,246,0.9)';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(CX, CY, 250, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#050506';
  ctx.beginPath();
  ctx.arc(CX, CY, 188, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = INK.aurora;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(CX, CY, 206, 0, Math.PI * 2);
  ctx.stroke();
}

/** Quasar — a dense reflective micro-print starburst. */
function quasar(ctx) {
  const glow = ctx.createRadialGradient(CX, CY, 10, CX, CY, 120);
  glow.addColorStop(0, 'rgba(245,247,246,0.7)');
  glow.addColorStop(1, 'rgba(245,247,246,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(CX, CY, 120, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const len = 360 + Math.random() * 140;
    ctx.strokeStyle = i % 8 === 0 ? 'rgba(245,247,246,0.95)' : 'rgba(245,247,246,0.55)';
    ctx.lineWidth = i % 8 === 0 ? 5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * 150, CY + Math.sin(a) * 150);
    ctx.lineTo(CX + Math.cos(a) * len, CY + Math.sin(a) * len);
    ctx.stroke();
  }

  ctx.fillStyle = '#f5f7f6';
  ctx.beginPath();
  ctx.arc(CX, CY, 22, 0, Math.PI * 2);
  ctx.fill();
}

/** Polaris — navigational compass mark. */
function polaris(ctx) {
  ctx.strokeStyle = 'rgba(245,247,246,0.9)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(CX, CY, 260, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(245,247,246,0.7)';
  ctx.lineWidth = 5;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath();
    ctx.moveTo(CX + dx * 260, CY + dy * 260);
    ctx.lineTo(CX + dx * 320, CY + dy * 320);
    ctx.stroke();
  }

  const star = (len, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 ? len * 0.32 : len;
      ctx.lineTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  };
  star(170, 'rgba(6,8,10,0.85)');
  star(150, '#f5f7f6');
  star(64, INK.aurora);

  wordmark(ctx, CX, CY + 305, 46, { color: INK.white });
}

/** Comet — a comet-dust streak across the chest. */
function comet(ctx) {
  const tx = CX + 90;
  const ty = CY + 140;
  const tailAngle = -0.62;
  const tailLen = 560;

  const glow = ctx.createRadialGradient(tx, ty, 8, tx, ty, 150);
  glow.addColorStop(0, 'rgba(245,247,246,0.95)');
  glow.addColorStop(0.4, 'rgba(63,214,187,0.6)');
  glow.addColorStop(1, 'rgba(63,214,187,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(tx, ty, 150, 0, Math.PI * 2);
  ctx.fill();

  const tail = ctx.createLinearGradient(tx, ty, tx + Math.cos(tailAngle) * tailLen, ty + Math.sin(tailAngle) * tailLen);
  tail.addColorStop(0, 'rgba(245,247,246,0.85)');
  tail.addColorStop(0.5, 'rgba(245,247,246,0.35)');
  tail.addColorStop(1, 'rgba(245,247,246,0)');
  ctx.strokeStyle = tail;
  ctx.lineCap = 'round';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + Math.cos(tailAngle) * tailLen, ty + Math.sin(tailAngle) * tailLen);
  ctx.stroke();

  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(245,247,246,0.5)';
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + Math.cos(tailAngle) * tailLen * 0.78, ty + Math.sin(tailAngle) * tailLen * 0.78);
  ctx.stroke();

  for (let i = 0; i < 14; i++) {
    const t = 0.35 + Math.random() * 0.6;
    const jitter = (Math.random() - 0.5) * 40;
    const px = tx + Math.cos(tailAngle) * tailLen * t + jitter * 0.7;
    const py = ty + Math.sin(tailAngle) * tailLen * t + jitter;
    ctx.fillStyle = `rgba(245,247,246,${0.75 - t * 0.5})`;
    ctx.beginPath();
    ctx.arc(px, py, 3 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#f5f7f6';
  ctx.beginPath();
  ctx.arc(tx, ty, 20, 0, Math.PI * 2);
  ctx.fill();
}

/** Eclipse — corona ring around a matte black disc. */
function eclipse(ctx) {
  const glow = ctx.createRadialGradient(CX, CY, 180, CX, CY, 470);
  glow.addColorStop(0, 'rgba(245,247,246,0.32)');
  glow.addColorStop(0.6, 'rgba(245,247,246,0.08)');
  glow.addColorStop(1, 'rgba(245,247,246,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(CX, CY, 470, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(245,247,246,0.92)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(CX, CY, 292, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(201,211,204,0.7)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(CX, CY, 262, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#050506';
  ctx.beginPath();
  ctx.arc(CX, CY, 216, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(245,247,246,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(CX, CY, 216, 0, Math.PI * 2);
  ctx.stroke();
}

/** Nova — a single embroidered mark over the heart (compact). */
function nova(ctx) {
  starPath(ctx, CX, CY - 60, 8, 120, 52);
  ctx.fillStyle = INK.aurora;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(6,8,10,0.85)';
  ctx.stroke();

  wordmark(ctx, CX, CY + 120, 64);
}

const DESIGNS = {
  'nebula-oversized-hoodie': nebula,
  'supernova-box-tee': auroraMark,
  'aurora-shell-jacket': auroraBand,
  'event-horizon-zip-hoodie': eventHorizon,
  'quasar-longsleeve': quasar,
  'nova-classic-tee': nova,
  'polaris-technical-puffer': polaris,
  'comet-heavyweight-crewneck': comet,
  'eclipse-muscle-tee': eclipse,
};

/** Draws a product's print onto a fresh transparent 1024x1024 canvas. */
export function generateShopPrint(slug) {
  const draw = DESIGNS[slug];
  if (!draw) return null;
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  draw(c.getContext('2d'));
  return c;
}

export const SHOP_PRINT_SLUGS = Object.keys(DESIGNS);
