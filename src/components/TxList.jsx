import { Activity, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react'

export default function TxList({ items }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center">
        <Activity className="h-6 w-6 text-slate-400 mb-1" />
        <p className="text-xs font-semibold text-slate-700">No session transactions</p>
        <p className="mt-0.5 text-[11px] text-slate-400">Sign a transaction to view execution state here.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2.5">
      {items.map((tx) => (
        <li
          key={`${tx.hash}-${tx.status}`}
          className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-[#F9FAFB] p-3 shadow-2xs transition hover:bg-white"
        >
          <div className="min-w-0 pr-3">
            <p className="font-['Plus_Jakarta_Sans',sans-serif] text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600" />
              {tx.action}
            </p>
            <p className="mt-0.5 font-['JetBrains_Mono',monospace] text-[11px] text-slate-400 truncate">
              {tx.hash}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              tx.status === 'confirmed'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700 animate-pulse'
            }`}
          >
            {tx.status === 'confirmed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {tx.status}
          </span>
        </li>
      ))}
    </ul>
  )
}