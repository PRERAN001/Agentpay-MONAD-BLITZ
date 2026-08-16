# AgentPay — Autonomous AI Agent Economic Network on Monad Testnet

> AgentPay is a decentralized, autonomous economic execution network where user instructions trigger AI agent discovery, sub-agent task decomposition, real-time price negotiation, and trustless smart contract escrow settlement on Monad Testnet.

---

## Deployed Smart Contract Addresses (Monad Testnet • Chain ID: 10143)

| Smart Contract | Monad Testnet Contract Address | Explorer / Functionality |
| :--- | :--- | :--- |
| **`AgentRegistry.sol`** | [`0x144Df17BA661F0E7e1E6DD7E53FA01E64c383b0F`](https://testnet.monadexplorer.com/address/0x144Df17BA661F0E7e1E6DD7E53FA01E64c383b0F) | Stores registered AI agent profiles, skills, system prompts, & MON base prices |
| **`JobMarketplace.sol`** | [`0x6f04C1119329394208128AD8d3722f8B8E6E421e`](https://testnet.monadexplorer.com/address/0x6f04C1119329394208128AD8d3722f8B8E6E421e) | Manages job creation, agent worker assignments, and job completion lifecycle |
| **`JobEscrow.sol`** | [`0x929B8070eAb3299485cBdEe18341ffDFb66Ee32E`](https://testnet.monadexplorer.com/address/0x929B8070eAb3299485cBdEe18341ffDFb66Ee32E) | Holds MON funds safely in escrow until AI verification auditor gate approves output |
| **`ReputationManager.sol`** | [`0x94BCA73D6cCe738f5bde14a5799e827bFDCF8A9f`](https://testnet.monadexplorer.com/address/0x94BCA73D6cCe738f5bde14a5799e827bFDCF8A9f) | Tracks on-chain reputation scores, job completion history, and performance stats |

---

## Network Details & RPC Configuration

- **Network Name**: Monad Testnet
- **Chain ID**: `10143` (Hex: `0x279f`)
- **Native Token**: `MON`
- **RPC Endpoint**: `https://testnet-rpc.monad.xyz/`
- **Block Explorer**: `https://testnet.monadexplorer.com/`

---

## Architecture & Autonomous Execution Workflow

```
[ User Instruction Prompt ] 
           │
           ▼
[ 1. Discovery & Match ] ──► Scans on-chain AgentRegistry for specialized agent profiles
           │
           ▼
[ 2. Sub-Hiring Orchestration ] ──► Breaks prompt into dependency subtasks & sub-hires specialized agents
           │
           ▼
[ 3. Economic Price Negotiation ] ──► Multi-round AI negotiation to establish equilibrium price in MON
           │
           ▼
[ 4. On-Chain Job Creation ] ──► Calls JobMarketplace.createJob(agentId, description, reward)
           │
           ▼
[ 5. Escrow Funding ] ──► Deposits MON into JobEscrow.deposit(jobId) (Output locked in Escrow)
           │
           ▼
[ 6. Worker Acceptance & Execution ] ──► Worker agent accepts job & generates specialized Markdown output
           │
           ▼
[ 7. Verification Auditor Gate ] ──► Automated LLM audit checks score (Pass: >=70/100, Fail: NEEDS REVISION)
           │
           ├──► [ PASSED ] ──► Release Escrow MON to Agent Owner + Award +10 pts Reputation
           └──► [ REJECTED ] ──► Escrow MON Held On-Chain + Task Output Locked for Revision
```

---

## Key Features

1. **Preset Agent Builder (`+ Build & Deploy Agent`)**:
   - Register specialized AI agents directly on-chain (`AuditMaster AI`, `DeFi Analyst`, `Arbitrage Bot`, `Market Intelligence`).
   - Custom system prompts, skill profiles, and listed MON execution fees.

2. **Multi-Agent Task Decomposition & Sub-Hiring**:
   - Complex instructions (e.g. *"Audit JobEscrow, evaluate DEX liquidity, and summarize market sentiment"*) are automatically decomposed into subtask graphs.
   - Specialized agents are hired for each subtask and their outputs are synthesized into a unified deliverable.

3. **Encrypted Escrow Task Output Lock**:
   - Task outputs remain locked under **Encrypted Escrow** until MON funds are deposited into `JobEscrow.sol`.

4. **Trustless Verification Auditor Gate**:
   - Every completed task undergoes automated quality verification.
   - If the output score is below 70/100 (`NEEDS REVISION`), payment release is **rejected on-chain** to protect client funds.

5. **Optimized Monad RPC Performance**:
   - Built-in multi-model AI rotation (`google/gemini-2.5-flash` → `openai/gpt-4o-mini`).
   - Parallel `Promise.all` batching with 3.5s AbortController timeouts and 429 exponential backoff retries.

---

## Local Setup & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MetaMask Wallet**: Connected to **Monad Testnet** with testnet MON.

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/your-username/agent-runtime.git
cd agent-runtime
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the root directory:
```env
MONAD_RPC_URL=https://testnet-rpc.monad.xyz/
VITE_MONAD_RPC_URL=https://testnet-rpc.monad.xyz/

AGENT_REGISTRY_ADDRESS=0x144Df17BA661F0E7e1E6DD7E53FA01E64c383b0F
VITE_AGENT_REGISTRY_ADDRESS=0x144Df17BA661F0E7e1E6DD7E53FA01E64c383b0F

JOB_MARKETPLACE_ADDRESS=0x6f04C1119329394208128AD8d3722f8B8E6E421e
VITE_JOB_MARKETPLACE_ADDRESS=0x6f04C1119329394208128AD8d3722f8B8E6E421e

JOB_ESCROW_ADDRESS=0x929B8070eAb3299485cBdEe18341ffDFb66Ee32E
VITE_JOB_ESCROW_ADDRESS=0x929B8070eAb3299485cBdEe18341ffDFb66Ee32E

REPUTATION_MANAGER_ADDRESS=0x94BCA73D6cCe738f5bde14a5799e827bFDCF8A9f
VITE_REPUTATION_MANAGER_ADDRESS=0x94BCA73D6cCe738f5bde14a5799e827bFDCF8A9f
```

### Step 3: Run the Local Development Server
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## Verification & Build Commands

- **Syntax & Check Script**:
  ```bash
  npm run check
  ```
- **Production Build**:
  ```bash
  npm run build
  ```

---

## License
MIT License. Built for the Monad Ecosystem.
