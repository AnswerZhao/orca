import { afterEach, describe, expect, it, vi } from 'vitest'
import { TUI_AGENT_CONFIG } from '../shared/tui-agent-config'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  unregisterDynamicTuiAgent
} from '../shared/tui-agent-dynamic-registry'
import { parseCliAgent } from './agent-launch-request'

const { loadCcProviderAgentEntriesMock } = vi.hoisted(() => ({
  loadCcProviderAgentEntriesMock: vi.fn((): { id: string; config: object }[] => [])
}))

vi.mock('../main/cc-providers/cc-provider-agent-registration', () => ({
  loadCcProviderAgentEntries: loadCcProviderAgentEntriesMock
}))

import { main } from './index'

describe('parseCliAgent with cc-* provider agents', () => {
  afterEach(() => {
    for (const id of listDynamicTuiAgentIds()) {
      unregisterDynamicTuiAgent(id)
    }
  })

  it('accepts a registered cc-* provider agent', () => {
    registerDynamicTuiAgent('cc-kimi', { ...TUI_AGENT_CONFIG.claude })
    expect(parseCliAgent('cc-kimi')).toBe('cc-kimi')
  })

  it('still rejects cc-* ids with no registered provider', () => {
    expect(() => parseCliAgent('cc-nope')).toThrow('Unknown TUI agent "cc-nope"')
  })
})

describe('cli entrypoint', () => {
  it('registers cc provider agents from disk before dispatching commands', async () => {
    loadCcProviderAgentEntriesMock.mockReturnValue([
      { id: 'cc-kimi', config: { ...TUI_AGENT_CONFIG.claude } }
    ])
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await main(['--help'])
      expect(loadCcProviderAgentEntriesMock).toHaveBeenCalled()
      // parseCliAgent reads this process's registry copy; the entrypoint must have
      // populated it (the main bundle's copy is a separate module instance).
      expect(parseCliAgent('cc-kimi')).toBe('cc-kimi')
    } finally {
      logSpy.mockRestore()
    }
  })
})
