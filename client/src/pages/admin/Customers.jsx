import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { api, formatMoney } from '../../lib/api';
import { toast } from '../../components/ToastHost';

const EASE = [0.22, 1, 0.36, 1];

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const isAdmin = user?.role === 'admin';

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 25 });
    if (search) params.set('search', search);
    api
      .get(`/admin/customers?${params}`)
      .then((data) => {
        setCustomers(data.customers);
        setTotal(data.total);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (c) => {
    setSelected(c);
    setDetail(null);
    api
      .get(`/admin/customers/${c.id}`)
      .then((data) => setDetail(data.customer))
      .catch((e) => toast(e.message, 'error'));
  };

  const toggleActive = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const data = await api.patch(`/admin/customers/${detail.id}`, { active: detail.active ? false : true });
      setDetail((d) => ({ ...d, active: data.customer.active }));
      setSelected((s) => ({ ...s, active: data.customer.active }));
      toast(data.customer.active ? 'Account re-enabled' : 'Account suspended');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Accounts</p>
        <h1 className="text-glow-soft mt-2 text-3xl font-bold text-white">
          Customers <span className="text-aurora-400">({total})</span>
        </h1>
      </div>

      <div className="card-dark flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name or email…"
          className="field flex-1"
        />
      </div>

      <div className="card-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.25em] text-white/40">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Total spent</th>
                <th className="px-4 py-3 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-4"><div className="h-6 animate-pulse rounded bg-white/[0.05]" /></td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-white/40">No customers found.</td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openDetail(c)}
                    className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03] ${selected?.id === c.id ? 'bg-aurora-400/[0.06]' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-white/85">{c.name}</p>
                      <p className="text-xs text-white/40">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-white/60">{c.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-mono text-white">{c.order_count}</td>
                    <td className="px-4 py-3 font-mono text-aurora-300">{formatMoney(c.total_spent)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${c.active ? 'border-aurora-400/40 text-aurora-300' : 'border-red-400/40 text-red-300'}`}>
                        {c.active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
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

      {detail && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="card-dark p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-white">{detail.name}</p>
              <p className="text-sm text-white/50">{detail.email} · joined {detail.created_at?.slice(0, 10)}</p>
            </div>
            {isAdmin && (
              <button
                disabled={busy}
                onClick={toggleActive}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all disabled:opacity-40 ${
                  detail.active ? 'border-red-400/40 text-red-300 hover:bg-red-400/10' : 'border-aurora-400/40 text-aurora-300 hover:bg-aurora-400/10'
                }`}
              >
                {detail.active ? 'Suspend account' : 'Re-enable account'}
              </button>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 text-center sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 p-4">
              <p className="text-2xl font-bold text-white">{detail.order_count}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">Orders</p>
            </div>
            <div className="rounded-lg border border-white/10 p-4">
              <p className="text-2xl font-bold text-aurora-300">{formatMoney(detail.total_spent)}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">Lifetime value</p>
            </div>
            <div className="rounded-lg border border-white/10 p-4">
              <p className="text-2xl font-bold text-white/70">{detail.orders?.length || 0}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">Recent orders</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="label">Order history</p>
            <div className="mt-2 space-y-2">
              {(detail.orders || []).length === 0 && <p className="text-sm text-white/40">No orders yet.</p>}
              {(detail.orders || []).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 px-4 py-3 text-sm">
                  <div>
                    <p className="font-mono text-aurora-300">{o.order_ref}</p>
                    <p className="text-xs text-white/40">{o.created_at?.slice(0, 16)} · {o.items.length} item(s)</p>
                  </div>
                  <span className="font-mono text-white">{formatMoney(o.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
