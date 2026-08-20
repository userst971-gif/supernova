import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { api, formatMoney } from '../../lib/api';
import { toast } from '../../components/ToastHost';

const EASE = [0.22, 1, 0.36, 1];

function StatusPill({ status }) {
  const map = {
    OUT_OF_STOCK: 'border-red-400/40 bg-red-400/10 text-red-300',
    LOW_STOCK: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
    IN_STOCK: 'border-aurora-400/40 bg-aurora-400/10 text-aurora-300',
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${map[status] || 'border-white/10 text-white/50'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const [variants, setVariants] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === 'admin';

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 30 });
    if (status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    api
      .get(`/admin/variants?${params}`)
      .then((data) => {
        setVariants(data.variants);
        setTotal(data.total);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (v) => {
    setSelected(v);
    setDetail(null);
    api
      .get(`/admin/variants/${v.id}`)
      .then((data) => setDetail(data.variant))
      .catch((e) => toast(e.message, 'error'));
  };

  const adjust = async (type, quantity, note) => {
    if (!selected) return;
    setBusy(true);
    try {
      const data = await api.post(`/admin/variants/${selected.id}/stock`, { type, quantity, note });
      toast(`${type} recorded — ${data.variant.stock_quantity} on hand`);
      openDetail(data.variant);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Stock control</p>
        <h1 className="text-glow-soft mt-2 text-3xl font-bold text-white">
          Inventory <span className="text-aurora-400">({total})</span>
        </h1>
      </div>

      <div className="card-dark flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search product, sku, colour, size…"
          className="field flex-1"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="field sm:w-44"
        >
          <option value="all">All stock levels</option>
          <option value="IN_STOCK">In stock</option>
          <option value="LOW_STOCK">Low stock</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
        </select>
      </div>

      <div className="card-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.25em] text-white/40">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Colour</th>
                <th className="px-4 py-3 font-medium">On hand</th>
                <th className="px-4 py-3 font-medium">Reserved</th>
                <th className="px-4 py-3 font-medium">Available</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Level</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-4"><div className="h-6 animate-pulse rounded bg-white/[0.05]" /></td>
                  </tr>
                ))
              ) : variants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-white/40">No variants found.</td>
                </tr>
              ) : (
                variants.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => openDetail(v)}
                    className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03] ${selected?.id === v.id ? 'bg-aurora-400/[0.06]' : ''}`}
                  >
                    <td className="px-4 py-3 text-white/85">{v.product_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/50">{v.sku}</td>
                    <td className="px-4 py-3 text-white/70">{v.size}</td>
                    <td className="px-4 py-3 text-white/70">{v.color}</td>
                    <td className="px-4 py-3 font-mono text-white">{v.stock_quantity}</td>
                    <td className="px-4 py-3 font-mono text-white/50">{v.reserved}</td>
                    <td className={`px-4 py-3 font-mono ${v.available > 0 ? 'text-aurora-300' : 'text-red-300'}`}>{v.available}</td>
                    <td className="px-4 py-3 font-mono text-white/70">{formatMoney(v.price)}</td>
                    <td className="px-4 py-3"><StatusPill status={v.stock_status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-white/50">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30 hover:text-white">Previous</button>
            <span>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30 hover:text-white">Next</button>
          </div>
        )}
      </div>

      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="card-dark p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-white">{selected.product_name}</p>
              <p className="mt-1 font-mono text-xs text-white/50">{selected.sku} · {selected.size} / {selected.color}</p>
            </div>
            <StatusPill status={selected.stock_status} />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border border-white/10 p-4">
              <p className="text-2xl font-bold text-white">{selected.stock_quantity}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">On hand</p>
            </div>
            <div className="rounded-lg border border-white/10 p-4">
              <p className="text-2xl font-bold text-white/70">{selected.reserved}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">Reserved</p>
            </div>
            <div className="rounded-lg border border-white/10 p-4">
              <p className="text-2xl font-bold text-aurora-300">{selected.available}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">Available</p>
            </div>
          </div>

          {isAdmin && (
            <div className="mt-6">
              <p className="label">Adjust stock</p>
              <StockOpForm busy={busy} onSubmit={adjust} />
            </div>
          )}

          {detail && (
            <div className="mt-6">
              <p className="label">Movement history</p>
              <div className="mt-2 space-y-1.5">
                {detail.movements.length === 0 && <p className="text-sm text-white/40">No movements recorded yet.</p>}
                {detail.movements.slice(0, 20).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/5 px-4 py-2 text-xs">
                    <span className="text-white/50">{m.created_at?.slice(0, 16)}</span>
                    <span className="font-semibold uppercase tracking-widest text-aurora-300">{m.type}</span>
                    <span className={`font-mono ${m.quantity > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </span>
                    <span className="truncate text-white/40">{m.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function StockOpForm({ busy, onSubmit }) {
  const [type, setType] = useState('RESTOCK');
  const [quantity, setQuantity] = useState(10);
  const [note, setNote] = useState('');

  return (
    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
      <select value={type} onChange={(e) => setType(e.target.value)} className="field sm:w-44">
        <option value="RESTOCK">RESTOCK +</option>
        <option value="ADJUSTMENT">ADJUST +</option>
        <option value="DAMAGE">DAMAGE −</option>
        <option value="RETURN">RETURN +</option>
      </select>
      <input
        type="number"
        min="1"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="field sm:w-28"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="field flex-1"
      />
      <button
        disabled={busy || !Number(quantity)}
        onClick={() => onSubmit(type, Number(quantity), note)}
        className="btn-aurora px-5 py-2 text-xs disabled:opacity-40"
      >
        RECORD
      </button>
    </div>
  );
}
