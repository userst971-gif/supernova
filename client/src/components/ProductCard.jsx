import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { formatMoney } from '../lib/api';
import ColorSwatch from './ColorSwatch';

export default function ProductCard({ product, index = 0 }) {
  const { addItem } = useCart();
  const firstVariant = product.variants?.find((v) => v.active) || product.variants?.[0];
  const colorOptions = [...new Set(
    (product.variants?.filter((v) => v.active).length
      ? product.variants.filter((v) => v.active)
      : product.variants || []
    ).map((v) => v.color)
  )];
  const hexFor = (c) => product.variants?.find((v) => v.color === c)?.color_hex;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: (index % 4) * 0.08, ease: 'easeOut' }}
      className="group relative"
    >
      <Link to={`/product/${product.slug}`} className="block">
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#050807] transition-colors duration-500 hover:border-aurora-400/30 hover:shadow-[0_0_40px_-8px_rgba(33,245,154,0.25)]">
          <img
            src={product.images?.[0]}
            alt={product.name}
            loading="lazy"
            className="aspect-[4/5] w-full object-cover opacity-90 transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-45" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-aurora-500/[0.07] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {product.compare_at_price && (
            <span className="absolute left-3 top-3 rounded-full bg-aurora-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-black">
              Sale
            </span>
          )}
          {product.stock === 0 && (
            <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
              Sold out
            </span>
          )}

          <div className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-between opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.preventDefault();
                addItem(product.id, product.sizes?.[0] || 'OS', 1, firstVariant?.color).catch(() => {});
              }}
              disabled={product.stock === 0}
              className="rounded-full bg-white/95 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-black shadow-lg transition-colors hover:bg-aurora-300"
            >
              Quick add
            </button>
            <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-white/90 backdrop-blur">
              {product.sizes?.length} sizes
            </span>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <Link
            to={`/product/${product.slug}`}
            className="text-sm font-medium text-white transition-colors hover:text-aurora-300"
          >
            {product.name}
          </Link>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-white/40">
            {product.category}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{formatMoney(product.price)}</p>
          {product.compare_at_price && (
            <p className="text-xs text-white/40 line-through">{formatMoney(product.compare_at_price)}</p>
          )}
        </div>
      </div>
      {colorOptions.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          {colorOptions.map((c) => (
            <ColorSwatch key={c} name={c} hex={hexFor(c)} size={13} />
          ))}
          <span className="ml-1 text-[10px] uppercase tracking-widest text-white/35">
            {colorOptions.length} color{colorOptions.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </motion.div>
  );
}
