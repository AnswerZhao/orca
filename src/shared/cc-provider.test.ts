import { describe, expect, it } from 'vitest'
import {
  CC_PROVIDER_ENV_KEY_PATTERN,
  CC_PROVIDER_SLUG_PATTERN,
  CcProviderConfigSchema,
  CcProviderPatchSchema
} from './cc-provider'

const KIMI = {
  name: 'Kimi',
  preset: 'kimi',
  apiKey: 'sk-test-key',
  env: {
    ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic',
    ANTHROPIC_MODEL: 'kimi-k3',
    ANTHROPIC_SMALL_FAST_MODEL: 'kimi-k2.6'
  }
}

describe('CcProviderConfigSchema', () => {
  it('accepts a well-formed provider config', () => {
    expect(CcProviderConfigSchema.parse(KIMI)).toEqual(KIMI)
  })

  it('allows omitting the preset marker', () => {
    const { preset: _preset, ...noPreset } = KIMI
    expect(CcProviderConfigSchema.parse(noPreset).preset).toBeUndefined()
  })

  it('requires a valid env.ANTHROPIC_BASE_URL', () => {
    const { env: _env, ...rest } = KIMI
    expect(
      CcProviderConfigSchema.safeParse({ ...rest, env: { ANTHROPIC_MODEL: 'x' } }).success
    ).toBe(false)
    expect(
      CcProviderConfigSchema.safeParse({ ...KIMI, env: { ANTHROPIC_BASE_URL: 'not a url' } })
        .success
    ).toBe(false)
  })

  it('rejects env keys outside the whitelist', () => {
    for (const key of ['PATH', 'NODE_OPTIONS', 'HOME', 'anthropic_model']) {
      const env = { ...KIMI.env, [key]: 'x' }
      expect(CcProviderConfigSchema.safeParse({ ...KIMI, env }).success, key).toBe(false)
    }
  })

  it('accepts every whitelisted env key family', () => {
    const env = {
      ...KIMI.env,
      CLAUDE_CODE_AUTO_COMPACT_WINDOW: '1000000',
      API_TIMEOUT_MS: '3000000'
    }
    expect(CcProviderConfigSchema.safeParse({ ...KIMI, env }).success).toBe(true)
  })

  it('rejects credentials smuggled into env', () => {
    for (const key of ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY']) {
      const env = { ...KIMI.env, [key]: 'sk-leak' }
      expect(CcProviderConfigSchema.safeParse({ ...KIMI, env }).success, key).toBe(false)
    }
  })

  it('rejects empty env values and multi-line api keys', () => {
    const env = { ...KIMI.env, ANTHROPIC_MODEL: '  ' }
    expect(CcProviderConfigSchema.safeParse({ ...KIMI, env }).success).toBe(false)
    expect(CcProviderConfigSchema.safeParse({ ...KIMI, apiKey: 'a\nb' }).success).toBe(false)
  })
})

describe('CcProviderPatchSchema', () => {
  it('accepts partial patches, including an apiKey-only one', () => {
    expect(CcProviderPatchSchema.parse({}).preset).toBeUndefined()
    expect(CcProviderPatchSchema.parse({ apiKey: 'sk-new' })).toEqual({ apiKey: 'sk-new' })
    expect(CcProviderPatchSchema.safeParse({ env: { PATH: '/x' } }).success).toBe(false)
  })
})

describe('patterns', () => {
  it('slug pattern keeps its v1 shape', () => {
    expect(CC_PROVIDER_SLUG_PATTERN.test('kimi')).toBe(true)
    expect(CC_PROVIDER_SLUG_PATTERN.test('-bad')).toBe(false)
  })

  it('env key pattern matches exactly the three documented families', () => {
    expect(CC_PROVIDER_ENV_KEY_PATTERN.test('ANTHROPIC_BASE_URL')).toBe(true)
    expect(CC_PROVIDER_ENV_KEY_PATTERN.test('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')).toBe(true)
    expect(CC_PROVIDER_ENV_KEY_PATTERN.test('API_TIMEOUT_MS')).toBe(true)
    expect(CC_PROVIDER_ENV_KEY_PATTERN.test('HTTP_PROXY')).toBe(false)
  })
})
