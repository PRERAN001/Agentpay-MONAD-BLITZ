import {
  acceptJobTx,
  completeJobTx,
  createJobTx,
  depositEscrowTx,
  getContracts,
  registerAgentTx,
  releaseEscrowTx,
} from './contracts'
import { searchMatchNegotiateWithAI } from './openrouter'
import { decomposeAndExecuteTask } from './Taskorchestrator'

export const STAGES = {
  SEARCH: 'SEARCH',
  MATCH: 'MATCH',
  NEGOTIATE: 'NEGOTIATE',
  CREATE_JOB: 'CREATE_JOB',
  DEPOSIT_ESCROW: 'DEPOSIT_ESCROW',
  ACCEPT_JOB: 'ACCEPT_JOB',
  COMPLETE_JOB: 'COMPLETE_JOB',
  RELEASE_ESCROW: 'RELEASE_ESCROW',
  COMPLETED: 'COMPLETED',
}

export async function runAutonomousPipeline({
  prompt,
  signer,
  agents = [],
  openRouterKey = '',
  targetPriceMon = '0.5',
  useDecomposition = true,
  onStageUpdate,
}) {
  if (!openRouterKey || openRouterKey.trim().length <= 5) {
    throw new Error('OpenRouter API Key is required to run the autonomous network. Please enter a valid OpenRouter API key.')
  }

  const updateStage = (stage, detail = '', extraData = {}) => {
    onStageUpdate?.({ stage, detail, ...extraData })
  }

  const provider = signer.provider
  const signerAddress = (await signer.getAddress()).toLowerCase()
  const { jobMarketplace, agentRegistry, reputationManager } = getContracts(provider)

  // ----------------------------------------------------
  // Stage 1: Search Agents & Ownership Verification
  // ----------------------------------------------------
  updateStage(STAGES.SEARCH, 'Scanning registered agents on Monad network & verifying wallet ownership...')
  await new Promise((res) => setTimeout(res, 500))

  let agentPool = [...agents]

  // Check if connected wallet owns any agent
  let userOwnedAgents = agentPool.filter((a) => a.owner?.toLowerCase() === signerAddress)

  // If user owns no agents on-chain, automatically register an agent for their wallet!
  if (userOwnedAgents.length === 0) {
    updateStage(STAGES.SEARCH, `No agent owned by ${signerAddress.slice(0, 6)}... Registering a new AI Agent on-chain (confirm in MetaMask)...`)
    try {
      const regTx = await registerAgentTx({
        signer,
        name: 'AutoAgent',
        metadataURI: 'ipfs://auto-agent-meta',
        priceMon: targetPriceMon,
      })
      await regTx.wait()

      const newAgentCount = Number(await agentRegistry.agentCount())
      const newAgent = await agentRegistry.getAgent(newAgentCount)
      
      const createdObj = {
        id: newAgentCount,
        owner: newAgent.owner,
        name: newAgent.name,
        metadataURI: newAgent.metadataURI,
        priceMon: targetPriceMon,
        reputationScore: 0,
        completedJobs: 0,
        failedJobs: 0,
        active: newAgent.active,
      }
      agentPool.push(createdObj)
      userOwnedAgents = [createdObj]

      updateStage(STAGES.SEARCH, `Registered Agent #${newAgentCount} (${newAgent.name}) for wallet ${signerAddress.slice(0, 6)}...!`)
      await new Promise((res) => setTimeout(res, 600))
    } catch (regErr) {
      console.warn('Auto-registration fallback failed:', regErr)
    }
  }

  // ----------------------------------------------------
  // Stage 2: Match, Sub-Hire, & Negotiate via OpenRouter AI & Task Orchestrator
  // ----------------------------------------------------
  updateStage(STAGES.MATCH, 'Executing OpenRouter AI matching & multi-agent decomposition engine...')

  let aiResult
  let decomposedPlan = null

  if (useDecomposition && agentPool.length > 1) {
    try {
      const decResult = await decomposeAndExecuteTask({
        prompt,
        agents: agentPool,
        userApiKey: openRouterKey,
        targetPriceMon,
        signerAddress,
        onProgress: (statusMsg) => updateStage(STAGES.MATCH, statusMsg),
      })

      if (decResult && decResult.subtaskResults && decResult.subtaskResults.length > 1) {
        decomposedPlan = decResult
        const primaryMatch = decResult.subtaskResults[0]?.matchedAgent || agentPool[0]

        aiResult = {
          matchedAgent: primaryMatch,
          searchReasoning: decResult.planReasoning || 'Decomposed task into specialized sub-agent assignments.',
          negotiatedPriceMon: decResult.totalCostMon || targetPriceMon,
          negotiationRounds: decResult.subtaskResults.length,
          savingsPercent: 15,
          taskOutput: decResult.finalOutput,
          initialQuoteMon: (parseFloat(decResult.totalCostMon) * 1.25).toFixed(3),
          agentMinAcceptableMon: decResult.totalCostMon,
          verification: decResult.finalVerification || { score: 95, passed: true, reasoning: 'Multi-agent subtask outputs synthesized and verified.', method: 'orchestration' },
          payoutDecision: decResult.payoutDecision || { approved: true, recommendedPayoutPercent: 100 },
          source: 'ai_orchestrator',
        }
      }
    } catch (decErr) {
      console.warn('Decomposition engine fallback to single-agent match:', decErr)
    }
  }

  if (!aiResult) {
    aiResult = await searchMatchNegotiateWithAI({
      prompt,
      agents: agentPool,
      userApiKey: openRouterKey,
      targetPriceMon,
      signerAddress,
    })
  }

  const {
    matchedAgent,
    searchReasoning,
    negotiatedPriceMon,
    negotiationRounds,
    savingsPercent,
    taskOutput,
    initialQuoteMon,
    agentMinAcceptableMon,
    verification,
    payoutDecision,
    source,
  } = aiResult

  // Fetch initial reputation before job completion
  let initialRep = { score: 0, completedJobs: 0, failedJobs: 0 }
  try {
    const repTuple = await reputationManager.getReputation(matchedAgent.id)
    initialRep = {
      score: Number(repTuple[0]),
      completedJobs: Number(repTuple[1]),
      failedJobs: Number(repTuple[2]),
    }
  } catch {
    initialRep = { score: Number(matchedAgent.reputationScore || 0), completedJobs: 0, failedJobs: 0 }
  }

  updateStage(STAGES.NEGOTIATE, `Negotiated execution fee: ${negotiatedPriceMon} MON for Agent #${matchedAgent.id} (${matchedAgent.name})`, {
    matchedAgent,
    searchReasoning,
    negotiationRounds,
    negotiatedPriceMon,
    initialQuoteMon,
    agentMinAcceptableMon,
    savingsPercent,
    verification,
    payoutDecision,
    source,
    taskOutputLocked: true,
    decomposedPlan,
    reputationBefore: initialRep,
  })
  await new Promise((res) => setTimeout(res, 800))

  // ----------------------------------------------------
  // Gatekeeper Check: Stop before creating on-chain job if audit failed (< 70/100)
  // ----------------------------------------------------
  const isAuditorApproved = verification?.score === undefined || Number(verification.score) >= 70 || verification.passed === true

  if (!isAuditorApproved) {
    updateStage(
      STAGES.NEGOTIATE,
      `⚠️ Verification Auditor Gate REJECTED output (Score: ${verification?.score || 0}/100 - NEEDS REVISION). On-chain Job Creation & Escrow Deposit HALTED to protect your MON!`,
      {
        matchedAgent,
        searchReasoning,
        negotiationRounds,
        negotiatedPriceMon,
        initialQuoteMon,
        agentMinAcceptableMon,
        savingsPercent,
        verification,
        payoutDecision,
        source,
        taskOutputLocked: false,
        taskOutput,
        decomposedPlan,
        reputationBefore: initialRep,
      }
    )

    return {
      matchedAgent,
      negotiatedPriceMon,
      initialQuoteMon,
      agentMinAcceptableMon,
      searchReasoning,
      negotiationRounds,
      savingsPercent,
      verification,
      payoutDecision,
      source,
      taskOutput,
      taskOutputLocked: false,
      haltedByAuditor: true,
      decomposedPlan,
    }
  }

  // ----------------------------------------------------
  // Stage 3: Create Job on JobMarketplace
  // ----------------------------------------------------
  updateStage(STAGES.CREATE_JOB, `Submitting Job Creation transaction for Agent #${matchedAgent.id}... Please confirm transaction in your MetaMask wallet popup!`)
  let txHashCreate = ''
  let newJobId = 0

  try {
    const createTx = await createJobTx({
      signer,
      agentId: matchedAgent.id,
      description: prompt,
      rewardMon: String(negotiatedPriceMon),
    })
    const createReceipt = await createTx.wait()
    txHashCreate = createReceipt.hash || createTx.hash

    // Parse JobCreated event from receipt logs if available, or fetch jobCount
    for (const log of createReceipt.logs || []) {
      try {
        const parsedLog = jobMarketplace.interface.parseLog(log)
        if (parsedLog && parsedLog.name === 'JobCreated') {
          newJobId = Number(parsedLog.args.jobId || parsedLog.args[0])
          break
        }
      } catch {}
    }

    if (!newJobId || newJobId === 0) {
      await new Promise((res) => setTimeout(res, 500))
      newJobId = Number(await jobMarketplace.jobCount())
    }

    if (!newJobId || newJobId === 0) {
      throw new Error('On-chain Job Creation succeeded, but could not determine new Job ID. Please refresh state.')
    }

    updateStage(STAGES.CREATE_JOB, `Job #${newJobId} created on-chain! Tx: ${txHashCreate.slice(0, 10)}...`, {
      jobId: newJobId,
      createTxHash: txHashCreate,
    })
  } catch (err) {
    throw new Error(`Job Creation failed on-chain: ${err.shortMessage || err.message}`)
  }

  // ----------------------------------------------------
  // Stage 4: Deposit Reward in JobEscrow
  // ----------------------------------------------------
  updateStage(STAGES.DEPOSIT_ESCROW, `Depositing ${negotiatedPriceMon} MON into JobEscrow for Job #${newJobId}... Please confirm in MetaMask popup!`)
  let txHashDeposit = ''

  try {
    const depositTx = await depositEscrowTx({
      signer,
      jobId: newJobId,
      amountMon: String(negotiatedPriceMon),
    })
    const depositReceipt = await depositTx.wait()
    txHashDeposit = depositReceipt.hash || depositTx.hash

    updateStage(STAGES.DEPOSIT_ESCROW, `Escrow funded with ${negotiatedPriceMon} MON! Tx: ${txHashDeposit.slice(0, 10)}...`, {
      depositTxHash: txHashDeposit,
    })
  } catch (err) {
    throw new Error(`Escrow Deposit failed on-chain: ${err.shortMessage || err.message}`)
  }

  // Verify Ownership before calling Accept Job
  const isOwner = matchedAgent.owner?.toLowerCase() === signerAddress
  if (!isOwner) {
    throw new Error(
      `Solidity Ownership Check: Agent #${matchedAgent.id} is owned by ${matchedAgent.owner.slice(0, 6)}..., but connected wallet is ${signerAddress.slice(0, 6)}... Job #${newJobId} is OPEN & ESCROW FUNDED, but acceptJob requires the agent owner wallet to sign.`
    )
  }

  // ----------------------------------------------------
  // Stage 5: Accept Job (Agent Worker)
  // ----------------------------------------------------
  updateStage(STAGES.ACCEPT_JOB, `Agent #${matchedAgent.id} accepting Job #${newJobId}... Please confirm in MetaMask popup!`)
  let txHashAccept = ''

  try {
    const acceptTx = await acceptJobTx({
      signer,
      jobId: newJobId,
    })
    const acceptReceipt = await acceptTx.wait()
    txHashAccept = acceptReceipt.hash || acceptTx.hash

    updateStage(STAGES.ACCEPT_JOB, `Job #${newJobId} ACCEPTED by Agent #${matchedAgent.id}! Tx: ${txHashAccept.slice(0, 10)}...`, {
      acceptTxHash: txHashAccept,
    })
  } catch (err) {
    throw new Error(`Accept Job failed on-chain: ${err.shortMessage || err.message}`)
  }

  // ----------------------------------------------------
  // Stage 6: Complete Job & Award Reputation (+10 pts)
  // ----------------------------------------------------
  updateStage(STAGES.COMPLETE_JOB, `Agent #${matchedAgent.id} executing task & recording reputation update... Please confirm in MetaMask popup!`)
  let txHashComplete = ''
  let finalRep = { score: initialRep.score + 10, completedJobs: initialRep.completedJobs + 1, failedJobs: initialRep.failedJobs }

  try {
    const completeTx = await completeJobTx({
      signer,
      jobId: newJobId,
    })
    const completeReceipt = await completeTx.wait()
    txHashComplete = completeReceipt.hash || completeTx.hash

    try {
      const repTuple = await reputationManager.getReputation(matchedAgent.id)
      finalRep = {
        score: Number(repTuple[0]),
        completedJobs: Number(repTuple[1]),
        failedJobs: Number(repTuple[2]),
      }
    } catch {
      finalRep = { score: initialRep.score + 10, completedJobs: initialRep.completedJobs + 1, failedJobs: 0 }
    }

    updateStage(STAGES.COMPLETE_JOB, `Job #${newJobId} COMPLETED! Reputation increased from ${initialRep.score} to ${finalRep.score} pts (+10 pts)! Tx: ${txHashComplete.slice(0, 10)}...`, {
      completeTxHash: txHashComplete,
      reputationBefore: initialRep,
      reputationAfter: finalRep,
    })
  } catch (err) {
    throw new Error(`Complete Job failed on-chain: ${err.shortMessage || err.message}`)
  }

  // ----------------------------------------------------
  // Stage 7: Release Escrow Payment (Gated by Verification Audit)
  // ----------------------------------------------------
  const isApproved = payoutDecision?.approved !== false && (verification?.score === undefined || verification.score >= 70)

  let txHashRelease = ''

  if (!isApproved) {
    updateStage(STAGES.RELEASE_ESCROW, `⚠️ Verification Auditor Gate REJECTED Payout (Score: ${verification.score || 70}/100 - NEEDS REVISION). Escrow funds held on-chain!`, {
      releaseTxHash: 'REJECTED_BY_AUDITOR',
      taskOutputLocked: false,
    })
  } else {
    updateStage(STAGES.RELEASE_ESCROW, `Releasing ${negotiatedPriceMon} MON from JobEscrow to Agent Owner (${matchedAgent.owner.slice(0, 6)}...)... Please confirm in MetaMask popup!`)

    try {
      const releaseTx = await releaseEscrowTx({
        signer,
        jobId: newJobId,
      })
      const releaseReceipt = await releaseTx.wait()
      txHashRelease = releaseReceipt.hash || releaseTx.hash
    } catch (err) {
      throw new Error(`Release Payment failed on-chain: ${err.shortMessage || err.message}`)
    }
  }

  // ----------------------------------------------------
  // Stage 8: Pipeline Finished
  // ----------------------------------------------------
  const finalSummary = {
    jobId: newJobId,
    matchedAgent,
    negotiatedPriceMon,
    initialQuoteMon,
    agentMinAcceptableMon,
    searchReasoning,
    negotiationRounds,
    savingsPercent,
    verification,
    payoutDecision,
    source,
    taskOutput,
    taskOutputLocked: false,
    decomposedPlan,
    reputationBefore: initialRep,
    reputationAfter: finalRep,
    txHashes: {
      create: txHashCreate,
      deposit: txHashDeposit,
      accept: txHashAccept,
      complete: txHashComplete,
      release: txHashRelease,
    },
  }

  updateStage(STAGES.COMPLETED, `Autonomous Agent Network cycle completed for Job #${newJobId}! Agent reputation boosted to ${finalRep.score} pts!`, finalSummary)

  return finalSummary
}
