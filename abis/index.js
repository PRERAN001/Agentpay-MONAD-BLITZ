import AgentRegistryAbi from "./AgentRegistry.json" with { type: "json" };
import JobEscrowAbi from "./JobEscrow.json" with { type: "json" };
import JobMarketplaceAbi from "./JobMarketplace.json" with { type: "json" };
import ReputationManagerAbi from "./ReputationManager.json" with { type: "json" };

export const abis = {
  AgentRegistry: AgentRegistryAbi.abi,
  JobEscrow: JobEscrowAbi.abi,
  JobMarketplace: JobMarketplaceAbi.abi,
  ReputationManager: ReputationManagerAbi.abi,
};

export const {
  AgentRegistry: AgentRegistryAbiEntry,
  JobEscrow: JobEscrowAbiEntry,
  JobMarketplace: JobMarketplaceAbiEntry,
  ReputationManager: ReputationManagerAbiEntry,
} = abis;

export default abis;