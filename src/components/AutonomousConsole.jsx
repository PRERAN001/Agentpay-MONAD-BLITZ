import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  Award,
  Bot,
  CheckCircle2,
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
  const [showKeyInput, setShowKeyInput] = useState(true)
  const [keyError, setKeyError] = useState('')

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!prompt.trim()) return

    if (!openRouterKey || openRouterKey.trim().length <= 5) {
      setKeyError('OpenRouter API Key is required to run the autonomous network. Please enter your API key below.')
      setShowKeyInput(true)
      return
    }

    setKeyError('')
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
      {/* Centered Prompt Engine */}
      <div className="relative mx-auto max-w-4xl rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8 shadow-2xl backdrop-blur-xl transition-all">
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1 text-[11px] font-bold text-white shadow-lg flex items-center gap-1.5 uppercase tracking-wider font-mono">
          <Sparkles className="h-3.5 w-3.5 text-zinc-300" />
          Autonomous AI Prompt Engine
        </div>

        <div className="text-center mt-2 mb-6">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold text-white md:text-3xl tracking-tight">
            What should your AI Agent execute on Monad?
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Search on-chain agents, dynamically negotiate pricing, verify output quality, & settle escrow.
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="relative group">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI Agents to audit contracts, analyze DEX yield, optimize gas, or execute arbitrage..."
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs sm:text-sm text-zinc-100 transition-all placeholder:text-zinc-600 focus:border-white focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-white/20 shadow-inner"
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700 transition flex items-center gap-1"
              >
                <Key className="h-3 w-3 text-zinc-400" />
                API Key
              </button>
            </div>
          </div>

          {/* Prompt Suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mr-1">
              Suggested:
            </span>
            {SAMPLE_PROMPTS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(sample)}
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white transition shadow-2xs"
              >
                <Bot className="h-3 w-3 text-zinc-400" />
                {sample.slice(0, 36)}…
              </button>
            ))}
          </div>

          {showKeyInput && (
            <div className={`rounded-2xl border p-3.5 space-y-2 text-xs transition-all ${
              keyError
                ? 'border-zinc-600 bg-zinc-900'
                : 'border-zinc-800 bg-zinc-900/40'
            }`}>
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-mono">
                  OpenRouter API Key (Required for AI Engine) <span className="text-zinc-500">*</span>
                </label>
                {keyError && <span className="text-[10px] font-bold text-zinc-300 flex items-center gap-1"><AlertCircle className="h-3 w-3 text-zinc-400" /> Key Required</span>}
              </div>
              <input
                type="password"
                value={openRouterKey}
                onChange={(e) => {
                  setOpenRouterKey(e.target.value)
                  if (e.target.value.trim().length > 5) setKeyError('')
                }}
                placeholder="sk-or-v1-..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-white transition"
              />
              {keyError ? (
                <p className="text-[10px] text-zinc-300 font-semibold flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-zinc-400" />
                  {keyError}
                </p>
              ) : (
                <p className="text-[10px] text-zinc-400">
                  Powers real LLM negotiation, verification scoring, and automated task regeneration.
                </p>
              )}
            </div>
          )}

          {/* Budget & Execution */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Target Budget:</span>
              <div className="relative flex-1 sm:w-36">
                <Coins className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={targetPriceMon}
                  onChange={(e) => setTargetPriceMon(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-8 pr-3 py-1.5 text-xs font-bold text-white font-mono focus:border-white focus:outline-none transition"
                />
              </div>
              <span className="text-xs font-bold text-zinc-400">MON</span>
            </div>

            <div className="w-full sm:w-auto">
              {!walletConnected ? (
                <button
                  type="button"
                  onClick={onConnectWallet}
                  className="w-full sm:w-auto rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-2.5 text-xs font-bold tracking-wide text-white hover:bg-zinc-800 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <Zap className="h-4 w-4 text-zinc-300" />
                  Connect MetaMask
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isExecuting || !prompt.trim()}
                  className={`w-full sm:w-auto rounded-2xl px-7 py-3 text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${
                    isExecuting
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-zinc-200 active:scale-98 shadow-md'
                  }`}
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-zinc-400" />
                      Running Autonomous Network...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-black" />
                      Submit Prompt & Execute On-Chain Network
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Telemetry & Results Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Panel: Telemetry Step Progress & Negotiation Dialogue */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 text-white shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-zinc-300 animate-pulse" />
                <span className="font-['JetBrains_Mono',monospace] text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Execution Telemetry & Negotiation
                </span>
              </div>
              <span className="font-mono text-[11px] text-zinc-500">Monad Chain 10143</span>
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
                        ? 'border border-white bg-zinc-900 text-white font-bold'
                        : isPast
                        ? 'border border-zinc-700 bg-zinc-900/60 text-zinc-200'
                        : 'border border-zinc-800/60 bg-zinc-950 text-zinc-600'
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    <span className="mt-1 text-[10px] font-semibold tracking-tight">{step.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Current Stage Status */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 mb-4 text-xs">
              <span className="block text-[10px] uppercase font-mono tracking-wider text-zinc-400">Current Status</span>
              <p className="mt-1 font-semibold text-zinc-200">
                {stageDetail || 'Idle — Enter prompt above to launch autonomous network.'}
              </p>
            </div>

            {/* Dynamic Price Negotiation */}
            {pipelineData?.matchedAgent && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-bold text-black uppercase flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      Matched Agent #{pipelineData.matchedAgent.id}
                    </span>
                    <span className="font-bold text-sm text-white">{pipelineData.matchedAgent.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-xs text-zinc-500 line-through font-mono">
                      Initial: {pipelineData.initialQuoteMon || '0.68 MON'}
                    </span>
                    <span className="rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 text-xs font-bold text-white flex items-center gap-1 font-mono">
                      <Coins className="h-3 w-3 text-zinc-400" />
                      Agreed: {pipelineData.negotiatedPriceMon || targetPriceMon} MON
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-300">{pipelineData.searchReasoning}</p>

                {pipelineData.agentMinAcceptableMon && (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-[11px] text-zinc-400 font-mono flex items-center justify-between">
                    <span>Agent Reserve Minimum:</span>
                    <span className="font-bold text-white">{pipelineData.agentMinAcceptableMon} MON</span>
                  </div>
                )}

                {/* Bidding Dialogue */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                      <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
                      AI Price Negotiation Dialogue
                    </span>
                    <span className="rounded-full bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[9px] font-mono font-bold text-zinc-300">
                      Saved {pipelineData.savingsPercent || 26}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    {Array.isArray(pipelineData.negotiationRounds) && pipelineData.negotiationRounds.map((roundItem, i) => (
                      <div
                        key={i}
                        className={`rounded-xl p-3 border transition-all ${
                          roundItem.speaker?.includes('Client')
                            ? 'border-zinc-700 bg-zinc-900/90 text-zinc-100'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                          <span className="font-bold text-zinc-200 flex items-center gap-1">
                            <Bot className="h-3 w-3 text-zinc-400" />
                            Round {roundItem.round || i + 1}: {roundItem.speaker}
                          </span>
                          <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[9px] font-bold text-white">
                            {roundItem.action} • {roundItem.offerMon}
                          </span>
                        </div>
                        <p className="text-[11px] font-sans leading-relaxed">{roundItem.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Multi-Agent Sub-Hiring & Task Decomposition Card */}
                {pipelineData?.decomposedPlan?.subtaskResults && (
                  <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 p-4 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                      <span className="flex items-center gap-2 font-bold text-xs text-white">
                        <Cpu className="h-4 w-4 text-emerald-400" />
                        Multi-Agent Sub-Hiring & Task Decomposition
                      </span>
                      <span className="rounded-full bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                        {pipelineData?.decomposedPlan?.subtaskResults?.length || 0} Specialized Agents Hired
                      </span>
                    </div>

                    {pipelineData.decomposedPlan.planReasoning && (
                      <p className="text-[11px] text-zinc-300 italic font-sans bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                        <strong className="text-white font-mono uppercase text-[9px] block mb-0.5">Master Agent Strategy:</strong>
                        "{pipelineData.decomposedPlan.planReasoning}"
                      </p>
                    )}

                    <div className="space-y-2.5 pt-1">
                      {pipelineData.decomposedPlan.subtaskResults.map((subItem, idx) => (
                        <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-1.5 transition-all hover:border-zinc-700">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white flex items-center gap-2">
                              <span className="h-5 w-5 rounded-full bg-zinc-800 text-emerald-400 text-[11px] flex items-center justify-center font-mono font-bold border border-zinc-700">
                                #{idx + 1}
                              </span>
                              {subItem.title}
                            </span>
                            <span className="rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                              Assigned Agent #{subItem.matchedAgent?.id || idx + 1} ({subItem.matchedAgent?.name || `Agent #${idx + 1}`}) • {subItem.negotiatedPriceMon} MON
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">{subItem.instruction}</p>
                          {subItem.taskOutput && (
                            <div className="mt-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 p-2 text-[10px] text-zinc-300 font-mono">
                              <span className="text-zinc-500 font-bold block mb-1">Sub-Agent Output Preview:</span>
                              <p className="line-clamp-2 italic">{subItem.taskOutput}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Verification Gate, On-Chain Reputation & Output */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 text-white shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <span className="font-['Plus_Jakarta_Sans',sans-serif] text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-zinc-400" />
                Agent Execution Report & Verification Layer
              </span>
              <span className="rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-mono font-bold text-white">
                Verified On-Chain
              </span>
            </div>

            {/* Verification Gate */}
            {pipelineData?.verification && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 mb-4 space-y-2 shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="flex items-center gap-2 font-bold text-xs text-white">
                    <ShieldCheck className="h-4 w-4 text-zinc-300" />
                    Verification Auditor Gate
                  </span>
                  <span className="rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-mono font-bold text-white">
                    Score: {pipelineData.verification.score}/100 ({Number(pipelineData.verification.score) >= 70 ? 'PASSED ✓' : 'NEEDS REVISION'})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-1">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-center">
                    <span className="block text-[9px] font-mono uppercase text-zinc-500">Escrow Payout Approval</span>
                    <span className="block font-bold text-sm text-white font-mono mt-0.5">
                      {Number(pipelineData.verification.score) >= 70 ? 100 : 0}% Approved
                    </span>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-center">
                    <span className="block text-[9px] font-mono uppercase text-zinc-500">Audit Attempts</span>
                    <span className="block font-bold text-sm text-zinc-300 font-mono mt-0.5">
                      {pipelineData.verification.attempts || 1} Attempt ({pipelineData.verification.method || 'heuristic'})
                    </span>
                  </div>
                </div>

                {pipelineData.verification.reasoning && (
                  <p className="text-[11px] text-zinc-400 italic pt-1 border-t border-zinc-800/60 font-sans leading-relaxed">
                    Auditor Reasoning: "{pipelineData.verification.reasoning}"
                  </p>
                )}
              </div>
            )}

            {/* On-Chain Reputation Awarded */}
            {pipelineData?.reputationAfter && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 mb-4 space-y-2 shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="flex items-center gap-2 font-bold text-xs text-white">
                    <Award className="h-4 w-4 text-zinc-300" />
                    On-Chain Reputation Updated on ReputationManager
                  </span>
                  <span className="text-[10px] font-mono font-bold text-white">+10 pts Awarded</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-1">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                    <span className="block text-[9px] font-mono uppercase text-zinc-500">Previous Rep</span>
                    <span className="block font-bold text-sm text-zinc-400 font-mono mt-0.5">{pipelineData.reputationBefore?.score ?? 0} pts</span>
                  </div>

                  <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-2">
                    <span className="block text-[9px] font-mono uppercase text-zinc-300 font-bold">New Rep Score</span>
                    <span className="block font-bold text-sm text-white font-mono flex items-center justify-center gap-1 mt-0.5">
                      <TrendingUp className="h-3.5 w-3.5 text-zinc-300" />
                      {pipelineData.reputationAfter.score} pts
                    </span>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                    <span className="block text-[9px] font-mono uppercase text-zinc-500">Completed Jobs</span>
                    <span className="block font-bold text-sm text-zinc-300 font-mono mt-0.5">{pipelineData.reputationAfter.completedJobs} Jobs</span>
                  </div>
                </div>
              </div>
            )}

            {/* Executed Prompt Output */}
            {pipelineData?.verification && Number(pipelineData.verification.score) < 70 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 text-center space-y-3 shadow-xl">
                <Lock className="mx-auto h-8 w-8 text-zinc-400" />
                <h4 className="font-bold text-sm text-white">🔒 Deliverable Content Withheld & Locked</h4>
                <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed font-sans">
                  The AI deliverable failed independent quality audit (<strong className="text-white font-mono">Score: {pipelineData.verification.score}/100 after {pipelineData.verification.attempts || 1} Attempts</strong>).
                  On-chain job creation & escrow deposit were halted to protect your MON. Deliverable content is locked.
                </p>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 border border-zinc-800 px-3.5 py-1 text-[11px] font-mono text-zinc-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                  Audit Gate Rejected • Deliverable Hidden & MON Safe
                </div>
              </div>
            ) : pipelineData?.taskOutputLocked ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center space-y-3">
                <Lock className="mx-auto h-8 w-8 text-zinc-400 animate-pulse" />
                <h4 className="font-bold text-sm text-white">Task Output Encrypted & Locked in Escrow</h4>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                  The matched Agent AI has generated and signed the execution output. To decrypt and reveal the deliverable, confirm the <strong className="text-white font-mono">{pipelineData.negotiatedPriceMon} MON</strong> Escrow Deposit on-chain.
                </p>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-700 px-3.5 py-1 text-[11px] font-mono text-zinc-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                  Escrow Lock Active • Awaiting Settlement
                </div>
              </div>
            ) : pipelineData?.taskOutput ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs space-y-2 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between text-zinc-200 font-bold border-b border-zinc-800 pb-2">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                    Specialized Agent Output ({pipelineData.source === 'ai' ? 'OpenRouter AI Engine' : 'Offline Engine'})
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">Unlocked & Settled ✓</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-zinc-200 text-xs leading-relaxed">
                  {pipelineData.taskOutput}
                </pre>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-zinc-500 space-y-2">
                <Bot className="mx-auto h-8 w-8 text-zinc-700" />
                <p>No prompt output generated yet.</p>
                <p className="text-[11px] text-zinc-600">Enter a prompt above and click <strong>Submit Prompt</strong> to view output.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}