const TOOLS = [
  { id: 'move', label: 'Move', icon: '✥' },
  { id: 'scale', label: 'Scale', icon: '⬔' },
  { id: 'rotate', label: 'Rotate', icon: '↻' },
];

const FACES = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

export default function DesignToolbar({ tool, onToolChange, face, onFaceChange, placement, onChange }) {
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-md">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => onToolChange(t.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-all ${
              tool === t.id
                ? 'bg-aurora-400/20 text-aurora-300 shadow-[0_0_12px_rgba(45,255,159,0.15)]'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}

        <div className="mx-1 h-5 w-px bg-white/15" />

        {FACES.map((f) => (
          <button
            key={f.id}
            onClick={() => onFaceChange(f.id)}
            className={`rounded-xl px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all ${
              face === f.id
                ? 'bg-aurora-400/20 text-aurora-300'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            {f.label}
          </button>
        ))}

        <div className="mx-1 h-5 w-px bg-white/15" />

        <button
          onClick={() => onChange({ scale: 1, rotation: 0, x: 0, y: 0 })}
          title="Reset"
          className="rounded-xl px-2.5 py-1.5 text-[10px] text-white/40 transition-colors hover:text-red-300"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
