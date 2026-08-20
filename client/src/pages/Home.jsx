import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Hero from '../components/Hero';
import ProductCard from '../components/ProductCard';
import { api } from '../lib/api';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/products/featured')
      .then((data) => setFeatured(data.products))
      .catch(() => setFeatured([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Hero />

      <section className="relative z-10 py-28">
        <div className="container-x">
          <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-[10px] uppercase tracking-[0.5em] text-aurora-300/80">Drop 004</p>
              <h2 className="text-glow-fade mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">
                The <span className="text-gradient-emerald">Drop</span>
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#8A9691]">
                Heavyweight garments cut for the void. Each drop is produced once, lit by
                the aurora, and never restocked.
              </p>
            </div>
            <Link
              to="/shop"
              className="group hidden items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-aurora-300/80 transition-colors hover:text-aurora-300 md:flex"
            >
              View the collection
              <span className="h-px w-10 bg-aurora-400/50 transition-all duration-300 group-hover:w-16" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-white/[0.04]" />
                ))
              : featured.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-24">
        <div className="container-x">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="card-dark relative overflow-hidden p-10 text-center sm:p-16"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(33,245,154,0.10),transparent_60%)]" />
            <div className="relative">
              <p className="text-[10px] uppercase tracking-[0.5em] text-aurora-300/80">Custom apparel</p>
              <h2 className="text-glow-fade mx-auto mt-4 max-w-2xl text-3xl font-bold leading-tight text-white sm:text-5xl">
                Your design. Your garment.
                <br />
                <span className="text-gradient-emerald">Worn on a real fit.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-[#8A9691]">
                Upload your artwork, map it onto a 3D hoodie or tee, pick your color and
                size, then ship it straight from the studio.
              </p>
              <Link to="/design" className="btn-aurora mt-8 text-xs">
                ENTER THE 3D STUDIO
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
