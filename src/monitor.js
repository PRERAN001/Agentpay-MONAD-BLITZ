const RPC_URL = 'https://testnet-rpc.monad.xyz/';
const AGENT_WALLET = '0x9e4EdD08d430407a621596049B863EbC0b61a268';
const AGENT_REGISTRY_ADDRESS = '0xFb468c883fa55D7D3f19a1fDBb03F6a1C5E6D4Bc';
const JOB_MARKETPLACE_ADDRESS = '0xD193a99e58f2EBb7E27E406bFD9978fD548b080B';
const AGENT_ID = 1;

const registryAbi = [
  'function getAgent(uint256) view returns ((address owner,string name,string metadataURI,uint256 price,uint256 reputation,bool active))',
];

const marketplaceAbi = [
  'function jobCount() view returns (uint256)',
  'function getJob(uint256) view returns ((uint256 jobId,address client,uint256 agentId,string description,uint256 reward,address agentWorker,uint8 status))',
];

const statusMap = {
  0: 'OPEN',
  1: 'ACCEPTED',
  2: 'COMPLETED',
};

const errorBox = document.getElementById('errorBox');
const refreshButton = document.getElementById('refreshButton');

function setError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function badgeClass(status) {
  if (status === 'OPEN') return 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  if (status === 'ACCEPTED') return 'border border-amber-500/40 bg-amber-500/10 text-amber-300';
  if (status === 'COMPLETED') return 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-300';
  return 'border border-slate-700 bg-slate-800 text-slate-300';
}

async function loadMonitor() {
  try {
    clearError();
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const network = await provider.getNetwork();
    const networkName = `${network.name} • chain ${network.chainId.toString()}`;
    const balance = await provider.getBalance(AGENT_WALLET);

    document.getElementById('networkValue').textContent = networkName;
    document.getElementById('walletValue').textContent = `${AGENT_WALLET.slice(0, 8)}…${AGENT_WALLET.slice(-6)}`;
    document.getElementById('balanceValue').textContent = `${ethers.formatEther(balance)} MON`;
    document.getElementById('timeValue').textContent = new Date().toLocaleTimeString();

    const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS, registryAbi, provider);
    const marketplace = new ethers.Contract(JOB_MARKETPLACE_ADDRESS, marketplaceAbi, provider);

    let agent = null;
    try {
      agent = await registry.getAgent(AGENT_ID);
    } catch (readErr) {
      agent = null;
    }

    document.getElementById('agentIdValue').textContent = String(AGENT_ID);
    document.getElementById('agentNameValue').textContent = agent ? agent.name : 'Not registered';
    document.getElementById('agentOwnerValue').textContent = agent ? agent.owner : '—';
    document.getElementById('agentPriceValue').textContent = agent ? `${ethers.formatEther(agent.price)} MON` : '—';
    document.getElementById('agentReputationValue').textContent = agent ? agent.reputation.toString() : '0';
    document.getElementById('agentActiveValue').textContent = agent ? (agent.active ? 'Yes' : 'No') : 'No';

    const jobCount = Number(await marketplace.jobCount());
    document.getElementById('jobCountValue').textContent = `${jobCount} total`;

    const jobsList = document.getElementById('jobsList');
    jobsList.innerHTML = '';

    if (jobCount === 0) {
      jobsList.innerHTML = '<div class="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No jobs have been created yet.</div>';
      return;
    }

    for (let i = 1; i <= jobCount; i += 1) {
      const job = await marketplace.getJob(i);
      const status = statusMap[Number(job.status)] ?? `UNKNOWN_${Number(job.status)}`;

      const card = document.createElement('div');
      card.className = 'rounded-xl border border-slate-800 bg-slate-950/60 p-4';
      card.innerHTML = `
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Job #${Number(job.jobId)}</p>
            <p class="mt-1 text-base font-medium text-white">${job.description || 'No description'}</p>
          </div>
          <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(status)}">${status}</span>
        </div>
        <div class="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <div class="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1">
            <span class="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Agent</span>
            <span class="mt-1 block text-slate-200">${Number(job.agentId)}</span>
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1">
            <span class="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Reward</span>
            <span class="mt-1 block text-slate-200">${ethers.formatEther(job.reward)} MON</span>
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1">
            <span class="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Client</span>
            <span class="mt-1 block text-slate-200">${job.client.slice(0, 6)}…${job.client.slice(-4)}</span>
          </div>
        </div>
      `;
      jobsList.appendChild(card);
    }
  } catch (error) {
    setError(error.message || 'Unable to read Monad state.');
  }
}

refreshButton.addEventListener('click', loadMonitor);
window.addEventListener('DOMContentLoaded', loadMonitor);
setInterval(loadMonitor, 15000);
