import { useCallback, useEffect, useRef, useState } from 'react';

const PLACEMENT_MIN = -0.4;
const PLACEMENT_MAX = 0.4;
const SCALE_MIN = 0.5;
const SCALE_MAX = 2.5;

const TOOLS = [
  { id: 'move', label: 'Move', icon: '✥' },
  { id: 'scale', label: 'Scale', icon: '⬡' },
  { id: 'rotate', label: 'Rotate', icon: '↻' },
];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export default function DesignEditor({ placement, onChange, artUrl, garmentColor }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const [tool, setTool] = useState('move');
  const [size, setSize] = useState({ w: 0, h: 0 });

  const { x, y, scale, rotation } = placement;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoneToPixel = useCallback(
    (zx, zy) => {
      if (!size.w || !size.h) return { px: 0, py: 0 };
      const zoneW = 0.34 * scale;
      const zoneH = 0.26 * scale;
      const px = (0.5 + zx / 0.8) * size.w;
      const py = (0.5 - zy / 0.8) * size.h;
      return { px, py, zoneW: zoneW * size.w * 0.8, zoneH: zoneH * size.h * 0.8 };
    },
    [size, scale]
  );

  const pixelToZone = useCallback(
    (px, py) => {
      if (!size.w || !size.h) return { x: 0, y: 0 };
      const zx = ((px / size.w) - 0.5) * 0.8;
      const zy = (0.5 - (py / size.h)) * 0.8;
      return { x: clamp(zx, PLACEMENT_MIN, PLACEMENT_MAX), y: clamp(zy, PLACEMENT_MIN, PLACEMENT_MAX) };
    },
    [size]
  );

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (tool === 'move') {
        dragRef.current = { mode: 'move', startX: px, startY: py, origX: x, origY: y };
      } else if (tool === 'scale') {
        const { px: cx, py: cy } = zoneToPixel(0, 0);
        const dist = Math.hypot(px - cx, py - cy);
        dragRef.current = { mode: 'scale', startDist: dist, origScale: scale };
      } else if (tool === 'rotate') {
        const { px: cx, py: cy } = zoneToPixel(0, 0);
        const angle = Math.atan2(py - cy, px - cx);
        dragRef.current = { mode: 'rotate', startAngle: angle, origRotation: rotation };
      }

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d) return;
        const r = canvasRef.current?.getBoundingClientRect();
        if (!r) return;
        const cpx = ev.clientX - r.left;
        const cpy = ev.clientY - r.top;

        if (d.mode === 'move') {
          const dx = (cpx - d.startX) / (r.width * 0.8) * 0.8;
          const dy = -(cpy - d.startY) / (r.height * 0.8) * 0.8;
          onChange({
            ...placement,
            x: clamp(d.origX + dx, PLACEMENT_MIN, PLACEMENT_MAX),
            y: clamp(d.origY + dy, PLACEMENT_MIN, PLACEMENT_MAX),
          });
        } else if (d.mode === 'scale') {
          const { px: cx, py: cy } = zoneToPixel(0, 0);
          const dist = Math.hypot(cpx - cx, cpy - cy);
          const ratio = dist / d.startDist;
          onChange({ ...placement, scale: clamp(d.origScale * ratio, SCALE_MIN, SCALE_MAX) });
        } else if (d.mode === 'rotate') {
          const { px: cx, py: cy } = zoneToPixel(0, 0);
          const angle = Math.atan2(cpy - cy, cpx - cx);
          const delta = ((angle - d.startAngle) * 180) / Math.PI;
          let rot = d.origRotation + delta;
          rot = ((rot % 360) + 360) % 360;
          onChange({ ...placement, rotation: Math.round(rot) });
        }
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [tool, x, y, scale, rotation, placement, onChange, zoneToPixel]
  );

  const { px: cx, py: cy, zoneW, zoneH } = zoneToPixel(x, y);
  const artSize = Math.min(zoneW, zoneH) * 0.9;
  const handleSize = 12;
  const rotHandleDist = Math.max(zoneW, zoneH) * 0.55 + 16;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-medium uppercase tracking-wider transition-all ${
              tool === t.id
                ? 'bg-aurora-400/15 text-aurora-300 shadow-[inset_0_0_0_1px_rgba(45,255,159,0.3)]'
                : 'text-white/45 hover:text-white/70'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative mt-3 flex-1 overflow-hidden rounded-xl border border-white/10 select-none"
        style={{
          backgroundColor: garmentColor || '#16181b',
          cursor: tool === 'move' ? 'grab' : tool === 'scale' ? 'nwse-resize' : 'crosshair',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
      >
        {/* Print zone outline */}
        <div
          className="pointer-events-none absolute rounded-sm"
          style={{
            left: cx - zoneW / 2,
            top: cy - zoneH / 2,
            width: zoneW,
            height: zoneH,
            border: '1px dashed rgba(255,255,255,0.2)',
          }}
        />

        {/* Art image */}
        {artUrl && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: cx - artSize / 2,
              top: cy - artSize / 2,
              width: artSize,
              height: artSize,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={artUrl}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* Crosshair center */}
        <div className="pointer-events-none absolute" style={{ left: cx - 1, top: cy - 1 }}>
          <div className="h-[2px] w-[2px] rounded-full bg-white/40" />
        </div>

        {/* Scale handle (corner) */}
        {tool === 'scale' && artUrl && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: cx + zoneW / 2 - handleSize / 2,
              top: cy - zoneH / 2 - handleSize / 2,
              width: handleSize,
              height: handleSize,
            }}
          >
            <div className="h-full w-full rounded-sm border-2 border-aurora-400 bg-aurora-400/20" />
          </div>
        )}

        {/* Rotation handle */}
        {tool === 'rotate' && artUrl && (
          <>
            <svg
              className="pointer-events-none absolute"
              style={{ left: cx - rotHandleDist - 10, top: cy - rotHandleDist - 10, width: (rotHandleDist + 10) * 2, height: (rotHandleDist + 10) * 2 }}
            >
              <circle
                cx={rotHandleDist + 10}
                cy={rotHandleDist + 10}
                r={rotHandleDist}
                fill="none"
                stroke="rgba(45,255,159,0.25)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            </svg>
            <div
              className="pointer-events-none absolute"
              style={{
                left: cx - handleSize / 2,
                top: cy - rotHandleDist - handleSize / 2,
                width: handleSize,
                height: handleSize,
              }}
            >
              <div className="h-full w-full rounded-full border-2 border-aurora-400 bg-aurora-400/30" />
            </div>
          </>
        )}

        {/* Move guide lines */}
        {tool === 'move' && artUrl && (
          <>
            <div className="pointer-events-none absolute" style={{ left: cx, top: 0, width: 1, height: size.h, backgroundColor: 'rgba(45,255,159,0.15)' }} />
            <div className="pointer-events-none absolute" style={{ left: 0, top: cy, width: size.w, height: 1, backgroundColor: 'rgba(45,255,159,0.15)' }} />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onChange({ ...placement, x: 0, y: 0 })}
          className="flex-1 rounded-lg border border-white/10 py-1.5 text-[10px] uppercase tracking-widest text-white/45 transition-colors hover:border-white/25 hover:text-white"
        >
          Center
        </button>
        <button
          onClick={() => onChange({ scale: 1, rotation: 0, x: 0, y: 0 })}
          className="flex-1 rounded-lg border border-white/10 py-1.5 text-[10px] uppercase tracking-widest text-white/45 transition-colors hover:border-white/25 hover:text-white"
        >
          Reset
        </button>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5">
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.05}
            value={scale}
            onChange={(e) => onChange({ ...placement, scale: Number(e.target.value) })}
            className="h-1 w-16 appearance-none rounded-full bg-white/15 accent-aurora-400"
          />
          <span className="text-[10px] font-mono text-aurora-300">{scale.toFixed(1)}×</span>
        </div>
      </div>
    </div>
  );
}
