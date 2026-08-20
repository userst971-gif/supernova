import { useMemo, useState } from 'react';

export default function SizeSelector({ sizes = [], selected, onChange, stockBySize = {} }) {
  const [internal, setInternal] = useState(null);

  const value = onChange ? selected : internal;
  const setValue = (v) => (onChange ? onChange(v) : setInternal(v));

  const unique = useMemo(() => [...new Set(sizes)], [sizes]);

  if (!unique.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {unique.map((size) => {
        const left = stockBySize[size];
        const out = typeof left === 'number' && left <= 0;
        return (
          <button
            key={size}
            type="button"
            disabled={out}
            onClick={() => setValue(size)}
            title={out ? 'Sold out' : undefined}
            className={`flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-xs font-medium tracking-widest transition-all ${
              out
                ? 'cursor-not-allowed border-white/5 text-white/25 line-through'
                : value === size
                  ? 'border-aurora-400 bg-aurora-400/15 text-aurora-300 shadow-glow'
                  : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white'
            }`}
          >
            {size}
          </button>
        );
      })}
    </div>
  );
}
