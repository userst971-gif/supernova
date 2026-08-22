import { useEffect, useRef, useState } from 'react';

const VIDEO_SRC = '/video/hero-supernova.webm';
const POSTER_SRC = '/img/hero-video-poster.jpg';
const LOOP_SECONDS = 10;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const SIDE_MASK = {
  maskImage:
    'radial-gradient(ellipse 80% 100% at 50% 46%, black 38%, rgba(0,0,0,0.9) 50%, transparent 62%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 80% 100% at 50% 46%, black 38%, rgba(0,0,0,0.9) 50%, transparent 62%)',
};

const VERTICAL_FADE_MASK =
  'linear-gradient(to bottom, transparent 0%, black 18%, black 87%, transparent 100%)';

const VERTICAL_FADE_STYLE = {
  maskImage: VERTICAL_FADE_MASK,
  WebkitMaskImage: VERTICAL_FADE_MASK,
};

const FLIGHT_KEYFRAMES = [
  { transform: 'translate3d(-150%, 0, 0)', opacity: 0, easing: EASE },
  { transform: 'translate3d(-55%, 0, 0)', opacity: 0.05, offset: 0.1, easing: 'linear' },
  { transform: 'translate3d(0, 0, 0)', opacity: 1, offset: 0.25, easing: EASE },
  { transform: 'translate3d(0, 0, 0)', opacity: 1, offset: 0.6, easing: EASE },
  { transform: 'translate3d(45%, 0, 0)', opacity: 1, offset: 0.7, easing: 'linear' },
  { transform: 'translate3d(90%, 0, 0)', opacity: 1, offset: 0.8, easing: EASE },
  { transform: 'translate3d(140%, 0, 0)', opacity: 1, offset: 0.97, easing: EASE },
  { transform: 'translate3d(150%, 0, 0)', opacity: 1, offset: 1 },
];

export default function HeroVideo() {
  const [reduced, setReduced] = useState(false);
  const videoRef = useRef(null);
  const flightRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced || !videoRef.current) return;
    videoRef.current.play().catch(() => {});
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const v = videoRef.current;
    const mover = flightRef.current;
    if (!v || !mover) return;

    const anim = mover.animate(FLIGHT_KEYFRAMES, {
      duration: LOOP_SECONDS * 1000,
      iterations: Infinity,
      fill: 'both',
    });
    anim.pause();

    let raf;
    const tick = () => {
      const p = (v.currentTime % LOOP_SECONDS) / LOOP_SECONDS;
      anim.currentTime = p * LOOP_SECONDS * 1000;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      anim.cancel();
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SCALE = 0.35;
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        sizeRef.current = { w: Math.round(width), h: Math.round(height) };
      }
    });
    ro.observe(canvas.parentElement);

    const draw = () => {
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0 && !video.paused && !video.ended) {
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          offscreen.width = Math.round(w * SCALE);
          offscreen.height = Math.round(h * SCALE);
        }
        const ow = offscreen.width;
        const oh = offscreen.height;
        offCtx.drawImage(video, 0, 0, ow, oh);
        const img = offCtx.getImageData(0, 0, ow, oh);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const lum = r * 0.299 + g * 0.587 + b * 0.114;
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
          if (sat < 0.12 && lum < 30) {
            d[i + 3] = 0;
          } else if (lum < 80) {
            const boost = 1.5 + (80 - lum) / 80;
            d[i] = Math.min(255, Math.round(r * boost));
            d[i + 1] = Math.min(255, Math.round(g * boost));
            d[i + 2] = Math.min(255, Math.round(b * boost));
          }
        }
        offCtx.putImageData(img, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offscreen, 0, 0, w, h);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [reduced]);

  if (reduced) {
    return (
      <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
        <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
          <div className="aspect-[16/9] h-[42vh] sm:h-[48vh] lg:h-[54vh]">
            <img
              src={POSTER_SRC}
              alt=""
              className="h-full w-full object-cover"
              style={{
                filter: 'brightness(1.14) contrast(1.3) saturate(0.9)',
                ...SIDE_MASK,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40"
      aria-hidden="true"
      style={{ mixBlendMode: 'screen' }}
    >
      <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
        <div ref={flightRef} className="hero-flight">
          <div className="aspect-[16/9] h-[42vh] sm:h-[48vh] lg:h-[54vh]">
            <div className="pointer-events-none absolute inset-0" style={VERTICAL_FADE_STYLE}>
              <video
                ref={videoRef}
                src={VIDEO_SRC}
                muted
                playsInline
                autoPlay
                loop
                preload="metadata"
                disablePictureInPicture
                controls={false}
                aria-hidden="true"
                className="absolute inset-0 h-full w-full pointer-events-none"
                style={{ filter: 'brightness(1.5) contrast(1.4) saturate(1.1)' }}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                style={SIDE_MASK}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
