export default function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 transition-colors hover:bg-slate-50/50 px-1 rounded-lg">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="font-['JetBrains_Mono',monospace] text-xs font-semibold text-slate-900 break-all text-right">
        {value}
      </span>
    </div>
  )
}