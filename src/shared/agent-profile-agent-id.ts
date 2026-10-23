/** Agent id prefix for user-defined agent profiles (`~/.orca/agent-profiles/*.json`). */
export const AGENT_PROFILE_AGENT_PREFIX = 'ap-'

/** A dynamic profile agent id, e.g. `ap-architect`. Registered at runtime, never a static TuiAgent. */
export type AgentProfileAgentId = `${typeof AGENT_PROFILE_AGENT_PREFIX}${string}`

export function isAgentProfileAgentId(value: unknown): value is AgentProfileAgentId {
  return (
    typeof value === 'string' &&
    value.length > AGENT_PROFILE_AGENT_PREFIX.length &&
    value.startsWith(AGENT_PROFILE_AGENT_PREFIX)
  )
}

export function agentProfileAgentId(slug: string): AgentProfileAgentId {
  return `${AGENT_PROFILE_AGENT_PREFIX}${slug}`
}

export function agentProfileSlugFromAgentId(id: AgentProfileAgentId): string {
  return id.slice(AGENT_PROFILE_AGENT_PREFIX.length)
}
