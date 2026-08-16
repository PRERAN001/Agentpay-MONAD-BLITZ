import { searchMatchNegotiateWithAI, verifyOutput } from './openrouter'
import { getAgentProfile } from './agentBuilder'

const MAX_SUBTASKS = 6

/**
 * Breaks a complex prompt into a dependency graph of subtasks, hires an
 * agent for each one (via the existing match/negotiate/verify pipeline),
 * chains outputs between dependent subtasks, then assembles and verifies
 * a single final deliverable.
 *
 * Falls back gracefully to a single-task run if the master agent decides
 * the prompt doesn't actually need decomposition.
 */
export async function decomposeAndExecuteTask({
  prompt,
  agents = [],
  userApiKey = '',
  targetPriceMon = '1.0',
  signerAddress = '',
  onProgress = () => {},
}) {
  if (!agents.length) {
    throw new Error('No registered agents found on Monad network to match.')
  }
  if (!userApiKey || userApiKey.trim().length <= 5) {
    throw new Error('Task decomposition requires an OpenRouter API key to plan subtasks.')
  }
  const key = userApiKey.trim()

  onProgress('Decomposing instruction into multi-agent subtask graph...')
  const plan = await planSubtasks({ prompt, agents, userApiKey: key })
  if (!plan || !Array.isArray(plan.subtasks) || plan.subtasks.length === 0) {
    throw new Error('Master agent could not produce a valid task plan.')
  }

  const subtasks = sanitizePlan(plan.subtasks)
  const order = topoSort(subtasks)
  const budgetPerTask = (parseFloat(targetPriceMon) / subtasks.length || 0).toFixed(3)

  const completed = {} // id -> { subtask, result }

  onProgress(`Sub-hiring across ${subtasks.length} specialized agents...`)

  // Execute subtasks sequentially if dependent, or in parallel
  for (const id of order) {
    const subtask = subtasks.find((s) => s.id === id)

    const depContext = (subtask.dependsOn || [])
      .map((depId) => completed[depId])
      .filter(Boolean)
      .map((dep) => `### Output from "${dep.subtask.title}":\n${dep.result.taskOutput}`)
      .join('\n\n')

    const subPrompt = depContext
      ? `${subtask.instruction}\n\n---\nContext from prior completed subtasks (use this as needed):\n${depContext}`
      : subtask.instruction

    onProgress(`Sub-task ${id}/${subtasks.length}: "${subtask.title}" matching & negotiating...`)

    let result
    try {
      result = await searchMatchNegotiateWithAI({
        prompt: subPrompt,
        agents,
        userApiKey: key,
        targetPriceMon: budgetPerTask,
        signerAddress,
      })
    } catch (err) {
      console.warn(`Subtask "${subtask.title}" failed to execute:`, err)
      result = {
        matchedAgent: null,
        taskOutput: `_(This subtask failed to execute: ${err.message})_`,
        negotiatedPriceMon: '0',
        verification: { score: 0, passed: false, reasoning: 'Subtask execution failed.', method: 'error' },
        payoutDecision: { approved: false, recommendedPayoutPercent: 0 },
      }
    }

    completed[id] = { subtask, result }
  }

  const subtaskResults = order.map((id) => completed[id])
  onProgress('Synthesizing sub-agent outputs & verifying escrow payout...')
  const synthesis = await synthesizeFinalOutput({ prompt, subtaskResults, userApiKey: key })

  const totalCostMon = subtaskResults.reduce(
    (sum, s) => sum + (parseFloat(s.result.negotiatedPriceMon) || 0),
    0
  )
  const allSubtasksApproved = subtaskResults.every((s) => s.result.payoutDecision?.approved)

  return {
    planReasoning: plan.reasoning || null,
    subtaskResults: subtaskResults.map((s) => ({
      id: s.subtask.id,
      title: s.subtask.title,
      instruction: s.subtask.instruction,
      dependsOn: s.subtask.dependsOn || [],
      matchedAgent: s.result.matchedAgent,
      negotiatedPriceMon: s.result.negotiatedPriceMon,
      verification: s.result.verification,
      payoutDecision: s.result.payoutDecision,
      taskOutput: s.result.taskOutput,
    })),
    finalOutput: synthesis.finalOutput,
    finalVerification: synthesis.verification,
    payoutDecision: {
      approved: allSubtasksApproved && (synthesis.verification?.passed ?? true),
      recommendedPayoutPercent: synthesis.verification?.passed ? 100 : (synthesis.verification?.score || 75),
    },
    totalCostMon: totalCostMon.toFixed(3),
  }
}

async function planSubtasks({ prompt, agents, userApiKey }) {
  const skillPool = [...new Set(agents.flatMap((a) => getAgentProfile(a.id)?.skills || []))]

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)

  let response
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${userApiKey}`,
        'HTTP-Referer': 'https://agentpay.monad.xyz',
        'X-Title': 'AgentPay Master Planning Agent',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 1500,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are the Master Planning Agent for a decentralized AI agent marketplace.

Decide whether the user's instruction genuinely benefits from being broken into multiple independently-workable subtasks (distinct skills required, sequential stages, or clearly parallelizable parts). If it's simple/atomic, return exactly ONE subtask equal to the original instruction — do not force decomposition where it doesn't help.

If decomposing, produce 2-${MAX_SUBTASKS} subtasks. For each: a short id ("1","2",...), a title, a fully self-contained instruction (detailed enough for an agent who has NOT seen the original prompt to execute it correctly), and dependsOn (array of subtask ids whose output this one needs as input — empty array if none).

Available agent skill areas in this pool: ${JSON.stringify(skillPool)}

Respond with ONLY this JSON, no markdown fences:
{
  "reasoning": "<why you decomposed it this way, or why it's a single task>",
  "subtasks": [
    { "id": "1", "title": "<short title>", "instruction": "<self-contained instruction>", "dependsOn": [] }
  ]
}`,
          },
          { role: 'user', content: `User instruction: "${prompt}"` },
        ],
      }),
    })
  } finally {
    clearTimeout(timer)
  }

  if (!response || !response.ok) {
    throw new Error(`Planning call failed with status ${response?.status || 'timeout'}`)
  }
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  const parsed = safeParseJson(content)
  if (!parsed) {
    throw new Error('Master agent returned an unparsable plan.')
  }
  return parsed
}

// Caps subtask count and drops dependsOn references to ids that don't exist
// in the plan, so a hallucinated dependency can't break the ordering step.
function sanitizePlan(rawSubtasks) {
  const capped = rawSubtasks.slice(0, MAX_SUBTASKS)
  const validIds = new Set(capped.map((s) => String(s.id)))
  return capped.map((s) => ({
    id: String(s.id),
    title: s.title || `Subtask ${s.id}`,
    instruction: s.instruction || '',
    dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String).filter((d) => validIds.has(d) && d !== String(s.id)) : [],
  }))
}

// Kahn's algorithm. Falls back to declared order if a cycle is detected
// (should be rare given sanitizePlan, but a bad plan shouldn't hang execution).
function topoSort(subtasks) {
  const ids = subtasks.map((s) => s.id)
  const inDegree = {}
  const graph = {}
  ids.forEach((id) => {
    inDegree[id] = 0
    graph[id] = []
  })
  subtasks.forEach((s) => {
    s.dependsOn.forEach((dep) => {
      graph[dep].push(s.id)
      inDegree[s.id] += 1
    })
  })

  const queue = ids.filter((id) => inDegree[id] === 0)
  const order = []
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    graph[id].forEach((next) => {
      inDegree[next] -= 1
      if (inDegree[next] === 0) queue.push(next)
    })
  }

  if (order.length !== ids.length) {
    console.warn('Dependency cycle detected in task plan; executing subtasks in declared order instead.')
    return ids
  }
  return order
}

async function synthesizeFinalOutput({ prompt, subtaskResults, userApiKey }) {
  const combined = subtaskResults
    .map((s) => `### ${s.subtask.title}\n${s.result.taskOutput}`)
    .join('\n\n---\n\n')

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userApiKey}`,
        'HTTP-Referer': 'https://agentpay.monad.xyz',
        'X-Title': 'AgentPay Master Assembly Agent',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 3000,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are the Master Assembly Agent. Combine the completed subtask outputs below into ONE cohesive, well-organized final deliverable that directly and completely answers the original user instruction. Resolve redundancy or contradictions between subtasks; do not just concatenate them.

Respond with ONLY this JSON, no markdown fences:
{ "finalOutput": "<cohesive markdown deliverable>" }`,
          },
          {
            role: 'user',
            content: `Original instruction: "${prompt}"\n\nCompleted subtask outputs:\n\n${combined}`,
          },
        ],
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      const parsed = safeParseJson(content)
      if (parsed?.finalOutput) {
        const verification = await verifyOutput({ prompt, taskOutput: parsed.finalOutput, userApiKey })
        return { finalOutput: parsed.finalOutput, verification }
      }
    } else {
      console.warn(`Synthesis call failed with status ${response.status}, concatenating subtask outputs instead.`)
    }
  } catch (err) {
    console.warn('Final synthesis call failed, concatenating subtask outputs instead:', err)
  }

  // Fallback: no synthesis model output, so just present the pieces plainly
  // rather than pretending they were assembled into one deliverable.
  const fallbackOutput = `## Combined Result (subtasks shown individually — synthesis step unavailable)\n\n${combined}`
  const verification = await verifyOutput({ prompt, taskOutput: fallbackOutput, userApiKey })
  return { finalOutput: fallbackOutput, verification }
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