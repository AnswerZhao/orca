import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  llmEndpointEnv,
  deleteLlmEndpoint,
  getLlmEndpoint,
  listLlmEndpoints,
  saveLlmEndpoint,
  toLlmEndpointPublicView,
  updateLlmEndpoint
} from './llm-endpoint-store'

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
  dir = mkdtempSync(join(tmpdir(), 'orca-llm-endpoints-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('llm-endpoint-store', () => {
  it('saves an endpoint as 0600 JSON and lists it back', () => {
    saveLlmEndpoint('kimi', KIMI, dir)
    const path = join(dir, 'kimi.json')
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(KIMI)
    const endpoints = listLlmEndpoints(dir)
    expect(endpoints).toHaveLength(1)
    expect(endpoints[0]).toEqual({ ...KIMI, slug: 'kimi' })
  })

  it('lists an empty directory and a missing directory as no endpoints', () => {
    expect(listLlmEndpoints(dir)).toEqual([])
    expect(listLlmEndpoints(join(dir, 'missing'))).toEqual([])
  })

  it('skips invalid JSON, schema violations, and bad slugs with a warning', () => {
    writeFileSync(join(dir, 'broken.json'), '{not json')
    writeFileSync(join(dir, 'nokey.json'), JSON.stringify({ ...KIMI, apiKey: '' }))
    writeFileSync(join(dir, 'badenv.json'), JSON.stringify({ ...KIMI, env: { PATH: '/x' } }))
    writeFileSync(join(dir, 'Bad Slug.json'), JSON.stringify(KIMI))
    writeFileSync(join(dir, 'notes.txt'), JSON.stringify(KIMI))
    saveLlmEndpoint('kimi', KIMI, dir)
    expect(listLlmEndpoints(dir).map((endpoint) => endpoint.slug)).toEqual(['kimi'])
  })

  it('rejects multi-line api keys and invalid slugs on save', () => {
    expect(() => saveLlmEndpoint('kimi', { ...KIMI, apiKey: 'a\nb' }, dir)).toThrow()
    expect(() => saveLlmEndpoint('../evil', KIMI, dir)).toThrow(/slug/)
    expect(() => saveLlmEndpoint('Kimi', KIMI, dir)).toThrow(/slug/)
  })

  it('deletes only existing endpoints with valid slugs', () => {
    saveLlmEndpoint('kimi', KIMI, dir)
    expect(deleteLlmEndpoint('kimi', dir)).toBe(true)
    expect(getLlmEndpoint('kimi', dir)).toBeNull()
    expect(deleteLlmEndpoint('kimi', dir)).toBe(false)
    expect(deleteLlmEndpoint('../outside', dir)).toBe(false)
  })

  it('redacts the apiKey from the public view', () => {
    const view = toLlmEndpointPublicView(saveLlmEndpoint('kimi', KIMI, dir))
    expect(view).toEqual({
      slug: 'kimi',
      name: 'Kimi',
      preset: 'kimi',
      env: KIMI.env
    })
    expect(JSON.stringify(view)).not.toContain(KIMI.apiKey)
  })

  it('builds the claude CLI env from the env dict plus the apiKey', () => {
    const env = llmEndpointEnv(saveLlmEndpoint('kimi', KIMI, dir))
    expect(env).toEqual({ ...KIMI.env, ANTHROPIC_AUTH_TOKEN: KIMI.apiKey })
  })

  it('updates fields while keeping the stored apiKey when the patch omits it', () => {
    saveLlmEndpoint('kimi', KIMI, dir)
    const updated = updateLlmEndpoint(
      'kimi',
      {
        name: 'Kimi 2',
        env: { ...KIMI.env, ANTHROPIC_MODEL: 'kimi-k3-turbo' }
      },
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
    saveLlmEndpoint('kimi', KIMI, dir)
    const updated = updateLlmEndpoint('kimi', { apiKey: 'sk-rotated' }, dir)
    expect(updated.apiKey).toBe('sk-rotated')
    expect(updated.name).toBe(KIMI.name)
  })

  it('rejects patches on missing endpoints and invalid patches', () => {
    expect(() => updateLlmEndpoint('ghost', { name: 'x' }, dir)).toThrow(/does not exist/)
    saveLlmEndpoint('kimi', KIMI, dir)
    expect(() => updateLlmEndpoint('kimi', { env: { PATH: '/evil' } }, dir)).toThrow(/patch/)
    expect(getLlmEndpoint('kimi', dir)?.env).toEqual(KIMI.env)
  })
})
