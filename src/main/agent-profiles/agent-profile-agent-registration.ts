import { TUI_AGENT_CONFIG } from '../../shared/tui-agent-config'
import type { TuiAgentConfig } from '../../shared/tui-agent-config-types'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  unregisterDynamicTuiAgent
} from '../../shared/tui-agent-dynamic-registry'
import { listAgentProfiles } from './agent-profile-store'

export type AgentProfileAgentEntry = {
  id: string
  config: TuiAgentConfig
  displayName: string
}

/** Loads ap-* agent entries from `~/.orca/agent-profiles/*.json` without touching the
 *  registry; ap-* agents inherit the claude harness config. Callers running in a separate
 *  bundle (the tsc-built CLI vs the electron-vite main bundle) each carry their own copy
 *  of the dynamic registry module, so cross-bundle callers must register these entries
 *  into their own registry copy instead of relying on `syncAgentProfileAgents`. */
export function loadAgentProfileAgentEntries(dir?: string): AgentProfileAgentEntry[] {
  return listAgentProfiles(dir).map((profile) => ({
    id: profile.id,
    config: { ...TUI_AGENT_CONFIG.claude },
    displayName: profile.name
  }))
}

/** Reconciles this process's dynamic agent registry with `~/.orca/agent-profiles/*.json`. */
export function syncAgentProfileAgents(dir?: string): string[] {
  const entries = loadAgentProfileAgentEntries(dir)
  const desired = new Set<string>(entries.map((entry) => entry.id))
  for (const id of listDynamicTuiAgentIds()) {
    if (!desired.has(id)) {
      unregisterDynamicTuiAgent(id)
    }
  }
  for (const entry of entries) {
    registerDynamicTuiAgent(entry.id, entry.config, entry.displayName)
  }
  return entries.map((entry) => entry.id)
}
