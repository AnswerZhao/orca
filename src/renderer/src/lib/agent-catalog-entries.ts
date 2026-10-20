import { primaryAgentCatalogEntries } from './agent-catalog-entries-primary'
import { secondaryAgentCatalogEntries } from './agent-catalog-entries-secondary'
import { getCcProviderViews } from './cc-provider-agents'
import type { AgentCatalogEntry } from './agent-catalog'

/** The catalog rows, in display order. */
export function buildAgentCatalogEntries(): AgentCatalogEntry[] {
  return [
    ...primaryAgentCatalogEntries(),
    ...secondaryAgentCatalogEntries(),
    // Why: user-defined cc-* providers ride the claude binary and reuse its icon.
    ...getCcProviderViews().map((view): AgentCatalogEntry => ({
      id: view.id,
      label: `CC ${view.name}`,
      cmd: 'claude',
      homepageUrl: view.env.ANTHROPIC_BASE_URL
    }))
  ]
}
