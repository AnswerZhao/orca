import { isCcProviderAgentId } from './cc-provider-agent-id'
import type { TuiAgent } from './tui-agent'
import {
  getTuiAgentDetectCommands,
  TUI_AGENT_CONFIG,
  type TuiAgentConfig,
  type TuiAgentDetectionRuntime
} from './tui-agent-config'
import { TUI_AGENT_DISPLAY_NAMES } from './tui-agent-display-names'

/** Runtime-registered dynamic agents (`cc-*` provider entries). Populated by main at startup
 *  (and mirrored in the renderer and CLI) from `~/.orca/cc-providers/*.json`.
 *  Invariant: no built-in agent id starts with `cc-`, so registration is prefix-checked only. */
const DYNAMIC_TUI_AGENT_CONFIGS = new Map<string, TuiAgentConfig>()

// Why mirror into the static tables instead of widening the TuiAgent type: upstream code
// indexes TUI_AGENT_CONFIG / TUI_AGENT_DISPLAY_NAMES directly and guards with isTuiAgent
// (Object.hasOwn on TUI_AGENT_CONFIG), so mirrored keys make cc-* agents resolve everywhere
// without touching those call sites. Static keys insert first, so a bare `claude` command
// still resolves to the static `claude` agent before any cc-* clone.
// SAFETY: every cast below writes a key that passed isCcProviderAgentId, so it never
// collides with a static key; deleting a missing key is a no-op.
function mutableTable<T>(table: object): Record<string, T> {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: see block comment above.
  return table as Record<string, T>
}

export function registerDynamicTuiAgent(
  id: string,
  config: TuiAgentConfig,
  displayName: string
): boolean {
  if (!isCcProviderAgentId(id)) {
    return false
  }
  DYNAMIC_TUI_AGENT_CONFIGS.set(id, config)
  mutableTable<TuiAgentConfig>(TUI_AGENT_CONFIG)[id] = config
  mutableTable<string>(TUI_AGENT_DISPLAY_NAMES)[id] = displayName
  return true
}

export function unregisterDynamicTuiAgent(id: string): boolean {
  if (!DYNAMIC_TUI_AGENT_CONFIGS.delete(id)) {
    return false
  }
  delete mutableTable<TuiAgentConfig>(TUI_AGENT_CONFIG)[id]
  delete mutableTable<string>(TUI_AGENT_DISPLAY_NAMES)[id]
  return true
}

/** Registered ids as TuiAgent values; isTuiAgent accepts them once mirrored. */
export function listDynamicTuiAgentIds(): TuiAgent[] {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: registered ids are mirrored into TUI_AGENT_CONFIG, so isTuiAgent holds for each.
  return [...DYNAMIC_TUI_AGENT_CONFIGS.keys()] as TuiAgent[]
}

/** Dynamic agents ride an existing CLI, so they count as installed exactly when it is.
 *  KNOWN_TUI_AGENT_DETECTION_COMMANDS is frozen at module load, before registration. */
export function resolveDynamicDetectedTuiAgentIds(
  foundCommands: ReadonlySet<string>,
  runtime: TuiAgentDetectionRuntime
): TuiAgent[] {
  return listDynamicTuiAgentIds().filter((id) => {
    const config = DYNAMIC_TUI_AGENT_CONFIGS.get(id)
    return (
      config !== undefined &&
      !config.detectUnsupportedRuntimes?.includes(runtime) &&
      getTuiAgentDetectCommands(config).some((cmd) => foundCommands.has(cmd)) &&
      (config.detectRequiredCommands ?? []).every((cmd) => foundCommands.has(cmd))
    )
  })
}
