import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { api, formatMoney } from '../../lib/api';
import { toast } from '../../components/ToastHost';

const EASE = [0.22, 1, 0.36, 1];

function StatCard({ label, value, sub, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="card-dark p-5"
    >
      <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ? 'text-aurora-300' : 'text-white'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </motion.div>
  );
}

function StatusDot({ status }) {
  const map = {
    OUT_OF_STOCK: 'bg-red-400',
    LOW_STOCK: 'bg-amber-400',
    IN_STOCK: 'bg-aurora-400',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[status] || 'bg-white/30'}`} />;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/analytics')
      .then(setData)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-white/[0.05]" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-white/[0.05]" />
      </div>
    );
  }

  const { totals, revenue_trend: trend, top_products, top_variants, inventory } = data;
  const maxRevenue = Math.max(...trend.map((d) => d.revenue), 1);
  const trendAsc = [...trend].reverse();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Overview</p>
        <h1 className="text-glow-soft mt-2 text-3xl font-bold text-white">
          Command <span className="text-aurora-400">dashboard</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(totals.revenue)} sub={`${formatMoney(totals.paid_revenue)} paid`} accent />
        <StatCard label="Orders" value={totals.orders} sub={`${totals.pending_orders} pending`} />
        <StatCard label="Avg order" value={formatMoney(totals.aov)} />
        <StatCard label="Customers" value={totals.customers} sub={`+${totals.new_customers_30d} in 30d`} />
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="card-dark p-6 xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Revenue trend</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Last 14 days</h2>
            </div>
            <span className="text-aurora-300">{formatMoney(totals.revenue)}</span>
          </div>
          <div className="flex h-44 items-end gap-2">
            {trendAsc.map((d) => (
              <div key={d.day} className="group relative flex flex-1 flex-col items-center justify-end gap-2">
                <span className="pointer-events-none absolute -top-7 whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {formatMoney(d.revenue)}
                </span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-aurora-700/40 to-aurora-400/80 transition-all group-hover:to-aurora-300"
                  style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}
                />
                <span className="text-[9px] uppercase text-white/35">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-dark p-6">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Inventory health</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{inventory.total} variants</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-white/60"><StatusDot status="IN_STOCK" /> In stock</span>
              <span className="font-semibold text-white">{inventory.in_stock}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-white/60"><StatusDot status="LOW_STOCK" /> Low stock</span>
              <Link to="/admin/inventory" className="font-semibold text-amber-300 hover:underline">{inventory.low_stock}</Link>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-white/60"><StatusDot status="OUT_OF_STOCK" /> Out of stock</span>
              <Link to="/admin/inventory" className="font-semibold text-red-300 hover:underline">{inventory.out_of_stock}</Link>
            </div>
          </div>
          {inventory.low_stock_items.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-white/10 pt-4">
              {inventory.low_stock_items.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-white/60">{v.sku}</span>
                  <span className="ml-2 shrink-0 font-mono text-amber-300">{v.stock_quantity} left</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <div className="card-dark p-6">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Top products</p>
          <div className="mt-4 space-y-3">
            {top_products.length === 0 && <p className="text-sm text-white/40">No sales yet.</p>}
            {top_products.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate text-white/80">{p.name}</span>
                <span className="flex shrink-0 items-center gap-4">
                  <span className="text-white/40">{p.units} units</span>
                  <span className="w-16 text-right font-mono text-aurora-300">{formatMoney(p.revenue)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-dark p-6">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Top variants</p>
          <div className="mt-4 space-y-3">
            {top_variants.length === 0 && <p className="text-sm text-white/40">No sales yet.</p>}
            {top_variants.map((v) => (
              <div key={v.variant_snapshot} className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate text-white/80">
                  {v.product_name} <span className="text-white/40">· {v.size} {v.color}</span>
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-aurora-300">{formatMoney(v.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
