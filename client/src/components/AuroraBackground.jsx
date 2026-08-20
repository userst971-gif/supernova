import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Two slow moving green/cyan curtains + one wide soft glow band.
const RIBBONS = [
  {
    baseY: 0.14, amp: 110, wavelength: 0.0011, speed: 0.000055, height: 320,
    colors: [
      [42, 245, 154], [26, 214, 168], [16, 170, 200],
    ],
    alpha: 0.5, phase: 0.0, driftAmp: 0.05,
  },
  {
    baseY: 0.3, amp: 78, wavelength: 0.00082, speed: 0.000043, height: 250,
    colors: [
      [33, 214, 154], [22, 168, 172], [90, 120, 210],
    ],
    alpha: 0.36, phase: 2.4, driftAmp: 0.07,
  },
  {
    baseY: 0.46, amp: 52, wavelength: 0.0006, speed: 0.000034, height: 190,
    colors: [
      [30, 190, 170], [60, 120, 190], [110, 90, 200],
    ],
    alpha: 0.22, phase: 4.6, driftAmp: 0.09,
  },
];

function mix(colors, t) {
  const n = colors.length;
  const seg = Math.max(0, Math.min(n - 1, t * (n - 1)));
  const i = Math.min(n - 2, Math.floor(seg));
  const f = seg - i;
  const a = colors[i];
  const b = colors[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export default function AuroraBackground() {
  const canvasRef = useRef(null);
  const { pathname } = useLocation();
  const isHero = pathname === '/';

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduced = reducedMotion();
    let raf;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars = [];
    let t = reduced ? 0 : Math.random() * 300;
    let mx = 0.5;
    let my = 0.5;
    let targetMx = 0.5;
    let targetMy = 0.5;

    const makeStars = () => {
      const count = Math.min(170, Math.floor((w * h) / 11000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.7,
        r: Math.random() * 0.9 + 0.25,
        tw: Math.random() * Math.PI * 2,
        sp: 0.002 + Math.random() * 0.006,
        bright: 0.2 + Math.random() * 0.5,
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeStars();
    };

    const onPointer = (e) => {
      targetMx = e.clientX / Math.max(1, window.innerWidth);
      targetMy = e.clientY / Math.max(1, window.innerHeight);
    };

    const drawBase = () => {
      ctx.fillStyle = '#020303';
      ctx.fillRect(0, 0, w, h);

      // Layer 2 — very subtle dark-green atmospheric haze
      const haze = ctx.createLinearGradient(0, 0, 0, h);
      haze.addColorStop(0, 'rgba(6, 60, 46, 0.10)');
      haze.addColorStop(0.45, 'rgba(8, 42, 34, 0.05)');
      haze.addColorStop(1, 'rgba(2, 3, 3, 0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);
    };

    const drawStars = () => {
      for (const s of stars) {
        const a = s.bright * (0.5 + 0.5 * Math.sin(t * 0.9 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(225, 245, 238, ${a})`;
        ctx.fill();
      }
    };

    const shapeY = (r, x, time) => {
      const k = x * r.wavelength;
      return (
        r.baseY * h +
        Math.sin(k + time * r.speed + r.phase) * r.amp +
        Math.sin(k * 0.33 + time * r.speed * 1.5 + r.phase * 2.3) * r.amp * 0.3 +
        Math.sin(k * 0.09 + time * r.speed * 0.6 + r.phase * 0.7) * r.amp * 0.18
      );
    };

    // Layer 3 — the flowing aurora curtains
    const drawRibbon = (r, time, px) => {
      const step = 12;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const drift =
        Math.sin(time * 0.000012 + r.phase) * w * r.driftAmp + px;
      const colorT = (Math.sin(time * 0.00002 + r.phase) + 1) / 2;
      const cTop = mix(r.colors, colorT);
      const cMid = mix(r.colors, (colorT + 0.45) % 1);

      for (let x = -r.height; x <= w + r.height; x += step) {
        const y0 = shapeY(r, x + drift, time);
        const top = y0 - r.height * 0.45;
        const bottom = y0 + r.height * 0.55;
        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, `rgba(${cTop[0]},${cTop[1]},${cTop[2]},${0.8 * r.alpha})`);
        grad.addColorStop(0.55, `rgba(${cMid[0]},${cMid[1]},${cMid[2]},${0.4 * r.alpha})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = step * 2.7;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.quadraticCurveTo(x + step * 0.5, (top + bottom) * 0.5, x + step, bottom);
        ctx.stroke();
      }
    };

    // Layer 3b — volumetric soft glow along the curtain
    const drawGlowBand = (r, time, px) => {
      const step = 48;
      const drift =
        Math.sin(time * 0.000012 + r.phase) * w * r.driftAmp + px;
      const colorT = (Math.sin(time * 0.00002 + r.phase + 1) + 1) / 2;
      const c = mix(r.colors, colorT);
      for (let x = -r.height; x <= w + r.height; x += step) {
        const y0 = shapeY(r, x + drift, time);
        const g = ctx.createRadialGradient(x, y0, 0, x, y0, r.height * 0.9);
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.05 * r.alpha})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y0, r.height * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Layer 5 — soft volumetric green light around the hero center
    const drawCenterGlow = (px) => {
      const g = ctx.createRadialGradient(
        w * 0.5 + px, h * 0.42, 0,
        w * 0.5 + px, h * 0.42, Math.min(w, h) * 0.55
      );
      g.addColorStop(0, 'rgba(20, 160, 120, 0.07)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const drawHorizonFalloff = () => {
      const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
      grad.addColorStop(0, 'rgba(2, 3, 3, 0)');
      grad.addColorStop(1, 'rgba(2, 3, 3, 0.82)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };

    // Layer 6 — vignette
    const drawVignette = () => {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const frame = () => {
      // Ease mouse toward target for a cinematic feel
      mx += (targetMx - mx) * 0.03;
      my += (targetMy - my) * 0.03;
      const px = (mx - 0.5) * w * 0.04;
      const py = (my - 0.5) * h * 0.02;

      ctx.clearRect(0, 0, w, h);
      drawBase();

      ctx.save();
      ctx.translate(px * 0.4, py * 0.4);
      drawStars();
      ctx.restore();

      ctx.globalCompositeOperation = 'lighter';
      ctx.save();
      ctx.translate(px, py);
      for (const r of RIBBONS) drawGlowBand(r, t, 0);
      for (const r of RIBBONS) drawRibbon(r, t, 0);
      drawCenterGlow(0);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';

      drawHorizonFalloff();
      drawVignette();

      if (!reduced && visible()) {
        t += 0.35;
        raf = requestAnimationFrame(frame);
      }
    };

    // The hero section is fully opaque (bg-void) and covers the viewport, so
    // the canvas is invisible there and drawing is pure waste. Also stop the
    // loop while the tab is hidden. Route changes re-run this effect (isHero).
    const visible = () => !document.hidden && !isHero;

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      raf = null;
      if (visible() && !reduced) raf = requestAnimationFrame(frame);
    };

    resize();
    frame();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointer);
    window.addEventListener('orientationchange', resize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('orientationchange', resize);
    };
  }, [isHero]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#020303]" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
