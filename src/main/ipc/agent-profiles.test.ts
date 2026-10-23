import { mkdtempSync, rmSync } from 'node:fs'
import type * as Os from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Why: cover the llmEndpoints / agentProfiles IPC surface against the real stores in a temp
// home — every mutation must re-sync the agent registry, and no endpoint reply may carry the apiKey.

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  syncAgentProfileAgents: vi.fn(),
  home: ''
}))

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof Os>()
  mocks.home = actual.tmpdir()
  return { ...actual, homedir: () => mocks.home }
})

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler)
    }
  }
}))

vi.mock('../agent-profiles/agent-profile-agent-registration', () => ({
  syncAgentProfileAgents: mocks.syncAgentProfileAgents
}))

import { registerAgentProfileHandlers } from './agent-profiles'

const KIMI = {
  name: 'Kimi',
  apiKey: 'sk-secret',
  env: { ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic' }
}

const tmpRoot = mkdtempSync(join(mocks.home, 'orca-ap-ipc-'))

function invoke(channel: string, ...args: unknown[]): unknown {
  const handler = mocks.handlers.get(channel)
  if (!handler) {
    throw new Error(`no handler for ${channel}`)
  }
  return handler(null, ...args)
}

beforeEach(() => {
  mocks.home = mkdtempSync(join(tmpRoot, 'home-'))
  mocks.handlers.clear()
  vi.clearAllMocks()
  registerAgentProfileHandlers()
})

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('agent profiles IPC', () => {
  it('registers exactly the eight llmEndpoints / agentProfiles channels', () => {
    expect([...mocks.handlers.keys()].sort()).toEqual([
      'agentProfiles:add',
      'agentProfiles:delete',
      'agentProfiles:list',
      'agentProfiles:update',
      'llmEndpoints:add',
      'llmEndpoints:delete',
      'llmEndpoints:list',
      'llmEndpoints:update'
    ])
  })

  it('round-trips endpoints through ~/.orca/llm-endpoints without exposing the apiKey', () => {
    expect(invoke('llmEndpoints:add', 'kimi', KIMI)).toEqual({
      slug: 'kimi',
      name: 'Kimi',
      env: KIMI.env
    })
    expect(invoke('llmEndpoints:update', 'kimi', { name: 'Kimi 2' })).toMatchObject({
      name: 'Kimi 2'
    })
    const listed = invoke('llmEndpoints:list')
    expect(JSON.stringify(listed)).not.toContain(KIMI.apiKey)
    expect(listed).toEqual([{ slug: 'kimi', name: 'Kimi 2', env: KIMI.env }])
    expect(mocks.syncAgentProfileAgents).toHaveBeenCalledTimes(2)
  })

  it('round-trips profiles and re-syncs the registry after each mutation', () => {
    invoke('llmEndpoints:add', 'kimi', KIMI)
    const added = invoke('agentProfiles:add', 'coder', {
      name: 'Coder',
      llmSource: { kind: 'endpoint', endpoint: 'kimi' }
    })
    expect(added).toMatchObject({
      id: 'ap-coder',
      slug: 'coder',
      permissionMode: 'auto'
    })
    expect(invoke('agentProfiles:update', 'coder', { effort: 'max' })).toMatchObject({
      effort: 'max'
    })
    expect(invoke('agentProfiles:list')).toHaveLength(1)
    expect(() => invoke('llmEndpoints:delete', 'kimi')).toThrow(/used by agent profile "Coder"/)
    expect(invoke('agentProfiles:delete', 'coder')).toBe(true)
    expect(invoke('llmEndpoints:delete', 'kimi')).toBe(true)
    // add endpoint, add, update, refused delete, delete profile, delete endpoint
    expect(mocks.syncAgentProfileAgents).toHaveBeenCalledTimes(6)
  })

  it('rejects non-string slugs', () => {
    expect(() => invoke('llmEndpoints:add', 42, KIMI)).toThrow(/slug/)
    expect(() => invoke('llmEndpoints:delete', null)).toThrow(/slug/)
    expect(() => invoke('agentProfiles:update', null, {})).toThrow(/slug/)
  })
})
