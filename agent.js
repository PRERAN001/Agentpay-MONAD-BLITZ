import { config } from "dotenv";
config();

import { createAgentRuntime } from "./src/agent.js";

async function main() {
  const runtime = createAgentRuntime({
    env: process.env,
  });

  console.log("Agent runtime initialized.");
  console.log(`Agent: ${runtime.name} (id: ${runtime.agentId})`);

  if (!runtime.isConfigured()) {
    console.log("Runtime is not configured yet. Add real Monad Testnet values to agent-runtime/.env before live blockchain calls.");
    console.log("Required values: MONAD_RPC_URL, AGENT_PRIVATE_KEY, AGENT_REGISTRY_ADDRESS, JOB_MARKETPLACE_ADDRESS, JOB_ESCROW_ADDRESS, REPUTATION_MANAGER_ADDRESS");
    return;
  }

  console.log(`Wallet: ${runtime.wallet.address}`);

  try {
    const balance = await runtime.getBalance();
    console.log(`Wallet balance: ${balance.toString()} wei`);

    let agent = null;
    try {
      agent = await runtime.getAgent();
    } catch (error) {
      const priceWei = BigInt(process.env.MIN_REWARD_WEI || "500000000000000000");
      console.log("Agent not registered yet. Registering with the configured wallet...");
      const tx = await runtime.registerAgent({ nameOverride: runtime.name, priceWei: priceWei.toString() });
      if (tx && typeof tx.wait === "function") {
        await tx.wait();
      }
      agent = await runtime.getAgent();
    }

    console.log(`Registered agent: ${agent.name} | owner: ${agent.owner} | active: ${agent.active} | reputation: ${agent.reputation.toString()}`);

    let jobs = await runtime.getOpenJobs();
    if (!jobs.length) {
      const reward = BigInt(process.env.MIN_REWARD_WEI || "500000000000000000");
      const jobTx = await runtime.createJob({
        description: "Validate Monad market research task",
        reward: reward.toString(),
      });

      if (jobTx && typeof jobTx.wait === "function") {
        await jobTx.wait();
      }

      jobs = await runtime.getOpenJobs();
      console.log(`Created a new market job with reward ${reward.toString()} wei.`);
    }

    console.log(`Open jobs: ${jobs.length}`);

    const result = await runtime.processEligibleJobs();
    if (result.accepted) {
      console.log(`Rule-based agent accepted job #${result.jobId}.`);
      console.log(`Execution status: ${result.execution.status}`);
      console.log(`Reputation after completion: ${result.reputation[0].toString()}`);
    } else {
      console.log(result.reason);
      }
  } catch (error) {
    console.log("Wallet balance could not be fetched.");
    console.log(error.message || String(error));
  }
}

main().catch((error) => {
  console.error("Agent runtime failed:", error);
  process.exitCode = 1;
});
