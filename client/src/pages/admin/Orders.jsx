import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, formatMoney } from '../../lib/api';
import { toast } from '../../components/ToastHost';

const EASE = [0.22, 1, 0.36, 1];

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PRODUCTION',
  'PRINTING',
  'QUALITY_CHECK',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const NEXT = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['PRINTING', 'CANCELLED'],
  PRINTING: ['QUALITY_CHECK', 'CANCELLED'],
  QUALITY_CHECK: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const PAYMENT_STATUSES = ['PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED'];

const STATUS_STYLE = {
  PENDING: 'text-amber-300 border-amber-300/30 bg-amber-300/10',
  CONFIRMED: 'text-sky-300 border-sky-300/30 bg-sky-300/10',
  IN_PRODUCTION: 'text-violet-300 border-violet-300/30 bg-violet-300/10',
  PRINTING: 'text-aurora-300 border-aurora-400/30 bg-aurora-400/10',
  QUALITY_CHECK: 'text-aurora-300 border-aurora-400/30 bg-aurora-400/10',
  PACKED: 'text-teal-300 border-teal-300/30 bg-teal-300/10',
  SHIPPED: 'text-indigo-300 border-indigo-300/30 bg-indigo-300/10',
  DELIVERED: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
  CANCELLED: 'text-red-300 border-red-300/30 bg-red-300/10',
  REFUNDED: 'text-red-300 border-red-300/30 bg-red-300/10',
};

function Badge({ status }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${STATUS_STYLE[status] || 'border-white/10 text-white/50'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'all', payment_status: 'all', search: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.payment_status !== 'all') params.set('payment_status', filters.payment_status);
    if (filters.search) params.set('search', filters.search);
    api
      .get(`/admin/orders?${params}`)
      .then((data) => {
        setOrders(data.orders);
        setTotal(data.total);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (order) => {
    setSelected(order);
    setDetail(null);
    api
      .get(`/admin/orders/${order.id}`)
      .then((data) => setDetail(data.order))
      .catch((e) => toast(e.message, 'error'));
  };

  const transition = async (to) => {
    if (!selected) return;
    setBusy(true);
    try {
      const data = await api.post(`/admin/orders/${selected.id}/status`, { status: to });
      setSelected(data.order);
      setDetail(data.order);
      toast(`Order ${data.order.order_ref} → ${data.order.status}`);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const setPayment = async (status) => {
    if (!selected) return;
    setBusy(true);
    try {
      const data = await api.patch(`/admin/orders/${selected.id}/payment`, { payment_status: status });
      setSelected(data.order);
      setDetail(data.order);
      toast('Payment status updated');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const createPrintJobs = async () => {
    if (!detail) return;
    const ids = detail.items.map((i) => i.id);
    if (!ids.length) return;
    try {
      const data = await api.post('/admin/production/jobs', { order_item_ids: ids });
      toast(`${data.job_ids.length} print job(s) created`);
      openDetail(selected);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Fulfilment</p>
        <h1 className="text-glow-soft mt-2 text-3xl font-bold text-white">
          Orders <span className="text-aurora-400">({total})</span>
        </h1>
      </div>

      <div className="card-dark flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          value={filters.search}
          onChange={(e) => {
            setFilters((f) => ({ ...f, search: e.target.value }));
            setPage(1);
          }}
          placeholder="Search ref, email or name…"
          className="field flex-1"
        />
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            setPage(1);
          }}
          className="field sm:w-44"
        >
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          value={filters.payment_status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, payment_status: e.target.value }));
            setPage(1);
          }}
          className="field sm:w-44"
        >
          <option value="all">Any payment</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <div className="card-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.25em] text-white/40">
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-4"><div className="h-6 animate-pulse rounded bg-white/[0.05]" /></td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-white/40">No orders match.</td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => openDetail(o)}
                    className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03] ${selected?.id === o.id ? 'bg-aurora-400/[0.06]' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-aurora-300">{o.order_ref}</td>
                    <td className="px-4 py-3">
                      <p className="text-white/85">{o.shipping_name}</p>
                      <p className="text-xs text-white/40">{o.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-white/60">{o.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-semibold text-white">{formatMoney(o.total)}</td>
                    <td className="px-4 py-3"><Badge status={o.status} /></td>
                    <td className="px-4 py-3 text-white/60">{o.payment_status.replace('_', ' ')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-white/50">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="disabled:opacity-30 hover:text-white"
            >
              Previous
            </button>
            <span>Page {page} of {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="disabled:opacity-30 hover:text-white"
            >
              Next
            </button>
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
              <p className="font-mono text-lg text-aurora-300">{selected.order_ref}</p>
              <p className="mt-1 text-xs text-white/50">Placed {selected.created_at}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge status={selected.status} />
              <Badge status={selected.payment_status} />
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="label">Ship to</p>
              <p className="mt-1 text-white/85">{selected.shipping_name}</p>
              <p className="text-sm text-white/55">{selected.shipping_address}, {selected.shipping_city}</p>
              <p className="text-sm text-white/55">{selected.shipping_country} {selected.shipping_zip}</p>
              <p className="mt-1 text-sm text-white/55">{selected.customer_email}</p>
            </div>
            <div>
              <p className="label">Advance</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(NEXT[selected.status] || []).map((to) => (
                  <button
                    key={to}
                    disabled={busy}
                    onClick={() => transition(to)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition-all disabled:opacity-40 ${
                      to === 'CANCELLED' || to === 'REFUNDED'
                        ? 'border-red-400/40 text-red-300 hover:bg-red-400/10'
                        : 'border-aurora-400/40 text-aurora-300 hover:bg-aurora-400/10'
                    }`}
                  >
                    → {to.replace('_', ' ')}
                  </button>
                ))}
                {selected.status === 'PENDING' && (
                  <button
                    onClick={createPrintJobs}
                    className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/70 hover:bg-white/10"
                  >
                    Create print jobs
                  </button>
                )}
              </div>
              <p className="label mt-4">Payment</p>
              <select
                value={selected.payment_status}
                disabled={busy}
                onChange={(e) => setPayment(e.target.value)}
                className="field mt-2"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6">
            <p className="label">Items</p>
            {detail ? (
              <div className="mt-2 space-y-2">
                {(detail.items || []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 px-4 py-3 text-sm">
                    <span className="truncate text-white/85">
                      {i.name} <span className="text-white/40">· {i.size}{i.color ? ` / ${i.color}` : ''} · {i.sku}</span>
                    </span>
                    <span className="shrink-0 text-white/60">×{i.quantity}</span>
                    <span className="shrink-0 font-mono text-aurora-300">{formatMoney(i.total_price)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 h-16 animate-pulse rounded-lg bg-white/[0.04]" />
            )}
          </div>

          {detail?.print_jobs?.length > 0 && (
            <div className="mt-6">
              <p className="label">Print jobs</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.print_jobs.map((j) => (
                  <span key={j.id} className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/60">
                    Job #{j.id} <span className="text-aurora-300">{j.status.replace('_', ' ')}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {detail?.history?.length > 0 && (
            <div className="mt-6">
              <p className="label">Timeline</p>
              <ol className="mt-2 space-y-1">
                {detail.history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 text-xs text-white/50">
                    <span className="text-white/30">{h.created_at?.slice(0, 16)}</span>
                    <span>{h.old_status || '—'} → <span className="text-aurora-300">{h.new_status}</span></span>
                    {h.note && <span className="italic text-white/35">“{h.note}”</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
