import { beforeEach, describe, expect, it, vi } from 'vitest'

// Why: cover the ccProviders IPC surface — the update handler must route through the store,
// re-sync the agent registry, and return only the redacted view (no apiKey over IPC).

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  listCcProviders: vi.fn((): unknown[] => []),
  saveCcProvider: vi.fn(),
  updateCcProvider: vi.fn(),
  deleteCcProvider: vi.fn(),
  syncCcProviderAgents: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler)
    }
  }
}))

vi.mock('../cc-providers/cc-provider-store', () => ({
  listCcProviders: mocks.listCcProviders,
  saveCcProvider: mocks.saveCcProvider,
  updateCcProvider: mocks.updateCcProvider,
  deleteCcProvider: mocks.deleteCcProvider,
  // Mirrors the real redaction: strip everything but the safe view fields.
  toCcProviderPublicView: (provider: { slug: string; name: string }) => ({
    id: `cc-${provider.slug}`,
    slug: provider.slug,
    name: provider.name
  })
}))

vi.mock('../cc-providers/cc-provider-agent-registration', () => ({
  syncCcProviderAgents: mocks.syncCcProviderAgents
}))

import { registerCcProviderHandlers } from './cc-providers'

const KIMI = {
  slug: 'kimi',
  name: 'Kimi',
  apiKey: 'sk-secret',
  env: { ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic' }
}

beforeEach(() => {
  mocks.handlers.clear()
  vi.clearAllMocks()
  registerCcProviderHandlers()
})

describe('cc-providers IPC', () => {
  it('ccProviders:update applies the patch, re-syncs agents, and returns the redacted view', () => {
    mocks.updateCcProvider.mockReturnValue(KIMI)
    const handler = mocks.handlers.get('ccProviders:update')
    expect(handler).toBeDefined()
    const patch = { name: 'Kimi 2' }
    const view = handler?.(null, 'kimi', patch)
    expect(mocks.updateCcProvider).toHaveBeenCalledWith('kimi', patch)
    expect(mocks.syncCcProviderAgents).toHaveBeenCalled()
    expect(view).toEqual({ id: 'cc-kimi', slug: 'kimi', name: 'Kimi' })
    expect(JSON.stringify(view)).not.toContain('sk-secret')
  })

  it('ccProviders:add and update reject non-string slugs', () => {
    expect(() => mocks.handlers.get('ccProviders:add')?.(null, 42, {})).toThrow(/slug/)
    expect(() => mocks.handlers.get('ccProviders:update')?.(null, null, {})).toThrow(/slug/)
  })

  it('ccProviders:delete removes the provider and re-syncs agents', () => {
    mocks.deleteCcProvider.mockReturnValue(true)
    const result = mocks.handlers.get('ccProviders:delete')?.(null, 'kimi')
    expect(result).toBe(true)
    expect(mocks.deleteCcProvider).toHaveBeenCalledWith('kimi')
    expect(mocks.syncCcProviderAgents).toHaveBeenCalled()
  })
})
