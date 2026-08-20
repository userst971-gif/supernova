import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import HeroBackground from './hero/HeroBackground';
import HeroVideo from './hero/HeroVideo';

const EASE = [0.22, 1, 0.36, 1];

function ScrollIndicator() {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[9px] uppercase tracking-[0.45em] text-white/35">Scroll</span>
      <div className="relative h-12 w-px overflow-hidden bg-white/15">
        <motion.div
          animate={{ y: ['-100%', '260%'] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
          className="absolute h-3 w-px bg-aurora-400 shadow-[0_0_8px_rgba(45,255,159,0.9)]"
        />
      </div>
    </div>
  );
}

export default function Hero() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });

  const titleX = useTransform(sx, (v) => v * 10);
  const titleY = useTransform(sy, (v) => v * 6);

  useEffect(() => {
    const onMove = (e) => {
      mx.set(e.clientX / Math.max(1, window.innerWidth) - 0.5);
      my.set(e.clientY / Math.max(1, window.innerHeight) - 0.5);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [mx, my]);

  return (
    <section className="relative flex h-[100svh] min-h-[620px] flex-col overflow-hidden bg-void">
      {/* cinematic background video (single element, full-bleed) */}
      <HeroBackground />

      {/* editorial content — title in the upper section, clear of the
          superhero's head below */}
      <div className="container-x relative z-20 flex h-full flex-col items-center pt-16 text-center sm:pt-20">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1, ease: EASE }}
          className="editorial-track flex items-center gap-5 text-[10px] uppercase text-aurora-300/85 sm:text-[11px]"
        >
          <span className="h-px w-10 bg-aurora-400/40 sm:w-16" />
          Drop 004 — Northern Lights
          <span className="h-px w-10 bg-aurora-400/40 sm:w-16" />
        </motion.p>

        <motion.h1
          style={{ x: titleX, y: titleY }}
          initial={{ opacity: 0, y: 60, filter: 'blur(18px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.45, duration: 1.5, ease: EASE }}
          className="text-gradient-emerald text-glow-fade mt-4 font-bold leading-[0.95] tracking-[-0.04em] text-[clamp(40px,8vw,128px)]"
        >
          AURORA
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 1, ease: EASE }}
          className="editorial-track mt-3 text-[11px] uppercase text-[#8A9691] sm:text-xs"
        >
          Cosmic Apparel
        </motion.p>

        <div className="flex-1" />

        {/* primary CTA — editorial fashion style: thin type, no pill */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 1, ease: EASE }}
          className="relative z-30 mb-9"
        >
          <Link
            to="/shop"
            aria-label="Explore Drop 004"
            className="group inline-flex flex-col items-center gap-3"
          >
            <span className="editorial-track text-[10px] font-light uppercase tracking-[0.55em] text-white/70 transition-all duration-300 group-hover:text-aurora-300 sm:text-[11px]">
              Explore Drop 004
            </span>
            <span className="relative block h-px w-24 overflow-hidden bg-white/20 transition-colors duration-300 group-hover:bg-aurora-400/60">
              <span
                className="absolute inset-0 origin-left scale-x-0 bg-aurora-400 transition-transform duration-500 ease-out group-hover:scale-x-100"
                style={{ boxShadow: '0 0 12px rgba(66,245,150,0.9)' }}
              />
            </span>
          </Link>
        </motion.div>
      </div>

      {/* superhero entrance video (on top of hero title/UI) */}
      <HeroVideo />

      {/* foreground depth fog — grounds the superhero into the scene */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[45] h-[22%]"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to top, rgba(1,3,3,0.72) 0%, rgba(1,3,3,0.22) 45%, transparent 100%)',
        }}
      />

      {/* editorial vertical CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1.2, ease: EASE }}
        className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 lg:block lg:right-10"
      >
        <Link
          to="/shop"
          className="group flex flex-col items-center gap-4"
          aria-label="Explore drop"
        >
          <span className="[writing-mode:vertical-rl] text-[11px] uppercase tracking-[0.5em] text-aurora-300/80 transition-all duration-300 group-hover:text-aurora-300 group-hover:[text-shadow:0_0_18px_rgba(45,255,159,0.7)]">
            Explore Drop
          </span>
          <motion.svg
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-aurora-400 transition-transform duration-300 group-hover:translate-y-1"
          >
            <path d="M12 2v0" />
            <path d="M14.5 7l2 2-1 6-3.5 2-3.5-2-1-6 2-2" />
            <path d="M12 14v3" />
            <path d="M9 8L12 4l3 4" strokeOpacity="0.5" />
            <circle cx="12" cy="11" r="1" />
          </motion.svg>
        </Link>
      </motion.div>

      {/* scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1.2 }}
        className="absolute bottom-8 left-8 z-30 hidden lg:block"
      >
        <ScrollIndicator />
      </motion.div>
    </section>
  );
}
