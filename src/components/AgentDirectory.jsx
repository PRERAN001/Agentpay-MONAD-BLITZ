export default function AgentDirectory({ agents, selectedAgentId, onSelectAgent, onHireAgent }) {
  if (!agents || agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
        <span className="text-2xl mb-2">🤖</span>
        <p className="text-xs font-semibold text-slate-700">No agents registered on Monad yet</p>
        <p className="mt-1 text-[11px] text-slate-400">Use Protocol Actions below to register your first AI agent.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((ag) => {
        const isSelected = String(ag.id) === String(selectedAgentId)

        return (
          <div
            key={ag.id}
            onClick={() => onSelectAgent?.(ag.id)}
            className={`group cursor-pointer relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
              isSelected
                ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-sm'
                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1 font-['JetBrains_Mono',monospace] text-[10px] font-semibold text-slate-400 uppercase">
                  <span className={`h-1.5 w-1.5 rounded-full ${ag.active ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                  Agent #{ag.id}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                    ag.active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                      : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                  }`}
                >
                  {ag.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {ag.name}
              </h3>

              <p className="mt-1 text-[11px] text-slate-400 font-mono truncate" title={ag.metadataURI}>
                {ag.metadataURI || 'ipfs://no-metadata'}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Fee</span>
                  <span className="block font-bold text-indigo-600 truncate">{ag.priceMon} MON</span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Reputation</span>
                  <span className="block font-bold text-slate-800">{ag.reputationScore} pts</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">
                Owner: {ag.owner.slice(0, 6)}…{ag.owner.slice(-4)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onHireAgent?.(ag)
                }}
                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-700 active:scale-95 shadow-2xs"
              >
                Hire Agent
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
