export default function StatCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200/90 bg-white text-slate-900',
    blue: 'border-indigo-100 bg-white text-slate-900',
    violet: 'border-purple-100 bg-white text-slate-900',
    emerald: 'border-emerald-100 bg-white text-slate-900',
    amber: 'border-amber-100 bg-white text-slate-900',
    neutral: 'border-slate-200/90 bg-white text-slate-900',
  }

  const indicatorTones = {
    slate: 'bg-slate-400',
    blue: 'bg-indigo-500',
    violet: 'bg-purple-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    neutral: 'bg-slate-400',
  }

  return (
    <div className={`group relative rounded-2xl border p-4.5 shadow-sm transition-all hover:shadow-md ${tones[tone] ?? tones.slate}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${indicatorTones[tone] ?? indicatorTones.slate}`} />
      </div>
      <p className="mt-2.5 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-slate-900 truncate">
        {value}
      </p>
    </div>
  )
}