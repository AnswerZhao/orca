import { afterEach, describe, expect, it } from 'vitest'
import type { AgentProfilePublicView } from '../../../shared/agent-profile'
import { isTuiAgent } from '../../../shared/tui-agent-config'
import { listDynamicTuiAgentIds } from '../../../shared/tui-agent-dynamic-registry'
import { buildAgentCatalogEntries } from './agent-catalog-entries'
import { applyAgentProfileViews, getAgentProfileViews } from './agent-profile-agents'

const ARCHITECT_VIEW: AgentProfilePublicView = {
  id: 'ap-architect',
  slug: 'architect',
  name: 'Architect',
  icon: 'compass',
  baseAgent: 'claude',
  llmSource: { kind: 'subscription' },
  model: 'opus',
  permissionMode: 'auto'
}

afterEach(() => {
  applyAgentProfileViews([])
})

describe('agent profile catalog entries', () => {
  it('appends a claude-cmd catalog row per profile and registers the agent', () => {
    expect(isTuiAgent('ap-architect')).toBe(false)
    applyAgentProfileViews([ARCHITECT_VIEW])
    expect(isTuiAgent('ap-architect')).toBe(true)
    const entry = buildAgentCatalogEntries().find((e) => String(e.id) === 'ap-architect')
    expect(entry).toMatchObject({ label: 'Architect', cmd: 'claude' })
  })

  it('drops entries and registrations when the profile list shrinks', () => {
    applyAgentProfileViews([ARCHITECT_VIEW])
    expect(getAgentProfileViews()).toHaveLength(1)
    applyAgentProfileViews([])
    expect(isTuiAgent('ap-architect')).toBe(false)
    expect(buildAgentCatalogEntries().find((e) => String(e.id) === 'ap-architect')).toBeUndefined()
    expect(listDynamicTuiAgentIds()).toEqual([])
  })
})
