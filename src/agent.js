import { createBlockchainConnection } from "./blockchain.js";
import { createDecisionEngine } from "./decision.js";

export function createAgentRuntime({ env = process.env } = {}) {
  const blockchain = createBlockchainConnection(env);
  const name = env.AGENT_NAME || "ResearchAgent";
  const agentId = env.AGENT_ID ? Number(env.AGENT_ID) : 0;
  const minRewardWei = env.MIN_REWARD_WEI ? BigInt(env.MIN_REWARD_WEI) : 0n;
  const decisionEngine = createDecisionEngine({ minRewardWei, agentId });

  return {
    name,
    agentId,
    minRewardWei,
    blockchain,
    wallet: blockchain.wallet,
    provider: blockchain.provider,
    decisionEngine,

    isConfigured() {
      return blockchain.isConfigured();
    },

    async getBalance() {
      return blockchain.getWalletBalance();
    },

    async getAgent(agentIdValue = agentId) {
      return blockchain.getAgent(agentIdValue);
    },

    async getOpenJobs() {
      return blockchain.getOpenJobs();
    },

    async getReputation(agentIdValue = agentId) {
      return blockchain.getReputation(agentIdValue);
    },

    async discoverJobsForThisAgent() {
      const jobs = await blockchain.getOpenJobs();
      return jobs.filter((job) => Number(job.agentId) === this.agentId);
    },

    async getJob(jobId) {
      return blockchain.getJob(jobId);
    },

    async registerAgent({
      nameOverride = name,
      metadataURI = "ipfs://agentpay/agent",
      priceWei,
    } = {}) {
      if (!priceWei) {
        throw new Error(
          "A price in wei is required when registering an agent.",
        );
      }

      return blockchain.registerAgent({
        name: nameOverride,
        metadataURI,
        priceWei,
      });
    },

    async createJob({
      agentIdValue = agentId,
      description = "Market research task",
      reward,
    } = {}) {
      if (!reward) {
        throw new Error("A reward in wei is required when creating a job.");
      }

      return blockchain.createJob({
        agentId: agentIdValue,
        description,
        reward,
      });
    },

    async hireAgent({ targetAgentId, description, rewardWei } = {}) {
      if (targetAgentId === undefined) {
        throw new Error("targetAgentId is required.");
      }

      if (!description) {
        throw new Error("Job description is required.");
      }

      // Don't hire yourself
      if (Number(targetAgentId) === this.agentId) {
        throw new Error("An agent cannot hire itself.");
      }

      // --------------------------------
      // 1. Find target agent
      // --------------------------------

      const agent = await blockchain.getAgent(targetAgentId);

      if (!agent.active) {
        throw new Error("Target agent is inactive.");
      }

      console.log(`Found agent: ${agent.name}`);

      console.log(`Reputation: ${agent.reputation.toString()}`);

      console.log(`Advertised price: ${agent.price.toString()} wei`);

      // --------------------------------
      // 2. Determine reward
      // --------------------------------

      const reward =
        rewardWei !== undefined ? BigInt(rewardWei) : BigInt(agent.price);

      if (reward <= 0n) {
        throw new Error("Reward must be greater than 0.");
      }

      // --------------------------------
      // 3. Check wallet balance
      // --------------------------------

      const balance = await blockchain.getWalletBalance();

      if (balance < reward) {
        throw new Error(
          `Insufficient MON balance. Need ${reward} wei, have ${balance} wei.`,
        );
      }

      // --------------------------------
      // 4. Create job
      // --------------------------------

      console.log(`Creating job for Agent #${targetAgentId}...`);

      const createTx = await blockchain.createJob({
        agentId: Number(targetAgentId),
        description,
        reward,
      });

      const createReceipt = await createTx.wait();

      console.log("Job created:", createReceipt.hash);

      // --------------------------------
      // 5. Get newly created job ID
      // --------------------------------

      const jobCount = await blockchain.getJobCount();

      const jobId = Number(jobCount);

      console.log(`Created Job #${jobId}`);

      // --------------------------------
      // 6. Deposit reward into escrow
      // --------------------------------

      console.log(`Depositing ${reward.toString()} wei...`);

      const depositTx = await blockchain.deposit(jobId, reward);

      const depositReceipt = await depositTx.wait();

      console.log("Escrow funded:", depositReceipt.hash);

      // --------------------------------
      // 7. Return hiring result
      // --------------------------------

      return {
        jobId,
        clientAgentId: this.agentId,
        hiredAgentId: Number(targetAgentId),
        rewardWei: reward.toString(),
        createTransaction: createReceipt.hash,
        depositTransaction: depositReceipt.hash,
      };
    },
    async acceptJob(jobId) {
      return blockchain.acceptJob(jobId);
    },

    async completeJob(jobId) {
      return blockchain.completeJob(jobId);
    },

    async deposit(jobId, valueWei) {
      return blockchain.deposit(jobId, valueWei);
    },

    async release(jobId) {
      return blockchain.release(jobId);
    },

    evaluateJob(job) {
      return decisionEngine.shouldAccept(job);
    },

    chooseJobs(jobs) {
      return jobs.filter((job) => decisionEngine.shouldAccept(job));
    },

    async executeTask(description) {
      return {
        summary: `Completed mock task: ${description}`,
        status: "completed",
      };
    },

    async processEligibleJobs() {
      const jobs = await this.discoverJobsForThisAgent();
      const eligible = jobs.filter((job) => this.evaluateJob(job));

      if (!eligible.length) {
        return {
          accepted: false,
          reason:
            "No open jobs match the configured agent and reward threshold.",
          jobs: jobs.map((job) => ({
            jobId: job.jobId,
            reward: job.reward,
            agentId: job.agentId,
            status: job.status,
          })),
        };
      }

      const selectedJob = eligible[0];
      const acceptTx = await this.acceptJob(selectedJob.jobId);
      if (acceptTx && typeof acceptTx.wait === "function") {
        await acceptTx.wait();
      }

      const execution = await this.executeTask(selectedJob.description);

      const completeTx = await this.completeJob(selectedJob.jobId);
      if (completeTx && typeof completeTx.wait === "function") {
        await completeTx.wait();
      }

      const reputation = await this.getReputation(this.agentId);

      return {
        accepted: true,
        jobId: selectedJob.jobId,
        execution,
        reputation,
      };
    },
  };
}

export default createAgentRuntime;
