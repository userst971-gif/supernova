import { useEffect, useRef, useState, useCallback } from 'react';

const VIDEO_SRC = '/video/hero-supernova.webm';
const LOOP_SECONDS = 10;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

// Canvas luma-key: only the very darkest neutral-grey pixels (VP9 background)
// become transparent. Dark-but-colored pixels (the suit lit by aurora) are kept.
const LUMA_FLOOR = 0.04;
const LUMA_CEIL = 0.16;
const SAT_KEEP = 0.12;

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

function lumaKeyFrame(video, ctx, w, h) {
  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const floor = LUMA_FLOOR * 255;
  const ceil = LUMA_CEIL * 255;
  const range = ceil - floor;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    if (lum < ceil && sat < SAT_KEEP) {
      const alpha = Math.max(0, (lum - floor) / range);
      d[i + 3] = Math.round(d[i + 3] * alpha);
    }
  }
  ctx.putImageData(img, 0, 0);
}

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

  // Flight animation
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

  // Canvas luma-key pipeline
  useEffect(() => {
    if (reduced) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

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
        }
        lumaKeyFrame(video, ctx, w, h);
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
            <video
              src={VIDEO_SRC}
              muted
              playsInline
              loop
              preload="metadata"
              className="h-full w-full object-cover mix-blend-screen"
              style={{
                filter: 'brightness(1.3) contrast(3) saturate(0.8)',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
      <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
        <div ref={flightRef} className="hero-flight">
          <div className="aspect-[16/9] h-[42vh] sm:h-[48vh] lg:h-[54vh]">
            {/* hidden video feeds frames to canvas */}
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
              className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
              aria-hidden="true"
            />
            {/* visible canvas with luma-keyed output */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                maskImage: 'radial-gradient(ellipse 72% 80% at 50% 46%, black 55%, rgba(0,0,0,0.5) 75%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 72% 80% at 50% 46%, black 55%, rgba(0,0,0,0.5) 75%, transparent 100%)',
                filter: 'brightness(1.25) contrast(1.15)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
