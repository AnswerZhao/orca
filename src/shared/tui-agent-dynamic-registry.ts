import { isCcProviderAgentId } from './tui-agent'
import { TUI_AGENT_CONFIG } from './tui-agent-config'
import type { TuiAgentConfig } from './tui-agent-config-types'

/** Runtime-registered dynamic agents (`cc-*` provider entries). Populated by main at startup
 *  (and mirrored in the renderer) from `~/.orca/cc-providers/*.json`.
 *  Invariant: no built-in agent id starts with `cc-`, so registration is prefix-checked only. */
const DYNAMIC_TUI_AGENT_CONFIGS = new Map<string, TuiAgentConfig>()

// Why: dozens of call sites index `TUI_AGENT_CONFIG[agent]` directly (launch-command
// resolution, pane identity, paste handling). Mirroring registrations into that runtime
// object keeps them working for cc-* agents; the Record<StaticTuiAgent, …> type keeps the
// dynamic keys invisible at compile time. The Map above stays the source of truth for
// cc-* enumeration. Runtime Object.keys(TUI_AGENT_CONFIG) loops will see the mirrored
// keys too — safe because static keys insert first (e.g. a bare `claude` command still
// resolves to the static `claude` agent before any cc-* clone).
function mirrorRegistration(id: string, config: TuiAgentConfig): void {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: callers pass the isCcProviderAgentId guard, so `id` is disjoint from the static keys.
  ;(TUI_AGENT_CONFIG as Record<string, TuiAgentConfig>)[id] = config
}

function dropRegistrationMirror(id: string): void {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: same guard as mirrorRegistration; deleting a missing key is a no-op.
  delete (TUI_AGENT_CONFIG as Record<string, TuiAgentConfig>)[id]
}

export function registerDynamicTuiAgent(id: string, config: TuiAgentConfig): boolean {
  if (!isCcProviderAgentId(id)) {
    return false
  }
  DYNAMIC_TUI_AGENT_CONFIGS.set(id, config)
  mirrorRegistration(id, config)
  return true
}

export function unregisterDynamicTuiAgent(id: string): boolean {
  dropRegistrationMirror(id)
  return DYNAMIC_TUI_AGENT_CONFIGS.delete(id)
}

export function listDynamicTuiAgentIds(): string[] {
  return [...DYNAMIC_TUI_AGENT_CONFIGS.keys()]
}

export function lookupDynamicTuiAgentConfig(id: string): TuiAgentConfig | undefined {
  return DYNAMIC_TUI_AGENT_CONFIGS.get(id)
}
