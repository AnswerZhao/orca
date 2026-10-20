import { isCcProviderAgentId, type StaticTuiAgent, type TuiAgent } from './tui-agent'
import { TUI_AGENT_CONFIG } from './tui-agent-config'
import { lookupDynamicTuiAgentConfig } from './tui-agent-dynamic-registry'
import type { TuiAgentConfig } from './tui-agent-config-types'

export function isTuiAgent(value: unknown): value is TuiAgent {
  return lookupTuiAgentConfig(value) !== undefined
}

export function lookupTuiAgentConfig(agent: unknown): TuiAgentConfig | undefined {
  if (isCcProviderAgentId(agent)) {
    return lookupDynamicTuiAgentConfig(agent)
  }
  if (typeof agent !== 'string' || !Object.hasOwn(TUI_AGENT_CONFIG, agent)) {
    return undefined
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the Object.hasOwn guard proves `agent` is a key of the static record.
  return TUI_AGENT_CONFIG[agent as StaticTuiAgent]
}
