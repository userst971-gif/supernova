import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/design', label: 'Design' },
  { to: '/manifesto', label: 'Manifesto' },
];

export default function Navbar() {
  const { count, openCart } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isStaff = user && (user.role === 'admin' || user.role === 'staff');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <motion.header
      initial={{ y: -90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-40"
    >
      <div className="border-b border-white/10 bg-transparent" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <nav className="container-x flex h-20 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-base font-bold tracking-[0.22em] text-white transition-opacity hover:opacity-80">
              AURO<span className="text-aurora-400">RA</span>
            </span>
          </Link>

          <div className="hidden items-center gap-10 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `relative text-[11px] uppercase tracking-[0.3em] transition-colors duration-300 ${
                    isActive ? 'text-aurora-300' : 'text-white/55 hover:text-white/90'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {l.label}
                    <motion.span
                      initial={false}
                      animate={{ opacity: isActive ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute -bottom-2 left-1/2 h-px w-5 -translate-x-1/2 bg-aurora-400 shadow-[0_0_8px_rgba(45,255,159,0.8)]"
                    />
                  </>
                )}
              </NavLink>
            ))}
            {isStaff && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `relative text-[11px] uppercase tracking-[0.3em] transition-colors duration-300 ${
                    isActive ? 'text-aurora-300' : 'text-white/55 hover:text-white/90'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    Admin
                    <motion.span
                      initial={false}
                      animate={{ opacity: isActive ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute -bottom-2 left-1/2 h-px w-5 -translate-x-1/2 bg-aurora-400 shadow-[0_0_8px_rgba(45,255,159,0.8)]"
                    />
                  </>
                )}
              </NavLink>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="hidden items-center gap-4 md:flex">
                <Link
                  to={isStaff ? '/admin' : '/account'}
                  className="text-[11px] uppercase tracking-[0.3em] text-white/55 transition-colors hover:text-aurora-300"
                >
                  {user.name.split(' ')[0]}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-[11px] uppercase tracking-[0.3em] text-white/40 transition-colors hover:text-white"
                >
                  Exit
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="hidden text-[11px] uppercase tracking-[0.3em] text-white/55 transition-colors hover:text-aurora-300 md:block"
              >
                Sign In
              </Link>
            )}

            <button
              onClick={openCart}
              aria-label="Open cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition-all duration-300 hover:border-aurora-400/50 hover:text-aurora-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 7h12l1.5 13h-15L6 7z" strokeLinejoin="round" />
                <path d="M9 10V6a3 3 0 0 1 6 0v4" strokeLinecap="round" />
              </svg>
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-aurora-400 px-1 text-[10px] font-bold text-black"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-white/10 bg-black/70 backdrop-blur-xl md:hidden"
            >
              <div className="container-x flex flex-col gap-5 py-6">
                {links.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setMenuOpen(false)}
                    className="text-base uppercase tracking-[0.3em] text-white/80"
                  >
                    {l.label}
                  </Link>
                ))}
                <Link to="/design" onClick={() => setMenuOpen(false)} className="text-base uppercase tracking-[0.3em] text-aurora-300">
                  Design your own
                </Link>
                {isStaff && (
                  <Link to="/admin" onClick={() => setMenuOpen(false)} className="text-base uppercase tracking-[0.3em] text-aurora-300">
                    Admin
                  </Link>
                )}
                {user ? (
                  <>
                    <Link to={isStaff ? '/admin' : '/account'} className="text-base uppercase tracking-[0.3em] text-white/80">
                      {user.name}
                    </Link>
                    <button onClick={handleLogout} className="text-left text-base uppercase tracking-[0.3em] text-white/50">
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => setMenuOpen(false)} className="text-base uppercase tracking-[0.3em] text-aurora-300">
                    Sign in
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
