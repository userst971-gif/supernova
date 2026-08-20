import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import AuroraBackground from './components/AuroraBackground';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import ToastHost from './components/ToastHost';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import Auth from './pages/Auth';
import Account from './pages/Account';
import Studio from './pages/Studio';
import ManifestoPage from './pages/ManifestoPage';
import AdminLayout from './pages/admin/AdminLayout';

const Design = lazy(() => import('./pages/Design'));
const RenderPage = lazy(() => import('./pages/RenderPage'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminProduction = lazy(() => import('./pages/admin/Production'));
const AdminInventory = lazy(() => import('./pages/admin/Inventory'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const AdminDesigns = lazy(() => import('./pages/admin/Designs'));
const AdminAudit = lazy(() => import('./pages/admin/Audit'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));

const ADMIN_FALLBACK = (
  <div className="pt-40 text-center text-xs uppercase tracking-[0.3em] text-white/40">Loading admin…</div>
);

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/account" element={<Account />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/manifesto" element={<ManifestoPage />} />
          <Route
            path="/render"
            element={
              <Suspense fallback={<div className="min-h-screen bg-[#020303]" />}>
                <RenderPage />
              </Suspense>
            }
          />
          <Route
            path="/admin"
            element={
              <Suspense fallback={ADMIN_FALLBACK}>
                <AdminLayout />
              </Suspense>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="production" element={<AdminProduction />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="designs" element={<AdminDesigns />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route
            path="/design"
            element={
              <Suspense
                fallback={
                  <div className="min-h-screen pt-40 text-center text-xs uppercase tracking-[0.3em] text-white/40">
                    Loading the studio…
                  </div>
                }
              >
                <Design />
              </Suspense>
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </motion.main>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="relative min-h-screen bg-void">
            <AuroraBackground />
            <Navbar />
            <AnimatedRoutes />
            <Footer />
            <CartDrawer />
            <ToastHost />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
