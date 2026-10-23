import { describe, expect, it } from 'vitest'
import { LlmEndpointConfigSchema } from './llm-endpoint'
import { LLM_ENDPOINT_PRESETS, getLlmEndpointPreset } from './llm-endpoint-presets'

describe('LLM_ENDPOINT_PRESETS', () => {
  it('ships exactly the kimi, glm, and deepseek presets', () => {
    expect(LLM_ENDPOINT_PRESETS.map((preset) => preset.key)).toEqual(['kimi', 'glm', 'deepseek'])
    expect(getLlmEndpointPreset('glm')?.name).toBe('GLM')
    expect(getLlmEndpointPreset('nope')).toBeUndefined()
  })

  it('every preset env passes the endpoint schema whitelist', () => {
    for (const preset of LLM_ENDPOINT_PRESETS) {
      const parsed = LlmEndpointConfigSchema.safeParse({
        name: preset.name,
        preset: preset.key,
        apiKey: 'sk-test',
        env: preset.env
      })
      expect(parsed.success, preset.key).toBe(true)
    }
  })

  it('deepseek injects no model names (its endpoint 400s on non-claude-* names)', () => {
    const env = getLlmEndpointPreset('deepseek')?.env ?? {}
    expect(Object.keys(env)).toEqual(['ANTHROPIC_BASE_URL'])
  })

  it('snapshot: preset env tables', () => {
    expect(LLM_ENDPOINT_PRESETS).toMatchSnapshot()
  })
})
