import { Activity, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react'

export default function TxList({ items }) {
  if (!items || !items.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 py-8 text-center">
        <Activity className="h-6 w-6 text-zinc-600 mb-1" />
        <p className="text-xs font-semibold text-zinc-300">No session transactions</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">Sign a transaction to view execution state here.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2.5">
      {items.map((tx) => (
        <li
          key={`${tx.hash}-${tx.status}`}
          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-sm transition hover:border-zinc-700 hover:bg-zinc-900/40"
        >
          <div className="min-w-0 pr-3">
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-xs font-bold text-white flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
              {tx.action}
            </p>
            <p className="mt-0.5 font-['JetBrains_Mono',monospace] text-[11px] text-zinc-400 truncate">
              {tx.hash}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wider ${
              tx.status === 'confirmed'
                ? 'border-zinc-700 bg-zinc-900 text-white'
                : 'border-zinc-800 bg-zinc-950 text-zinc-400 animate-pulse'
            }`}
          >
            {tx.status === 'confirmed' ? <CheckCircle2 className="h-3 w-3 text-white" /> : <Clock className="h-3 w-3 text-zinc-400" />}
            {tx.status}
          </span>
        </li>
      ))}
    </ul>
  )
}