import { afterEach, describe, expect, it } from 'vitest'
import { TUI_AGENT_CONFIG } from '../../shared/tui-agent-config'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  unregisterDynamicTuiAgent
} from '../../shared/tui-agent-dynamic-registry'
import { resolveBareAgentLaunchCommand } from './runtime-agent-launch-resolution'

describe('resolveBareAgentLaunchCommand with ap-* profiles registered', () => {
  afterEach(() => {
    for (const id of listDynamicTuiAgentIds()) {
      unregisterDynamicTuiAgent(id)
    }
  })

  it('still resolves a bare claude command to the static claude agent', () => {
    registerDynamicTuiAgent('ap-architect', { ...TUI_AGENT_CONFIG.claude }, 'Architect')
    expect(
      resolveBareAgentLaunchCommand({
        command: 'claude',
        settings: {},
        platform: 'linux',
        isRemote: false
      })
    ).toBe('claude')
  })
})
