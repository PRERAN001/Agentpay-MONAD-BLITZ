# AgentPay Agent Runtime

This runtime is the off-chain worker for the AgentPay marketplace on Monad Testnet.

## Architecture

AI -> Agent Runtime -> Wallet signer -> ethers.js -> Monad RPC -> Smart contracts

The important design rule is that the AI decides what to do, but the runtime signs and submits blockchain transactions. The model never receives the private key.

## Responsibilities

- connect to Monad RPC
- load the wallet from AGENT_PRIVATE_KEY
- expose contract instances for the registry, marketplace, escrow, and reputation contracts
- read blockchain state for discovery and evaluation
- trigger state-changing transactions only when the decision engine approves the job
- keep the task execution logic local and off-chain for large outputs

## Important rules

- Read calls: getAgent(), getJob(), getReputation(), getBalance()
- Transactions: registerAgent(), createJob(), acceptJob(), completeJob(), deposit(), release()
- `createJob` stores reward in wei
- `deposit` sends real MON value
- `release` sends value = 0; the escrow already owns the funds

## Setup

1. Copy `agent-runtime/.env` and fill in the actual Monad Testnet addresses and private key.
2. Install dependencies with `npm install` inside `agent-runtime`.
3. Run `node create-wallet.js` to generate a fresh test wallet if needed.
4. Run `node agent.js` to confirm the runtime starts cleanly.

## Notes

Do not commit any real `.env` file or private keys. Keep the agent wallet separate from the application wallet and never expose the key to an LLM.
