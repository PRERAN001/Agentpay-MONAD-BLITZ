import { useState } from 'react'
import { AGENT_PRESETS, getAgentProfile, saveAgentProfile } from '../lib/agentBuilder'
import { Bot, Check, Sliders, Sparkles, X } from 'lucide-react'

export default function AgentBuilderModal({ agentId, agentName, isOpen, onClose, onSaved }) {
  if (!isOpen) return null

  const existing = getAgentProfile(agentId)
  const [selectedPresetId, setSelectedPresetId] = useState(existing.presetId || 'DEFI_ANALYST')
  const [systemPrompt, setSystemPrompt] = useState(existing.systemPrompt || '')
  const [temperature, setTemperature] = useState(existing.temperature || 0.4)

  const handleSelectPreset = (preset) => {
    setSelectedPresetId(preset.id)
    setSystemPrompt(preset.systemPrompt)
  }

  const handleSave = (e) => {
    e.preventDefault()
    const preset = AGENT_PRESETS.find((p) => p.id === selectedPresetId) || AGENT_PRESETS[0]
    const profile = {
      presetId: preset.id,
      presetName: preset.name,
      systemPrompt,
      temperature,
      skills: ['Monad RPC', 'On-Chain Execution', 'Escrow Settlement'],
    }

    saveAgentProfile(agentId, profile)
    onSaved?.(profile)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-slate-900">
                Agent #{agentId} AI Builder & Configurator
              </h3>
              <p className="text-xs text-slate-500">
                Configure custom AI capabilities, system persona, and execution prompt for <strong>{agentName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Preset Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Select AI Capability Preset
            </label>
            <div className="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto pr-1">
              {AGENT_PRESETS.map((preset) => {
                const isSelected = preset.id === selectedPresetId
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex flex-col text-left p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 text-indigo-950 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold flex items-center justify-between">
                      {preset.name}
                      {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 line-clamp-2">{preset.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* System Prompt Customizer */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Custom AI System Prompt
            </label>
            <textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Model Temperature Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
              <span className="flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5 text-slate-500" /> AI Temperature / Creativity
              </span>
              <span className="font-mono text-indigo-600">{temperature}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700"
            >
              Save Agent Persona & Build
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
