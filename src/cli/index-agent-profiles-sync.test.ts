import { afterEach, describe, expect, it, vi } from 'vitest'
import { TUI_AGENT_CONFIG } from '../shared/tui-agent-config'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  unregisterDynamicTuiAgent
} from '../shared/tui-agent-dynamic-registry'
import { parseCliAgent } from './agent-launch-request'

const { loadAgentProfileAgentEntriesMock } = vi.hoisted(() => ({
  loadAgentProfileAgentEntriesMock: vi.fn(
    (): { id: string; config: object; displayName: string }[] => []
  )
}))

vi.mock('../main/agent-profiles/agent-profile-agent-registration', () => ({
  loadAgentProfileAgentEntries: loadAgentProfileAgentEntriesMock
}))

import { main } from './index'

describe('parseCliAgent with ap-* profile agents', () => {
  afterEach(() => {
    for (const id of listDynamicTuiAgentIds()) {
      unregisterDynamicTuiAgent(id)
    }
  })

  it('accepts a registered ap-* profile agent', () => {
    registerDynamicTuiAgent('ap-architect', { ...TUI_AGENT_CONFIG.claude }, 'Architect')
    expect(parseCliAgent('ap-architect')).toBe('ap-architect')
  })

  it('still rejects ap-* ids with no registered profile', () => {
    expect(() => parseCliAgent('ap-nope')).toThrow('Unknown TUI agent "ap-nope"')
  })
})

describe('cli entrypoint', () => {
  it('registers agent profiles from disk before dispatching commands', async () => {
    loadAgentProfileAgentEntriesMock.mockReturnValue([
      {
        id: 'ap-architect',
        config: { ...TUI_AGENT_CONFIG.claude },
        displayName: 'Architect'
      }
    ])
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await main(['--help'])
      expect(loadAgentProfileAgentEntriesMock).toHaveBeenCalled()
      // parseCliAgent reads this process's registry copy; the entrypoint must have
      // populated it (the main bundle's copy is a separate module instance).
      expect(parseCliAgent('ap-architect')).toBe('ap-architect')
    } finally {
      logSpy.mockRestore()
    }
  })
})
