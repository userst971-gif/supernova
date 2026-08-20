import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../components/ToastHost';

export default function Designs() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (showArchived) params.set('include_archived', 'true');
    const qs = params.toString();
    api
      .get(`/admin/designs${qs ? `?${qs}` : ''}`)
      .then((data) => setDesigns(data.designs))
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [search, showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  const setFlag = async (id, patch) => {
    try {
      await api.post(`/admin/designs/${id}/status`, patch);
      toast('Design updated');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">Library</p>
        <h1 className="text-glow-soft mt-2 text-3xl font-bold text-white">
          Designs <span className="text-aurora-400">({designs.length})</span>
        </h1>
      </div>

      <div className="card-dark flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, prompt or owner…"
          className="field flex-1"
        />
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 accent-aurora-400"
          />
          Include archived
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      ) : designs.length === 0 ? (
        <div className="card-dark p-10 text-center text-white/40">No designs match.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {designs.map((d) => (
            <div key={d.id} className="card-dark overflow-hidden">
              <img
                src={d.image_url}
                alt={d.name}
                className="aspect-square w-full border-b border-white/10 object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="p-4">
                <p className="truncate text-sm font-medium text-white">{d.name}</p>
                <p className="mt-0.5 truncate text-xs text-white/40">
                  {d.owner_name || 'Guest'} · {d.source.replace('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-white/40">{d.customization_count} customization(s)</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.published === 0 && (
                    <button
                      onClick={() => setFlag(d.id, { published: true })}
                      className="rounded-full border border-aurora-400/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-aurora-300 hover:bg-aurora-400/10"
                    >
                      Publish
                    </button>
                  )}
                  {d.published === 1 && (
                    <button
                      onClick={() => setFlag(d.id, { published: false })}
                      className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/60 hover:bg-white/10"
                    >
                      Unpublish
                    </button>
                  )}
                  {d.archived === 0 ? (
                    <button
                      onClick={() => setFlag(d.id, { archived: true })}
                      className="rounded-full border border-red-400/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-red-300 hover:bg-red-400/10"
                    >
                      Archive
                    </button>
                  ) : (
                    <button
                      onClick={() => setFlag(d.id, { archived: false })}
                      className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/60 hover:bg-white/10"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
