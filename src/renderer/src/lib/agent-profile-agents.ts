import type { AgentProfilePublicView } from '../../../shared/agent-profile'
import { TUI_AGENT_CONFIG } from '../../../shared/tui-agent-config'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  unregisterDynamicTuiAgent
} from '../../../shared/tui-agent-dynamic-registry'

// The renderer mirrors main's ap-* registry so isTuiAgent and the catalog know the
// profile agents; main stays the source of truth.
let agentProfileViews: readonly AgentProfilePublicView[] = []
let catalogVersion = 0

/** Bumped on every apply so cached catalogs (localized per locale) rebuild. */
export function getAgentProfileCatalogVersion(): number {
  return catalogVersion
}

export function getAgentProfileViews(): readonly AgentProfilePublicView[] {
  return agentProfileViews
}

export function applyAgentProfileViews(views: readonly AgentProfilePublicView[]): void {
  agentProfileViews = views
  const desired = new Set<string>(views.map((view) => view.id))
  for (const id of listDynamicTuiAgentIds()) {
    if (!desired.has(id)) {
      unregisterDynamicTuiAgent(id)
    }
  }
  for (const view of views) {
    registerDynamicTuiAgent(view.id, { ...TUI_AGENT_CONFIG[view.baseAgent] }, view.name)
  }
  catalogVersion += 1
}

/** Pulls the profile list from main and mirrors it into the renderer registry. */
export async function refreshAgentProfiles(): Promise<void> {
  applyAgentProfileViews(await window.api.agentProfiles.list())
}
