import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Award,
  Bot,
  CheckCircle2,
  Coins,
  Cpu,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  UserCheck,
  Wallet,
  Zap,
} from 'lucide-react'

import AgentBuilderModal from './components/AgentBuilderModal'
import AgentDirectory from './components/AgentDirectory'
import AutonomousConsole from './components/AutonomousConsole'
import InfoRow from './components/InfoRow'
import JobTable from './components/JobTable'
import StatCard from './components/StatCard'
import TxList from './components/TxList'
import { getAgentProfile } from './lib/agentBuilder'
import { runAutonomousPipeline } from './lib/autonomousPipeline'
import {
  acceptJobTx,
  completeJobTx,
  connectWallet,
  CONTRACT_ADDRESSES,
  createJobTx,
  depositEscrowTx,
  hasMetaMask,
  hireAgentTx,
  MONAD_RPC_URL,
  readDashboardState,
  registerAgentTx,
  releaseEscrowTx,
  setMarketplaceTx,
  updateAgentTx,
} from './lib/contracts'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [network, setNetwork] = useState('Waiting for RPC...')
  const [wallet, setWallet] = useState({ connected: false, address: '', balanceMon: '0' })
  const [signer, setSigner] = useState(null)
  const [agentId, setAgentId] = useState("1")
  const [agent, setAgent] = useState(null)
  const [agents, setAgents] = useState([])
  const [reputation, setReputation] = useState({ score: 0, completedJobs: 0, failedJobs: 0 })
  const [jobs, setJobs] = useState([])
  const [jobCount, setJobCount] = useState(0)
  const [agentCount, setAgentCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [txHistory, setTxHistory] = useState([])
  const [activeTab, setActiveTab] = useState('register')
  const [lastRegisteredId, setLastRegisteredId] = useState(null)

  // Builder Modal State
  const [builderModalOpen, setBuilderModalOpen] = useState(false)
  const [builderAgentId, setBuilderAgentId] = useState('1')

  // Autonomous Pipeline State
  const [isAutonomousExecuting, setIsAutonomousExecuting] = useState(false)
  const [autonomousStage, setAutonomousStage] = useState(null)
  const [autonomousData, setAutonomousData] = useState(null)

  const [registerForm, setRegisterForm] = useState({
    name: 'ResearchAgent',
    metadataURI: 'ipfs://agentpay/agent',
    priceMon: '0.5',
  })

  const [updateForm, setUpdateForm] = useState({
    agentId: '1',
    name: 'ResearchAgent V2',
    metadataURI: 'ipfs://agentpay/agent-v2',
    priceMon: '0.6',
    active: true,
  })

  const [hireForm, setHireForm] = useState({
    targetAgentId: '1',
    description: 'Autonomous research task on Monad network',
    rewardMon: '0.5',
  })

  const [createJobForm, setCreateJobForm] = useState({
    targetAgentId: '1',
    description: 'Summarize Monad ecosystem update',
    rewardMon: '0.5',
  })

  const [acceptForm, setAcceptForm] = useState({
    jobId: '1',
  })

  const [completeForm, setCompleteForm] = useState({
    jobId: '1',
  })

  const [escrowForm, setEscrowForm] = useState({
    depositJobId: '1',
    depositAmountMon: '0.5',
    releaseJobId: '1',
  })

  const [adminForm, setAdminForm] = useState({
    marketplaceAddress: CONTRACT_ADDRESSES.jobMarketplace,
  })

  const addTx = (tx) => setTxHistory((prev) => [tx, ...prev].slice(0, 20))

  const walletRef = useRef(wallet)
  walletRef.current = wallet

  const fetchStatus = async (walletAddress) => {
    try {
      setLoading(true)
      setError('')
      const activeAddress = walletAddress || walletRef.current.address
      const snapshot = await readDashboardState({ agentId, walletAddress: activeAddress })
      setNetwork(snapshot.networkName)
      if (activeAddress) {
        setWallet((prev) => ({ ...prev, connected: true, address: activeAddress, balanceMon: snapshot.walletBalanceMon }))
      }
      setAgent(snapshot.agent)
      setAgents(snapshot.agents || [])
      setReputation(snapshot.reputation)
      setJobs(snapshot.jobs)
      setJobCount(snapshot.jobCount)
      setAgentCount(snapshot.agentCount)
      setLastUpdated(new Date())
    } catch (readError) {
      setError(readError.message || 'Unable to read Monad state.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(() => fetchStatus(), 15000)
    return () => clearInterval(timer)
  }, [agentId, wallet.address])

  const handleConnectWallet = async () => {
    try {
      setError('')
      const result = await connectWallet()
      setSigner(result.signer)
      setWallet({ connected: true, address: result.address, balanceMon: result.balanceMon })
      await fetchStatus(result.address)
    } catch (walletError) {
      setError(walletError.message || 'Could not connect wallet.')
    }
  }

  const runTx = async (actionName, work) => {
    if (!signer) {
      setError('Connect MetaMask before sending transactions.')
      return
    }

    try {
      setError('')
      const result = await work()
      const txHash = result?.hash || result?.transactionHash || result
      addTx({ action: actionName, hash: typeof txHash === 'string' ? txHash : txHash?.hash, status: 'pending' })

      if (result && typeof result.wait === 'function') {
        await result.wait()
      }

      addTx({ action: actionName, hash: typeof txHash === 'string' ? txHash : txHash?.hash, status: 'confirmed' })
      
      const newAgentCount = agentCount + (actionName === 'Register Agent' ? 1 : 0)
      if (actionName === 'Register Agent') {
        setLastRegisteredId(newAgentCount)
        setAgentId(String(newAgentCount))
      }

      await fetchStatus(wallet.address)
    } catch (txError) {
      setError(txError.shortMessage || txError.message || `Failed to execute ${actionName}.`)
    }
  }

  const handleRunAutonomousPipeline = async ({ prompt, openRouterKey, targetPriceMon }) => {
    if (!signer) {
      setError('Connect MetaMask before running autonomous execution pipeline.')
      return
    }

    try {
      setError('')
      setIsAutonomousExecuting(true)
      setAutonomousStage({ stage: 'SEARCH', detail: 'Starting autonomous pipeline...' })

      const result = await runAutonomousPipeline({
        prompt,
        signer,
        agents,
        openRouterKey,
        targetPriceMon,
        onStageUpdate: (stageInfo) => {
          setAutonomousStage(stageInfo)
          if (stageInfo.matchedAgent) {
            setAutonomousData((prev) => ({ ...prev, ...stageInfo }))
          }
        },
      })

      setAutonomousData(result)
      await fetchStatus(wallet.address)
    } catch (pipelineErr) {
      setError(pipelineErr.shortMessage || pipelineErr.message || 'Autonomous pipeline failed.')
    } finally {
      setIsAutonomousExecuting(false)
    }
  }

  const handleSelectAgent = (selectedId) => {
    const idStr = String(selectedId)
    setAgentId(idStr)
    setHireForm((p) => ({ ...p, targetAgentId: idStr }))
    setCreateJobForm((p) => ({ ...p, targetAgentId: idStr }))
    
    const target = agents.find((a) => String(a.id) === idStr)
    if (target) {
      setUpdateForm({
        agentId: idStr,
        name: target.name,
        metadataURI: target.metadataURI,
        priceMon: target.priceMon,
        active: target.active,
      })
      setHireForm((p) => ({ ...p, rewardMon: target.priceMon }))
    }
  }

  const handleHireFromDirectory = (ag) => {
    handleSelectAgent(ag.id)
    setActiveTab('hire')
  }

  const handleOpenBuilderModal = (idToBuild = agentId) => {
    setBuilderAgentId(String(idToBuild))
    setBuilderModalOpen(true)
  }

  const targetAgentForHire = useMemo(() => {
    return agents.find((a) => String(a.id) === String(hireForm.targetAgentId))
  }, [agents, hireForm.targetAgentId])

  const targetAgentForCreate = useMemo(() => {
    return agents.find((a) => String(a.id) === String(createJobForm.targetAgentId))
  }, [agents, createJobForm.targetAgentId])

  const selectedAgentProfile = useMemo(() => {
    return getAgentProfile(agentId)
  }, [agentId])

  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'OPEN'), [jobs])

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200 font-['Inter',sans-serif]">
      {/* Dark Glow Mesh Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-40 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-indigo-900/30 via-purple-900/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-900/20 via-emerald-900/15 to-transparent blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Navigation Header */}
        <header className="mb-8 flex flex-col gap-5 border-b border-slate-800/80 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3 py-1 text-xs font-semibold tracking-wider text-indigo-300 uppercase">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              AgentPay Protocol • Dark Edition
            </div>
            <h1 className="mt-2 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Monad AI Autonomous Network
            </h1>
            <p className="mt-1 text-sm text-slate-400 font-normal">
              Autonomous economic network for AI agents with OpenRouter search, match, price negotiation, & escrow settlement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleConnectWallet}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-wide transition-all shadow-md ${
                wallet.connected
                  ? 'border border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 shadow-indigo-600/20'
              }`}
            >
              <Wallet className={`h-4 w-4 ${wallet.connected ? 'text-emerald-400' : 'text-indigo-200'}`} />
              {wallet.connected ? 'Wallet Connected' : 'Connect MetaMask'}
            </button>

            <button
              type="button"
              onClick={() => fetchStatus()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 shadow-sm transition hover:bg-slate-800 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
              Refresh
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-900/80 bg-rose-950/80 p-4 text-xs font-medium text-rose-300 shadow-sm">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            {error}
          </div>
        )}

        {/* Success Banner when registering */}
        {lastRegisteredId && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-900/80 bg-emerald-950/80 p-4 text-xs font-medium text-emerald-200 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>Agent successfully registered on-chain with <strong>Agent ID #{lastRegisteredId}</strong>!</span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectAgent(lastRegisteredId)}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              View Agent #{lastRegisteredId}
            </button>
          </div>
        )}

        {/* Metric Cards */}
        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatCard label="Network" value={network} tone="blue" />
          <StatCard
            label="Wallet"
            value={wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : 'Disconnected'}
            tone="violet"
          />
          <StatCard label="Balance" value={`${wallet.balanceMon} MON`} tone="emerald" />
          <StatCard label="Last Synced" value={lastUpdated.toLocaleTimeString()} tone="neutral" />
        </section>

        {/* Primary Feature: Autonomous Economic Network Console */}
        <section className="mt-8">
          <AutonomousConsole
            onRunPipeline={handleRunAutonomousPipeline}
            isExecuting={isAutonomousExecuting}
            currentStage={autonomousStage}
            stageDetail={autonomousStage?.detail}
            pipelineData={autonomousData}
            walletConnected={wallet.connected}
            onConnectWallet={handleConnectWallet}
          />
        </section>

        {/* Contract Wire Info */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#0F1626]/80 p-4 text-xs font-['JetBrains_Mono',monospace] text-slate-400 shadow-sm">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 font-sans font-semibold text-slate-200">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
              Live On-Chain Smart Contracts
            </span>
            <span className="font-mono text-[11px] text-slate-500 font-normal">RPC: {MONAD_RPC_URL}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
            <p><span className="text-slate-500 font-sans">AgentRegistry:</span> {CONTRACT_ADDRESSES.agentRegistry.slice(0, 10)}…</p>
            <p><span className="text-slate-500 font-sans">JobMarketplace:</span> {CONTRACT_ADDRESSES.jobMarketplace.slice(0, 10)}…</p>
            <p><span className="text-slate-500 font-sans">JobEscrow:</span> {CONTRACT_ADDRESSES.jobEscrow.slice(0, 10)}…</p>
            <p><span className="text-slate-500 font-sans">ReputationManager:</span> {CONTRACT_ADDRESSES.reputationManager.slice(0, 10)}…</p>
          </div>
        </section>

        {/* On-Chain Registered Agents Directory */}
        <section className="mt-8 rounded-3xl border border-slate-800 bg-[#0F1626]/90 p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-white flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-400" />
                Registered Agents Directory
              </h2>
              <p className="text-xs text-slate-400">Discover, build, & customize AI agents registered on Monad</p>
            </div>
            <span className="rounded-full bg-indigo-950 border border-indigo-800 px-3 py-1 text-xs font-semibold text-indigo-300">
              {agentCount} Agents On-Chain
            </span>
          </div>

          <AgentDirectory
            agents={agents}
            selectedAgentId={agentId}
            onSelectAgent={handleSelectAgent}
            onHireAgent={handleHireFromDirectory}
            onCustomizeAgent={handleOpenBuilderModal}
          />
        </section>

        {/* Workspace: Agent Inspector & Job Board */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_1.95fr]">
          {/* Agent Inspector */}
          <div className="rounded-3xl border border-slate-800 bg-[#0F1626]/90 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-white flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-indigo-400" />
                  Agent Inspector
                </h2>
                <span className="text-xs text-slate-400">Total Registered: {agentCount}</span>
              </div>

              <div className="mb-5 flex gap-2">
                <div className="flex-1">
                  <Input
                    label="Lookup Agent ID"
                    value={agentId}
                    onChange={(v) => setAgentId(v)}
                  />
                </div>
                {agents.length > 0 && (
                  <div className="self-end mb-0.5">
                    <select
                      value={agentId}
                      onChange={(e) => handleSelectAgent(e.target.value)}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 transition-all hover:border-slate-700 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Agent...</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          #{a.id} - {a.name} ({a.priceMon} MON)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-slate-500 animate-pulse">Querying Monad RPC…</div>
              ) : (
                <div className="divide-y divide-slate-800/80 text-xs text-slate-300">
                  <InfoRow label="Agent Name" value={agent?.name ?? 'Not registered'} />
                  <InfoRow label="AI Persona Preset" value={selectedAgentProfile?.presetName ?? 'DeFi Analyst'} />
                  <InfoRow label="Owner Address" value={agent?.owner ?? '—'} />
                  <InfoRow label="Metadata URI" value={agent?.metadataURI ?? '—'} />
                  <InfoRow label="Execution Price" value={`${agent?.priceMon ?? '0'} MON`} />
                  <InfoRow label="Registry Rep" value={String(agent?.reputationOnRegistry ?? 0)} />
                  <InfoRow label="Reputation Score" value={String(reputation.score)} />
                  <InfoRow label="Completed Jobs" value={String(reputation.completedJobs)} />
                  <InfoRow label="Failed Jobs" value={String(reputation.failedJobs)} />
                  <InfoRow label="Status" value={agent?.active ? 'Active' : 'Inactive'} />
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleOpenBuilderModal(agentId)}
                className="w-full rounded-xl border border-indigo-900/60 bg-indigo-950/60 py-2.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/80 transition flex items-center justify-center gap-1.5"
              >
                <Sliders className="h-4 w-4 text-indigo-400" />
                Customize Agent #{agentId} System Persona & Prompt
              </button>
            </div>
          </div>

          {/* Job Marketplace Table */}
          <div className="rounded-3xl border border-slate-800 bg-[#0F1626]/90 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-white flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-400" />
                    Job Board
                  </h2>
                  <p className="text-xs text-slate-400">Open and completed work requests with live Escrow balance</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-indigo-950 border border-indigo-800 px-3 py-1 text-xs font-semibold text-indigo-300">
                    {openJobs.length} Open
                  </span>
                  <span className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-xs font-semibold text-slate-400">
                    {jobCount} Total
                  </span>
                </div>
              </div>
              <JobTable jobs={jobs} />
            </div>
          </div>
        </section>

        {/* Execution Hub: Interactive Protocol Actions */}
        <section className="mt-8 rounded-3xl border border-slate-800 bg-[#0F1626]/90 p-6 shadow-xl">
          <div className="mb-6 border-b border-slate-800 pb-4">
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-indigo-400" />
              Protocol Actions
            </h2>
            <p className="text-xs text-slate-400 mb-4">Execute smart contract functions across all deployed modules using contract ABIs</p>
            
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'register', label: '1. Register Agent' },
                { id: 'builder', label: '2. Agent Builder' },
                { id: 'update', label: '3. Update Agent' },
                { id: 'hire', label: '4. Hire Agent (1-Click)' },
                { id: 'create', label: '5. Create Job' },
                { id: 'accept', label: '6. Accept Job' },
                { id: 'complete', label: '7. Complete Job' },
                { id: 'escrow', label: '8. Deposit Escrow' },
                { id: 'release', label: '9. Release Payment' },
                { id: 'reputation', label: '10. Reputation Contract' },
                { id: 'admin', label: '11. Contract Admin' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-2xl">
            {/* 1. REGISTER AGENT */}
            {activeTab === 'register' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Register Agent', () => registerAgentTx({ signer, name: registerForm.name, metadataURI: registerForm.metadataURI, priceMon: registerForm.priceMon })) }}>
                <div className="rounded-xl border border-indigo-900/60 bg-indigo-950/40 p-3 text-xs text-indigo-300 mb-2">
                  Registers a new AI agent into the <strong>AgentRegistry</strong> smart contract.
                </div>
                <Input label="Agent Name" value={registerForm.name} onChange={(v) => setRegisterForm((p) => ({ ...p, name: v }))} />
                <Input label="Metadata URI (IPFS / Arweave)" value={registerForm.metadataURI} onChange={(v) => setRegisterForm((p) => ({ ...p, metadataURI: v }))} />
                <Input label="Execution Price (MON)" value={registerForm.priceMon} onChange={(v) => setRegisterForm((p) => ({ ...p, priceMon: v }))} />
                <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 active:scale-95 flex items-center gap-1.5" type="submit">
                  <Bot className="h-4 w-4" />
                  Register Agent
                </button>
              </form>
            )}

            {/* 2. AGENT BUILDER & PERSONA CONFIGURATOR */}
            {activeTab === 'builder' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-indigo-900/60 bg-indigo-950/40 p-3 text-xs text-indigo-300 mb-2">
                  Configure and build custom AI personas, system prompts, and specialized execution capability sets for any agent.
                </div>
                <Input label="Agent ID to Customize" value={agentId} onChange={(v) => handleSelectAgent(v)} />
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-slate-300">
                  <p className="font-bold text-white">Current Agent Persona: {selectedAgentProfile.presetName}</p>
                  <p className="text-slate-400 font-mono text-[11px]">Prompt: {selectedAgentProfile.systemPrompt.slice(0, 120)}...</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenBuilderModal(agentId)}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 active:scale-95 flex items-center gap-1.5"
                >
                  <Sliders className="h-4 w-4" />
                  Open Agent Builder & Configurator Modal
                </button>
              </div>
            )}

            {/* 3. UPDATE AGENT */}
            {activeTab === 'update' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Update Agent', () => updateAgentTx({ signer, agentId: Number(updateForm.agentId), name: updateForm.name, metadataURI: updateForm.metadataURI, priceMon: updateForm.priceMon, active: updateForm.active })) }}>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400 mb-2">
                  Updates an existing agent in <strong>AgentRegistry</strong>. Must be executed by the agent owner.
                </div>
                <Input label="Agent ID to Update" value={updateForm.agentId} onChange={(v) => handleSelectAgent(v)} />
                <Input label="Updated Agent Name" value={updateForm.name} onChange={(v) => setUpdateForm((p) => ({ ...p, name: v }))} />
                <Input label="Updated Metadata URI" value={updateForm.metadataURI} onChange={(v) => setUpdateForm((p) => ({ ...p, metadataURI: v }))} />
                <Input label="Updated Price (MON)" value={updateForm.priceMon} onChange={(v) => setUpdateForm((p) => ({ ...p, priceMon: v }))} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateForm.active}
                    onChange={(e) => setUpdateForm((p) => ({ ...p, active: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                  />
                  Agent Active Status
                </label>
                <button className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-700 active:scale-95" type="submit">
                  Update Agent Record
                </button>
              </form>
            )}

            {/* 4. HIRE AGENT (1-CLICK CREATION + ESCROW DEPOSIT) */}
            {activeTab === 'hire' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Hire Agent', () => hireAgentTx({ signer, agentId: Number(hireForm.targetAgentId), description: hireForm.description, rewardMon: hireForm.rewardMon })) }}>
                <div className="rounded-xl border border-indigo-900/60 bg-indigo-950/40 p-3 text-xs text-indigo-300 mb-2">
                  <strong>1-Click Hire:</strong> Sequentially creates a job on <strong>JobMarketplace</strong> AND deposits the reward MON into <strong>JobEscrow</strong>.
                </div>
                
                <Input label="Target Agent ID" value={hireForm.targetAgentId} onChange={(v) => setHireForm((p) => ({ ...p, targetAgentId: v }))} />
                
                {targetAgentForHire && (
                  <div className="rounded-xl border border-indigo-900/80 bg-slate-950 p-3 text-xs shadow-2xs">
                    <div className="flex items-center justify-between font-semibold text-indigo-300">
                      <span>Agent #{targetAgentForHire.id}: {targetAgentForHire.name}</span>
                      <span className="text-emerald-400">{targetAgentForHire.priceMon} MON</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Owner: {targetAgentForHire.owner}</p>
                    <p className="text-[11px] text-slate-400">Status: {targetAgentForHire.active ? 'Active ✓' : 'Inactive ✗'} | Reputation: {targetAgentForHire.reputationScore} pts</p>
                  </div>
                )}

                <Input label="Job Task Description" value={hireForm.description} onChange={(v) => setHireForm((p) => ({ ...p, description: v }))} />
                <Input label="Bounty Reward (MON)" value={hireForm.rewardMon} onChange={(v) => setHireForm((p) => ({ ...p, rewardMon: v }))} />

                <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 active:scale-95 flex items-center gap-1.5" type="submit">
                  <Coins className="h-4 w-4" />
                  Hire Agent & Escrow Funds
                </button>
              </form>
            )}

            {/* 5. CREATE JOB */}
            {activeTab === 'create' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Create Job', () => createJobTx({ signer, agentId: Number(createJobForm.targetAgentId), description: createJobForm.description, rewardMon: createJobForm.rewardMon })) }}>
                <Input label="Target Agent ID" value={createJobForm.targetAgentId} onChange={(v) => setCreateJobForm((p) => ({ ...p, targetAgentId: v }))} />
                {targetAgentForCreate && (
                  <div className="text-xs text-slate-400">
                    Selected: <strong>{targetAgentForCreate.name}</strong> ({targetAgentForCreate.priceMon} MON)
                  </div>
                )}
                <Input label="Job Description" value={createJobForm.description} onChange={(v) => setCreateJobForm((p) => ({ ...p, description: v }))} />
                <Input label="Reward Bounty (MON)" value={createJobForm.rewardMon} onChange={(v) => setCreateJobForm((p) => ({ ...p, rewardMon: v }))} />
                <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 active:scale-95" type="submit">
                  Create Job
                </button>
              </form>
            )}

            {/* 6. ACCEPT JOB */}
            {activeTab === 'accept' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Accept Job', () => acceptJobTx({ signer, jobId: Number(acceptForm.jobId) })) }}>
                <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 p-3 text-xs text-amber-300 mb-2">
                  Allows the owner of the assigned agent to accept an OPEN job on <strong>JobMarketplace</strong>.
                </div>
                <Input label="Job ID to Accept" value={acceptForm.jobId} onChange={(v) => setAcceptForm({ jobId: v })} />
                <button className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-amber-500 active:scale-95" type="submit">
                  Accept Job Assignment
                </button>
              </form>
            )}

            {/* 7. COMPLETE JOB */}
            {activeTab === 'complete' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Complete Job', () => completeJobTx({ signer, jobId: Number(completeForm.jobId) })) }}>
                <div className="rounded-xl border border-sky-900/60 bg-sky-950/40 p-3 text-xs text-sky-300 mb-2">
                  Marks an ACCEPTED job as COMPLETED and automatically records reputation score bonus via <strong>ReputationManager</strong>.
                </div>
                <Input label="Job ID to Complete" value={completeForm.jobId} onChange={(v) => setCompleteForm({ jobId: v })} />
                <button className="rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-sky-500 active:scale-95 flex items-center gap-1.5" type="submit">
                  <Award className="h-4 w-4" />
                  Mark Job Completed & Award Reputation
                </button>
              </form>
            )}

            {/* 8. DEPOSIT ESCROW */}
            {activeTab === 'escrow' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Deposit Escrow', () => depositEscrowTx({ signer, jobId: Number(escrowForm.depositJobId), amountMon: escrowForm.depositAmountMon })) }}>
                <Input label="Job ID to Escrow" value={escrowForm.depositJobId} onChange={(v) => setEscrowForm((p) => ({ ...p, depositJobId: v }))} />
                <Input label="Deposit Amount (MON)" value={escrowForm.depositAmountMon} onChange={(v) => setEscrowForm((p) => ({ ...p, depositAmountMon: v }))} />
                <button className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 active:scale-95" type="submit">
                  Deposit to Escrow
                </button>
              </form>
            )}

            {/* 9. RELEASE ESCROW */}
            {activeTab === 'release' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Release Payment', () => releaseEscrowTx({ signer, jobId: Number(escrowForm.releaseJobId) })) }}>
                <Input label="Completed Job ID" value={escrowForm.releaseJobId} onChange={(v) => setEscrowForm((p) => ({ ...p, releaseJobId: v }))} />
                <button className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-slate-700 active:scale-95" type="submit">
                  Release Escrow Funds to Agent
                </button>
              </form>
            )}

            {/* 10. REPUTATION CONTRACT */}
            {activeTab === 'reputation' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 p-3 text-xs text-emerald-300 mb-2">
                  <strong>ReputationManager Smart Contract:</strong> On-chain agent reputation score (+10 pts per completed job). Updated automatically by <strong>JobMarketplace</strong> when completing jobs.
                </div>

                <Input label="Lookup Agent ID Reputation" value={agentId} onChange={(v) => handleSelectAgent(v)} />

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-white">Agent #{agentId}: {agent?.name || 'Selected Agent'}</span>
                    <span className="rounded-full bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                      {reputation.score} Total Points
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Score</span>
                      <span className="block font-extrabold text-indigo-400 text-sm mt-0.5">{reputation.score} pts</span>
                    </div>

                    <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/60 p-2.5">
                      <span className="block text-[10px] text-emerald-400 font-bold uppercase">Completed Jobs</span>
                      <span className="block font-extrabold text-emerald-300 text-sm mt-0.5">{reputation.completedJobs}</span>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Failed Jobs</span>
                      <span className="block font-extrabold text-slate-300 text-sm mt-0.5">{reputation.failedJobs}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 11. CONTRACT ADMIN */}
            {activeTab === 'admin' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Set Marketplace Address', () => setMarketplaceTx({ signer, marketplaceAddress: adminForm.marketplaceAddress })) }}>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400 mb-2">
                  Configures the authorized JobMarketplace address in <strong>ReputationManager</strong>. Must be run by contract deployer/owner.
                </div>
                <Input label="Marketplace Address" value={adminForm.marketplaceAddress} onChange={(v) => setAdminForm({ marketplaceAddress: v })} />
                <button className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-slate-700 active:scale-95" type="submit">
                  Update Marketplace Permission
                </button>
              </form>
            )}
          </div>
        </section>

        {/* History & Runtime Signals */}
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-[#0F1626]/90 p-6 shadow-xl">
            <h2 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-white flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-indigo-400" />
              Recent Transactions
            </h2>
            <TxList items={txHistory} />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0F1626]/90 p-6 shadow-xl">
            <h2 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-white flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-indigo-400" />
              System Telemetry
            </h2>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>Total On-Chain Agents</span>
                <span className="font-semibold text-indigo-400">{agentCount} registered</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>Active Jobs Pool</span>
                <span className="font-semibold text-white">{openJobs.length} open / {jobCount} total</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>MetaMask Provider</span>
                <span className={`font-semibold ${hasMetaMask() ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasMetaMask() ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Protocol Engine</span>
                <span className="font-semibold text-white">Monad Testnet</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Agent Builder Modal */}
      <AgentBuilderModal
        agentId={builderAgentId}
        agentName={agents.find((a) => String(a.id) === String(builderAgentId))?.name || `Agent #${builderAgentId}`}
        isOpen={builderModalOpen}
        onClose={() => setBuilderModalOpen(false)}
        onSaved={() => fetchStatus()}
      />
    </div>
  )
}

function Input({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 transition-all placeholder:text-slate-500 hover:border-slate-700 focus:border-indigo-500 focus:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
      />
    </label>
  )
}

export default App