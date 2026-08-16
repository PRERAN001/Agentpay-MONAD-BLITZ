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

  // Fetch all registered agents in parallel batches
  const agentIndices = Array.from({ length: agentCount }, (_, i) => i + 1)
  const agents = await Promise.all(
    agentIndices.map(async (i) => {
      try {
        const [ag, repTuple] = await Promise.all([
          retryOn429(() => agentRegistry.getAgent(i)),
          retryOn429(() => reputationManager.getReputation(i)).catch(() => null),
        ])

        const repScore = repTuple ? Number(repTuple[0]) : Number(ag.reputation)
        const completedJobs = repTuple ? Number(repTuple[1]) : 0
        const failedJobs = repTuple ? Number(repTuple[2]) : 0

        return {
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
        }
      } catch (err) {
        return null
      }
    })
  ).then((list) => list.filter(Boolean))

  let selectedAgent = null
  let selectedReputation = { score: 0, completedJobs: 0, failedJobs: 0 }

  const parsedId = Number(agentId)
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

  // Fetch all jobs in parallel batches
  const jobIndices = Array.from({ length: jobCount }, (_, i) => i + 1)
  const jobs = await Promise.all(
    jobIndices.map(async (i) => {
      try {
        const [job, escrowBal] = await Promise.all([
          retryOn429(() => jobMarketplace.getJob(i)),
          retryOn429(() => jobEscrow.escrowBalance(i)).catch(() => 0n),
        ])

        return {
          id: Number(job.jobId),
          client: job.client,
          agentId: Number(job.agentId),
          description: job.description,
          rewardMon: ethers.formatEther(job.reward),
          escrowBalanceMon: ethers.formatEther(escrowBal),
          worker: job.agentWorker,
          status: JOB_STATUS[Number(job.status)] ?? `UNKNOWN_${Number(job.status)}`,
        }
      } catch (err) {
        return null
      }
    })
  ).then((list) => list.filter(Boolean))

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
  const { jobMarketplace, agentRegistry } = getContracts(signer)
  
  let agent
  try {
    agent = await agentRegistry.getAgent(agentId)
  } catch (err) {
    throw new Error(`Agent #${agentId} does not exist on AgentRegistry: ${err.message}`)
  }

  if (!agent.active) {
    throw new Error(`Agent #${agentId} (${agent.name}) is INACTIVE on-chain and cannot accept new jobs.`)
  }

  try {
    return await jobMarketplace.createJob(agentId, description, parseMonToWei(rewardMon), {
      gasLimit: 500000n,
    })
  } catch (txErr) {
    return await jobMarketplace.createJob(agentId, description, parseMonToWei(rewardMon))
  }
}

export async function acceptJobTx({ signer, jobId }) {
  const { jobMarketplace, agentRegistry } = getContracts(signer)
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
  if (statusNum !== 0) {
    throw new Error(`Job #${jobId} cannot be accepted because its status is ${JOB_STATUS[statusNum] || statusNum} (must be OPEN).`)
  }

  const agent = await agentRegistry.getAgent(job.agentId)
  if (agent.owner.toLowerCase() !== userAddress.toLowerCase()) {
    throw new Error(
      `Solidity Ownership Requirement: Only the owner of Agent #${job.agentId} (${agent.owner.slice(0, 6)}...) can call acceptJob on Job #${jobId}. Connected wallet is ${userAddress.slice(0, 6)}...`
    )
  }

  try {
    return await jobMarketplace.acceptJob(jobId, { gasLimit: 500000n })
  } catch {
    return await jobMarketplace.acceptJob(jobId)
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

