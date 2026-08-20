import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { formatMoney } from '../lib/api';
import ColorSwatch from './ColorSwatch';

export default function CartDrawer() {
  const { items, subtotal, count, open, closeCart, updateQty, removeItem, loading } = useCart();
  const navigate = useNavigate();

  const freeShipping = 150;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0a0b0c] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <h2 className="text-sm font-semibold tracking-[0.3em] text-white">
                YOUR CART <span className="text-aurora-400">({count})</span>
              </h2>
              <button
                onClick={closeCart}
                aria-label="Close cart"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <p className="text-white/50">Your cart is floating in the void.</p>
                  <Link
                    to="/shop"
                    onClick={closeCart}
                    className="btn-aurora text-xs"
                  >
                    EXPLORE THE DROP
                  </Link>
                </div>
              ) : (
                <ul className="space-y-5">
                  {items.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      className="flex gap-4"
                    >
                      <Link to={`/product/${item.slug}`} onClick={closeCart} className="shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-24 w-20 rounded-xl border border-white/10 object-cover"
                        />
                      </Link>
                      <div className="flex flex-1 flex-col">
                        <div className="flex justify-between gap-2">
                          <Link
                            to={`/product/${item.slug}`}
                            onClick={closeCart}
                            className="text-sm font-medium text-white hover:text-aurora-300"
                          >
                            {item.name}
                          </Link>
                          <button
                            onClick={() => removeItem(item.id)}
                            aria-label="Remove item"
                            className="text-white/40 transition-colors hover:text-red-400"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
                            </svg>
                          </button>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs uppercase tracking-widest text-white/40">
                          Size {item.size}
                          {item.color && (
                            <>
                              <ColorSwatch name={item.color} hex={item.color_hex} size={11} />
                              · {item.color}
                            </>
                          )}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center rounded-full border border-white/10">
                            <button
                              onClick={() => updateQty(item.id, item.qty - 1)}
                              disabled={loading || item.qty <= 1}
                              className="flex h-7 w-7 items-center justify-center text-white/60 hover:text-aurora-300 disabled:opacity-30"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-xs text-white">{item.qty}</span>
                            <button
                              onClick={() => updateQty(item.id, item.qty + 1)}
                              disabled={loading || item.qty >= item.stock}
                              className="flex h-7 w-7 items-center justify-center text-white/60 hover:text-aurora-300 disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-white">
                            {formatMoney(item.price * item.qty)}
                          </span>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-white/10 px-6 py-5">
                {subtotal < freeShipping && (
                  <p className="mb-3 text-xs text-white/50">
                    Add <span className="text-aurora-300">{formatMoney(freeShipping - subtotal)}</span> more for free shipping.
                  </p>
                )}
                <div className="mb-4 flex justify-between text-sm">
                  <span className="text-white/60">SUBTOTAL</span>
                  <span className="font-semibold text-white">{formatMoney(subtotal)}</span>
                </div>
                <button
                  onClick={() => {
                    closeCart();
                    navigate('/checkout');
                  }}
                  disabled={loading}
                  className="btn-aurora w-full text-sm"
                >
                  CHECKOUT — {formatMoney(subtotal)}
                </button>
                <button
                  onClick={closeCart}
                  className="mt-2 w-full text-center text-xs tracking-widest text-white/50 hover:text-white"
                >
                  CONTINUE SHOPPING
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
