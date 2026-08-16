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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-8 text-center">
        <Bot className="h-8 w-8 text-zinc-600 mb-2" />
        <p className="text-xs font-semibold text-zinc-300">No agents registered on Monad yet</p>
        <p className="mt-1 text-[11px] text-zinc-500">Use Protocol Actions below to register your first AI agent.</p>
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
                ? 'border-white bg-zinc-900/90 ring-1 ring-white/20 shadow-md'
                : 'border-zinc-800/90 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900/40 hover:shadow-lg'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 font-['JetBrains_Mono',monospace] text-[10px] font-semibold text-zinc-400 uppercase">
                  <span className={`h-1.5 w-1.5 rounded-full ${ag.active ? 'bg-white' : 'bg-zinc-600'}`} />
                  Agent #{ag.id}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border ${
                    ag.active
                      ? 'bg-zinc-900 text-zinc-100 border-zinc-700'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                  }`}
                >
                  {ag.active ? <CheckCircle2 className="h-3 w-3 text-white" /> : <XCircle className="h-3 w-3 text-zinc-500" />}
                  {ag.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-white group-hover:text-zinc-200 transition-colors">
                    {ag.name}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 mt-1">
                    <Sparkles className="h-2.5 w-2.5 text-zinc-400" />
                    {profile.presetName || 'AI Agent'}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-[11px] text-zinc-500 font-mono truncate" title={ag.metadataURI}>
                {ag.metadataURI || 'ipfs://no-metadata'}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
                    <Coins className="h-2.5 w-2.5 text-zinc-400" /> Fee
                  </span>
                  <span className="block font-bold text-white font-mono truncate mt-0.5">{ag.priceMon} MON</span>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
                    <Award className="h-2.5 w-2.5 text-zinc-400" /> Reputation
                  </span>
                  <span className="block font-bold text-zinc-200 font-mono mt-0.5">{ag.reputationScore} pts</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCustomizeAgent?.(ag.id)
                }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 hover:text-white transition"
              >
                <Settings className="h-3 w-3 text-zinc-400" />
                Customize AI
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onHireAgent?.(ag)
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-zinc-700 active:scale-95"
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