import { getAgentProfile } from './agentBuilder'

// --- Verification tuning ---
const PASS_THRESHOLD = 70       // score >= this => payout fully approved
const RETRY_THRESHOLD = 50      // score below this => worth one regeneration attempt
const MAX_VERIFICATION_ATTEMPTS = 2

export async function searchMatchNegotiateWithAI({
  prompt,
  agents = [],
  userApiKey = '',
  targetPriceMon = '0.5',
  signerAddress = '',
}) {
  const activeAgents = agents.filter((a) => a.active)
  let agentPool = activeAgents.length > 0 ? activeAgents : agents

  if (!agentPool.length) {
    throw new Error('No registered agents found on Monad network to match.')
  }

  // Prioritize agents owned by connected wallet address
  if (signerAddress) {
    const owned = agentPool.filter((a) => a.owner?.toLowerCase() === signerAddress.toLowerCase())
    if (owned.length > 0) {
      agentPool = owned
    }
  }

  let result
  if (!userApiKey || userApiKey.trim().length <= 5) {
    result = runOfflineFallback(prompt, agentPool, targetPriceMon)
  } else {
    result = await runAiNegotiation(prompt, agentPool, targetPriceMon, userApiKey.trim())
  }

  // --- Verification gate: don't hand back an "approved" payout without checking the work ---
  result.verification = await verifyAndPossiblyRetry({
    prompt,
    agent: result.matchedAgent,
    profile: result.agentProfile,
    taskOutput: result.taskOutput,
    source: result.source,
    userApiKey: userApiKey?.trim() || '',
  })

  // Surface the caller-facing decision plainly, since this is what an escrow
  // release check should key off of instead of assuming "completed = pay in full".
  result.payoutDecision = {
    approved: result.verification.passed,
    recommendedPayoutPercent: result.verification.recommendedPayoutPercent,
  }

  // Keep taskOutput in sync if verification triggered a successful regeneration.
  if (result.verification.finalTaskOutput) {
    result.taskOutput = result.verification.finalTaskOutput
  }

  return result
}

const FALLBACK_MODELS = [
  'google/gemini-2.5-flash',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-r1-distill-llama-70b',
  'openai/gpt-4o-mini',
]

async function runAiNegotiation(prompt, agentPool, targetPriceMon, userApiKey) {
  const agentsPayload = agentPool.map((a) => {
    const profile = getAgentProfile(a.id)
    return {
      id: Number(a.id),
      name: a.name,
      listedPriceMon: a.priceMon,
      reputationScore: Number(a.reputationScore || a.reputationOnRegistry || 0),
      presetName: profile.presetName,
      systemPrompt: profile.systemPrompt,
    }
  })

  for (const model of FALLBACK_MODELS) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${userApiKey}`,
          'HTTP-Referer': 'https://agentpay.monad.xyz',
          'X-Title': 'AgentPay Autonomous Network',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 3000,
          temperature: 0.6,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an Autonomous AI Economic Matcher & Negotiator on the Monad Blockchain, and also the executing agent that fulfills the winning task.

You will be given a user instruction, a target budget in MON, and a list of registered agents (each with id, name, listedPriceMon, reputationScore, presetName, systemPrompt).

--- MATCHING ---
Pick the single best agent for the task based on how well its presetName/systemPrompt fits the user's instruction, and its reputationScore as a tiebreaker.

--- NEGOTIATION (must be REAL, not scripted) ---
Each agent has an implicit minimum acceptable price, which you must reason about internally using:
  - Its listedPriceMon (agents rarely accept much less than this)
  - Its reputationScore (higher reputation = more leverage = firmer on price, smaller concessions)
Simulate a realistic 3-5 round back-and-forth negotiation between the Agent AI and a Client AI negotiating on the user's behalf:
  - Round 1: Agent AI opens with a premium quote above its listed price (reflecting demand/reputation).
  - Middle round(s): Both sides make incremental concessions toward each other — NOT a single jump straight to an agreed number.
  - Final round: Agreement is reached.
CRITICAL RULES for the final negotiated price:
  1. A deal must ALWAYS be reached — negotiation never fails outright.
  2. The final negotiatedPriceMon must NOT simply equal the client's target budget by default. If the agent's minimum acceptable price is at or below the target, land at or near the target. If the agent's minimum is above the target, land above the target, closer to the agent's minimum.
  3. Vary the outcome based on the actual numbers given — no fixed formula each time.

--- TASK OUTPUT (must be REAL, not generic filler) ---
taskOutput must be a detailed, accurate, specifically-tailored Markdown response that actually and correctly answers the user's instruction, written in the voice/expertise implied by the matched agent's presetName and systemPrompt. Do not use a generic templated structure. Use headers, code blocks, and tables only where they genuinely help.

Respond with ONLY a JSON object, no markdown fences, no preamble:
{
  "matchedAgentId": <number>,
  "searchReasoning": "<why this agent was matched>",
  "agentMinAcceptableMon": "<string, your internal estimate of the agent's floor price>",
  "initialQuoteMon": "<string>",
  "negotiatedPriceMon": "<string, the real equilibrium price per the rules above>",
  "savingsPercent": <number, can be 0 or negative if the client ended up paying above target>,
  "negotiationRounds": [
    { "round": 1, "speaker": "Agent AI", "action": "INITIAL_QUOTE", "offerMon": "<string>", "message": "<string>" },
    { "round": 2, "speaker": "Client AI", "action": "COUNTER_OFFER", "offerMon": "<string>", "message": "<string>" }
  ],
  "taskOutput": "<detailed, correct, specific markdown answer to the user's instruction>"
}`
            },
            {
              role: 'user',
              content: `User Instruction: "${prompt}"\nTarget Budget: ${targetPriceMon} MON\n\nRegistered Agents:\n${JSON.stringify(
                agentsPayload,
                null,
                2
              )}`,
            },
          ],
        }),
      })

      clearTimeout(timer)

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''
        const parsed = safeParseJson(content)

        if (parsed && parsed.matchedAgentId) {
          const matched = agentPool.find((a) => Number(a.id) === Number(parsed.matchedAgentId)) || agentPool[0]
          const profile = getAgentProfile(matched.id)
          const initialQuoteMon = parsed.initialQuoteMon || `${(parseFloat(targetPriceMon) * 1.3).toFixed(2)} MON`
          const negotiatedPriceMon = String(parsed.negotiatedPriceMon || targetPriceMon)

          return {
            matchedAgent: matched,
            agentProfile: profile,
            searchReasoning: parsed.searchReasoning || `Matched ${matched.name} (${profile.presetName}) via ${model}.`,
            listedPriceMon: matched.priceMon,
            agentMinAcceptableMon: parsed.agentMinAcceptableMon || null,
            initialQuoteMon,
            negotiatedPriceMon,
            savingsPercent: Number(parsed.savingsPercent || 15),
            negotiationRounds: Array.isArray(parsed.negotiationRounds) && parsed.negotiationRounds.length
              ? parsed.negotiationRounds
              : minimalRoundsFromResult(matched, initialQuoteMon, negotiatedPriceMon),
            taskOutput: parsed.taskOutput || '',
            source: 'ai',
          }
        }
      }
    } catch (err) {
      console.warn(`OpenRouter model ${model} negotiation failed or timed out:`, err)
    }
  }

  // Fallback cleanly to offline engine if all models fail/timeout
  return runOfflineFallback(prompt, agentPool, targetPriceMon)
}

function minimalRoundsFromResult(agent, initialQuoteMon, negotiatedPriceMon) {
  return [
    {
      round: 1,
      speaker: `${agent.name} (Agent AI)`,
      action: 'INITIAL_QUOTE',
      offerMon: initialQuoteMon,
      message: `Opening quote: ${initialQuoteMon}.`,
    },
    {
      round: 2,
      speaker: `${agent.name} (Agent AI)`,
      action: 'AGREE',
      offerMon: negotiatedPriceMon,
      message: `Agreed at ${negotiatedPriceMon}.`,
    },
  ]
}

function safeParseJson(content) {
  try {
    return JSON.parse(content)
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      return null
    }
  }
}

// ============================================================================
// VERIFICATION LAYER
// Runs after a taskOutput exists (AI-generated or offline placeholder).
// Scores the output against the original instruction and decides whether
// escrow payout should be approved, partially approved, or retried.
// ============================================================================
async function verifyAndPossiblyRetry({ prompt, agent, profile, taskOutput, source, userApiKey }) {
  let attempts = 1
  let currentOutput = taskOutput
  let verdict = await scoreOutput({ prompt, taskOutput: currentOutput, source, userApiKey })

  const canRetry = source === 'ai' && !!userApiKey && attempts < MAX_VERIFICATION_ATTEMPTS
  if (verdict.score < RETRY_THRESHOLD && canRetry) {
    attempts += 1
    const regenerated = await regenerateTaskOutput({
      prompt,
      agent,
      profile,
      previousOutput: currentOutput,
      critique: verdict.reasoning,
      userApiKey,
    })

    if (regenerated) {
      const retryVerdict = await scoreOutput({ prompt, taskOutput: regenerated, source, userApiKey })
      // Keep whichever attempt scored higher.
      if (retryVerdict.score > verdict.score) {
        currentOutput = regenerated
        verdict = retryVerdict
      }
    }
  }

  return {
    score: verdict.score,
    passed: verdict.score >= PASS_THRESHOLD,
    reasoning: verdict.reasoning,
    recommendedPayoutPercent: verdict.score >= PASS_THRESHOLD ? 100 : Math.max(0, verdict.score),
    method: verdict.method,
    attempts,
    finalTaskOutput: attempts > 1 ? currentOutput : null, // only set if a regeneration actually replaced the output
  }
}

// Reusable verification entry point for other modules (e.g. task orchestration)
// that need to score assembled/synthesized AI output against an instruction.
// Always treated as real AI-produced work (source: 'ai') since callers only
// invoke this on content they actually generated.
export async function verifyOutput({ prompt, taskOutput, userApiKey }) {
  return scoreOutput({ prompt, taskOutput, source: 'ai', userApiKey })
}

async function scoreOutput({ prompt, taskOutput, source, userApiKey }) {
  // Offline placeholder output never did any real work — don't pretend to verify it.
  if (source !== 'ai') {
    return {
      score: 0,
      reasoning: 'No AI-generated work was produced (offline fallback mode) — nothing to verify, payout should not be approved.',
      method: 'skipped',
    }
  }

  if (userApiKey) {
    try {
      const aiVerdict = await aiVerify({ prompt, taskOutput, userApiKey })
      if (aiVerdict) return { ...aiVerdict, method: 'ai' }
    } catch (err) {
      console.warn('AI verification call failed, falling back to heuristic verification:', err)
    }
  }

  return { ...heuristicVerify(prompt, taskOutput), method: 'heuristic' }
}

async function aiVerify({ prompt, taskOutput, userApiKey }) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userApiKey}`,
      'HTTP-Referer': 'https://agentpay.monad.xyz',
      'X-Title': 'AgentPay Verification Auditor',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      max_tokens: 500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an independent Verification Auditor AI for a decentralized agent marketplace. You are NOT the agent that did the work — you are checking it before payment is released.

Score the given taskOutput strictly against the userInstruction on:
- Correctness (is it factually/technically right, not just plausible-sounding?)
- Completeness (does it actually address everything asked?)
- Specificity (is it tailored to this instruction, or generic filler that could answer anything?)

Be genuinely critical — a lazy, generic, or padded answer should score low even if it's well-formatted markdown.

Respond with ONLY this JSON, no markdown fences:
{
  "score": <integer 0-100>,
  "reasoning": "<1-3 sentences, specific to what's good or missing>",
  "recommendedPayoutPercent": <integer 0-100>
}`,
        },
        {
          role: 'user',
          content: `userInstruction: "${prompt}"\n\ntaskOutput:\n${taskOutput}`,
        },
      ],
    }),
  })

  if (!response.ok) return null
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  const parsed = safeParseJson(content)
  if (!parsed || typeof parsed.score !== 'number') return null

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)))
  return {
    score,
    reasoning: parsed.reasoning || 'No reasoning provided by auditor.',
  }
}

async function regenerateTaskOutput({ prompt, agent, profile, previousOutput, critique, userApiKey }) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userApiKey}`,
        'HTTP-Referer': 'https://agentpay.monad.xyz',
        'X-Title': 'AgentPay Autonomous Network',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 2500,
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are ${agent.name}, an AI agent with persona: ${profile.presetName}. System behavior: ${profile.systemPrompt}

Your previous answer to a client's task was scored too low by an independent verification auditor and payment is being withheld. Rewrite your answer to directly fix the auditor's critique. Do not just pad it — actually address what was missing or wrong.

Respond with ONLY this JSON, no markdown fences:
{ "taskOutput": "<improved, detailed, correct markdown answer>" }`,
          },
          {
            role: 'user',
            content: `Original instruction: "${prompt}"\n\nYour previous answer:\n${previousOutput}\n\nAuditor critique: ${critique}\n\nProvide a corrected answer.`,
          },
        ],
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    const parsed = safeParseJson(content)
    return parsed?.taskOutput || null
  } catch (err) {
    console.warn('Task output regeneration failed:', err)
    return null
  }
}

function heuristicVerify(prompt, taskOutput) {
  if (!taskOutput || taskOutput.length < 20) {
    return {
      score: 0,
      reasoning: 'Output is empty or too short to be meaningful work.',
    }
  }

  const outputLower = taskOutput.toLowerCase()
  const promptWords = [...new Set(
    prompt
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  )]

  const matched = promptWords.filter((w) => outputLower.includes(w))
  const overlapRatio = promptWords.length > 0 ? matched.length / promptWords.length : 1
  const lengthScore = Math.min(1, taskOutput.length / 800)

  const score = Math.round(overlapRatio * 60 + lengthScore * 40)

  return {
    score,
    reasoning: `Heuristic check (no verifier API key): ${matched.length}/${promptWords.length} key terms from the instruction appear in the output, output length ${taskOutput.length} chars.`,
  }
}

// ============================================================================
// OFFLINE FALLBACK — used only when no API key is set or the AI call fails.
// The price is computed from real inputs (listed price + reputation vs
// target) rather than always landing on target, and the output is honestly
// labeled as a placeholder rather than pretending to be AI-authored work.
// ============================================================================
function runOfflineFallback(prompt, agentPool, targetPriceMon) {
  const sorted = [...agentPool].sort((a, b) => b.reputationScore - a.reputationScore)
  const bestAgent = sorted[0] || agentPool[0]
  const profile = getAgentProfile(bestAgent.id)

  const targetNum = parseFloat(targetPriceMon) || 0.5
  const listedNum = parseFloat(bestAgent.priceMon) || targetNum
  const reputation = Number(bestAgent.reputationScore) || 0

  const firmness = Math.min(0.98, 0.85 + reputation / 2000)
  const minAcceptable = +(listedNum * firmness).toFixed(2)

  const negotiatedNum = Math.max(targetNum, minAcceptable)
  const initialQuoteNum = +(Math.max(listedNum, negotiatedNum) * 1.25).toFixed(2)
  const savingsPct = initialQuoteNum > 0 ? Math.round(((initialQuoteNum - negotiatedNum) / initialQuoteNum) * 100) : 0

  return {
    matchedAgent: bestAgent,
    agentProfile: profile,
    searchReasoning: `[Offline mode] Scanned ${agentPool.length} agents. Matched #${bestAgent.id} (${bestAgent.name}, ${profile.presetName}) — highest reputation (${reputation} pts) in pool.`,
    listedPriceMon: bestAgent.priceMon,
    agentMinAcceptableMon: String(minAcceptable),
    initialQuoteMon: `${initialQuoteNum} MON`,
    negotiatedPriceMon: String(negotiatedNum),
    savingsPercent: savingsPct,
    negotiationRounds: [
      {
        round: 1,
        speaker: `${bestAgent.name} (Agent AI)`,
        action: 'INITIAL_QUOTE',
        offerMon: `${initialQuoteNum} MON`,
        message: `Opening quote ${initialQuoteNum} MON, above listed rate ${bestAgent.priceMon} MON given current reputation.`,
      },
      {
        round: 2,
        speaker: 'Client AI Negotiator',
        action: 'COUNTER_OFFER',
        offerMon: `${targetPriceMon} MON`,
        message: `Client counters at target budget of ${targetPriceMon} MON.`,
      },
      {
        round: 3,
        speaker: `${bestAgent.name} (Agent AI)`,
        action: negotiatedNum > targetNum ? 'HOLD_FIRM_AND_AGREE' : 'AGREE',
        offerMon: `${negotiatedNum} MON`,
        message:
          negotiatedNum > targetNum
            ? `Can't go as low as ${targetPriceMon} MON given reputation and listed rate — final offer ${negotiatedNum} MON.`
            : `Deal — settling at ${negotiatedNum} MON.`,
      },
    ],
    taskOutput: buildOfflineTaskOutput(prompt, bestAgent, profile),
    source: 'offline-fallback',
  }
}

function buildOfflineTaskOutput(prompt, agent, profile) {
  const cleanPrompt = prompt.replace(/"/g, "'").trim()
  return `### ⚠️ Offline Fallback Output
**Agent:** ${agent.name} (Agent #${agent.id}, ${profile.presetName})

No OpenRouter API key was available (or the AI call failed), so this task could not be answered by a real model. Below is a placeholder — connect a valid API key to get an actual, prompt-specific answer.

> **Your instruction:** "${cleanPrompt}"

_Add an OpenRouter API key to get a genuine AI-generated response to this instruction instead of this notice._`
}