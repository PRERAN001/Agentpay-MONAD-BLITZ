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
import { getAgentProfile, saveAgentProfile } from './lib/agentBuilder'
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
  const [agentId, setAgentId] = useState('1')
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
    const activeAddress = walletAddress || walletRef.current.address
    if (activeAddress) {
      setWallet((prev) => ({
        ...prev,
        connected: true,
        address: activeAddress,
      }))
    }

    try {
      setLoading(true)
      setError('')
      const snapshot = await readDashboardState({ agentId, walletAddress: activeAddress })
      setNetwork(snapshot.networkName)
      if (activeAddress) {
        setWallet((prev) => ({
          ...prev,
          connected: true,
          address: activeAddress,
          balanceMon: snapshot.walletBalanceMon,
        }))
      }
      setAgent(snapshot.agent)
      setAgents(snapshot.agents || [])
      setReputation(snapshot.reputation)
      setJobs(snapshot.jobs || [])
      setJobCount(snapshot.jobCount || 0)
      setAgentCount(snapshot.agentCount || 0)
      setLastUpdated(new Date())
    } catch (readError) {
      console.warn('Dashboard fetchStatus error:', readError)
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
      console.error('Autonomous Pipeline Failure:', pipelineErr)
      const errReason = pipelineErr.reason || pipelineErr.shortMessage || pipelineErr.message || String(pipelineErr)
      setError(`Autonomous Pipeline Error: ${errReason}`)
      setAutonomousStage({
        stage: 'ERROR',
        detail: `Pipeline Error: ${errReason}`,
      })
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

  const handleDeployNewAgentFromBuilder = async ({ name, metadataURI, priceMon, profile }) => {
    if (!signer) {
      setError('Connect MetaMask before registering a new AI Agent.')
      return
    }

    try {
      setError('')
      const tx = await registerAgentTx({ signer, name, metadataURI, priceMon })
      addTx({ action: 'Register Agent', hash: tx.hash, status: 'pending' })
      await tx.wait()
      addTx({ action: 'Register Agent', hash: tx.hash, status: 'confirmed' })

      const newId = agentCount + 1
      if (profile) {
        saveAgentProfile(newId, profile)
      }
      setLastRegisteredId(newId)
      setAgentId(String(newId))
      await fetchStatus(wallet.address)
    } catch (err) {
      console.error('Failed to deploy agent from builder:', err)
      setError(`Failed to deploy agent on-chain: ${err.shortMessage || err.message}`)
    }
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
    <div className="min-h-screen bg-black text-zinc-100 antialiased selection:bg-white selection:text-black font-sans">
      {/* Subtle Monochrome Ambient Spotlight & Grid */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-40 right-1/4 h-[600px] w-[600px] rounded-full bg-white/[0.03] blur-[140px]" />
        <div className="absolute top-1/3 -left-40 h-[600px] w-[600px] rounded-full bg-zinc-500/[0.03] blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Navigation Header */}
        <header className="mb-8 flex flex-col gap-5 border-b border-zinc-800/80 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/90 px-3 py-1 text-xs font-semibold tracking-wider text-zinc-300 uppercase shadow-inner">
              <Sparkles className="h-3.5 w-3.5 text-zinc-200" />
              AgentPay Protocol • Noir Edition
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Monad AI Autonomous Network
            </h1>
            <p className="mt-1 text-sm text-zinc-400 font-normal">
              Autonomous economic network for AI agents with OpenRouter search, match, price negotiation, & escrow settlement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { setBuilderAgentId(''); setBuilderModalOpen(true) }}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-white/5 hover:bg-zinc-200 active:scale-95 transition"
            >
              <Bot className="h-4 w-4 text-black" />
              + Build & Deploy Agent
            </button>

            <button
              type="button"
              onClick={handleConnectWallet}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-wide transition-all border ${
                wallet.connected
                  ? 'border-zinc-500 bg-zinc-900 text-white shadow-sm'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Wallet className="h-4 w-4 text-emerald-400" />
              {wallet.connected ? (
                <span className="flex items-center gap-2">
                  <span className="font-mono">{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</span>
                  <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-zinc-700">
                    {wallet.balanceMon} MON
                  </span>
                </span>
              ) : (
                'Connect Wallet'
              )}
            </button>

            <button
              type="button"
              onClick={() => fetchStatus()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-zinc-300 shadow-sm transition hover:bg-zinc-900 hover:border-zinc-700 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
              Refresh
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4 text-xs font-medium text-zinc-200 shadow-lg">
            <AlertCircle className="h-5 w-5 text-white shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Banner when registering */}
        {lastRegisteredId && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-zinc-600 bg-zinc-900 p-4 text-xs font-medium text-zinc-100 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
              <span>Agent successfully registered on-chain with <strong className="text-white underline underline-offset-2">Agent ID #{lastRegisteredId}</strong>!</span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectAgent(lastRegisteredId)}
              className="rounded-lg border border-zinc-600 bg-white px-3 py-1 text-xs font-bold text-black hover:bg-zinc-200 transition"
            >
              View Agent #{lastRegisteredId}
            </button>
          </div>
        )}

        {/* Metric Cards */}
        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatCard label="Network" value={network} tone="neutral" />
          <StatCard
            label="Wallet"
            value={wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : 'Disconnected'}
            tone="neutral"
          />
          <StatCard label="Balance" value={`${wallet.balanceMon} MON`} tone="neutral" />
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
        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-400 shadow-md">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80 font-sans font-semibold text-zinc-200">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-zinc-300" />
              Live On-Chain Smart Contracts
            </span>
            <span className="font-mono text-[11px] text-zinc-500 font-normal">RPC: {MONAD_RPC_URL}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
            <p><span className="text-zinc-500 font-sans">AgentRegistry:</span> {CONTRACT_ADDRESSES.agentRegistry.slice(0, 10)}…</p>
            <p><span className="text-zinc-500 font-sans">JobMarketplace:</span> {CONTRACT_ADDRESSES.jobMarketplace.slice(0, 10)}…</p>
            <p><span className="text-zinc-500 font-sans">JobEscrow:</span> {CONTRACT_ADDRESSES.jobEscrow.slice(0, 10)}…</p>
            <p><span className="text-zinc-500 font-sans">ReputationManager:</span> {CONTRACT_ADDRESSES.reputationManager.slice(0, 10)}…</p>
          </div>
        </section>

        {/* On-Chain Registered Agents Directory */}
        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bot className="h-5 w-5 text-zinc-300" />
                Registered Agents Directory
              </h2>
              <p className="text-xs text-zinc-400">Discover, build, & customize AI agents registered on Monad</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setBuilderAgentId(''); setBuilderModalOpen(true) }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 hover:border-zinc-500 active:scale-95 transition"
              >
                <Bot className="h-3.5 w-3.5 text-zinc-400" />
                + Deploy Agent
              </button>
              <span className="rounded-full bg-zinc-900 border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-300">
                {agentCount} Agents On-Chain
              </span>
            </div>
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
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-zinc-300" />
                  Agent Inspector
                </h2>
                <span className="text-xs text-zinc-400">Total Registered: {agentCount}</span>
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
                      className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 transition-all hover:border-zinc-600 focus:border-white focus:outline-none"
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
                <div className="py-8 text-center text-xs text-zinc-500 animate-pulse">Querying Monad RPC…</div>
              ) : (
                <div className="divide-y divide-zinc-800/80 text-xs text-zinc-300">
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

            <div className="mt-4 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => handleOpenBuilderModal(agentId)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white hover:border-zinc-500 transition flex items-center justify-center gap-1.5"
              >
                <Sliders className="h-4 w-4 text-zinc-400" />
                Customize Agent #{agentId} System Persona & Prompt
              </button>
            </div>
          </div>

          {/* Job Marketplace Table */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-zinc-300" />
                    Job Board
                  </h2>
                  <p className="text-xs text-zinc-400">Open and completed work requests with live Escrow balance</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-zinc-900 border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-200">
                    {openJobs.length} Open
                  </span>
                  <span className="rounded-full bg-zinc-900/50 border border-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-500">
                    {jobCount} Total
                  </span>
                </div>
              </div>
              <JobTable jobs={jobs} />
            </div>
          </div>
        </section>

        {/* Execution Hub: Interactive Protocol Actions */}
        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 border-b border-zinc-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-zinc-300" />
              Protocol Actions
            </h2>
            <p className="text-xs text-zinc-400 mb-4">Execute smart contract functions across all deployed modules using contract ABIs</p>

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
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
                    activeTab === tab.id
                      ? 'border-white bg-white text-black shadow-md'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
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
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-3 text-xs text-zinc-300 mb-2">
                  Registers a new AI agent into the <strong className="text-white">AgentRegistry</strong> smart contract.
                </div>
                <Input label="Agent Name" value={registerForm.name} onChange={(v) => setRegisterForm((p) => ({ ...p, name: v }))} />
                <Input label="Metadata URI (IPFS / Arweave)" value={registerForm.metadataURI} onChange={(v) => setRegisterForm((p) => ({ ...p, metadataURI: v }))} />
                <Input label="Execution Price (MON)" value={registerForm.priceMon} onChange={(v) => setRegisterForm((p) => ({ ...p, priceMon: v }))} />
                <button className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black shadow-md hover:bg-zinc-200 active:scale-95 flex items-center gap-1.5 transition" type="submit">
                  <Bot className="h-4 w-4 text-black" />
                  Register Agent
                </button>
              </form>
            )}

            {/* 2. AGENT BUILDER & PERSONA CONFIGURATOR */}
            {activeTab === 'builder' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-3 text-xs text-zinc-300 mb-2">
                  Configure and build custom AI personas, system prompts, and specialized execution capability sets for any agent.
                </div>
                <Input label="Agent ID to Customize" value={agentId} onChange={(v) => handleSelectAgent(v)} />
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2 text-zinc-300">
                  <p className="font-bold text-white">Current Agent Persona: {selectedAgentProfile.presetName}</p>
                  <p className="text-zinc-400 font-mono text-[11px]">Prompt: {selectedAgentProfile.systemPrompt.slice(0, 120)}...</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenBuilderModal(agentId)}
                  className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black shadow-md hover:bg-zinc-200 active:scale-95 flex items-center gap-1.5 transition"
                >
                  <Sliders className="h-4 w-4 text-black" />
                  Open Agent Builder & Configurator Modal
                </button>
              </div>
            )}

            {/* 3. UPDATE AGENT */}
            {activeTab === 'update' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Update Agent', () => updateAgentTx({ signer, agentId: Number(updateForm.agentId), name: updateForm.name, metadataURI: updateForm.metadataURI, priceMon: updateForm.priceMon, active: updateForm.active })) }}>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400 mb-2">
                  Updates an existing agent in <strong className="text-white">AgentRegistry</strong>. Must be executed by the agent owner.
                </div>
                <Input label="Agent ID to Update" value={updateForm.agentId} onChange={(v) => handleSelectAgent(v)} />
                <Input label="Updated Agent Name" value={updateForm.name} onChange={(v) => setUpdateForm((p) => ({ ...p, name: v }))} />
                <Input label="Updated Metadata URI" value={updateForm.metadataURI} onChange={(v) => setUpdateForm((p) => ({ ...p, metadataURI: v }))} />
                <Input label="Updated Price (MON)" value={updateForm.priceMon} onChange={(v) => setUpdateForm((p) => ({ ...p, priceMon: v }))} />
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateForm.active}
                    onChange={(e) => setUpdateForm((p) => ({ ...p, active: e.target.checked }))}
                    className="rounded border-zinc-700 bg-zinc-900 text-white focus:ring-white"
                  />
                  Agent Active Status
                </label>
                <button className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition" type="submit">
                  Update Agent Record
                </button>
              </form>
            )}

            {/* 4. HIRE AGENT (1-CLICK CREATION + ESCROW DEPOSIT) */}
            {activeTab === 'hire' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Hire Agent', () => hireAgentTx({ signer, agentId: Number(hireForm.targetAgentId), description: hireForm.description, rewardMon: hireForm.rewardMon })) }}>
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-3 text-xs text-zinc-300 mb-2">
                  <strong className="text-white">1-Click Hire:</strong> Sequentially creates a job on <strong className="text-white">JobMarketplace</strong> AND deposits the reward MON into <strong className="text-white">JobEscrow</strong>.
                </div>

                <Input label="Target Agent ID" value={hireForm.targetAgentId} onChange={(v) => setHireForm((p) => ({ ...p, targetAgentId: v }))} />

                {targetAgentForHire && (
                  <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-xs shadow-inner">
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>Agent #{targetAgentForHire.id}: {targetAgentForHire.name}</span>
                      <span className="font-mono text-zinc-300">{targetAgentForHire.priceMon} MON</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">Owner: {targetAgentForHire.owner}</p>
                    <p className="text-[11px] text-zinc-400">Status: {targetAgentForHire.active ? 'Active ✓' : 'Inactive ✗'} | Reputation: {targetAgentForHire.reputationScore} pts</p>
                  </div>
                )}

                <Input label="Job Task Description" value={hireForm.description} onChange={(v) => setHireForm((p) => ({ ...p, description: v }))} />
                <Input label="Bounty Reward (MON)" value={hireForm.rewardMon} onChange={(v) => setHireForm((p) => ({ ...p, rewardMon: v }))} />

                <button className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black shadow-md hover:bg-zinc-200 active:scale-95 flex items-center gap-1.5 transition" type="submit">
                  <Coins className="h-4 w-4 text-black" />
                  Hire Agent & Escrow Funds
                </button>
              </form>
            )}

            {/* 5. CREATE JOB */}
            {activeTab === 'create' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Create Job', () => createJobTx({ signer, agentId: Number(createJobForm.targetAgentId), description: createJobForm.description, rewardMon: createJobForm.rewardMon })) }}>
                <Input label="Target Agent ID" value={createJobForm.targetAgentId} onChange={(v) => setCreateJobForm((p) => ({ ...p, targetAgentId: v }))} />
                {targetAgentForCreate && (
                  <div className="text-xs text-zinc-400">
                    Selected: <strong className="text-white">{targetAgentForCreate.name}</strong> ({targetAgentForCreate.priceMon} MON)
                  </div>
                )}
                <Input label="Job Description" value={createJobForm.description} onChange={(v) => setCreateJobForm((p) => ({ ...p, description: v }))} />
                <Input label="Reward Bounty (MON)" value={createJobForm.rewardMon} onChange={(v) => setCreateJobForm((p) => ({ ...p, rewardMon: v }))} />
                <button className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black shadow-md hover:bg-zinc-200 active:scale-95 transition" type="submit">
                  Create Job
                </button>
              </form>
            )}

            {/* 6. ACCEPT JOB */}
            {activeTab === 'accept' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Accept Job', () => acceptJobTx({ signer, jobId: Number(acceptForm.jobId) })) }}>
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-3 text-xs text-zinc-300 mb-2">
                  Allows the owner of the assigned agent to accept an OPEN job on <strong className="text-white">JobMarketplace</strong>.
                </div>
                <Input label="Job ID to Accept" value={acceptForm.jobId} onChange={(v) => setAcceptForm({ jobId: v })} />
                <button className="rounded-xl border border-zinc-600 bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-zinc-800 active:scale-95 transition" type="submit">
                  Accept Job Assignment
                </button>
              </form>
            )}

            {/* 7. COMPLETE JOB */}
            {activeTab === 'complete' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Complete Job', () => completeJobTx({ signer, jobId: Number(completeForm.jobId) })) }}>
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-3 text-xs text-zinc-300 mb-2">
                  Marks an ACCEPTED job as COMPLETED and automatically records reputation score bonus via <strong className="text-white">ReputationManager</strong>.
                </div>
                <Input label="Job ID to Complete" value={completeForm.jobId} onChange={(v) => setCompleteForm({ jobId: v })} />
                <button className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black shadow-md hover:bg-zinc-200 active:scale-95 flex items-center gap-1.5 transition" type="submit">
                  <Award className="h-4 w-4 text-black" />
                  Mark Job Completed & Award Reputation
                </button>
              </form>
            )}

            {/* 8. DEPOSIT ESCROW */}
            {activeTab === 'escrow' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Deposit Escrow', () => depositEscrowTx({ signer, jobId: Number(escrowForm.depositJobId), amountMon: escrowForm.depositAmountMon })) }}>
                <Input label="Job ID to Escrow" value={escrowForm.depositJobId} onChange={(v) => setEscrowForm((p) => ({ ...p, depositJobId: v }))} />
                <Input label="Deposit Amount (MON)" value={escrowForm.depositAmountMon} onChange={(v) => setEscrowForm((p) => ({ ...p, depositAmountMon: v }))} />
                <button className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black shadow-md hover:bg-zinc-200 active:scale-95 transition" type="submit">
                  Deposit to Escrow
                </button>
              </form>
            )}

            {/* 9. RELEASE ESCROW */}
            {activeTab === 'release' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Release Payment', () => releaseEscrowTx({ signer, jobId: Number(escrowForm.releaseJobId) })) }}>
                <Input label="Completed Job ID" value={escrowForm.releaseJobId} onChange={(v) => setEscrowForm((p) => ({ ...p, releaseJobId: v }))} />
                <button className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-zinc-800 active:scale-95 transition" type="submit">
                  Release Escrow Funds to Agent
                </button>
              </form>
            )}

            {/* 10. REPUTATION CONTRACT */}
            {activeTab === 'reputation' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-3 text-xs text-zinc-300 mb-2">
                  <strong className="text-white">ReputationManager Smart Contract:</strong> On-chain agent reputation score (+10 pts per completed job). Updated automatically by <strong className="text-white">JobMarketplace</strong> when completing jobs.
                </div>

                <Input label="Lookup Agent ID Reputation" value={agentId} onChange={(v) => handleSelectAgent(v)} />

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="font-bold text-white">Agent #{agentId}: {agent?.name || 'Selected Agent'}</span>
                    <span className="rounded-full bg-black border border-zinc-700 px-2.5 py-0.5 text-xs font-bold text-white">
                      {reputation.score} Total Points
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl border border-zinc-800 bg-black p-2.5">
                      <span className="block text-[10px] text-zinc-400 font-bold uppercase">Score</span>
                      <span className="block font-extrabold text-white text-sm mt-0.5">{reputation.score} pts</span>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-black p-2.5">
                      <span className="block text-[10px] text-zinc-400 font-bold uppercase">Completed Jobs</span>
                      <span className="block font-extrabold text-zinc-200 text-sm mt-0.5">{reputation.completedJobs}</span>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-black p-2.5">
                      <span className="block text-[10px] text-zinc-400 font-bold uppercase">Failed Jobs</span>
                      <span className="block font-extrabold text-zinc-400 text-sm mt-0.5">{reputation.failedJobs}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 11. CONTRACT ADMIN */}
            {activeTab === 'admin' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Set Marketplace Address', () => setMarketplaceTx({ signer, marketplaceAddress: adminForm.marketplaceAddress })) }}>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400 mb-2">
                  Configures the authorized JobMarketplace address in <strong className="text-white">ReputationManager</strong>. Must be run by contract deployer/owner.
                </div>
                <Input label="Marketplace Address" value={adminForm.marketplaceAddress} onChange={(v) => setAdminForm({ marketplaceAddress: v })} />
                <button className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-zinc-800 active:scale-95 transition" type="submit">
                  Update Marketplace Permission
                </button>
              </form>
            )}
          </div>
        </section>

        {/* History & Runtime Signals */}
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-sm">
            <h2 className="mb-4 text-base font-bold text-white flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-zinc-300" />
              Recent Transactions
            </h2>
            <TxList items={txHistory} />
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-sm">
            <h2 className="mb-4 text-base font-bold text-white flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-zinc-300" />
              System Telemetry
            </h2>
            <div className="space-y-3 text-xs text-zinc-300">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span>Total On-Chain Agents</span>
                <span className="font-semibold text-white">{agentCount} registered</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span>Active Jobs Pool</span>
                <span className="font-semibold text-white">{openJobs.length} open / {jobCount} total</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span>MetaMask Provider</span>
                <span className={`font-semibold ${hasMetaMask() ? 'text-white' : 'text-zinc-500'}`}>
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
        onSaved={() => fetchStatus(wallet.address)}
        onDeployNewAgent={handleDeployNewAgentFromBuilder}
      />
    </div>
  )
}

function Input({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 transition-all placeholder:text-zinc-500 hover:border-zinc-700 focus:border-white focus:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-white/20"
      />
    </label>
  )
}

export default App