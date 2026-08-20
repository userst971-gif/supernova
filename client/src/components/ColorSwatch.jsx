import { colorHex } from '../lib/colors';

export default function ColorSwatch({ name, hex, size = 18, selected = false, className = '' }) {
  const bg = hex || colorHex(name);
  return (
    <span
      title={name}
      className={`inline-block shrink-0 rounded-full border border-white/25 ${
        selected ? 'ring-2 ring-aurora-400 ring-offset-2 ring-offset-black' : ''
      } ${className}`}
      style={{ width: size, height: size, backgroundColor: bg }}
    />
  );
}
