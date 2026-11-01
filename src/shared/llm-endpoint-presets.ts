/**
 * Built-in LLM endpoint presets. Values come from each vendor's official Claude Code
 * onboarding docs (verified 2026-10-19); a preset is only an env template — the user
 * still supplies the apiKey and may edit anything before saving.
 */
export type LlmEndpointPreset = {
  key: 'kimi' | 'glm' | 'deepseek'
  name: string
  /** Spawn env template; credentials never live here (the endpoint's apiKey field is injected as ANTHROPIC_AUTH_TOKEN). */
  env: Record<string, string>
}

export const LLM_ENDPOINT_PRESETS: readonly LlmEndpointPreset[] = [
  {
    key: 'kimi',
    name: 'Kimi',
    env: {
      ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic',
      ANTHROPIC_MODEL: 'kimi-k3',
      // Why not kimi-k2.7-code (the vendor's haiku-tier example): it forces thinking mode,
      // which 400s in Claude Code unless Thinking is enabled; kimi-k2.6 is the safe fast tier.
      ANTHROPIC_SMALL_FAST_MODEL: 'kimi-k2.6'
    }
  },
  {
    key: 'glm',
    name: 'GLM',
    env: {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
      ANTHROPIC_MODEL: 'glm-5.2',
      ANTHROPIC_SMALL_FAST_MODEL: 'glm-4.7',
      // Vendor-recommended request timeout for long Claude Code turns.
      API_TIMEOUT_MS: '3000000'
    }
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    // Why no model keys: DeepSeek's Anthropic endpoint only accepts claude-* names and maps
    // them server-side (claude-opus* → its pro model, everything else → flash); sending a
    // deepseek-* model name is a 400.
    env: {
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic'
    }
  }
]

export function getLlmEndpointPreset(key: string): LlmEndpointPreset | undefined {
  return LLM_ENDPOINT_PRESETS.find((preset) => preset.key === key)
}
