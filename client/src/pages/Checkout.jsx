import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { api, formatMoney } from '../lib/api';
import { toast } from '../components/ToastHost';

const SHIPPING_FLAT = 9.0;
const FREE_SHIPPING_FROM = 150;

const emptyForm = {
  name: '',
  email: '',
  address: '',
  city: '',
  zip: '',
  country: '',
};

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);

  const shipping = subtotal >= FREE_SHIPPING_FROM || subtotal === 0 ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const placeOrder = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await api.post('/orders', form);
      setOrder(data.order);
      clearCart();
      toast('Order confirmed — welcome aboard.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (order) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pt-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="card-dark relative w-full max-w-lg overflow-hidden p-10 text-center sm:p-14"
        >
          <div className="animate-pulse-glow pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-aurora-500/15 to-transparent" />
          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aurora-400/15 text-aurora-300">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-glow-soft mt-6 text-3xl font-bold text-white">Order confirmed.</h1>
            <p className="mt-3 font-mono text-sm tracking-widest text-aurora-300">REF {order.order_ref}</p>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              {order.name}, your garments are being pulled from the event horizon.
              A confirmation has been sent to <span className="text-white">{order.email}</span>.
            </p>
            <div className="mt-6 flex items-center justify-center gap-8 border-t border-white/10 pt-6 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40">Paid</p>
                <p className="mt-1 font-semibold text-white">{formatMoney(order.total)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40">Status</p>
                <p className="mt-1 font-semibold uppercase text-aurora-300">{order.status}</p>
              </div>
            </div>
            <Link to="/shop" className="btn-aurora mt-8 w-full text-sm">
              CONTINUE EXPLORING
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen pt-32">
      <div className="container-x">
        <h1 className="text-glow-soft mb-10 text-4xl font-bold text-white">
          Check<span className="text-aurora-400">out</span>
        </h1>

        <div className="grid gap-10 lg:grid-cols-5">
          <form onSubmit={placeOrder} className="card-dark p-8 lg:col-span-3">
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
              Shipping details
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                ['name', 'Full name'],
                ['email', 'Email'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="label" htmlFor={key}>{label}</label>
                  <input
                    id={key}
                    name={key}
                    type={key === 'email' ? 'email' : 'text'}
                    required
                    value={form[key]}
                    onChange={update}
                    className="field"
                    placeholder={label}
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="label" htmlFor="address">Address</label>
                <input id="address" name="address" type="text" required value={form.address} onChange={update} className="field" placeholder="Street address" />
              </div>
              <div>
                <label className="label" htmlFor="city">City</label>
                <input id="city" name="city" type="text" required value={form.city} onChange={update} className="field" placeholder="City" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="label" htmlFor="zip">ZIP / Postal</label>
                  <input id="zip" name="zip" type="text" required value={form.zip} onChange={update} className="field" placeholder="00000" />
                </div>
                <div>
                  <label className="label" htmlFor="country">Country</label>
                  <input id="country" name="country" type="text" required value={form.country} onChange={update} className="field" placeholder="Country" />
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-white/10 bg-black/30 p-5 text-xs leading-relaxed text-white/40">
              Demo store — no real payment is processed. Orders are recorded in the local
              database and decrement live inventory.
            </div>

            <button type="submit" disabled={submitting || items.length === 0} className="btn-aurora mt-8 w-full text-sm">
              {submitting ? 'PLACING ORDER…' : `PAY ${formatMoney(total)}`}
            </button>
          </form>

          <div className="lg:col-span-2">
            <div className="card-dark p-8">
              <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
                Order summary
              </h2>
              {items.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/50">
                  Your cart is empty.{' '}
                  <Link to="/shop" className="text-aurora-300 hover:underline">
                    Fill it.
                  </Link>
                </p>
              ) : (
                <ul className="space-y-5">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-4">
                      <img src={item.image} alt="" className="h-16 w-14 rounded-lg border border-white/10 object-cover" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{item.name}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/40">
                          {item.size} · ×{item.qty}
                        </p>
                      </div>
                      <span className="text-sm text-white">{formatMoney(item.price * item.qty)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8 space-y-2 border-t border-white/10 pt-5 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'Free' : formatMoney(shipping)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
