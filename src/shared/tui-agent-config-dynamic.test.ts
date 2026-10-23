import { afterEach, describe, expect, it } from 'vitest'
import { isTuiAgent, TUI_AGENT_CONFIG } from './tui-agent-config'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  resolveDynamicDetectedTuiAgentIds,
  unregisterDynamicTuiAgent
} from './tui-agent-dynamic-registry'
import { isCcProviderAgentId } from './cc-provider-agent-id'
import { requireTuiAgentConfig } from './require-tui-agent-config'
import { tuiAgentDisplayName } from './tui-agent-display-names'
import { resolveAgentLaunchCommand } from './tui-agent-launch-command'
import type { TuiAgent } from './tui-agent'

const CLAUDE_LIKE = { ...TUI_AGENT_CONFIG.claude }
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: registered cc-* ids satisfy isTuiAgent at runtime, which is what these tests exercise.
const KIMI = 'cc-kimi' as TuiAgent

describe('dynamic cc-* provider agents', () => {
  afterEach(() => {
    for (const id of listDynamicTuiAgentIds()) {
      unregisterDynamicTuiAgent(id)
    }
  })

  it('recognizes cc-* id shape', () => {
    expect(isCcProviderAgentId('cc-kimi')).toBe(true)
    expect(isCcProviderAgentId('cc-')).toBe(false)
    expect(isCcProviderAgentId('claude')).toBe(false)
    expect(isCcProviderAgentId(42)).toBe(false)
  })

  it('mirrors registrations into the static tables and removes them on unregister', () => {
    expect(isTuiAgent('cc-kimi')).toBe(false)
    expect(registerDynamicTuiAgent('cc-kimi', CLAUDE_LIKE, 'CC Kimi')).toBe(true)
    expect(isTuiAgent('cc-kimi')).toBe(true)
    expect(requireTuiAgentConfig(KIMI)).toEqual(CLAUDE_LIKE)
    expect(tuiAgentDisplayName('cc-kimi')).toBe('CC Kimi')
    expect(unregisterDynamicTuiAgent('cc-kimi')).toBe(true)
    expect(isTuiAgent('cc-kimi')).toBe(false)
    expect(tuiAgentDisplayName('cc-kimi')).toBeNull()
  })

  it('rejects ids that are not cc-* so static agents are never overwritten', () => {
    expect(registerDynamicTuiAgent('kimi', CLAUDE_LIKE, 'Kimi')).toBe(false)
    expect(registerDynamicTuiAgent('claude', CLAUDE_LIKE, 'Fake')).toBe(false)
    expect(tuiAgentDisplayName('claude')).toBe('Claude')
    expect(unregisterDynamicTuiAgent('claude')).toBe(false)
    expect(isTuiAgent('claude')).toBe(true)
  })

  it('resolves a launch command for a cc-* agent via the claude config', () => {
    registerDynamicTuiAgent('cc-kimi', CLAUDE_LIKE, 'CC Kimi')
    const result = resolveAgentLaunchCommand({
      agent: KIMI,
      cmdOverrides: {},
      platform: 'linux',
      shell: 'posix'
    })
    expect(result).toMatchObject({ ok: true, command: 'claude' })
  })

  it('detects cc-* agents exactly when their underlying CLI is present', () => {
    registerDynamicTuiAgent('cc-kimi', CLAUDE_LIKE, 'CC Kimi')
    expect(resolveDynamicDetectedTuiAgentIds(new Set(['claude']), 'linux')).toEqual(['cc-kimi'])
    expect(resolveDynamicDetectedTuiAgentIds(new Set(), 'linux')).toEqual([])
  })
})
