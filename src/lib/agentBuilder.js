export const AGENT_PRESETS = [
  {
    id: 'DEFI_ANALYST',
    name: 'DeFi Analyst & Yield Specialist',
    description: 'Specialized in Monad DEX liquidity, yield farming, gas optimization, and tokenomics.',
    systemPrompt: `You are an expert Monad DeFi Analyst. When given a task, provide detailed financial analysis, liquidity metrics, gas optimization strategies, and actionable yield recommendations formatted cleanly with markdown tables and bullet points.`,
  },
  {
    id: 'CONTRACT_AUDITOR',
    name: 'Smart Contract Security Auditor',
    description: 'Scans Solidity smart contracts for reentrancy, access control risks, overflow issues, and gas inefficiencies.',
    systemPrompt: `You are a Senior Smart Contract Auditor on Monad. When given a task or contract inspection, perform a rigorous security assessment. List findings by severity (Critical, High, Medium, Low), code snippets, mitigation recommendations, and gas optimizations.`,
  },
  {
    id: 'ARBITRAGE_BOT',
    name: 'Autonomous Arbitrage & MEV Bot',
    description: 'Monitors Monad mempools, cross-DEX price spreads, slippage tolerances, and atomic execution paths.',
    systemPrompt: `You are an Autonomous Arbitrage Engine on Monad. Provide high-frequency execution strategies, route calculations, estimated MON profit margins, slippage protections, and atomic transaction execution steps.`,
  },
  {
    id: 'MARKET_INTELLIGENCE',
    name: 'Market Intelligence & Sentiment Synthesizer',
    description: 'Aggregates ecosystem news, developer updates, GitHub activity, and social sentiment on Monad.',
    systemPrompt: `You are a Market Intelligence Synthesizer. Provide comprehensive market updates, ecosystem growth metrics, key risk factors, developer sentiment trends, and executive summaries.`,
  },
  {
    id: 'CUSTOM',
    name: 'Custom AI Agent Persona',
    description: 'Custom user-defined AI system prompt and specialized capabilities.',
    systemPrompt: `You are a custom AI Agent operating on the Monad Autonomous Network. Execute instructions thoroughly with high precision.`,
  },
]

const STORAGE_KEY = 'agent_builder_profiles_v1'

export function loadAllProfiles() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function getAgentProfile(agentId) {
  const profiles = loadAllProfiles()
  const idStr = String(agentId)
  if (profiles[idStr]) {
    return profiles[idStr]
  }

  // Default preset fallback based on Agent ID modulo
  const idNum = Number(agentId) || 1
  const presetIndex = (idNum - 1) % (AGENT_PRESETS.length - 1)
  const defaultPreset = AGENT_PRESETS[presetIndex] || AGENT_PRESETS[0]

  return {
    presetId: defaultPreset.id,
    presetName: defaultPreset.name,
    systemPrompt: defaultPreset.systemPrompt,
    temperature: 0.4,
    skills: ['On-Chain Execution', 'Monad RPC', 'Escrow Settlement'],
  }
}

export function saveAgentProfile(agentId, profile) {
  if (typeof window === 'undefined') return
  try {
    const profiles = loadAllProfiles()
    profiles[String(agentId)] = {
      ...profile,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  } catch (err) {
    console.error('Failed to save agent profile:', err)
  }
}
