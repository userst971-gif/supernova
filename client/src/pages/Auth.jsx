import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { toast } from '../components/ToastHost';

export default function Auth() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user =
        mode === 'login'
          ? await login(form.email, form.password)
          : await register(form.name, form.email, form.password);
      toast(user.role === 'admin' ? 'Welcome back, Nova Admin.' : 'Welcome to the dark side.');
      navigate(user.role === 'admin' ? '/studio' : '/shop');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pt-20">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="card-dark w-full max-w-md p-10"
      >
        <div className="mb-8 text-center">
          <h1 className="text-glow-soft text-3xl font-bold text-white">
            {mode === 'login' ? 'Re-enter orbit' : 'Join the signal'}
          </h1>
          <p className="mt-2 text-xs tracking-widest text-white/40">
            {mode === 'login' ? 'SIGN IN TO YOUR ACCOUNT' : 'CREATE YOUR ACCOUNT'}
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 rounded-full border border-white/10 p-1">
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full py-2 text-xs uppercase tracking-widest transition-all ${
                mode === m ? 'bg-aurora-400/15 text-aurora-300' : 'text-white/50 hover:text-white'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5">
          {mode === 'register' && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" name="name" type="text" required value={form.name} onChange={update} className="field" placeholder="Your name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required value={form.email} onChange={update} className="field" placeholder="you@galaxy.com" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={8} value={form.password} onChange={update} className="field" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={busy} className="btn-aurora w-full text-sm">
            {busy ? 'CONNECTING…' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-white/40">
          Demo credentials
          <br />
          Admin: admin@aurora.io / aurora123
          <br />
          Customer: customer@aurora.io / aurora123
        </div>
      </motion.div>
    </div>
  );
}
