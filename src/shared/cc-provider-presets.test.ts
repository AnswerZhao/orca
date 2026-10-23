import { describe, expect, it } from 'vitest'
import { CcProviderConfigSchema } from './cc-provider'
import { CC_PROVIDER_PRESETS, getCcProviderPreset } from './cc-provider-presets'

describe('CC_PROVIDER_PRESETS', () => {
  it('ships exactly the kimi, glm, and deepseek presets', () => {
    expect(CC_PROVIDER_PRESETS.map((preset) => preset.key)).toEqual(['kimi', 'glm', 'deepseek'])
    expect(getCcProviderPreset('glm')?.name).toBe('GLM')
    expect(getCcProviderPreset('nope')).toBeUndefined()
  })

  it('every preset env passes the provider schema whitelist', () => {
    for (const preset of CC_PROVIDER_PRESETS) {
      const parsed = CcProviderConfigSchema.safeParse({
        name: preset.name,
        preset: preset.key,
        apiKey: 'sk-test',
        env: preset.env
      })
      expect(parsed.success, preset.key).toBe(true)
    }
  })

  it('deepseek injects no model names (its endpoint 400s on non-claude-* names)', () => {
    const env = getCcProviderPreset('deepseek')?.env ?? {}
    expect(Object.keys(env)).toEqual(['ANTHROPIC_BASE_URL'])
  })

  it('snapshot: preset env tables', () => {
    expect(CC_PROVIDER_PRESETS).toMatchSnapshot()
  })
})
