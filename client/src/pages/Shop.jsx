import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProductCard from '../components/ProductCard';
import { api } from '../lib/api';

const CATEGORIES = ['all', 'hoodies', 'tees', 'outerwear'];

const SORTS = [
  { value: 'new', label: 'Newest' },
  { value: 'price_asc', label: 'Price · Low to High' },
  { value: 'price_desc', label: 'Price · High to Low' },
  { value: 'name', label: 'Name' },
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'new';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (category !== 'all') qs.set('category', category);
    qs.set('sort', sort);
    api
      .get(`/products?${qs}`)
      .then((data) => setProducts(data.products))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [category, sort]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  };

  const resultLabel = useMemo(() => {
    const count = products.length;
    if (category === 'all') return `${count} ${count === 1 ? 'garment' : 'garments'} in orbit`;
    return `${count} ${category} ${count === 1 ? 'garment' : 'garments'}`;
  }, [products, category]);

  return (
    <div className="relative z-10 min-h-screen pt-32">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-10"
        >
          <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Catalog</p>
          <h1 className="text-glow-soft mt-2 text-4xl font-bold text-white sm:text-5xl">
            The <span className="text-aurora-400">Collection</span>
          </h1>
        </motion.div>

        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setParam('category', c)}
                className={`rounded-full border px-5 py-2 text-xs uppercase tracking-widest transition-all ${
                  category === c
                    ? 'border-aurora-400 bg-aurora-400/15 text-aurora-300 shadow-glow'
                    : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="sort" className="text-[11px] uppercase tracking-widest text-white/40">
              Sort
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setParam('sort', e.target.value)}
              className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs tracking-widest text-white/80 outline-none focus:border-aurora-400/70"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value} className="bg-black">
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mb-8 font-mono text-xs tracking-widest text-white/40">{resultLabel}</p>

        {loading ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="card-dark mx-auto max-w-md p-12 text-center">
            <p className="text-white/60">Nothing here. Even light gets trapped sometimes.</p>
            <button
              onClick={() => setParam('category', 'all')}
              className="btn-ghost mt-6 text-xs"
            >
              RESET FILTERS
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
