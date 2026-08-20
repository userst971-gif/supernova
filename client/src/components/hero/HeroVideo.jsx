import { useEffect, useRef, useState, useCallback } from 'react';

const VIDEO_SRC = '/video/hero-supernova.webm';
const POSTER_SRC = '/img/hero-video-poster.jpg';
const LOOP_SECONDS = 10;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

// Luma-key threshold: only the very dark VP9 background (~16-25) gets removed.
// A soft falloff between floor and ceiling avoids harsh edges on the character.
const LUMA_FLOOR = 0.05;  // below this: fully transparent
const LUMA_CEIL = 0.10;   // above this: fully opaque

const COMBINED_MASK =
  'linear-gradient(to bottom, transparent 0%, black 18%, black 87%, transparent 100%), radial-gradient(ellipse 55% 75% at 50% 46%, black 30%, rgba(0,0,0,0.5) 42%, transparent 54%)';
const COMBINED_MASK_STYLE = {
  maskImage: COMBINED_MASK,
  WebkitMaskImage: COMBINED_MASK,
  maskComposite: 'intersect',
  WebkitMaskComposite: 'destination-in',
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

const RIM_GRADIENT =
  'radial-gradient(130% 95% at 50% 16%, rgba(90,255,185,0.32) 0%, rgba(90,255,185,0.10) 38%, transparent 60%), linear-gradient(to right, rgba(60,255,175,0.22) 0%, transparent 16%), linear-gradient(to left, rgba(60,255,175,0.22) 0%, transparent 16%), linear-gradient(to bottom, rgba(45,255,159,0.10) 0%, transparent 26%)';

function lumaKeyFrame(video, ctx, w, h) {
  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const floor = LUMA_FLOOR * 255;
  const ceil = LUMA_CEIL * 255;
  const range = ceil - floor;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (lum < ceil) {
      const alpha = Math.max(0, (lum - floor) / range);
      d[i + 3] = Math.round(d[i + 3] * alpha);
    }
  }
  ctx.putImageData(img, 0, 0);
}

function HeroStage({ videoRef }) {
  const canvasRef = useRef(null);
  const offCtxRef = useRef(null);
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = offCtxRef.current;
    if (!video || !canvas || !ctx || video.paused || video.ended) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    lumaKeyFrame(video, ctx, w, h);
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [videoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    offCtxRef.current = canvas.getContext('2d', { willReadFrequently: true });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        sizeRef.current = { w: Math.round(width), h: Math.round(height) };
      }
    });
    ro.observe(canvas);

    rafRef.current = requestAnimationFrame(drawFrame);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame]);

  return (
    <div className="aspect-[16/9] h-[42vh] sm:h-[48vh] lg:h-[54vh]">
      <div
        className="pointer-events-none absolute -inset-x-[4%] -inset-y-[4%] mix-blend-multiply"
        style={{
          background:
            'radial-gradient(ellipse 42% 46% at 50% 54%, rgba(1,3,3,0.55) 0%, rgba(1,3,3,0.28) 46%, transparent 70%)',
        }}
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={COMBINED_MASK_STYLE}
      />

      <div
        className="absolute inset-0 mix-blend-screen"
        aria-hidden="true"
        style={{
          ...COMBINED_MASK_STYLE,
          background: RIM_GRADIENT,
        }}
      />
    </div>
  );
}

export default function HeroVideo() {
  const [reduced, setReduced] = useState(false);
  const videoRef = useRef(null);
  const flightRef = useRef(null);

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

  if (reduced) {
    return (
      <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
        <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
          <div className="aspect-[16/9] h-[42vh] sm:h-[48vh] lg:h-[54vh]">
            <div
              className="absolute -inset-x-[4%] -inset-y-[4%] mix-blend-multiply"
              style={{
                background:
                  'radial-gradient(ellipse 42% 46% at 50% 54%, rgba(1,3,3,0.55) 0%, rgba(1,3,3,0.28) 46%, transparent 70%)',
              }}
            />
            <img
              src={POSTER_SRC}
              alt=""
              className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
              style={{
                filter: 'brightness(1.3) contrast(3) saturate(0.8)',
                ...COMBINED_MASK_STYLE,
              }}
            />
            <div
              className="absolute inset-0 mix-blend-screen"
              aria-hidden="true"
              style={{
                ...COMBINED_MASK_STYLE,
                background: RIM_GRADIENT,
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
          {/* hidden <video> feeds frames to the canvas luma-key pipeline */}
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
          <HeroStage videoRef={videoRef} />
        </div>
      </div>
    </div>
  );
}
