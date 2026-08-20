import { useEffect, useRef, useState } from 'react';

const VIDEO_SRC = '/video/hero-supernova.webm';
const POSTER_SRC = '/img/hero-video-poster.jpg';
const LOOP_SECONDS = 10;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

// SUPERNOVA wordmark reel. The source clip is a 10s VP9 sequence on a near-
// black background (a centred glowing logo, brightest around 30–40% height).
// mix-blend-screen keys the black out against the cinematic night scene.
// The sweep mirrors the clip's internal motion 1:1: a Web Animations API
// animation reproduces the .hero-flight keyframes, paused and frame-locked to
// the video's currentTime every rAF, so the sweep and the playhead can never
// drift. The video is looped, so the reel repeats seamlessly.
//
// The source webm has NO alpha channel, so a true transparent cut-out is not
// available. Two things guarantee the viewer never sees a video box:
//   1. screen-blend keys the near-black background out,
//   2. STAGE_MASK feathered-fades the box edges to fully transparent (top,
//      corners and bottom), so even residual VP9 noise can never draw a
//      rectangle. The logo stays solid in the centre; its glow dissolves
//      into the mask before the box edge, which reads as atmospheric haze.
//
// Integration (the logo is lit BY this environment, not pasted on top):
//   - A dark multiply pool sits UNDER the video, deepening the night scene
//     directly behind the wordmark so the glow pops instead of washing out.
//   - An emerald rim overlay picks up the aurora, so the logo catches green
//     light from the same source that lights the sky.
//
// STAGE_MASK must fade EVERY box edge to fully transparent, not just the
// sides. A lone radial ellipse can't do that: with its centre at 46% height,
// the top edge (46% of the radius) and bottom edge (54%) land inside the
// opaque stops, so the rim glow paints bright bars along the top/bottom of
// the box — the "rectangle" that keeps coming back once the background is
// bright.
//
// The fix uses nested masks (they multiply, no mask-composite needed):
//   - a wrapper div gets VERTICAL_FADE_MASK — one linear gradient fading the
//     top 0–18% and the bottom 87–100% to fully transparent, so no top/bottom
//     bar can ever paint,
//   - the video + rim keep SIDE_MASK, a radial ellipse that feathers the
//     sides and corners only.
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
  { transform: 'translate3d(90%, 0, 0)', opacity: 0, offset: 0.8, easing: EASE },
  { transform: 'translate3d(140%, 0, 0)', opacity: 0, offset: 0.97, easing: EASE },
  { transform: 'translate3d(150%, 0, 0)', opacity: 0, offset: 1 },
];

// Luma key via CSS: VP9's "pure black" background is really dark grey
// (~16–25), which mix-blend-screen alone lifts as a faint rectangular veil over
// the scene. `brightness(1.14)` then `contrast(1.3)` pushes the grey bg below
// black while lifting the logo's glow. The STAGE_MASK below then guarantees no
// box edge can ever render.
const VIDEO_FILTER = 'brightness(1.14) contrast(1.3) saturate(0.9)';

const RIM_GRADIENT =
  'radial-gradient(130% 95% at 50% 16%, rgba(90,255,185,0.32) 0%, rgba(90,255,185,0.10) 38%, transparent 60%), linear-gradient(to right, rgba(60,255,175,0.22) 0%, transparent 16%), linear-gradient(to left, rgba(60,255,175,0.22) 0%, transparent 16%), linear-gradient(to bottom, rgba(45,255,159,0.10) 0%, transparent 26%)';

function HeroStage({ videoRef }) {
  return (
    <div className="aspect-[16/9] h-[42vh] sm:h-[48vh] lg:h-[54vh]">
      {/* dark backdrop pool — multiplies the night scene away in a TIGHT pool
          around the wordmark so the glow pops without a big shadow ellipse
          reading as a container. Placed UNDER the video so it only darkens
          what's behind the logo, never the logo itself. */}
      <div
        className="pointer-events-none absolute -inset-x-[4%] -inset-y-[4%] mix-blend-multiply"
        style={{
          background:
            'radial-gradient(ellipse 42% 46% at 50% 54%, rgba(1,3,3,0.55) 0%, rgba(1,3,3,0.28) 46%, transparent 70%)',
        }}
      />

      {/* logo layers, clipped by the wrapper's vertical fade so the top
          and bottom box edges can never paint a bar; each child keeps the
          radial SIDE_MASK for the sides and corners. */}
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
          className="relative h-full w-full object-cover mix-blend-screen"
          style={{
            filter: VIDEO_FILTER,
            ...SIDE_MASK,
          }}
        />

        {/* emerald backlight — aurora spilling over the wordmark's glow so it
            catches green light from the same source that lights the sky */}
        <div
          className="absolute inset-0 mix-blend-screen"
          aria-hidden="true"
          style={{
            ...SIDE_MASK,
            background: RIM_GRADIENT,
          }}
        />
      </div>
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
            <div className="pointer-events-none absolute inset-0" style={VERTICAL_FADE_STYLE}>
              <img
                src={POSTER_SRC}
                alt=""
                className="relative h-full w-full object-cover mix-blend-screen"
                style={{
                  filter: VIDEO_FILTER,
                  ...SIDE_MASK,
                }}
              />
              <div
                className="absolute inset-0 mix-blend-screen"
                aria-hidden="true"
                style={{
                  ...SIDE_MASK,
                  background: RIM_GRADIENT,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
      <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
        <div ref={flightRef} className="hero-flight">
          <HeroStage videoRef={videoRef} />
        </div>
      </div>
    </div>
  );
}
