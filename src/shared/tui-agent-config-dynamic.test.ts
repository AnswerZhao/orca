import { afterEach, describe, expect, it } from 'vitest'
import { isTuiAgent, TUI_AGENT_CONFIG } from './tui-agent-config'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  resolveDynamicDetectedTuiAgentIds,
  unregisterDynamicTuiAgent
} from './tui-agent-dynamic-registry'
import { isAgentProfileAgentId } from './agent-profile-agent-id'
import { requireTuiAgentConfig } from './require-tui-agent-config'
import { tuiAgentDisplayName } from './tui-agent-display-names'
import { resolveAgentLaunchCommand } from './tui-agent-launch-command'
import type { TuiAgent } from './tui-agent'

const CLAUDE_LIKE = { ...TUI_AGENT_CONFIG.claude }
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: registered ap-* ids satisfy isTuiAgent at runtime, which is what these tests exercise.
const KIMI = 'ap-kimi' as TuiAgent

describe('dynamic ap-* profile agents', () => {
  afterEach(() => {
    for (const id of listDynamicTuiAgentIds()) {
      unregisterDynamicTuiAgent(id)
    }
  })

  it('recognizes ap-* id shape', () => {
    expect(isAgentProfileAgentId('ap-kimi')).toBe(true)
    expect(isAgentProfileAgentId('ap-')).toBe(false)
    expect(isAgentProfileAgentId('claude')).toBe(false)
    expect(isAgentProfileAgentId(42)).toBe(false)
  })

  it('mirrors registrations into the static tables and removes them on unregister', () => {
    expect(isTuiAgent('ap-kimi')).toBe(false)
    expect(registerDynamicTuiAgent('ap-kimi', CLAUDE_LIKE, 'Kimi')).toBe(true)
    expect(isTuiAgent('ap-kimi')).toBe(true)
    expect(requireTuiAgentConfig(KIMI)).toEqual(CLAUDE_LIKE)
    expect(tuiAgentDisplayName('ap-kimi')).toBe('Kimi')
    expect(unregisterDynamicTuiAgent('ap-kimi')).toBe(true)
    expect(isTuiAgent('ap-kimi')).toBe(false)
    expect(tuiAgentDisplayName('ap-kimi')).toBeNull()
  })

  it('rejects ids that are not dynamic so static agents are never overwritten', () => {
    expect(registerDynamicTuiAgent('kimi', CLAUDE_LIKE, 'Kimi')).toBe(false)
    expect(registerDynamicTuiAgent('cc-kimi', CLAUDE_LIKE, 'Kimi')).toBe(false)
    expect(registerDynamicTuiAgent('claude', CLAUDE_LIKE, 'Fake')).toBe(false)
    expect(tuiAgentDisplayName('claude')).toBe('Claude')
    expect(unregisterDynamicTuiAgent('claude')).toBe(false)
    expect(isTuiAgent('claude')).toBe(true)
  })

  it('resolves a launch command for a ap-* agent via the claude config', () => {
    registerDynamicTuiAgent('ap-kimi', CLAUDE_LIKE, 'Kimi')
    const result = resolveAgentLaunchCommand({
      agent: KIMI,
      cmdOverrides: {},
      platform: 'linux',
      shell: 'posix'
    })
    expect(result).toMatchObject({ ok: true, command: 'claude' })
  })

  it('detects ap-* agents exactly when their underlying CLI is present', () => {
    registerDynamicTuiAgent('ap-kimi', CLAUDE_LIKE, 'Kimi')
    expect(resolveDynamicDetectedTuiAgentIds(new Set(['claude']), 'linux')).toEqual(['ap-kimi'])
    expect(resolveDynamicDetectedTuiAgentIds(new Set(), 'linux')).toEqual([])
  })
})
