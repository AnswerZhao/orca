/** Agent id prefix for user-defined Claude-compatible providers (`~/.orca/cc-providers/*.json`). */
export const CC_PROVIDER_AGENT_PREFIX = 'cc-'

/** A dynamic provider agent id, e.g. `cc-kimi`. Registered at runtime, never a static TuiAgent. */
export type CcProviderAgentId = `${typeof CC_PROVIDER_AGENT_PREFIX}${string}`

export function isCcProviderAgentId(value: unknown): value is CcProviderAgentId {
  return (
    typeof value === 'string' &&
    value.length > CC_PROVIDER_AGENT_PREFIX.length &&
    value.startsWith(CC_PROVIDER_AGENT_PREFIX)
  )
}
