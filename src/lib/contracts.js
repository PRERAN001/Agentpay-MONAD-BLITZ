import { ethers } from 'ethers'

import AgentRegistryArtifact from '../../abis/AgentRegistry.json'
import JobMarketplaceArtifact from '../../abis/JobMarketplace.json'
import JobEscrowArtifact from '../../abis/JobEscrow.json'
import ReputationManagerArtifact from '../../abis/ReputationManager.json'
import deployedAddresses from '../../ignition/deployments/chain-10143/deployed_addresses.json'

export const MONAD_RPC_URL = 'https://testnet-rpc.monad.xyz/'

export const CONTRACT_ADDRESSES = {
  agentRegistry: deployedAddresses['AgentPayModule#AgentRegistry'],
  jobMarketplace: deployedAddresses['AgentPayModule#JobMarketplace'],
  jobEscrow: deployedAddresses['AgentPayModule#JobEscrow'],
  reputationManager: deployedAddresses['AgentPayModule#ReputationManager'],
}

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

export async function readDashboardState({ agentId, walletAddress }) {
  const provider = getPublicProvider()
  const { agentRegistry, jobMarketplace, jobEscrow, reputationManager } = getContracts(provider)

  const network = await provider.getNetwork()
  const walletBalance = walletAddress ? await provider.getBalance(walletAddress) : 0n
  const agentCount = Number(await agentRegistry.agentCount())
  const jobCount = Number(await jobMarketplace.jobCount())

  // Fetch all registered agents
  const agents = []
  for (let i = 1; i <= agentCount; i += 1) {
    try {
      const ag = await agentRegistry.getAgent(i)
      let repScore = 0
      let completedJobs = 0
      let failedJobs = 0
      try {
        const repTuple = await reputationManager.getReputation(i)
        repScore = Number(repTuple[0])
        completedJobs = Number(repTuple[1])
        failedJobs = Number(repTuple[2])
      } catch {
        repScore = Number(ag.reputation)
      }

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
      console.error(`Error reading agent ${i}:`, err)
    }
  }

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

  const jobs = []
  for (let i = 1; i <= jobCount; i += 1) {
    const job = await jobMarketplace.getJob(i)
    let escrowBal = 0n
    try {
      escrowBal = await jobEscrow.escrowBalance(i)
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

export async function registerAgentTx({ signer, name, metadataURI, priceMon }) {
  const { agentRegistry } = getContracts(signer)
  const tx = await agentRegistry.registerAgent(name, metadataURI, ethers.parseEther(priceMon))
  return tx
}

export async function updateAgentTx({ signer, agentId, name, metadataURI, priceMon, active }) {
  const { agentRegistry } = getContracts(signer)
  return agentRegistry.updateAgent(agentId, name, metadataURI, ethers.parseEther(priceMon), active)
}

export async function createJobTx({ signer, agentId, description, rewardMon }) {
  const { jobMarketplace } = getContracts(signer)
  return jobMarketplace.createJob(agentId, description, ethers.parseEther(rewardMon))
}

export async function acceptJobTx({ signer, jobId }) {
  const { jobMarketplace } = getContracts(signer)
  return jobMarketplace.acceptJob(jobId)
}

export async function completeJobTx({ signer, jobId }) {
  const { jobMarketplace } = getContracts(signer)
  return jobMarketplace.completeJob(jobId)
}

export async function depositEscrowTx({ signer, jobId, amountMon }) {
  const { jobEscrow } = getContracts(signer)
  return jobEscrow.deposit(jobId, { value: ethers.parseEther(amountMon) })
}

export async function releaseEscrowTx({ signer, jobId }) {
  const { jobEscrow } = getContracts(signer)
  return jobEscrow.release(jobId)
}

export async function hireAgentTx({ signer, agentId, description, rewardMon }) {
  const { jobMarketplace, jobEscrow } = getContracts(signer)
  const rewardWei = ethers.parseEther(rewardMon)
  
  // Step 1: Create Job
  const createTx = await jobMarketplace.createJob(agentId, description, rewardWei)
  const receipt = await createTx.wait()
  
  // Get current jobCount as newly created jobId
  const newJobId = await jobMarketplace.jobCount()
  
  // Step 2: Deposit into Escrow
  const depositTx = await jobEscrow.deposit(newJobId, { value: rewardWei })
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

