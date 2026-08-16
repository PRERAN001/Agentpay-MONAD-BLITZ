import deployedAddresses from "../ignition/deployments/chain-10143/deployed_addresses.json";

export function resolveAddress(key, viteKey, fallback) {
  let envVal = ''
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envVal = import.meta.env[viteKey] || import.meta.env[key] || ''
    }
  } catch {}

  if (!envVal && typeof process !== 'undefined' && process.env) {
    envVal = process.env[viteKey] || process.env[key] || ''
  }

  const finalVal = (envVal || fallback || '').trim()
  return finalVal
}

export function getDeployedContractAddresses() {
  return {
    agentRegistry: resolveAddress("AGENT_REGISTRY_ADDRESS", "VITE_AGENT_REGISTRY_ADDRESS", deployedAddresses?.["AgentPayModule#AgentRegistry"] || ""),
    jobMarketplace: resolveAddress("JOB_MARKETPLACE_ADDRESS", "VITE_JOB_MARKETPLACE_ADDRESS", deployedAddresses?.["AgentPayModule#JobMarketplace"] || ""),
    jobEscrow: resolveAddress("JOB_ESCROW_ADDRESS", "VITE_JOB_ESCROW_ADDRESS", deployedAddresses?.["AgentPayModule#JobEscrow"] || ""),
    reputationManager: resolveAddress("REPUTATION_MANAGER_ADDRESS", "VITE_REPUTATION_MANAGER_ADDRESS", deployedAddresses?.["AgentPayModule#ReputationManager"] || ""),
  };
}

export default getDeployedContractAddresses;