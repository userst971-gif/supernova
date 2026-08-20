import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../components/ToastHost';

const TABS = [
  { id: 'brand', label: 'Brand' },
  { id: 'shipping', label: 'Shipping & payment' },
  { id: 'studio', label: 'Studio' },
];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('brand');
  const [settings, setSettings] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/admin/settings');
      setSettings(data.settings);
      setDrafts(JSON.parse(JSON.stringify(data.settings)));
    } catch (e) {
      toast(e.message, 'error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key, path, value) =>
    setDrafts((d) => {
      const next = { ...d, [key]: { ...(d[key] || {}) } };
      next[key][path] = value;
      return next;
    });

  const save = async (key) => {
    setSaving(true);
    try {
      const data = await api.put('/admin/settings', { key, value: drafts[key] });
      setSettings(data.settings);
      setDrafts(JSON.parse(JSON.stringify(data.settings)));
      toast('Settings saved');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleShippingMethod = (m) => {
    const methods = drafts.shipping?.methods || [];
    set('shipping', 'methods', methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m]);
  };

  if (!settings) {
    return <div className="card-dark p-10 text-center text-white/40">Loading settings…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Store configuration</p>
        <h1 className="text-glow-soft mt-2 text-3xl font-bold text-white">Settings</h1>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all ${
              tab === t.id
                ? 'border-aurora-400 bg-aurora-400/10 text-aurora-300'
                : 'border-white/15 text-white/50 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card-dark max-w-2xl p-6">
        {tab === 'brand' && (
          <div className="space-y-4">
            <Field label="Store name">
              <input
                value={drafts.brand?.store_name || ''}
                onChange={(e) => set('brand', 'store_name', e.target.value)}
                className="field"
              />
            </Field>
            <Field label="Currency">
              <input
                value={drafts.brand?.currency || ''}
                onChange={(e) => set('brand', 'currency', e.target.value.toUpperCase())}
                className="field"
                maxLength={3}
              />
            </Field>
            <Field label="Contact email">
              <input
                value={drafts.brand?.contact_email || ''}
                onChange={(e) => set('brand', 'contact_email', e.target.value)}
                className="field"
              />
            </Field>
            <Field label="Phone">
              <input
                value={drafts.brand?.phone || ''}
                onChange={(e) => set('brand', 'phone', e.target.value)}
                className="field"
              />
            </Field>
          </div>
        )}

        {tab === 'shipping' && (
          <div className="space-y-4">
            <Field label="Flat shipping rate">
              <input
                type="number"
                value={drafts.shipping?.flat_rate ?? 0}
                onChange={(e) => set('shipping', 'flat_rate', Number(e.target.value))}
                className="field"
              />
            </Field>
            <Field label="Free shipping from (0 disables)">
              <input
                type="number"
                value={drafts.shipping?.free_shipping_from ?? 0}
                onChange={(e) => set('shipping', 'free_shipping_from', Number(e.target.value))}
                className="field"
              />
            </Field>
            <div>
              <span className="label">Shipping methods</span>
              <div className="mt-2 flex gap-4">
                {['standard', 'express'].map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={(drafts.shipping?.methods || []).includes(m)}
                      onChange={() => toggleShippingMethod(m)}
                      className="h-4 w-4 accent-aurora-400"
                    />
                    {m[0].toUpperCase() + m.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Payment method">
              <select
                value={drafts.payment?.method || 'cash_on_delivery'}
                onChange={(e) => set('payment', 'method', e.target.value)}
                className="field"
              >
                <option value="cash_on_delivery">Cash on delivery</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </Field>
          </div>
        )}

        {tab === 'studio' && (
          <div className="space-y-4">
            <Field label="Default garment">
              <input
                value={drafts.studio?.garment_default || ''}
                onChange={(e) => set('studio', 'garment_default', e.target.value)}
                className="field"
              />
            </Field>
            <Field label="Print technique">
              <input
                value={drafts.studio?.print_technique || ''}
                onChange={(e) => set('studio', 'print_technique', e.target.value)}
                className="field"
              />
            </Field>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => save(tab === 'brand' ? 'brand' : tab === 'shipping' ? 'shipping' : 'studio')}
            disabled={saving}
            className="btn-aurora px-6 py-2.5 text-sm disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
