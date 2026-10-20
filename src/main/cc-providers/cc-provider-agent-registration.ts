import { TUI_AGENT_CONFIG } from '../../shared/tui-agent-config'
import type { TuiAgentConfig } from '../../shared/tui-agent-config-types'
import {
  listDynamicTuiAgentIds,
  registerDynamicTuiAgent,
  unregisterDynamicTuiAgent
} from '../../shared/tui-agent-dynamic-registry'
import { listCcProviders } from './cc-provider-store'

export type CcProviderAgentEntry = {
  id: string
  config: TuiAgentConfig
}

/** Loads cc-* agent entries from `~/.orca/cc-providers/*.json` without touching the
 *  registry; cc-* agents inherit the claude harness config. Callers running in a separate
 *  bundle (the tsc-built CLI vs the electron-vite main bundle) each carry their own copy
 *  of the dynamic registry module, so cross-bundle callers must register these entries
 *  into their own registry copy instead of relying on `syncCcProviderAgents`. */
export function loadCcProviderAgentEntries(dir?: string): CcProviderAgentEntry[] {
  return listCcProviders(dir).map((provider) => ({
    id: provider.id,
    config: { ...TUI_AGENT_CONFIG.claude }
  }))
}

/** Reconciles this process's dynamic agent registry with `~/.orca/cc-providers/*.json`. */
export function syncCcProviderAgents(dir?: string): string[] {
  const entries = loadCcProviderAgentEntries(dir)
  const desired = new Set<string>(entries.map((entry) => entry.id))
  for (const id of listDynamicTuiAgentIds()) {
    if (!desired.has(id)) {
      unregisterDynamicTuiAgent(id)
    }
  }
  for (const entry of entries) {
    registerDynamicTuiAgent(entry.id, entry.config)
  }
  return entries.map((entry) => entry.id)
}
