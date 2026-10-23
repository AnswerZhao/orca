import { afterEach, describe, expect, it } from 'vitest'
import { isTuiAgent } from '../../../shared/tui-agent-config'
import { listDynamicTuiAgentIds } from '../../../shared/tui-agent-dynamic-registry'
import { buildAgentCatalogEntries } from './agent-catalog-entries'
import { applyCcProviderViews, getCcProviderViews } from './cc-provider-agents'

const KIMI_VIEW = {
  id: 'cc-kimi' as const,
  slug: 'kimi',
  name: 'Kimi',
  preset: 'kimi',
  env: {
    ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic',
    ANTHROPIC_MODEL: 'kimi-k3'
  }
}

afterEach(() => {
  applyCcProviderViews([])
})

describe('cc provider catalog entries', () => {
  it('appends a claude-cmd catalog row per provider and registers the agent', () => {
    expect(isTuiAgent('cc-kimi')).toBe(false)
    applyCcProviderViews([KIMI_VIEW])
    expect(isTuiAgent('cc-kimi')).toBe(true)
    const entry = buildAgentCatalogEntries().find((e) => String(e.id) === 'cc-kimi')
    expect(entry).toMatchObject({ label: 'CC Kimi', cmd: 'claude' })
  })

  it('drops entries and registrations when the provider list shrinks', () => {
    applyCcProviderViews([KIMI_VIEW])
    expect(getCcProviderViews()).toHaveLength(1)
    applyCcProviderViews([])
    expect(isTuiAgent('cc-kimi')).toBe(false)
    expect(buildAgentCatalogEntries().find((e) => String(e.id) === 'cc-kimi')).toBeUndefined()
    expect(listDynamicTuiAgentIds()).toEqual([])
  })
})
