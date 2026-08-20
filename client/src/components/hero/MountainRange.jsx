import { useMemo } from 'react';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Builds a jagged ridge silhouette across [0, 1440].
function ridge(rand, baseY, amp, segments) {
  let d = `M0 ${baseY}`;
  for (let i = 1; i <= segments; i++) {
    const x = (1440 / segments) * i;
    const peak = rand() * amp * (i % 2 === 0 ? 1.35 : 1) * (1 - i / segments * 0.25);
    d += ` L${x.toFixed(1)} ${(baseY - peak).toFixed(1)}`;
  }
  return `${d} L1440 480 L0 480 Z`;
}

export default function MountainRange() {
  const layers = useMemo(() => {
    const rand = mulberry32(7331);
    return [
      {
        id: 'back',
        d: ridge(rand, 300, 128, 14),
        fill: 'url(#mntBack)',
        opacity: 1,
      },
      {
        id: 'mid',
        d: ridge(rand, 348, 96, 11),
        fill: 'url(#mntMid)',
        opacity: 1,
      },
      {
        id: 'fore',
        d: ridge(rand, 402, 68, 9),
        fill: 'url(#mntFore)',
        opacity: 1,
      },
    ];
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <svg
        className="absolute inset-x-0 bottom-0 h-[46%] w-full"
        viewBox="0 0 1440 480"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="mntBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c1614" />
            <stop offset="100%" stopColor="#05080a" />
          </linearGradient>
          <linearGradient id="mntMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#08110f" />
            <stop offset="100%" stopColor="#040707" />
          </linearGradient>
          <linearGradient id="mntFore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#050b09" />
            <stop offset="100%" stopColor="#020404" />
          </linearGradient>
        </defs>
        {layers.map((l) => (
          <path key={l.id} d={l.d} fill={l.fill} opacity={l.opacity} />
        ))}
      </svg>
    </div>
  );
}
