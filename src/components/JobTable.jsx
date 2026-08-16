import { ClipboardList } from 'lucide-react'

function statusBadge(status) {
  switch (status) {
    case 'OPEN':
      return 'border-zinc-600 bg-zinc-900 text-white'
    case 'ACCEPTED':
      return 'border-zinc-700 bg-zinc-900/80 text-zinc-300'
    case 'COMPLETED':
      return 'border-zinc-800 bg-zinc-950 text-zinc-400'
    default:
      return 'border-zinc-800 bg-zinc-900 text-zinc-500'
  }
}

export default function JobTable({ jobs }) {
  if (!jobs || !jobs.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-10 text-center">
        <ClipboardList className="h-8 w-8 text-zinc-600 mb-2" />
        <p className="text-xs font-semibold text-zinc-300">No on-chain jobs found</p>
        <p className="mt-1 text-[11px] text-zinc-500">Created jobs will appear live here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="group relative rounded-2xl border border-zinc-800 bg-zinc-950 p-4.5 shadow-md transition-all hover:border-zinc-700 hover:bg-zinc-900/30"
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 font-['JetBrains_Mono',monospace] text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 group-hover:bg-white transition-colors" />
                Job #{job.id}
              </span>
              <p className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-white">
                {job.description || 'No description provided'}
              </p>
            </div>
            <span
              className={`inline-flex self-start sm:self-center items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold font-mono tracking-wide shadow-2xs ${statusBadge(job.status)}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
              {job.status}
            </span>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <InfoPill label="Target Agent" value={`#${job.agentId}`} />
            <InfoPill label="Bounty" value={`${job.rewardMon} MON`} highlight />
            <InfoPill label="Escrow Fund" value={`${job.escrowBalanceMon || '0'} MON`} />
            <InfoPill label="Client" value={`${job.client.slice(0, 6)}…${job.client.slice(-4)}`} mono />
            <InfoPill
              label="Worker"
              value={
                job.worker === '0x0000000000000000000000000000000000000000'
                  ? 'Unassigned'
                  : `${job.worker.slice(0, 6)}…${job.worker.slice(-4)}`
              }
              mono
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function InfoPill({ label, value, mono = false, highlight = false }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 transition-colors group-hover:bg-zinc-900">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 font-mono">
        {label}
      </span>
      <span
        className={`mt-0.5 block truncate text-xs font-semibold ${
          mono ? "font-['JetBrains_Mono',monospace]" : ''
        } ${highlight ? 'text-white font-bold font-mono' : 'text-zinc-300'}`}
      >
        {value}
      </span>
    </div>
  )
}