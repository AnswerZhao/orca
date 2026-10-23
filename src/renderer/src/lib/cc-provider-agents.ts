import { ccProviderDisplayName, type CcProviderPublicView } from '../../../shared/cc-provider'
import { TUI_AGENT_CONFIG } from '../../../shared/tui-agent-config'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  unregisterDynamicTuiAgent
} from '../../../shared/tui-agent-dynamic-registry'

// The renderer mirrors main's cc-* registry so isTuiAgent and the catalog know the
// dynamic agents; main stays the source of truth (and the only process holding apiKeys).
let ccProviderViews: readonly CcProviderPublicView[] = []
let catalogVersion = 0

/** Bumped on every apply so cached catalogs (localized per locale) rebuild. */
export function getCcProviderCatalogVersion(): number {
  return catalogVersion
}

export function getCcProviderViews(): readonly CcProviderPublicView[] {
  return ccProviderViews
}

export function applyCcProviderViews(views: readonly CcProviderPublicView[]): void {
  ccProviderViews = views
  const desired = new Set<string>(views.map((view) => view.id))
  for (const id of listDynamicTuiAgentIds()) {
    if (!desired.has(id)) {
      unregisterDynamicTuiAgent(id)
    }
  }
  for (const view of views) {
    registerDynamicTuiAgent(
      view.id,
      { ...TUI_AGENT_CONFIG.claude },
      ccProviderDisplayName(view.name)
    )
  }
  catalogVersion += 1
}

/** Pulls the redacted provider list from main and mirrors it into the renderer registry. */
export async function refreshCcProviders(): Promise<void> {
  applyCcProviderViews(await window.api.ccProviders.list())
}
