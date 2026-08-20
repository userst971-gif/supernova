export default function QuantityStepper({ value, onChange, min = 1, max = 99, disabled }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/15">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className="flex h-10 w-10 items-center justify-center text-white/60 hover:text-aurora-300 disabled:opacity-30"
      >
        −
      </button>
      <span className="w-8 text-center text-sm text-white">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className="flex h-10 w-10 items-center justify-center text-white/60 hover:text-aurora-300 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
