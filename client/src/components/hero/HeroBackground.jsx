import { useEffect, useRef, useState } from 'react';
import { HERO_BACKGROUND_VIDEO, HERO_BACKGROUND_POSTER } from '../../config/hero';

// Single cinematic background: ONE local video element, full-bleed, behind
// everything (z-10, below hero content z-20/30 and the character z-40). No
// procedural WebGL/shaders/stars/pyramids anymore — the user supplies the
// night scene and it is referenced via the public asset system.
//
// Fallback behaviour keeps the hero intentional even before the file exists:
//   - a poster frame is shown until the video's first frame paints,
//   - if the asset 404s or fails to decode, a static night gradient replaces
//     the video entirely (no broken-video icon, no flash of white).
//
// Reduced-motion: the video never plays — the poster frame renders as a static
// image so there is no background animation at all.
export default function HeroBackground() {
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced || failed) return;
    videoRef.current?.play().catch(() => {});
  }, [reduced, failed]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {reduced || failed ? (
        <img
          src={HERO_BACKGROUND_POSTER}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          src={HERO_BACKGROUND_VIDEO}
          poster={HERO_BACKGROUND_POSTER}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          disablePictureInPicture
          controls={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* fallback night gradient (only visible while the video is missing) */}
      {failed && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, #020305 0%, #030608 34%, #06130e 58%, #04100b 74%, #030806 100%)',
          }}
        />
      )}

      {/* readability overlay — keeps the AURORA title crisp over the bright
          scene, vignettes the edges to blend the blur-fill sides and darkens
          the bottom to ground the figure. Gradients + box-shadow only, no
          animation. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(1,3,3,0.6) 0%, rgba(1,3,3,0.28) 22%, rgba(1,3,3,0.1) 38%, transparent 52%), radial-gradient(ellipse 130% 95% at 50% 40%, transparent 50%, rgba(1,3,3,0.4) 80%, rgba(0,1,1,0.82) 100%), linear-gradient(to top, rgba(1,3,3,0.55) 0%, rgba(1,3,3,0.14) 26%, transparent 46%)',
        }}
      />
    </div>
  );
}
