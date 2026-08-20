import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { api, formatMoney } from '../lib/api';

export default function Account() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      api
        .get('/orders')
        .then((data) => setOrders(data.orders))
        .catch(() => {})
        .finally(() => setLoaded(true));
    }
  }, [user, loading]);

  if (loading || !loaded) {
    return <div className="container-x min-h-screen pt-40 text-center text-white/40">Locating your orders…</div>;
  }
  if (!user) return null;

  return (
    <div className="relative z-10 min-h-screen pt-32">
      <div className="container-x max-w-4xl">
        <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Account</p>
        <h1 className="text-glow-soft mt-2 text-4xl font-bold text-white">
          {user.name.split(' ')[0]}, <span className="text-aurora-400">welcome back</span>
        </h1>
        <p className="mt-2 text-sm text-white/50">{user.email}</p>

        <div className="mt-12">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
            Order history
          </h2>
          {orders.length === 0 ? (
            <div className="card-dark p-10 text-center">
              <p className="text-white/50">No orders yet.</p>
              <Link to="/shop" className="btn-ghost mt-6 text-xs">
                START EXPLORING
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-dark p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs tracking-widest text-aurora-300">REF {o.order_ref}</p>
                      <p className="mt-1 text-xs text-white/40">{o.created_at} UTC</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{formatMoney(o.total)}</p>
                      <span className="mt-1 inline-block rounded-full bg-aurora-400/15 px-3 py-0.5 text-[10px] uppercase tracking-widest text-aurora-300">
                        {o.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                    {o.items.map((it, i) => (
                      <Link
                        key={i}
                        to={`/product/${it.slug}`}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70 transition-colors hover:border-aurora-400/40"
                      >
                        <span>{it.qty}×</span>
                        <span className="text-white">{it.name}</span>
                        <span className="text-white/40">({it.size})</span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
