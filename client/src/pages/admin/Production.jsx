import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../components/ToastHost';

const JOB_STATUSES = ['QUEUED', 'DESIGN_READY', 'PRINTING', 'PRINTED', 'QUALITY_CHECK', 'COMPLETE', 'FAILED'];
const BATCH_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETE'];

const JOB_STYLE = {
  QUEUED: 'border-white/20 text-white/60',
  DESIGN_READY: 'border-sky-400/40 text-sky-300',
  PRINTING: 'border-aurora-400/40 text-aurora-300',
  PRINTED: 'border-violet-400/40 text-violet-300',
  QUALITY_CHECK: 'border-amber-400/40 text-amber-300',
  COMPLETE: 'border-emerald-400/40 text-emerald-300',
  FAILED: 'border-red-400/40 text-red-300',
};

export default function Production() {
  const [jobs, setJobs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [jobFilter, setJobFilter] = useState('all');
  const [batchName, setBatchName] = useState('');
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (jobFilter !== 'all') params.set('status', jobFilter);
    Promise.all([
      api.get(`/admin/production/jobs${params.toString() ? `?${params}` : ''}`),
      api.get('/admin/production/batches'),
      api.get('/admin/production/matrix'),
    ])
      .then(([j, b, m]) => {
        setJobs(j.jobs);
        setBatches(b.batches);
        setMatrix(m);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [jobFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const setJobStatus = async (job, status) => {
    try {
      await api.post(`/admin/production/jobs/${job.id}/status`, { status });
      toast(`Job #${job.id} → ${status}`);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const createBatch = async () => {
    if (!batchName.trim()) {
      toast('Give the batch a name.', 'error');
      return;
    }
    try {
      const data = await api.post('/admin/production/batches', { name: batchName, job_ids: selectedJobs });
      toast(`Batch "${data.batch.name}" created`);
      setBatchName('');
      setSelectedJobs([]);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const setBatchStatus = async (batch, status) => {
    try {
      await api.post(`/admin/production/batches/${batch.id}/status`, { status });
      toast(`Batch #${batch.id} → ${status}`);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const toggleJob = (id) =>
    setSelectedJobs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const jobInBatch = jobs.filter((j) => selectedJobs.includes(j.id)).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Print floor</p>
        <h1 className="text-glow-soft mt-2 text-3xl font-bold text-white">
          Production <span className="text-aurora-400">({jobs.length} jobs)</span>
        </h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card-dark p-6 xl:col-span-2">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Size × colour matrix</p>
          <p className="mt-1 text-xs text-white/40">Ordered quantities not yet complete.</p>
          {matrix && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                    <th className="py-2 text-left font-medium">Size</th>
                    {matrix.colors.map((c) => (
                      <th key={c} className="py-2 font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.sizes.map((s) => (
                    <tr key={s} className="border-t border-white/5">
                      <td className="py-2 text-left font-semibold text-white/80">{s}</td>
                      {matrix.colors.map((c) => {
                        const cell = matrix.cells.find((r) => r.size === s && r.color === c);
                        return (
                          <td key={c} className="py-2">
                            <span className={`font-mono ${cell && cell.qty > 0 ? 'text-aurora-300' : 'text-white/25'}`}>
                              {cell ? cell.qty : 0}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-dark p-6">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Batches</p>
          <div className="mt-3 flex gap-2">
            <input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="Batch name…"
              className="field flex-1"
            />
            <button
              onClick={createBatch}
              disabled={!selectedJobs.length}
              className="btn-aurora px-4 py-2 text-xs disabled:opacity-40"
              title={selectedJobs.length ? `Includes ${jobInBatch} selected job(s)` : 'Select jobs below first'}
            >
              CREATE
            </button>
          </div>
          <p className="mt-2 text-xs text-white/40">
            {selectedJobs.length ? `${selectedJobs.length} job(s) selected` : 'No jobs selected yet'}
          </p>
          <div className="mt-4 space-y-2">
            {batches.length === 0 && <p className="text-sm text-white/40">No batches yet.</p>}
            {batches.map((b) => (
              <div key={b.id} className="rounded-lg border border-white/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{b.name}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${JOB_STYLE[b.status] || ''}`}>
                    {b.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/40">{b.complete_count}/{b.job_count} jobs complete</p>
                <div className="mt-2 flex gap-1.5">
                  {BATCH_STATUSES.map((s) => (
                    <button
                      key={s}
                      disabled={b.status === s}
                      onClick={() => setBatchStatus(b, s)}
                      className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/50 hover:text-white disabled:opacity-25"
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-dark overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Print jobs</p>
          <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="field sm:w-48">
            <option value="all">All statuses</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.25em] text-white/40">
                <th className="px-4 py-3 font-medium">Pick</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-4"><div className="h-6 animate-pulse rounded bg-white/[0.05]" /></td>
                  </tr>
                ))
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                    No print jobs yet. Advance an order in the Orders tab and create print jobs there.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(j.id)}
                        onChange={() => toggleJob(j.id)}
                        className="h-4 w-4 accent-aurora-400"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/60">#{j.id}</td>
                    <td className="px-4 py-3">
                      <p className="text-white/85">{j.product_name_snapshot}</p>
                      <p className="text-xs text-white/40">{j.size}{j.color ? ` / ${j.color}` : ''} · {j.sku}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-aurora-300">{j.order_number}</td>
                    <td className="px-4 py-3 font-mono text-white/70">{j.quantity}</td>
                    <td className="px-4 py-3">
                      <select
                        value={j.status}
                        onChange={(e) => setJobStatus(j, e.target.value)}
                        className={`rounded-full border bg-transparent px-2 py-1 text-[10px] font-semibold uppercase tracking-widest ${JOB_STYLE[j.status] || 'border-white/20 text-white/60'}`}
                      >
                        {JOB_STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-black">{s.replace('_', ' ')}</option>
                        ))}
                      </select>
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
