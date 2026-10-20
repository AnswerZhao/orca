import { describe, expect, it } from 'vitest'
import { TUI_AGENT_CONFIG } from './tui-agent-config'
import type { StaticTuiAgent } from './tui-agent'

describe('TUI_AGENT_CONFIG', () => {
  it('resolves launchCmd and expectedProcess for every agent', () => {
    for (const [agent, config] of Object.entries(TUI_AGENT_CONFIG)) {
      expect(config.launchCmd, agent).toBeTruthy()
      expect(config.expectedProcess, agent).toBeTruthy()
    }
  })

  it('defaults launchCmd and expectedProcess to detectCmd', () => {
    expect(TUI_AGENT_CONFIG.codex).toMatchObject({
      detectCmd: 'codex',
      launchCmd: 'codex',
      expectedProcess: 'codex'
    })
  })

  it('keeps explicit overrides where the launch line or process differs from the binary', () => {
    const overrides: [StaticTuiAgent, Partial<(typeof TUI_AGENT_CONFIG)[StaticTuiAgent]>][] = [
      ['claude-agent-teams', { launchCmd: 'orca claude-teams', expectedProcess: 'claude' }],
      ['kiro', { launchCmd: 'kiro-cli chat --tui', expectedProcess: 'kiro-cli' }],
      ['command-code', { launchCmd: 'command-code --trust' }],
      ['hermes', { launchCmd: 'hermes --tui' }],
      ['rovo', { detectCmd: 'acli', launchCmd: 'acli rovodev run', expectedProcess: 'acli' }],
      ['muse', { launchCmd: 'muse --trust-workspace' }]
    ]
    for (const [agent, expected] of overrides) {
      expect(TUI_AGENT_CONFIG[agent]).toMatchObject(expected)
    }
  })
})
