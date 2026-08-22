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
    <div
      className="pointer-events-none absolute inset-0 z-40"
      aria-hidden="true"
      style={{ mixBlendMode: 'screen' }}
    >
      <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
        <div ref={flightRef} className="hero-flight">
          <div className="aspect-[16/9] h-[42vh] sm:h-[48vh] lg:h-[54vh]">
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
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                filter: 'brightness(1.14) contrast(1.3) saturate(0.9)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
