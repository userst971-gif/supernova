import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { api, formatMoney } from '../lib/api';
import { toast } from '../components/ToastHost';

const CATEGORIES = ['hoodies', 'tees', 'outerwear'];
const ALL_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const emptyForm = {
  name: '',
  category: 'tees',
  description: '',
  price: '',
  compare_at_price: '',
  sizes: ['M', 'L', 'XL'],
  colors: ['Void Black'],
  stock: 10,
  featured: false,
  images: [],
};

export default function Studio() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      navigate(user ? '/auth' : '/auth');
      return;
    }
    if (user?.role === 'admin') loadProducts();
    setLoaded(true);
  }, [user, loading]);

  const loadProducts = async () => {
    try {
      const data = await api.get('/products');
      setProducts(data.products);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const startEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      description: p.description,
      price: String(p.price),
      compare_at_price: p.compare_at_price ? String(p.compare_at_price) : '',
      sizes: p.sizes || [],
      colors: p.colors || [],
      stock: p.stock,
      featured: p.featured,
      images: p.images || [],
    });
    setFiles([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setFiles([]);
  };

  const toggleSize = (s) =>
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(s) ? f.sizes.filter((x) => x !== s) : [...f.sizes, s],
    }));

  const removeImage = (img) => setForm((f) => ({ ...f, images: f.images.filter((x) => x !== img) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('Give the garment a name.', 'error');
    if (!form.price) return toast('Set a price.', 'error');

    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('category', form.category);
    fd.append('description', form.description);
    fd.append('price', form.price);
    fd.append('compare_at_price', form.compare_at_price || '');
    fd.append('stock', form.stock);
    fd.append('featured', form.featured);
    fd.append('images', JSON.stringify(form.images));
    form.sizes.forEach((s) => fd.append('sizes', s));
    form.colors.forEach((c) => fd.append('colors', c));
    files.forEach((file) => fd.append('images', file));

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, null, { formData: fd });
        toast('Garment updated.');
      } else {
        await api.post('/products', null, { formData: fd });
        toast('New drop published.');
      }
      resetForm();
      loadProducts();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (p) => {
    if (!window.confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    try {
      await api.del(`/products/${p.id}`);
      toast('Garment deleted.');
      loadProducts();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (loading || !loaded) {
    return <div className="container-x min-h-screen pt-40 text-center text-white/40">Aligning telescopes…</div>;
  }

  if (!user) return null;

  return (
    <div className="relative z-10 min-h-screen pt-28">
      <div className="container-x">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Creator Studio</p>
          <h1 className="text-glow-soft mt-2 text-4xl font-bold text-white">
            Forge the <span className="text-aurora-400">Drop</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/50">
            Design garments, upload photography, set pricing and stock. Changes are live
            instantly across the storefront.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-5">
          <form onSubmit={submit} className="card-dark self-start p-8 lg:col-span-3">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
                {editing ? `Edit — ${editing.name}` : 'New garment'}
              </h2>
              {editing && (
                <button type="button" onClick={resetForm} className="text-xs tracking-widest text-white/50 hover:text-white">
                  CANCEL
                </button>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <label className="label" htmlFor="pname">Name</label>
                <input id="pname" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nebula Oversized Hoodie" />
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="cat">Category</label>
                  <select id="cat" className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-black">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="price">Price ($)</label>
                  <input id="price" type="number" step="0.01" min="0" className="field" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="148.00" />
                </div>
                <div>
                  <label className="label" htmlFor="compare">Compare at ($)</label>
                  <input id="compare" type="number" step="0.01" min="0" className="field" value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} placeholder="optional" />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="desc">Description</label>
                <textarea id="desc" rows="4" className="field resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell the story of the garment…" />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label">Sizes</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSize(s)}
                        className={`h-10 w-10 rounded-full border text-xs font-medium transition-all ${
                          form.sizes.includes(s)
                            ? 'border-aurora-400 bg-aurora-400/15 text-aurora-300'
                            : 'border-white/10 text-white/50'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="stock">Stock</label>
                  <input id="stock" type="number" min="0" className="field" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })} />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="colors">Colors (comma separated)</label>
                <input id="colors" className="field" value={form.colors.join(', ')} onChange={(e) => setForm({ ...form, colors: e.target.value.split(',').map((c) => c.trim()).filter(Boolean) })} placeholder="Void Black, Emerald Dust" />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-4">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="h-4 w-4 accent-aurora-400" />
                <span className="text-sm text-white/70">Feature on the homepage constellation</span>
              </label>

              <div>
                <label className="label">Images</label>
                <div className="flex flex-wrap gap-3">
                  {form.images.map((img) => (
                    <div key={img} className="relative">
                      <img src={img} alt="" className="h-24 w-20 rounded-lg border border-white/10 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(img)}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 text-white/40 transition-colors hover:border-aurora-400/50 hover:text-aurora-300">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="text-[9px] tracking-widest">UPLOAD</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
                      multiple
                      className="hidden"
                      onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                    />
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <span key={i} className="chip">+ {f.name}</span>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" disabled={saving} className="btn-aurora w-full text-sm">
                {saving ? 'FORGING…' : editing ? 'UPDATE GARMENT' : 'PUBLISH GARMENT'}
              </button>
            </div>
          </form>

          <div className="lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
              Live catalog ({products.length})
            </h2>
            <div className="space-y-3">
              {products.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-dark flex items-center gap-4 p-4"
                >
                  <img src={p.images?.[0]} alt="" className="h-16 w-14 rounded-lg border border-white/10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {p.name}
                      {p.featured && <span className="ml-2 text-[10px] uppercase text-aurora-300">● Featured</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-widest text-white/40">
                      {p.category} · {formatMoney(p.price)} · {p.stock} left
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(p)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 hover:border-aurora-400/50 hover:text-aurora-300">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                      </svg>
                    </button>
                    <button onClick={() => removeProduct(p)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 hover:border-red-400/50 hover:text-red-400">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
