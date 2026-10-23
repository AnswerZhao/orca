import { primaryAgentCatalogEntries } from './agent-catalog-entries-primary'
import { secondaryAgentCatalogEntries } from './agent-catalog-entries-secondary'
import { getCcProviderViews } from './cc-provider-agents'
import { translate } from '@/i18n/i18n'
import type { AgentCatalogEntry } from './agent-catalog'
import type { TuiAgent } from '../../../shared/tui-agent'

/** The catalog rows, in display order. */
export function buildAgentCatalogEntries(): AgentCatalogEntry[] {
  return [
    ...primaryAgentCatalogEntries(),
    ...secondaryAgentCatalogEntries(),
    // Why: user-defined cc-* providers ride the claude binary and reuse its icon.
    ...getCcProviderViews().map((view): AgentCatalogEntry => ({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: applyCcProviderViews registers every view before it is listed, so isTuiAgent holds for view.id.
      id: view.id as TuiAgent,
      label: translate('auto.lib.agent.catalog.ccProvider', 'CC {{name}}', { name: view.name }),
      cmd: 'claude',
      homepageUrl: view.env.ANTHROPIC_BASE_URL
    }))
  ]
}
