import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../components/ToastHost';

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 200 });
    if (action !== 'all') params.set('action', action);
    if (search) params.set('search', search);
    api
      .get(`/admin/audit?${params}`)
      .then((data) => setLogs(data.logs))
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [action, search]);

  useEffect(() => {
    load();
  }, [load]);

  const actions = [...new Set(logs.map((l) => l.action))].sort();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Trail</p>
        <h1 className="text-glow-soft mt-2 text-3xl font-bold text-white">
          Audit <span className="text-aurora-400">log</span>
        </h1>
      </div>

      <div className="card-dark flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search admin, entity id or metadata…"
          className="field flex-1"
        />
        <select value={action} onChange={(e) => setAction(e.target.value)} className="field sm:w-52">
          <option value="all">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="card-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.25em] text-white/40">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Id</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-4"><div className="h-6 animate-pulse rounded bg-white/[0.05]" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-white/40">No audit entries found.</td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-b border-white/5">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-white/50">{l.created_at?.slice(0, 16)}</td>
                    <td className="px-4 py-3 text-white/70">{l.admin_email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-aurora-400/30 bg-aurora-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-aurora-300">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60">{l.entity || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/50">{l.entity_id || '—'}</td>
                    <td className="max-w-sm truncate px-4 py-3 font-mono text-xs text-white/35" title={JSON.stringify(l.metadata)}>
                      {JSON.stringify(l.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
