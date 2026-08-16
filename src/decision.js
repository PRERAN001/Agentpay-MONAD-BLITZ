export function createDecisionEngine({ minRewardWei = 0n, agentId = 0 } = {}) {
  return {
    minRewardWei,
    agentId,

    shouldAccept(job) {
      if (!job) return false;

      const reward = BigInt(job.reward || "0");
      const isOpen = Number(job.status) === 0;
      const isForThisAgent = Number(job.agentId) === Number(agentId);
      const meetsReward = reward >= minRewardWei;

      return isOpen && isForThisAgent && meetsReward;
    },

    explain(job) {
      if (!job) {
        return {
          accepted: false,
          reasons: ["No job provided"],
        };
      }

      const reasons = [];
      const reward = BigInt(job.reward || "0");
      const isOpen = Number(job.status) === 0;
      const isForThisAgent = Number(job.agentId) === Number(agentId);
      const meetsReward = reward >= minRewardWei;

      if (!isOpen) reasons.push("Job is not OPEN");
      if (!isForThisAgent) reasons.push("Job is not assigned to this agent");
      if (!meetsReward) reasons.push(`Reward below minimum ${minRewardWei.toString()} wei`);

      return {
        accepted: isOpen && isForThisAgent && meetsReward,
        reasons,
        rewardWei: reward.toString(),
      };
    },
  };
}

export default createDecisionEngine;
