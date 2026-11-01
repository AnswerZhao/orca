import { TUI_AGENT_FAVICON_DOMAINS } from '../../../shared/tui-agent-favicon-domains'
import { primaryAgentCatalogEntries } from './agent-catalog-entries-primary'
import { secondaryAgentCatalogEntries } from './agent-catalog-entries-secondary'
import { getAgentProfileViews } from './agent-profile-agents'
import type { AgentCatalogEntry } from './agent-catalog'
import type { TuiAgent } from '../../../shared/tui-agent'

export function buildAgentCatalogEntries(): AgentCatalogEntry[] {
  return [
    ...primaryAgentCatalogEntries(),
    ...secondaryAgentCatalogEntries(),
    // Why: user-defined ap-* profiles ride the claude binary; the label is the profile's own name.
    ...getAgentProfileViews().map((view): AgentCatalogEntry => ({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: applyAgentProfileViews registers every view before it is listed, so isTuiAgent holds for view.id.
      id: view.id as TuiAgent,
      label: view.name,
      cmd: 'claude',
      homepageUrl: 'https://code.claude.com/docs'
    }))
  ].map((entry) => {
    const faviconDomain = TUI_AGENT_FAVICON_DOMAINS[entry.id]
    return faviconDomain ? { ...entry, faviconDomain } : entry
  })
}
