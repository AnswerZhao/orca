import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isTuiAgent } from '../../shared/tui-agent-config'
import {
  listDynamicTuiAgentIds,
  unregisterDynamicTuiAgent
} from '../../shared/tui-agent-dynamic-registry'
import { syncCcProviderAgents } from './cc-provider-agent-registration'
import {
  ccProviderEnv,
  deleteCcProvider,
  getCcProvider,
  listCcProviders,
  saveCcProvider,
  toCcProviderPublicView,
  updateCcProvider
} from './cc-provider-store'

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

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orca-cc-providers-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  for (const id of listDynamicTuiAgentIds()) {
    unregisterDynamicTuiAgent(id)
  }
})

describe('cc-provider-store', () => {
  it('saves a provider as 0600 JSON and lists it back', () => {
    saveCcProvider('kimi', KIMI, dir)
    const path = join(dir, 'kimi.json')
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(KIMI)
    const providers = listCcProviders(dir)
    expect(providers).toHaveLength(1)
    expect(providers[0]).toMatchObject({ ...KIMI, slug: 'kimi', id: 'cc-kimi' })
  })

  it('lists an empty directory and a missing directory as no providers', () => {
    expect(listCcProviders(dir)).toEqual([])
    expect(listCcProviders(join(dir, 'missing'))).toEqual([])
  })

  it('skips invalid JSON, schema violations, and bad slugs with a warning', () => {
    writeFileSync(join(dir, 'broken.json'), '{not json')
    writeFileSync(join(dir, 'nokey.json'), JSON.stringify({ ...KIMI, apiKey: '' }))
    writeFileSync(join(dir, 'badenv.json'), JSON.stringify({ ...KIMI, env: { PATH: '/x' } }))
    writeFileSync(join(dir, 'Bad Slug.json'), JSON.stringify(KIMI))
    writeFileSync(join(dir, 'notes.txt'), JSON.stringify(KIMI))
    saveCcProvider('kimi', KIMI, dir)
    expect(listCcProviders(dir).map((provider) => provider.slug)).toEqual(['kimi'])
  })

  it('rejects multi-line api keys and invalid slugs on save', () => {
    expect(() => saveCcProvider('kimi', { ...KIMI, apiKey: 'a\nb' }, dir)).toThrow()
    expect(() => saveCcProvider('../evil', KIMI, dir)).toThrow(/slug/)
    expect(() => saveCcProvider('Kimi', KIMI, dir)).toThrow(/slug/)
  })

  it('deletes only existing providers with valid slugs', () => {
    saveCcProvider('kimi', KIMI, dir)
    expect(deleteCcProvider('kimi', dir)).toBe(true)
    expect(getCcProvider('kimi', dir)).toBeNull()
    expect(deleteCcProvider('kimi', dir)).toBe(false)
    expect(deleteCcProvider('../outside', dir)).toBe(false)
  })

  it('redacts the apiKey from the public view', () => {
    const view = toCcProviderPublicView(saveCcProvider('kimi', KIMI, dir))
    expect(view).toEqual({
      id: 'cc-kimi',
      slug: 'kimi',
      name: 'Kimi',
      preset: 'kimi',
      env: KIMI.env
    })
    expect(JSON.stringify(view)).not.toContain(KIMI.apiKey)
  })

  it('builds the claude CLI env from the env dict plus the apiKey', () => {
    const env = ccProviderEnv(saveCcProvider('kimi', KIMI, dir))
    expect(env).toEqual({ ...KIMI.env, ANTHROPIC_AUTH_TOKEN: KIMI.apiKey })
  })

  it('updates fields while keeping the stored apiKey when the patch omits it', () => {
    saveCcProvider('kimi', KIMI, dir)
    const updated = updateCcProvider(
      'kimi',
      { name: 'Kimi 2', env: { ...KIMI.env, ANTHROPIC_MODEL: 'kimi-k3-turbo' } },
      dir
    )
    expect(updated).toMatchObject({
      name: 'Kimi 2',
      apiKey: KIMI.apiKey,
      env: { ...KIMI.env, ANTHROPIC_MODEL: 'kimi-k3-turbo' }
    })
    expect(JSON.parse(readFileSync(join(dir, 'kimi.json'), 'utf8')).apiKey).toBe(KIMI.apiKey)
  })

  it('replaces the apiKey only when the patch carries a new one', () => {
    saveCcProvider('kimi', KIMI, dir)
    const updated = updateCcProvider('kimi', { apiKey: 'sk-rotated' }, dir)
    expect(updated.apiKey).toBe('sk-rotated')
    expect(updated.name).toBe(KIMI.name)
  })

  it('rejects patches on missing providers and invalid patches', () => {
    expect(() => updateCcProvider('ghost', { name: 'x' }, dir)).toThrow(/does not exist/)
    saveCcProvider('kimi', KIMI, dir)
    expect(() => updateCcProvider('kimi', { env: { PATH: '/evil' } }, dir)).toThrow(/patch/)
    expect(getCcProvider('kimi', dir)?.env).toEqual(KIMI.env)
  })
})

describe('syncCcProviderAgents', () => {
  it('registers cc-* agents from disk and unregisters removed ones', () => {
    expect(isTuiAgent('cc-kimi')).toBe(false)
    saveCcProvider('kimi', KIMI, dir)
    expect(syncCcProviderAgents(dir)).toEqual(['cc-kimi'])
    expect(isTuiAgent('cc-kimi')).toBe(true)
    deleteCcProvider('kimi', dir)
    expect(syncCcProviderAgents(dir)).toEqual([])
    expect(isTuiAgent('cc-kimi')).toBe(false)
  })
})
