import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Cpu,
  FileText,
  Handshake,
  Key,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { STAGES } from '../lib/autonomousPipeline'

const SAMPLE_PROMPTS = [
  'Perform an autonomous security audit and vulnerability scan for JobEscrow contract',
  'Analyze Monad gas optimization parameters and EVM throughput benchmarks',
  'Summarize DEX liquidity pools and yield farming strategies on Monad Testnet',
  'Execute high-frequency market intelligence and ecosystem sentiment analysis',
]

const STAGE_STEPS = [
  { key: STAGES.SEARCH, label: 'Search', icon: Search },
  { key: STAGES.MATCH, label: 'Match', icon: Target },
  { key: STAGES.NEGOTIATE, label: 'Negotiate', icon: MessageSquare },
  { key: STAGES.CREATE_JOB, label: 'Create Job', icon: FileText },
  { key: STAGES.DEPOSIT_ESCROW, label: 'Deposit Escrow', icon: Lock },
  { key: STAGES.ACCEPT_JOB, label: 'Accept Job', icon: Handshake },
  { key: STAGES.COMPLETE_JOB, label: 'Complete Task', icon: Cpu },
  { key: STAGES.RELEASE_ESCROW, label: 'Release Payment', icon: Coins },
]

export default function AutonomousConsole({
  onRunPipeline,
  isExecuting,
  currentStage,
  stageDetail,
  pipelineData,
  walletConnected,
  onConnectWallet,
}) {
  const [prompt, setPrompt] = useState('Perform an autonomous security audit and vulnerability scan for JobEscrow contract')
  const [openRouterKey, setOpenRouterKey] = useState('')
  const [targetPriceMon, setTargetPriceMon] = useState('0.5')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [showNegotiationLog, setShowNegotiationLog] = useState(true)

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!prompt.trim()) return
    onRunPipeline({
      prompt,
      openRouterKey,
      targetPriceMon,
    })
  }

  const activeStageIndex = STAGE_STEPS.findIndex((s) => s.key === currentStage?.stage)
  const isCompleted = currentStage?.stage === STAGES.COMPLETED

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* HERO CENTERED PROMPT BOX (Dark Sleek Theme)          */}
      {/* ---------------------------------------------------- */}
      <div className="relative mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-[#0F1626]/90 p-6 md:p-8 shadow-2xl backdrop-blur-xl transition-all">
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full border border-indigo-500/30 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-1 text-[11px] font-bold text-white shadow-lg flex items-center gap-1.5 uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-300" />
          Autonomous AI Prompt Engine
        </div>

        <div className="text-center mt-2 mb-6">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold text-white md:text-3xl tracking-tight">
            What should your AI Agent execute on Monad?
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Search on-chain agents, dynamically negotiate pricing, escrow MON bounty, & settle task execution.
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="relative group">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI Agents to audit contracts, analyze DEX yield, optimize gas, or execute arbitrage..."
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs sm:text-sm text-slate-100 transition-all placeholder:text-slate-500 focus:border-indigo-500 focus:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-inner"
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 transition flex items-center gap-1"
              >
                <Key className="h-3 w-3 text-indigo-400" />
                API Key
              </button>
            </div>
          </div>

          {/* Quick Action Sample Chips */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              Suggested:
            </span>
            {SAMPLE_PROMPTS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(sample)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-slate-300 hover:border-indigo-500 hover:bg-indigo-950/50 hover:text-indigo-200 transition shadow-2xs"
              >
                <Bot className="h-3 w-3 text-indigo-400" />
                {sample.slice(0, 36)}…
              </button>
            ))}
          </div>

          {showKeyInput && (
            <div className="rounded-2xl border border-indigo-900/60 bg-indigo-950/40 p-3.5 space-y-2 text-xs">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                OpenRouter API Key (Optional LLM Engine)
              </label>
              <input
                type="password"
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full rounded-xl border border-indigo-900/80 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="text-[10px] text-indigo-400">
                If left blank, our intelligent dynamic negotiator engine handles multi-round bidding and execution.
              </p>
            </div>
          )}

          {/* Budget & Execution Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Budget:</span>
              <div className="relative flex-1 sm:w-36">
                <Coins className="absolute left-2.5 top-2 h-3.5 w-3.5 text-indigo-400" />
                <input
                  type="text"
                  value={targetPriceMon}
                  onChange={(e) => setTargetPriceMon(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs font-extrabold text-indigo-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <span className="text-xs font-bold text-slate-400">MON</span>
            </div>

            <div className="w-full sm:w-auto">
              {!walletConnected ? (
                <button
                  type="button"
                  onClick={onConnectWallet}
                  className="w-full sm:w-auto rounded-2xl bg-slate-800 px-6 py-2.5 text-xs font-bold tracking-wide text-white shadow-md hover:bg-slate-700 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <Zap className="h-4 w-4 text-emerald-400" />
                  Connect MetaMask
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isExecuting || !prompt.trim()}
                  className={`w-full sm:w-auto rounded-2xl px-7 py-3 text-xs font-extrabold tracking-wide text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                    isExecuting
                      ? 'bg-indigo-900 cursor-not-allowed animate-pulse'
                      : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 active:scale-98 shadow-indigo-600/30'
                  }`}
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      Running Autonomous Network...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      Submit Prompt & Execute On-Chain Network
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* ---------------------------------------------------- */}
      {/* AUTONOMOUS TELEMETRY & EXECUTION RESULT PANELS      */}
      {/* ---------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Panel: Telemetry Step Progress & Negotiation Dialogue */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-slate-800 bg-[#0F1626]/90 p-5 text-white shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span className="font-['JetBrains_Mono',monospace] text-xs font-bold uppercase tracking-wider text-slate-200">
                  Execution Telemetry & Negotiation
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">Monad Chain 10143</span>
            </div>

            {/* Step Progress Pills */}
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {STAGE_STEPS.map((step, idx) => {
                const IconComponent = step.icon
                const isPast = activeStageIndex > idx || isCompleted
                const isCurrent = currentStage?.stage === step.key

                return (
                  <div
                    key={step.key}
                    className={`flex flex-col items-center rounded-xl p-2 text-center transition-all ${
                      isCurrent
                        ? 'border border-indigo-500 bg-indigo-950/80 text-indigo-300 ring-2 ring-indigo-500/30'
                        : isPast
                        ? 'border border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                        : 'border border-slate-800 bg-slate-900/50 text-slate-500'
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    <span className="mt-1 text-[10px] font-semibold tracking-tight">{step.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Current Stage Status Banner */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 mb-4 text-xs">
              <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-400">Current Status</span>
              <p className="mt-1 font-semibold text-indigo-300">
                {stageDetail || 'Idle — Enter prompt above to launch autonomous network.'}
              </p>
            </div>

            {/* Dynamic AI Price Negotiation Card */}
            {pipelineData?.matchedAgent && (
              <div className="rounded-2xl border border-indigo-900/80 bg-gradient-to-b from-indigo-950/80 to-slate-950 p-4 space-y-3 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-900/50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      Matched Agent #{pipelineData.matchedAgent.id}
                    </span>
                    <span className="font-bold text-sm text-white">{pipelineData.matchedAgent.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300 line-through">
                      Initial Quote: {pipelineData.initialQuoteMon || '0.68 MON'}
                    </span>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-extrabold text-emerald-300 flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      Agreed: {pipelineData.negotiatedPriceMon || targetPriceMon} MON
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300">{pipelineData.searchReasoning}</p>

                {/* Multi-Round Bidding Dialogue Log */}
                <div className="rounded-xl border border-indigo-900/60 bg-slate-950/90 p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                      <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                      AI Price Negotiation Dialogue
                    </span>
                    <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold text-indigo-300">
                      Saved {pipelineData.savingsPercent || 26}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    {pipelineData.negotiationRounds?.map((roundItem, i) => (
                      <div
                        key={i}
                        className={`rounded-xl p-3 border transition-all ${
                          roundItem.speaker?.includes('Client')
                            ? 'border-indigo-900/60 bg-indigo-950/50 text-indigo-200'
                            : 'border-slate-800 bg-slate-900/70 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                          <span className="font-bold text-indigo-300 flex items-center gap-1">
                            <Bot className="h-3 w-3" />
                            Round {roundItem.round || i + 1}: {roundItem.speaker}
                          </span>
                          <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                            {roundItem.action} • {roundItem.offerMon}
                          </span>
                        </div>
                        <p className="text-[11px] font-sans leading-relaxed">{roundItem.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: On-Chain Reputation Card & Executed Task Output */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-slate-800 bg-[#0F1626]/90 p-5 text-white shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="font-['Plus_Jakarta_Sans',sans-serif] text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-indigo-400" />
                Agent Execution Report & On-Chain Reputation
              </span>
              <span className="rounded-full bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                Verified On-Chain
              </span>
            </div>

            {/* Prominent On-Chain Reputation Awarded Card */}
            {pipelineData?.reputationAfter && (
              <div className="rounded-2xl border border-emerald-900/80 bg-gradient-to-r from-emerald-950/60 via-slate-950 to-emerald-950/60 p-4 mb-4 space-y-2 shadow-sm">
                <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
                  <span className="flex items-center gap-2 font-bold text-xs text-emerald-400">
                    <Award className="h-4 w-4 text-emerald-400" />
                    On-Chain Reputation Updated on ReputationManager
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">+10 pts Awarded</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-1">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                    <span className="block text-[9px] font-mono uppercase text-slate-400">Previous Rep</span>
                    <span className="block font-bold text-sm text-slate-300">{pipelineData.reputationBefore?.score ?? 0} pts</span>
                  </div>

                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/80 p-2">
                    <span className="block text-[9px] font-mono uppercase text-emerald-400 font-bold">New Rep Score</span>
                    <span className="block font-extrabold text-sm text-emerald-300 flex items-center justify-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      {pipelineData.reputationAfter.score} pts
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-2">
                    <span className="block text-[9px] font-mono uppercase text-slate-400">Completed Jobs</span>
                    <span className="block font-bold text-sm text-slate-200">{pipelineData.reputationAfter.completedJobs} Jobs</span>
                  </div>
                </div>
              </div>
            )}

            {/* Executed Prompt-Specific Output */}
            {pipelineData?.taskOutput ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-2 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between text-indigo-300 font-bold border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Specialized Agent Output
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Status: Settled & Escrow Paid</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-slate-200 text-xs leading-relaxed">
                  {pipelineData.taskOutput}
                </pre>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                <Bot className="mx-auto h-8 w-8 text-slate-600" />
                <p>No prompt output generated yet.</p>
                <p className="text-[11px] text-slate-500">Enter a prompt above and click <strong>Submit Prompt</strong> to see custom agent results.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
