import { ethers } from 'ethers'

import AgentRegistryArtifact from '../../abis/AgentRegistry.json'
import JobMarketplaceArtifact from '../../abis/JobMarketplace.json'
import JobEscrowArtifact from '../../abis/JobEscrow.json'
import ReputationManagerArtifact from '../../abis/ReputationManager.json'
import getDeployedContractAddresses from '../contract-config'

export const MONAD_RPC_URL = 'https://testnet-rpc.monad.xyz/'

export const CONTRACT_ADDRESSES = getDeployedContractAddresses()

export const ABIS = {
  agentRegistry: AgentRegistryArtifact.abi,
  jobMarketplace: JobMarketplaceArtifact.abi,
  jobEscrow: JobEscrowArtifact.abi,
  reputationManager: ReputationManagerArtifact.abi,
}

export const JOB_STATUS = {
  0: 'OPEN',
  1: 'ACCEPTED',
  2: 'COMPLETED',
}

export function getPublicProvider() {
  return new ethers.JsonRpcProvider(MONAD_RPC_URL)
}

export function hasMetaMask() {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined'
}

export function getBrowserProvider() {
  if (!hasMetaMask()) {
    throw new Error('MetaMask is not available in this browser.')
  }
  return new ethers.BrowserProvider(window.ethereum)
}

export function getContracts(runner) {
  return {
    agentRegistry: new ethers.Contract(CONTRACT_ADDRESSES.agentRegistry, ABIS.agentRegistry, runner),
    jobMarketplace: new ethers.Contract(CONTRACT_ADDRESSES.jobMarketplace, ABIS.jobMarketplace, runner),
    jobEscrow: new ethers.Contract(CONTRACT_ADDRESSES.jobEscrow, ABIS.jobEscrow, runner),
    reputationManager: new ethers.Contract(CONTRACT_ADDRESSES.reputationManager, ABIS.reputationManager, runner),
  }
}

export async function connectWallet() {
  const provider = getBrowserProvider()
  await provider.send('eth_requestAccounts', [])
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  const network = await provider.getNetwork()
  const balance = await provider.getBalance(address)

  return {
    provider,
    signer,
    address,
    chainId: Number(network.chainId),
    networkName: network.name,
    balanceMon: ethers.formatEther(balance),
  }
}

async function retryOn429(fn, maxRetries = 3, delayMs = 400) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.code === -32005 || err?.shortMessage?.includes('rate limit')
      if (is429 && attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, delayMs * attempt))
      } else {
        throw err
      }
    }
  }
}

export async function readDashboardState({ agentId, walletAddress }) {
  const provider = getPublicProvider()
  const { agentRegistry, jobMarketplace, jobEscrow, reputationManager } = getContracts(provider)

  const [network, walletBalance, agentCountBig, jobCountBig] = await Promise.all([
    retryOn429(() => provider.getNetwork()),
    walletAddress ? retryOn429(() => provider.getBalance(walletAddress)) : Promise.resolve(0n),
    retryOn429(() => agentRegistry.agentCount()),
    retryOn429(() => jobMarketplace.jobCount()),
  ])

  const agentCount = Number(agentCountBig)
  const jobCount = Number(jobCountBig)

  // Fetch all registered agents sequentially with retries to prevent RPC rate limiting
  const agents = []
  for (let i = 1; i <= agentCount; i += 1) {
    try {
      const ag = await retryOn429(() => agentRegistry.getAgent(i), 5, 300)
      let repScore = Number(ag.reputation || 0)
      let completedJobs = 0
      let failedJobs = 0

      try {
        const repTuple = await retryOn429(() => reputationManager.getReputation(i), 2, 200).catch(() => null)
        if (repTuple) {
          repScore = Number(repTuple[0])
          completedJobs = Number(repTuple[1])
          failedJobs = Number(repTuple[2])
        }
      } catch {}

      agents.push({
        id: i,
        owner: ag.owner,
        name: ag.name,
        metadataURI: ag.metadataURI,
        priceMon: ethers.formatEther(ag.price),
        reputationOnRegistry: Number(ag.reputation),
        reputationScore: repScore,
        completedJobs,
        failedJobs,
        active: ag.active,
      })
    } catch (err) {
      console.warn(`Could not read agent ${i} after 5 retries:`, err)
    }
  }

  let selectedAgent = null
  let selectedReputation = { score: 0, completedJobs: 0, failedJobs: 0 }

  const parsedId = Number(agentId) || 1
  if (parsedId > 0 && parsedId <= agentCount) {
    const found = agents.find((a) => a.id === parsedId)
    if (found) {
      selectedAgent = found
      selectedReputation = {
        score: found.reputationScore,
        completedJobs: found.completedJobs,
        failedJobs: found.failedJobs,
      }
    }
  }

  // Fetch all jobs sequentially with retries
  const jobs = []
  for (let i = 1; i <= jobCount; i += 1) {
    try {
      const job = await retryOn429(() => jobMarketplace.getJob(i), 5, 300)
      let escrowBal = 0n
      try {
        escrowBal = await retryOn429(() => jobEscrow.escrowBalance(i), 2, 200).catch(() => 0n)
      } catch {
        escrowBal = 0n
      }

      jobs.push({
        id: Number(job.jobId),
        client: job.client,
        agentId: Number(job.agentId),
        description: job.description,
        rewardMon: ethers.formatEther(job.reward),
        escrowBalanceMon: ethers.formatEther(escrowBal),
        worker: job.agentWorker,
        status: JOB_STATUS[Number(job.status)] ?? `UNKNOWN_${Number(job.status)}`,
      })
    } catch (err) {
      console.warn(`Could not read job ${i} after retries:`, err)
    }
  }

  return {
    networkName: `${network.name} • chain ${network.chainId.toString()}`,
    walletBalanceMon: ethers.formatEther(walletBalance),
    agentCount,
    jobCount,
    agents,
    agent: selectedAgent,
    reputation: selectedReputation,
    jobs,
  }
}

export function parseMonToWei(value) {
  if (value === null || value === undefined) return ethers.parseEther('0.5')
  const str = String(value)
  const match = str.match(/([0-9.]+)/)
  const cleanNumStr = match ? match[1] : '0.5'
  return ethers.parseEther(cleanNumStr)
}

export async function registerAgentTx({ signer, name, metadataURI, priceMon }) {
  const { agentRegistry } = getContracts(signer)
  try {
    return await agentRegistry.registerAgent(name, metadataURI, parseMonToWei(priceMon), {
      gasLimit: 500000n,
    })
  } catch {
    return await agentRegistry.registerAgent(name, metadataURI, parseMonToWei(priceMon))
  }
}

export async function updateAgentTx({ signer, agentId, name, metadataURI, priceMon, active }) {
  const { agentRegistry } = getContracts(signer)
  return agentRegistry.updateAgent(agentId, name, metadataURI, parseMonToWei(priceMon), active)
}

export async function createJobTx({ signer, agentId, description, rewardMon }) {
  const readContracts = getContracts(getPublicProvider())
  const writeContracts = getContracts(signer)
  
  let targetId = Number(agentId) || 1
  let agentCount = 1

  try {
    agentCount = Number(await readContracts.agentRegistry.agentCount())
  } catch {
    agentCount = 1
  }

  // If requested agentId is greater than registered agentCount on-chain, clamp to valid on-chain agent
  if (targetId > agentCount || targetId <= 0) {
    targetId = agentCount > 0 ? agentCount : 1
  }

  let agent
  try {
    agent = await readContracts.agentRegistry.getAgent(targetId)
  } catch (err) {
    console.warn(`Direct RPC read for Agent #${targetId} warning:`, err)
  }

  if (agent && !agent.active) {
    throw new Error(`Agent #${targetId} (${agent.name}) is INACTIVE on-chain and cannot accept new jobs.`)
  }

  try {
    return await writeContracts.jobMarketplace.createJob(targetId, description, parseMonToWei(rewardMon), {
      gasLimit: 500000n,
    })
  } catch (txErr) {
    return await writeContracts.jobMarketplace.createJob(targetId, description, parseMonToWei(rewardMon))
  }
}

export async function acceptJobTx({ signer, jobId }) {
  const readContracts = getContracts(getPublicProvider())
  const writeContracts = getContracts(signer)
  const userAddress = await signer.getAddress()
  
  let job
  try {
    job = await readContracts.jobMarketplace.getJob(jobId)
  } catch {
    console.warn(`Direct RPC check for Job #${jobId} pending indexing.`)
  }

  if (job && Number(job.jobId) !== 0) {
    const statusNum = Number(job.status)
    if (statusNum !== 0) {
      throw new Error(`Job #${jobId} cannot be accepted because its status is ${JOB_STATUS[statusNum] || statusNum} (must be OPEN).`)
    }

    try {
      const agent = await readContracts.agentRegistry.getAgent(job.agentId)
      if (agent.owner.toLowerCase() !== userAddress.toLowerCase()) {
        console.warn(`Note: Connected wallet is ${userAddress.slice(0, 6)}..., agent owner is ${agent.owner.slice(0, 6)}...`)
      }
    } catch {}
  }

  try {
    return await writeContracts.jobMarketplace.acceptJob(jobId, { gasLimit: 500000n })
  } catch {
    return await writeContracts.jobMarketplace.acceptJob(jobId)
  }
}

export async function completeJobTx({ signer, jobId }) {
  const { jobMarketplace } = getContracts(signer)
  const userAddress = await signer.getAddress()

  let job
  try {
    job = await jobMarketplace.getJob(jobId)
  } catch {
    throw new Error(`Job #${jobId} does not exist on JobMarketplace.`)
  }

  if (Number(job.jobId) === 0) {
    throw new Error(`Job #${jobId} does not exist.`)
  }

  const statusNum = Number(job.status)
  if (statusNum !== 1) {
    throw new Error(`Job #${jobId} cannot be completed because its status is ${JOB_STATUS[statusNum] || statusNum} (must be ACCEPTED first).`)
  }

  if (job.agentWorker.toLowerCase() !== userAddress.toLowerCase()) {
    throw new Error(
      `Solidity Worker Requirement: Only the assigned worker (${job.agentWorker.slice(0, 6)}...) can complete Job #${jobId}. Connected wallet is ${userAddress.slice(0, 6)}...`
    )
  }

  try {
    return await jobMarketplace.completeJob(jobId, { gasLimit: 500000n })
  } catch {
    return await jobMarketplace.completeJob(jobId)
  }
}

export async function depositEscrowTx({ signer, jobId, amountMon }) {
  const { jobEscrow, jobMarketplace } = getContracts(signer)
  const userAddress = await signer.getAddress()

  let job
  try {
    job = await jobMarketplace.getJob(jobId)
  } catch {
    throw new Error(`Job #${jobId} does not exist on JobMarketplace.`)
  }

  if (Number(job.jobId) === 0) {
    throw new Error(`Job #${jobId} does not exist.`)
  }

  if (job.client.toLowerCase() !== userAddress.toLowerCase()) {
    throw new Error(
      `Solidity Client Requirement: Only the client who created Job #${jobId} (${job.client.slice(0, 6)}...) can deposit into Escrow. Connected wallet is ${userAddress.slice(0, 6)}...`
    )
  }

  const statusNum = Number(job.status)
  if (statusNum !== 0) {
    throw new Error(`Job #${jobId} is not OPEN (current status: ${JOB_STATUS[statusNum] || statusNum}).`)
  }

  try {
    return await jobEscrow.deposit(jobId, { value: parseMonToWei(amountMon), gasLimit: 500000n })
  } catch {
    return await jobEscrow.deposit(jobId, { value: parseMonToWei(amountMon) })
  }
}

export async function releaseEscrowTx({ signer, jobId }) {
  const { jobEscrow, jobMarketplace } = getContracts(signer)

  let job
  try {
    job = await jobMarketplace.getJob(jobId)
  } catch {
    throw new Error(`Job #${jobId} does not exist on JobMarketplace.`)
  }

  if (Number(job.jobId) === 0) {
    throw new Error(`Job #${jobId} does not exist.`)
  }

  const statusNum = Number(job.status)
  if (statusNum !== 2) {
    throw new Error(`Job #${jobId} must be COMPLETED before funds can be released (current status: ${JOB_STATUS[statusNum] || statusNum}).`)
  }

  let bal = 0n
  try {
    bal = await jobEscrow.escrowBalance(jobId)
  } catch {
    bal = 0n
  }

  if (bal === 0n) {
    throw new Error(`Job #${jobId} has no funds in escrow (balance is 0 MON).`)
  }

  try {
    return await jobEscrow.release(jobId, { gasLimit: 500000n })
  } catch {
    return await jobEscrow.release(jobId)
  }
}

export async function hireAgentTx({ signer, agentId, description, rewardMon }) {
  const { jobMarketplace, jobEscrow, agentRegistry } = getContracts(signer)
  const rewardWei = parseMonToWei(rewardMon)
  
  let agent
  try {
    agent = await agentRegistry.getAgent(agentId)
  } catch (err) {
    throw new Error(`Agent #${agentId} does not exist on AgentRegistry: ${err.message}`)
  }

  if (!agent.active) {
    throw new Error(`Agent #${agentId} (${agent.name}) is INACTIVE on-chain and cannot accept new jobs.`)
  }

  // Step 1: Create Job
  let createTx
  try {
    createTx = await jobMarketplace.createJob(agentId, description, rewardWei, { gasLimit: 500000n })
  } catch {
    createTx = await jobMarketplace.createJob(agentId, description, rewardWei)
  }
  await createTx.wait()
  
  // Get current jobCount as newly created jobId
  const newJobId = await jobMarketplace.jobCount()
  
  // Step 2: Deposit into Escrow
  let depositTx
  try {
    depositTx = await jobEscrow.deposit(newJobId, { value: rewardWei, gasLimit: 500000n })
  } catch {
    depositTx = await jobEscrow.deposit(newJobId, { value: rewardWei })
  }
  await depositTx.wait()
  
  return {
    hash: depositTx.hash,
    jobId: Number(newJobId),
  }
}

export async function setMarketplaceTx({ signer, marketplaceAddress }) {
  const { reputationManager } = getContracts(signer)
  return reputationManager.setMarketplace(marketplaceAddress)
}

