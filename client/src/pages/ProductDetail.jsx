import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import SizeSelector from '../components/SizeSelector';
import QuantityStepper from '../components/QuantityStepper';
import ProductCard from '../components/ProductCard';
import ColorSwatch from '../components/ColorSwatch';
import { toast } from '../components/ToastHost';
import { api, formatMoney } from '../lib/api';

export default function ProductDetail() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSize(null);
    setColor(null);
    setQty(1);
    setActiveImage(0);
    api
      .get(`/products/${slug}`)
      .then((data) => {
        setProduct(data.product);
        return api.get(`/products?category=${data.product.category}`);
      })
      .then((data) => setRelated(data.products.filter((p) => p.slug !== slug).slice(0, 4)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="container-x min-h-screen pt-36">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-[4/5] animate-pulse rounded-2xl bg-white/[0.05]" />
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-6 w-24 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-40 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container-x flex min-h-screen flex-col items-center justify-center pt-20 text-center">
        <p className="text-white/60">{error || 'Product lost in the void.'}</p>
        <Link to="/shop" className="btn-ghost mt-6 text-xs">BACK TO SHOP</Link>
      </div>
    );
  }

  const discount = product.compare_at_price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  const variants = product.variants || [];
  const colors = product.colors || [];
  const colorOptions = variants.filter((v) => v.active).length
    ? [...new Set(variants.filter((v) => v.active).map((v) => v.color))]
    : colors;
  const activeVariant =
    color && size
      ? variants.find((v) => v.active && v.color === color && v.size === size)
      : null;
  const perColorSizes = color
    ? variants.filter((v) => v.active && v.color === color).map((v) => v.size)
    : product.sizes;
  const inStock = activeVariant ? activeVariant.stock_quantity : product.stock;

  const handleAdd = () => {
    if (colorOptions.length > 1 && !color) {
      setError('Select a colorway first.');
      toast('Select a colorway first.', 'error');
      return;
    }
    if (!size) {
      setError('Select a size first.');
      toast('Select a size first.', 'error');
      return;
    }
    if (inStock === 0) {
      setError('This size and colorway is sold out.');
      toast('This size and colorway is sold out.', 'error');
      return;
    }
    setError(null);
    addItem(product.id, size, qty, color || colorOptions[0] || null).then(() => toast(`${product.name} added to cart`)).catch((e) => toast(e.message, 'error'));
  };

  return (
    <div className="relative z-10 min-h-screen pt-28">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <img
                src={color ? product.color_images?.[color] || product.images[0] : product.images[activeImage] || product.images[0]}
                alt={product.name}
                className="aspect-[4/5] w-full object-cover"
              />
              {discount > 0 && (
                <span className="absolute left-4 top-4 rounded-full bg-aurora-400 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-black">
                  −{discount}%
                </span>
              )}
              {product.stock === 0 && (
                <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                  Sold out
                </span>
              )}
            </div>
            {!color && product.images.length > 1 && (
              <div className="mt-4 flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={img + i}
                    onClick={() => setActiveImage(i)}
                    className={`overflow-hidden rounded-lg border transition-all ${
                      i === activeImage
                        ? 'border-aurora-400 shadow-glow'
                        : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="h-20 w-16 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">{product.category}</p>
            <h1 className="text-glow-soft mt-2 text-3xl font-bold text-white sm:text-4xl">{product.name}</h1>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-2xl font-semibold text-white">{formatMoney(product.price)}</span>
              {product.compare_at_price && (
                <span className="text-lg text-white/40 line-through">{formatMoney(product.compare_at_price)}</span>
              )}
            </div>

            <p className="mt-6 text-sm leading-relaxed text-white/55">{product.description}</p>

            {colorOptions.length > 0 && (
              <div className="mt-6">
                <p className="label">Colorway</p>
                <div className="flex flex-wrap gap-3">
                  {colorOptions.map((c) => {
                    const hex = variants.find((v) => v.active && v.color === c)?.color_hex;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setColor(c);
                          setSize(null);
                        }}
                        className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 transition-all ${
                          color === c ? 'border-aurora-400 bg-aurora-400/10' : 'border-white/15 hover:border-white/30'
                        }`}
                      >
                        <ColorSwatch name={c} hex={hex} size={22} selected={color === c} />
                        <span
                          className={`text-xs ${
                            color === c ? 'text-aurora-300' : 'text-white/70'
                          }`}
                        >
                          {c}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-8">
              <p className="label">Select size</p>
              <SizeSelector
                sizes={perColorSizes}
                selected={size}
                onChange={setSize}
                stockBySize={color ? Object.fromEntries(
                  variants.filter((v) => v.active && v.color === color).map((v) => [v.size, v.stock_quantity])
                ) : {}}
              />
            </div>

            <div className="mt-6 flex items-center gap-4">
              <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, inStock)} />
              <span className="font-mono text-xs text-white/40">
                {inStock > 0 ? `${inStock} in stock` : 'Sold out'}
              </span>
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleAdd}
                disabled={inStock === 0}
                className="btn-aurora flex-1 text-sm"
              >
                ADD TO CART
              </button>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="card-dark p-4 text-center">
                <p className="text-aurora-300">480gsm</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">Heavyweight</p>
              </div>
              <div className="card-dark p-4 text-center">
                <p className="text-aurora-300">Pre-washed</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">Zero shrink</p>
              </div>
              <div className="card-dark p-4 text-center">
                <p className="text-aurora-300">Void dye</p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">Won’t fade</p>
              </div>
            </div>
          </motion.div>
        </div>

        {related.length > 0 && (
          <div className="mt-28">
            <div className="mb-8">
              <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Also in orbit</p>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Complete the set</h2>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
