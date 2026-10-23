import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveCcProviderSpawnEnv } from './cc-provider-spawn-env'
import { deleteCcProvider, saveCcProvider } from './cc-provider-store'

const KIMI = {
  name: 'Kimi',
  apiKey: 'sk-test-key',
  env: {
    ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic',
    ANTHROPIC_MODEL: 'kimi-k3'
  }
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orca-cc-spawn-env-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('resolveCcProviderSpawnEnv', () => {
  it('returns the provider env dict plus ANTHROPIC_AUTH_TOKEN for a registered cc-* agent', () => {
    saveCcProvider('kimi', KIMI, dir)
    expect(resolveCcProviderSpawnEnv('cc-kimi', dir)).toEqual({
      ...KIMI.env,
      ANTHROPIC_AUTH_TOKEN: KIMI.apiKey
    })
  })

  it('passes through auxiliary env keys like API_TIMEOUT_MS', () => {
    saveCcProvider(
      'glm',
      { ...KIMI, name: 'GLM', env: { ...KIMI.env, API_TIMEOUT_MS: '3000000' } },
      dir
    )
    expect(resolveCcProviderSpawnEnv('cc-glm', dir)).toMatchObject({ API_TIMEOUT_MS: '3000000' })
  })

  it('returns null for built-in agents, unknown providers, and non-strings', () => {
    saveCcProvider('kimi', KIMI, dir)
    expect(resolveCcProviderSpawnEnv('claude', dir)).toBeNull()
    expect(resolveCcProviderSpawnEnv('cc-deepseek', dir)).toBeNull()
    expect(resolveCcProviderSpawnEnv('cc-', dir)).toBeNull()
    expect(resolveCcProviderSpawnEnv(undefined, dir)).toBeNull()
    expect(resolveCcProviderSpawnEnv(42, dir)).toBeNull()
  })

  it('stops resolving once the provider file is deleted', () => {
    saveCcProvider('kimi', KIMI, dir)
    expect(resolveCcProviderSpawnEnv('cc-kimi', dir)).not.toBeNull()
    deleteCcProvider('kimi', dir)
    expect(resolveCcProviderSpawnEnv('cc-kimi', dir)).toBeNull()
  })
})
