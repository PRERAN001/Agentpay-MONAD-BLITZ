export default function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 transition-colors hover:bg-zinc-900/60 px-1.5 rounded-lg border-b border-zinc-800/70 last:border-0">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <span className="font-['JetBrains_Mono',monospace] text-xs font-semibold text-zinc-100 break-all text-right">
        {value}
      </span>
    </div>
  )
}