import deployedAddresses from "../ignition/deployments/chain-10143/deployed_addresses.json" with { type: "json" };

export function resolveAddress(env, key, fallback) {
  const value = (env?.[key] || fallback || "").trim();
  return value || "";
}

export function getDeployedContractAddresses(env = process.env) {
  return {
    agentRegistry: resolveAddress(env, "AGENT_REGISTRY_ADDRESS", deployedAddresses["AgentPayModule#AgentRegistry"]),
    jobMarketplace: resolveAddress(env, "JOB_MARKETPLACE_ADDRESS", deployedAddresses["AgentPayModule#JobMarketplace"]),
    jobEscrow: resolveAddress(env, "JOB_ESCROW_ADDRESS", deployedAddresses["AgentPayModule#JobEscrow"]),
    reputationManager: resolveAddress(env, "REPUTATION_MANAGER_ADDRESS", deployedAddresses["AgentPayModule#ReputationManager"]),
  };
}

export default getDeployedContractAddresses;