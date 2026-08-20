import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-white/10 bg-void/70 backdrop-blur-xl">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="text-xl font-bold tracking-[0.25em] text-white">
            AURO<span className="text-aurora-400">RA</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/50">
            Garments designed beyond the event horizon. Built for the ones who wear the night sky.
          </p>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">Navigate</p>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link to="/shop" className="hover:text-aurora-300">Shop</Link></li>
            <li><Link to="/manifesto" className="hover:text-aurora-300">Manifesto</Link></li>
            <li><Link to="/auth" className="hover:text-aurora-300">Account</Link></li>
            <li><Link to="/studio" className="hover:text-aurora-300">Creator Studio</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">Contact</p>
          <ul className="space-y-2 text-sm text-white/60">
            <li>signal@aurora.io</li>
            <li>+1 (555) 001-0000</li>
            <li>Reykjavík · 64.14°N</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs tracking-widest text-white/30">
        © {new Date().getFullYear()} AURORA — ALL LIGHT RESERVED
      </div>
    </footer>
  );
}
