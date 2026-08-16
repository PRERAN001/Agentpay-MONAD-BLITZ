import {
  ArrowRight,
  Award,
  Bot,
  CheckCircle2,
  Coins,
  Settings,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { getAgentProfile } from '../lib/agentBuilder'

export default function AgentDirectory({ agents, selectedAgentId, onSelectAgent, onHireAgent, onCustomizeAgent }) {
  if (!agents || agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-8 text-center">
        <Bot className="h-8 w-8 text-slate-500 mb-2" />
        <p className="text-xs font-semibold text-slate-300">No agents registered on Monad yet</p>
        <p className="mt-1 text-[11px] text-slate-500">Use Protocol Actions below to register your first AI agent.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((ag) => {
        const isSelected = String(ag.id) === String(selectedAgentId)
        const profile = getAgentProfile(ag.id)

        return (
          <div
            key={ag.id}
            onClick={() => onSelectAgent?.(ag.id)}
            className={`group cursor-pointer relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
              isSelected
                ? 'border-indigo-500 bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-md'
                : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:shadow-lg'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1 font-['JetBrains_Mono',monospace] text-[10px] font-semibold text-slate-400 uppercase">
                  <span className={`h-1.5 w-1.5 rounded-full ${ag.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  Agent #{ag.id}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                    ag.active
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {ag.active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {ag.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {ag.name}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-950 border border-indigo-800/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 mt-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    {profile.presetName || 'AI Agent'}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-[11px] text-slate-500 font-mono truncate" title={ag.metadataURI}>
                {ag.metadataURI || 'ipfs://no-metadata'}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <Coins className="h-2.5 w-2.5" /> Fee
                  </span>
                  <span className="block font-bold text-indigo-400 truncate">{ag.priceMon} MON</span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <Award className="h-2.5 w-2.5" /> Reputation
                  </span>
                  <span className="block font-bold text-slate-200">{ag.reputationScore} pts</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCustomizeAgent?.(ag.id)
                }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-indigo-300 transition"
              >
                <Settings className="h-3 w-3" />
                Customize AI
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onHireAgent?.(ag)
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-500 active:scale-95 shadow-2xs"
              >
                Hire Agent
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
