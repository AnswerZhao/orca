import { afterEach, describe, expect, it } from 'vitest'
import { TUI_AGENT_CONFIG } from '../../shared/tui-agent-config'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  unregisterDynamicTuiAgent
} from '../../shared/tui-agent-dynamic-registry'
import { resolveBareAgentLaunchCommand } from './runtime-agent-launch-resolution'

describe('resolveBareAgentLaunchCommand with cc-* providers registered', () => {
  afterEach(() => {
    for (const id of listDynamicTuiAgentIds()) {
      unregisterDynamicTuiAgent(id)
    }
  })

  it('still resolves a bare claude command to the static claude agent', () => {
    registerDynamicTuiAgent('cc-kimi', { ...TUI_AGENT_CONFIG.claude }, 'CC Kimi')
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
