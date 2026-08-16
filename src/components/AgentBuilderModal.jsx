import { useState } from 'react'
import { AGENT_PRESETS, getAgentProfile, saveAgentProfile } from '../lib/agentBuilder'
import { Bot, Check, Plus, Sliders, Sparkles, X, Zap } from 'lucide-react'

export default function AgentBuilderModal({
  agentId,
  agentName,
  isOpen,
  onClose,
  onSaved,
  onDeployNewAgent,
}) {
  if (!isOpen) return null

  const isCreateNew = !agentId || agentId === 'new'
  const existing = agentId ? getAgentProfile(agentId) : {}

  const [mode, setMode] = useState(isCreateNew ? 'create' : 'customize')
  const [name, setName] = useState(agentName || 'Custom AI Agent')
  const [priceMon, setPriceMon] = useState('0.5')
  const [metadataURI, setMetadataURI] = useState('ipfs://custom-agent-metadata')

  const [selectedPresetId, setSelectedPresetId] = useState(existing.presetId || 'DEFI_ANALYST')
  const [systemPrompt, setSystemPrompt] = useState(
    existing.systemPrompt || AGENT_PRESETS[0].systemPrompt
  )
  const [temperature, setTemperature] = useState(existing.temperature || 0.4)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')

  const handleSelectPreset = (preset) => {
    setSelectedPresetId(preset.id)
    setSystemPrompt(preset.systemPrompt)
    setName(preset.name)
    if (preset.id === 'DEFI_ANALYST') setPriceMon('0.4')
    if (preset.id === 'CONTRACT_AUDITOR') setPriceMon('0.5')
    if (preset.id === 'ARBITRAGE_BOT') setPriceMon('0.6')
    if (preset.id === 'MARKET_INTELLIGENCE') setPriceMon('0.3')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setModalError('')
    setIsSubmitting(true)
    const preset = AGENT_PRESETS.find((p) => p.id === selectedPresetId) || AGENT_PRESETS[0]
    const profile = {
      presetId: preset.id,
      presetName: preset.name,
      systemPrompt,
      temperature,
      skills: ['Monad RPC', 'On-Chain Execution', 'Escrow Settlement'],
    }

    try {
      if (mode === 'create' && onDeployNewAgent) {
        await onDeployNewAgent({
          name,
          metadataURI,
          priceMon,
          profile,
        })
      } else if (agentId) {
        saveAgentProfile(agentId, profile)
        onSaved?.(profile)
      }
      setIsSubmitting(false)
      onClose()
    } catch (err) {
      console.error('Failed to submit agent deployment:', err)
      setModalError(err.shortMessage || err.message || 'MetaMask transaction rejected or failed.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150 text-white">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-2 text-zinc-300">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-white">
                {mode === 'create' ? 'Build & Deploy New AI Agent On-Chain' : `Customize Agent #${agentId}`}
              </h3>
              <p className="text-xs text-zinc-400">
                Configure AI capability presets, system prompts, & execution parameters on Monad
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex gap-2 rounded-xl bg-zinc-900/60 p-1 border border-zinc-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-1.5 rounded-lg transition ${
              mode === 'create' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Plus className="h-3.5 w-3.5 inline mr-1" />
            Create New Agent
          </button>
          {agentId && (
            <button
              type="button"
              onClick={() => setMode('customize')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                mode === 'customize' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sliders className="h-3.5 w-3.5 inline mr-1" />
              Customize Agent #{agentId}
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {mode === 'create' && (
            <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                1. Smart Contract Registration Parameters
              </span>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Agent Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SecurityAuditor AI"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-white focus:outline-none transition"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Base Price (MON)</label>
                  <input
                    type="text"
                    value={priceMon}
                    onChange={(e) => setPriceMon(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-white focus:outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Metadata URI</label>
                  <input
                    type="text"
                    value={metadataURI}
                    onChange={(e) => setMetadataURI(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-white focus:outline-none transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preset Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              2. Select AI Capability Preset
            </label>
            <div className="grid gap-2 sm:grid-cols-2 max-h-44 overflow-y-auto pr-1">
              {AGENT_PRESETS.map((preset) => {
                const isSelected = preset.id === selectedPresetId
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex flex-col text-left p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-white bg-zinc-900 text-white ring-1 ring-white/20'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span className="font-bold flex items-center justify-between text-xs">
                      {preset.name}
                      {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-1 line-clamp-2">{preset.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* System Prompt Customizer */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-zinc-300" /> Custom AI System Prompt
            </label>
            <textarea
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-white focus:outline-none transition"
            />
          </div>

          {/* Model Temperature Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 mb-1">
              <span className="flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5 text-zinc-400" /> AI Temperature / Creativity
              </span>
              <span className="font-mono text-white font-bold">{temperature}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-white cursor-pointer"
            />
          </div>

          {modalError && (
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-200">
              {modalError}
            </div>
          )}

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
            <div className="text-[11px] text-zinc-400">
              {isSubmitting && (
                <span className="text-zinc-200 animate-pulse font-medium">
                  Confirming transaction in MetaMask window...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-white px-5 py-2 text-xs font-bold text-black shadow-md hover:bg-zinc-200 active:scale-95 flex items-center gap-1.5 disabled:opacity-50 transition"
              >
                <Zap className="h-3.5 w-3.5 text-black fill-black" />
                {isSubmitting
                  ? 'Confirming in MetaMask...'
                  : mode === 'create'
                  ? 'Register & Deploy Agent On-Chain'
                  : 'Save Agent Persona'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}