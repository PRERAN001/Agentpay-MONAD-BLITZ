import { useEffect, useMemo, useState } from 'react'

import AgentDirectory from './components/AgentDirectory'
import InfoRow from './components/InfoRow'
import JobTable from './components/JobTable'
import StatCard from './components/StatCard'
import TxList from './components/TxList'
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

  const fetchStatus = async (walletAddress = wallet.address) => {
    try {
      setLoading(true)
      setError('')
      const snapshot = await readDashboardState({ agentId, walletAddress })
      setNetwork(snapshot.networkName)
      setWallet((prev) => ({ ...prev, balanceMon: snapshot.walletBalanceMon }))
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
  }, [agentId])

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

  const targetAgentForHire = useMemo(() => {
    return agents.find((a) => String(a.id) === String(hireForm.targetAgentId))
  }, [agents, hireForm.targetAgentId])

  const targetAgentForCreate = useMemo(() => {
    return agents.find((a) => String(a.id) === String(createJobForm.targetAgentId))
  }, [agents, createJobForm.targetAgentId])

  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'OPEN'), [jobs])

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900 font-['Inter',sans-serif]">
      {/* Background Decorative Mesh Glow */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-gradient-to-tr from-indigo-100/60 to-purple-100/40 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-96 w-96 rounded-full bg-gradient-to-br from-blue-100/50 to-emerald-50/50 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Navigation Header */}
        <header className="mb-8 flex flex-col gap-5 border-b border-slate-200/80 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/60 px-3 py-1 text-xs font-semibold tracking-wider text-indigo-700 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
              AgentPay Protocol
            </div>
            <h1 className="mt-2 font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Monad AI-Agent Marketplace
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-normal">
              Decentralized micro-contracts and autonomous execution layer on Monad.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleConnectWallet}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-wide transition-all shadow-sm ${
                wallet.connected
                  ? 'border border-emerald-200 bg-emerald-50/70 text-emerald-800'
                  : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-slate-900/10'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${wallet.connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {wallet.connected ? 'Wallet Connected' : 'Connect MetaMask'}
            </button>

            <button
              type="button"
              onClick={() => fetchStatus()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              Refresh
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs font-medium text-rose-800 shadow-sm">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-200 text-rose-800 font-bold">!</span>
            {error}
          </div>
        )}

        {/* Success Banner when registering */}
        {lastRegisteredId && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-medium text-emerald-900 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-emerald-800">✓</span>
              <span>Agent successfully registered on-chain with <strong>Agent ID #{lastRegisteredId}</strong>!</span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectAgent(lastRegisteredId)}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
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

        {/* Contract Wire Info */}
        <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm p-4 text-xs font-['JetBrains_Mono',monospace] text-slate-600 shadow-sm">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 font-sans font-semibold text-slate-800">
            <span>Live On-Chain Smart Contracts</span>
            <span className="font-mono text-[11px] text-slate-400 font-normal">RPC: {MONAD_RPC_URL}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
            <p><span className="text-slate-400 font-sans">AgentRegistry:</span> {CONTRACT_ADDRESSES.agentRegistry.slice(0, 10)}…</p>
            <p><span className="text-slate-400 font-sans">JobMarketplace:</span> {CONTRACT_ADDRESSES.jobMarketplace.slice(0, 10)}…</p>
            <p><span className="text-slate-400 font-sans">JobEscrow:</span> {CONTRACT_ADDRESSES.jobEscrow.slice(0, 10)}…</p>
            <p><span className="text-slate-400 font-sans">ReputationManager:</span> {CONTRACT_ADDRESSES.reputationManager.slice(0, 10)}…</p>
          </div>
        </section>

        {/* On-Chain Registered Agents Directory */}
        <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-slate-900">Registered Agents Directory</h2>
              <p className="text-xs text-slate-400">Discover and hire AI agents registered on Monad</p>
            </div>
            <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              {agentCount} Agents On-Chain
            </span>
          </div>

          <AgentDirectory
            agents={agents}
            selectedAgentId={agentId}
            onSelectAgent={handleSelectAgent}
            onHireAgent={handleHireFromDirectory}
          />
        </section>

        {/* Primary Workspace (Inspector & Job Board) */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_1.95fr]">
          {/* Agent Inspector */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-slate-900">Agent Inspector</h2>
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
                    className="rounded-xl border border-slate-200 bg-[#F9FAFB] px-3 py-2 text-xs text-slate-900 transition-all hover:border-slate-300 focus:border-indigo-600 focus:outline-none"
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
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Querying Monad RPC…</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                <InfoRow label="Agent Name" value={agent?.name ?? 'Not registered'} />
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

          {/* Job Marketplace Table */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-slate-900">Job Board</h2>
                  <p className="text-xs text-slate-400">Open and completed work requests with live Escrow balance</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {openJobs.length} Open
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {jobCount} Total
                  </span>
                </div>
              </div>
              <JobTable jobs={jobs} />
            </div>
          </div>
        </section>

        {/* Execution Hub: Interactive Protocol Actions */}
        <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-slate-900">Protocol Actions</h2>
            <p className="text-xs text-slate-500 mb-4">Execute smart contract functions across all deployed modules using contract ABIs</p>
            
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'register', label: '1. Register Agent' },
                { id: 'update', label: '2. Update Agent' },
                { id: 'hire', label: '3. Hire Agent (1-Click)' },
                { id: 'create', label: '4. Create Job' },
                { id: 'accept', label: '5. Accept Job' },
                { id: 'complete', label: '6. Complete Job' },
                { id: 'escrow', label: '7. Deposit Escrow' },
                { id: 'release', label: '8. Release Payment' },
                { id: 'admin', label: '9. Contract Admin' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100/70 text-slate-600 hover:bg-slate-100'
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
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs text-indigo-900 mb-2">
                  Registers a new AI agent into the <strong>AgentRegistry</strong> smart contract.
                </div>
                <Input label="Agent Name" value={registerForm.name} onChange={(v) => setRegisterForm((p) => ({ ...p, name: v }))} />
                <Input label="Metadata URI (IPFS / Arweave)" value={registerForm.metadataURI} onChange={(v) => setRegisterForm((p) => ({ ...p, metadataURI: v }))} />
                <Input label="Execution Price (MON)" value={registerForm.priceMon} onChange={(v) => setRegisterForm((p) => ({ ...p, priceMon: v }))} />
                <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95" type="submit">
                  Register Agent
                </button>
              </form>
            )}

            {/* 2. UPDATE AGENT */}
            {activeTab === 'update' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Update Agent', () => updateAgentTx({ signer, agentId: Number(updateForm.agentId), name: updateForm.name, metadataURI: updateForm.metadataURI, priceMon: updateForm.priceMon, active: updateForm.active })) }}>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-700 mb-2">
                  Updates an existing agent in <strong>AgentRegistry</strong>. Must be executed by the agent owner.
                </div>
                <Input label="Agent ID to Update" value={updateForm.agentId} onChange={(v) => handleSelectAgent(v)} />
                <Input label="Updated Agent Name" value={updateForm.name} onChange={(v) => setUpdateForm((p) => ({ ...p, name: v }))} />
                <Input label="Updated Metadata URI" value={updateForm.metadataURI} onChange={(v) => setUpdateForm((p) => ({ ...p, metadataURI: v }))} />
                <Input label="Updated Price (MON)" value={updateForm.priceMon} onChange={(v) => setUpdateForm((p) => ({ ...p, priceMon: v }))} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateForm.active}
                    onChange={(e) => setUpdateForm((p) => ({ ...p, active: e.target.checked }))}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Agent Active Status
                </label>
                <button className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-95" type="submit">
                  Update Agent Record
                </button>
              </form>
            )}

            {/* 3. HIRE AGENT (1-CLICK CREATION + ESCROW DEPOSIT) */}
            {activeTab === 'hire' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Hire Agent', () => hireAgentTx({ signer, agentId: Number(hireForm.targetAgentId), description: hireForm.description, rewardMon: hireForm.rewardMon })) }}>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs text-indigo-900 mb-2">
                  <strong>1-Click Hire:</strong> Sequentially creates a job on <strong>JobMarketplace</strong> AND deposits the reward MON into <strong>JobEscrow</strong>.
                </div>
                
                <Input label="Target Agent ID" value={hireForm.targetAgentId} onChange={(v) => setHireForm((p) => ({ ...p, targetAgentId: v }))} />
                
                {targetAgentForHire && (
                  <div className="rounded-xl border border-indigo-200 bg-white p-3 text-xs shadow-2xs">
                    <div className="flex items-center justify-between font-semibold text-indigo-900">
                      <span>Agent #{targetAgentForHire.id}: {targetAgentForHire.name}</span>
                      <span className="text-indigo-600">{targetAgentForHire.priceMon} MON</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Owner: {targetAgentForHire.owner}</p>
                    <p className="text-[11px] text-slate-500">Status: {targetAgentForHire.active ? 'Active ✓' : 'Inactive ✗'} | Reputation: {targetAgentForHire.reputationScore} pts</p>
                  </div>
                )}

                <Input label="Job Task Description" value={hireForm.description} onChange={(v) => setHireForm((p) => ({ ...p, description: v }))} />
                <Input label="Bounty Reward (MON)" value={hireForm.rewardMon} onChange={(v) => setHireForm((p) => ({ ...p, rewardMon: v }))} />

                <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95" type="submit">
                  Hire Agent & Escrow Funds
                </button>
              </form>
            )}

            {/* 4. CREATE JOB */}
            {activeTab === 'create' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Create Job', () => createJobTx({ signer, agentId: Number(createJobForm.targetAgentId), description: createJobForm.description, rewardMon: createJobForm.rewardMon })) }}>
                <Input label="Target Agent ID" value={createJobForm.targetAgentId} onChange={(v) => setCreateJobForm((p) => ({ ...p, targetAgentId: v }))} />
                {targetAgentForCreate && (
                  <div className="text-xs text-slate-500">
                    Selected: <strong>{targetAgentForCreate.name}</strong> ({targetAgentForCreate.priceMon} MON)
                  </div>
                )}
                <Input label="Job Description" value={createJobForm.description} onChange={(v) => setCreateJobForm((p) => ({ ...p, description: v }))} />
                <Input label="Reward Bounty (MON)" value={createJobForm.rewardMon} onChange={(v) => setCreateJobForm((p) => ({ ...p, rewardMon: v }))} />
                <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95" type="submit">
                  Create Job
                </button>
              </form>
            )}

            {/* 5. ACCEPT JOB */}
            {activeTab === 'accept' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Accept Job', () => acceptJobTx({ signer, jobId: Number(acceptForm.jobId) })) }}>
                <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 text-xs text-amber-900 mb-2">
                  Allows the owner of the assigned agent to accept an OPEN job on <strong>JobMarketplace</strong>.
                </div>
                <Input label="Job ID to Accept" value={acceptForm.jobId} onChange={(v) => setAcceptForm({ jobId: v })} />
                <button className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 active:scale-95" type="submit">
                  Accept Job Assignment
                </button>
              </form>
            )}

            {/* 6. COMPLETE JOB */}
            {activeTab === 'complete' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Complete Job', () => completeJobTx({ signer, jobId: Number(completeForm.jobId) })) }}>
                <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3 text-xs text-sky-900 mb-2">
                  Marks an ACCEPTED job as COMPLETED and automatically records reputation score bonus via <strong>ReputationManager</strong>.
                </div>
                <Input label="Job ID to Complete" value={completeForm.jobId} onChange={(v) => setCompleteForm({ jobId: v })} />
                <button className="rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 active:scale-95" type="submit">
                  Mark Job Completed
                </button>
              </form>
            )}

            {/* 7. DEPOSIT ESCROW */}
            {activeTab === 'escrow' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Deposit Escrow', () => depositEscrowTx({ signer, jobId: Number(escrowForm.depositJobId), amountMon: escrowForm.depositAmountMon })) }}>
                <Input label="Job ID to Escrow" value={escrowForm.depositJobId} onChange={(v) => setEscrowForm((p) => ({ ...p, depositJobId: v }))} />
                <Input label="Deposit Amount (MON)" value={escrowForm.depositAmountMon} onChange={(v) => setEscrowForm((p) => ({ ...p, depositAmountMon: v }))} />
                <button className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95" type="submit">
                  Deposit to Escrow
                </button>
              </form>
            )}

            {/* 8. RELEASE ESCROW */}
            {activeTab === 'release' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Release Payment', () => releaseEscrowTx({ signer, jobId: Number(escrowForm.releaseJobId) })) }}>
                <Input label="Completed Job ID" value={escrowForm.releaseJobId} onChange={(v) => setEscrowForm((p) => ({ ...p, releaseJobId: v }))} />
                <button className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-95" type="submit">
                  Release Escrow Funds to Agent
                </button>
              </form>
            )}

            {/* 9. CONTRACT ADMIN */}
            {activeTab === 'admin' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); runTx('Set Marketplace Address', () => setMarketplaceTx({ signer, marketplaceAddress: adminForm.marketplaceAddress })) }}>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-700 mb-2">
                  Configures the authorized JobMarketplace address in <strong>ReputationManager</strong>. Must be run by contract deployer/owner.
                </div>
                <Input label="Marketplace Address" value={adminForm.marketplaceAddress} onChange={(v) => setAdminForm({ marketplaceAddress: v })} />
                <button className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-95" type="submit">
                  Update Marketplace Permission
                </button>
              </form>
            )}
          </div>
        </section>

        {/* History & Runtime Signals */}
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-slate-900">Recent Transactions</h2>
            <TxList items={txHistory} />
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-slate-900">System Telemetry</h2>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span>Total On-Chain Agents</span>
                <span className="font-semibold text-indigo-600">{agentCount} registered</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span>Active Jobs Pool</span>
                <span className="font-semibold text-slate-900">{openJobs.length} open / {jobCount} total</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span>MetaMask Provider</span>
                <span className={`font-semibold ${hasMetaMask() ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {hasMetaMask() ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Protocol Engine</span>
                <span className="font-semibold text-slate-900">Monad Testnet</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Input({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-[#F9FAFB] px-3.5 py-2.5 text-xs text-slate-900 transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-600/10"
      />
    </label>
  )
}

export default App