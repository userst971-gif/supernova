import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/production', label: 'Production' },
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/designs', label: 'Designs' },
  { to: '/admin/audit', label: 'Audit log' },
  { to: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isStaff = user && (user.role === 'admin' || user.role === 'staff');

  useEffect(() => {
    if (!loading && !isStaff) {
      navigate(user ? '/account' : '/auth', { replace: true });
    }
  }, [user, loading, isStaff, navigate]);

  if (loading || !isStaff) {
    return (
      <div className="container-x flex min-h-screen items-center justify-center pt-28">
        <div className="h-6 w-40 animate-pulse rounded bg-white/[0.05]" />
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen pt-28">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside>
            <div className="card-dark sticky top-28 p-4">
              <p className="px-2 pb-3 text-[10px] uppercase tracking-[0.4em] text-aurora-300/70">
                Command
              </p>
              <nav className="flex flex-col gap-1">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-aurora-400/15 font-medium text-aurora-300'
                          : 'text-white/55 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                {user.role === 'admin' && (
                  <NavLink
                    to="/studio"
                    className={({ isActive }) =>
                      `mt-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-aurora-400/15 font-medium text-aurora-300'
                          : 'text-white/55 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    Products
                  </NavLink>
                )}
              </nav>
              <NavLink
                to="/shop"
                className="mt-4 block rounded-lg border border-white/10 px-3 py-2 text-center text-xs uppercase tracking-widest text-white/50 transition-colors hover:border-aurora-400/40 hover:text-white"
              >
                View store
              </NavLink>
            </div>
          </aside>

          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
