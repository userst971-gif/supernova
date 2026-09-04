import { useEffect, useRef, useState } from 'react';

const VIDEO_SRC = '/video/hero-supernova.webm';
const POSTER_SRC = '/img/hero-video-poster.jpg';
const LOOP_SECONDS = 10;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

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

const SOFT_EDGE_MASK = {
  maskImage:
    'radial-gradient(ellipse 105% 105% at 50% 48%, black 48%, rgba(0,0,0,0.7) 62%, transparent 76%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 105% 105% at 50% 48%, black 48%, rgba(0,0,0,0.7) 62%, transparent 76%)',
};

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

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        sizeRef.current = { w: Math.round(width), h: Math.round(height) };
      }
    });
    ro.observe(canvas);

    const draw = () => {
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0 && !video.paused && !video.ended) {
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          offscreen.width = w;
          offscreen.height = h;
        }
        offCtx.drawImage(video, 0, 0, w, h);
        const img = offCtx.getImageData(0, 0, w, h);
        const d = img.data;
        const BRIGHTNESS = 1.14;
        const CONTRAST = 1.3;
        const adj = (v) => {
          const c = (v * BRIGHTNESS - 128) * CONTRAST + 128;
          return c < 0 ? 0 : c > 255 ? 255 : c;
        };
        for (let i = 0; i < d.length; i += 4) {
          const R = adj(d[i]);
          const G = adj(d[i + 1]);
          const B = adj(d[i + 2]);
          const lum = R * 0.299 + G * 0.587 + B * 0.114;
          if (lum < 8) {
            d[i + 3] = 0;
          } else if (lum < 50) {
            d[i + 3] = Math.round(((lum - 8) / 42) * 255);
          }
          d[i] = R;
          d[i + 1] = G;
          d[i + 2] = B;
        }
        offCtx.putImageData(img, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(offscreen, 0, 0);
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
        <div className="absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2">
          <div className="aspect-[16/9] h-[56vh] sm:h-[62vh] lg:h-[68vh]">
            <img
              src={POSTER_SRC}
              alt=""
              className="h-full w-full object-cover"
              style={{ filter: 'brightness(1.14) contrast(1.3) saturate(0.9)' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
      <div className="absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2">
        <div ref={flightRef} className="hero-flight">
          <div className="aspect-[16/9] h-[56vh] sm:h-[62vh] lg:h-[68vh]">
            <div className="pointer-events-none absolute inset-0">
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
                style={{ opacity: 0 }}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full pointer-events-none"
                style={SOFT_EDGE_MASK}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
