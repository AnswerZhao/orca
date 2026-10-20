import { afterEach, describe, expect, it } from 'vitest'
import { isTuiAgent, lookupTuiAgentConfig, TUI_AGENT_CONFIG } from './tui-agent-config'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  unregisterDynamicTuiAgent
} from './tui-agent-dynamic-registry'
import { requireTuiAgentConfig } from './require-tui-agent-config'
import { isCcProviderAgentId } from './tui-agent'
import { tuiAgentToAgentKind } from './agent-kind'
import { tuiAgentDisplayName } from './tui-agent-display-names'
import { toSkillsCliAgentKeys } from './skills-cli-agent-keys'
import { resolveAgentLaunchCommand } from './tui-agent-launch-command'
import { resolveDynamicDetectedTuiAgentIds } from './tui-agent-detection-commands'

const CLAUDE_LIKE = { ...TUI_AGENT_CONFIG.claude }

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

  it('registers, looks up, and unregisters a dynamic agent', () => {
    expect(isTuiAgent('cc-kimi')).toBe(false)
    expect(registerDynamicTuiAgent('cc-kimi', CLAUDE_LIKE)).toBe(true)
    expect(isTuiAgent('cc-kimi')).toBe(true)
    expect(lookupTuiAgentConfig('cc-kimi')).toEqual(CLAUDE_LIKE)
    expect(requireTuiAgentConfig('cc-kimi')).toEqual(CLAUDE_LIKE)
    expect(listDynamicTuiAgentIds()).toContain('cc-kimi')
    expect(unregisterDynamicTuiAgent('cc-kimi')).toBe(true)
    expect(isTuiAgent('cc-kimi')).toBe(false)
  })

  it('rejects ids that are not cc-* or collide with static agents', () => {
    expect(registerDynamicTuiAgent('kimi', CLAUDE_LIKE)).toBe(false)
    expect(registerDynamicTuiAgent('claude', CLAUDE_LIKE)).toBe(false)
    expect(registerDynamicTuiAgent('not-an-agent', CLAUDE_LIKE)).toBe(false)
    expect(isTuiAgent('not-an-agent')).toBe(false)
  })

  it('requireTuiAgentConfig still names unknown ids', () => {
    expect(() => requireTuiAgentConfig('cc-nope')).toThrow(/Unknown agent "cc-nope"/)
  })

  it('maps cc-* agents onto the claude harness surfaces', () => {
    expect(tuiAgentToAgentKind('cc-kimi')).toBe('claude-code')
    expect(tuiAgentDisplayName('cc-kimi')).toBe('CC kimi')
    expect(toSkillsCliAgentKeys(['cc-kimi'])).toContain('claude-code')
  })

  it('mirrors registrations into TUI_AGENT_CONFIG so direct indexing keeps working', () => {
    expect(Object.hasOwn(TUI_AGENT_CONFIG, 'cc-kimi')).toBe(false)
    registerDynamicTuiAgent('cc-kimi', CLAUDE_LIKE)
    expect(Object.hasOwn(TUI_AGENT_CONFIG, 'cc-kimi')).toBe(true)
    unregisterDynamicTuiAgent('cc-kimi')
    expect(Object.hasOwn(TUI_AGENT_CONFIG, 'cc-kimi')).toBe(false)
  })

  it('resolves a launch command for a cc-* agent via the claude config', () => {
    registerDynamicTuiAgent('cc-kimi', CLAUDE_LIKE)
    const result = resolveAgentLaunchCommand({
      agent: 'cc-kimi',
      cmdOverrides: {},
      platform: 'linux',
      shell: 'posix'
    })
    expect(result).toMatchObject({ ok: true, command: 'claude' })
  })

  it('detects cc-* agents exactly when their underlying CLI is present', () => {
    registerDynamicTuiAgent('cc-kimi', CLAUDE_LIKE)
    expect(resolveDynamicDetectedTuiAgentIds(new Set(['claude']), 'linux')).toEqual(['cc-kimi'])
    expect(resolveDynamicDetectedTuiAgentIds(new Set(), 'linux')).toEqual([])
  })
})
