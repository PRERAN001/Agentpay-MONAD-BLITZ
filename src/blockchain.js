import { config } from "dotenv";
config();

import { ethers } from "ethers";

import {
  AgentRegistryAbiEntry,
  JobEscrowAbiEntry,
  JobMarketplaceAbiEntry,
  ReputationManagerAbiEntry,
} from "../abis/index.js";
import { getDeployedContractAddresses } from "./contract-config.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const PLACEHOLDER_KEY_PREFIX = "0xreplace_";

function toAddress(value) {
  return (value || "").trim();
}

function isPlaceholderPrivateKey(value) {
  return !value || value === "replace_with_agent_private_key" || value.startsWith(PLACEHOLDER_KEY_PREFIX);
}

export function createBlockchainConnection(env = process.env) {
  const rpcUrl = toAddress(env.MONAD_RPC_URL);
  const privateKey = toAddress(env.AGENT_PRIVATE_KEY);
  const addresses = getDeployedContractAddresses(env);
  const registryAddress = addresses.agentRegistry;
  const marketplaceAddress = addresses.jobMarketplace;
  const escrowAddress = addresses.jobEscrow;
  const reputationAddress = addresses.reputationManager;

  const provider = rpcUrl ? new ethers.JsonRpcProvider(rpcUrl) : null;
  const wallet = privateKey && !isPlaceholderPrivateKey(privateKey) && provider ? new ethers.Wallet(privateKey, provider) : null;

  const contracts = {};

  if (wallet && registryAddress && registryAddress !== ZERO_ADDRESS) {
    contracts.agentRegistry = new ethers.Contract(registryAddress, AgentRegistryAbiEntry, wallet);
  }

  if (wallet && marketplaceAddress && marketplaceAddress !== ZERO_ADDRESS) {
    contracts.jobMarketplace = new ethers.Contract(marketplaceAddress, JobMarketplaceAbiEntry, wallet);
  }

  if (wallet && escrowAddress && escrowAddress !== ZERO_ADDRESS) {
    contracts.jobEscrow = new ethers.Contract(escrowAddress, JobEscrowAbiEntry, wallet);
  }

  if (wallet && reputationAddress && reputationAddress !== ZERO_ADDRESS) {
    contracts.reputationManager = new ethers.Contract(reputationAddress, ReputationManagerAbiEntry, wallet);
  }

  return {
    provider,
    wallet,
    address: wallet?.address || null,
    contracts,
    isConfigured() {
      return Boolean(
        rpcUrl &&
        privateKey &&
        registryAddress &&
        marketplaceAddress &&
        escrowAddress &&
        reputationAddress &&
        registryAddress !== ZERO_ADDRESS &&
        marketplaceAddress !== ZERO_ADDRESS &&
        escrowAddress !== ZERO_ADDRESS &&
        reputationAddress !== ZERO_ADDRESS
      );
    },

    async getWalletBalance() {
      if (!wallet) {
        throw new Error("Wallet is not configured. Set MONAD_RPC_URL and AGENT_PRIVATE_KEY.");
      }
      return provider.getBalance(wallet.address);
    },

    async getAgent(agentId) {
      if (!contracts.agentRegistry) {
        throw new Error("AgentRegistry contract address is not configured.");
      }
      return contracts.agentRegistry.getAgent(agentId);
    },

    async registerAgent({ name, metadataURI = "", priceWei }) {
      if (!contracts.agentRegistry) {
        throw new Error("AgentRegistry contract address is not configured.");
      }
      return contracts.agentRegistry.registerAgent(name, metadataURI, priceWei);
    },

    async createJob({ agentId, description, reward }) {
      if (!contracts.jobMarketplace) {
        throw new Error("JobMarketplace contract address is not configured.");
      }
      return contracts.jobMarketplace.createJob(agentId, description, reward);
    },

    async getJob(jobId) {
      if (!contracts.jobMarketplace) {
        throw new Error("JobMarketplace contract address is not configured.");
      }
      return contracts.jobMarketplace.getJob(jobId);
    },

    async getOpenJobs() {
      if (!contracts.jobMarketplace) {
        throw new Error("JobMarketplace contract address is not configured.");
      }

      const count = await contracts.jobMarketplace.jobCount();
      const jobs = [];

      for (let i = 1; i <= Number(count); i += 1) {
        const job = await contracts.jobMarketplace.getJob(i);
        if (Number(job.status) === 0) {
          jobs.push({
            jobId: Number(job.jobId),
            client: job.client,
            agentId: Number(job.agentId),
            description: job.description,
            reward: job.reward.toString(),
            status: "OPEN",
          });
        }
      }

      return jobs;
    },

    async acceptJob(jobId) {
      if (!contracts.jobMarketplace) {
        throw new Error("JobMarketplace contract address is not configured.");
      }
      return contracts.jobMarketplace.acceptJob(jobId);
    },

    async completeJob(jobId) {
      if (!contracts.jobMarketplace) {
        throw new Error("JobMarketplace contract address is not configured.");
      }
      return contracts.jobMarketplace.completeJob(jobId);
    },

    async getReputation(agentId) {
      if (!contracts.reputationManager) {
        throw new Error("ReputationManager contract address is not configured.");
      }
      return contracts.reputationManager.getReputation(agentId);
    },

    async getJobCount() {
      if (!contracts.jobMarketplace) {
        throw new Error("JobMarketplace contract address is not configured.");
      }
      return contracts.jobMarketplace.jobCount();
    },

    async getAgentCount() {
      if (!contracts.agentRegistry) {
        throw new Error("AgentRegistry contract address is not configured.");
      }
      return contracts.agentRegistry.agentCount();
    },

    async updateAgent({ agentId, name, metadataURI = "", priceWei, active = true }) {
      if (!contracts.agentRegistry) {
        throw new Error("AgentRegistry contract address is not configured.");
      }
      return contracts.agentRegistry.updateAgent(agentId, name, metadataURI, priceWei, active);
    },

    async getAllAgents() {
      if (!contracts.agentRegistry) {
        throw new Error("AgentRegistry contract address is not configured.");
      }
      const count = await contracts.agentRegistry.agentCount();
      const agentsList = [];

      for (let i = 1; i <= Number(count); i += 1) {
        try {
          const agent = await contracts.agentRegistry.getAgent(i);
          let repScore = 0;
          if (contracts.reputationManager) {
            try {
              const rep = await contracts.reputationManager.getReputation(i);
              repScore = Number(rep[0]);
            } catch {
              repScore = Number(agent.reputation);
            }
          }
          agentsList.push({
            id: i,
            owner: agent.owner,
            name: agent.name,
            metadataURI: agent.metadataURI,
            priceWei: agent.price.toString(),
            reputation: repScore,
            active: agent.active,
          });
        } catch (err) {
          console.error(`Failed to fetch agent ${i}:`, err);
        }
      }

      return agentsList;
    },

    async deposit(jobId, valueWei) {
      if (!contracts.jobEscrow) {
        throw new Error("JobEscrow contract address is not configured.");
      }
      return contracts.jobEscrow.deposit(jobId, { value: valueWei });
    },

    async release(jobId) {
      if (!contracts.jobEscrow) {
        throw new Error("JobEscrow contract address is not configured.");
      }
      return contracts.jobEscrow.release(jobId);
    },
  };
}

export const blockchain = createBlockchainConnection();
export default blockchain;
