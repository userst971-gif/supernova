import { useEffect, useRef, useState } from 'react';

const VIDEO_SRC = '/video/hero-supernova.webm';
const POSTER_SRC = '/img/hero-video-poster.jpg';
const LOOP_SECONDS = 10;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const SIDE_MASK = {
  maskImage:
    'radial-gradient(ellipse 110% 110% at 50% 48%, black 42%, rgba(0,0,0,0.6) 60%, transparent 78%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 110% 110% at 50% 48%, black 42%, rgba(0,0,0,0.6) 60%, transparent 78%)',
};

const VERTICAL_FADE_MASK =
  'linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%)';

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
        <div className="absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2">
          <div className="aspect-[16/9] h-[56vh] sm:h-[62vh] lg:h-[68vh]">
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
      <div className="absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2">
        <div ref={flightRef} className="hero-flight">
          <div className="aspect-[16/9] h-[56vh] sm:h-[62vh] lg:h-[68vh]">
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
                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                style={{
                  filter: 'brightness(1.6) contrast(1.5) saturate(1.1)',
                  ...SIDE_MASK,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
