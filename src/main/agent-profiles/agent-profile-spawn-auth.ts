import {
  agentProfileSlugFromAgentId,
  isAgentProfileAgentId
} from '../../shared/agent-profile-agent-id'
import {
  getAgentProfile,
  defaultAgentProfileStoreDirs,
  type AgentProfileStoreDirs
} from './agent-profile-store'
import { getLlmEndpoint, llmEndpointEnv } from './llm-endpoint-store'

/**
 * How a profile agent's claude authenticates: its signed-in account (claudeAuth runs as for
 * plain claude), or an endpoint whose env replaces that account auth.
 */
export type AgentProfileSpawnAuth =
  | { kind: 'subscription' }
  | { kind: 'endpoint'; env: Record<string, string> }

/**
 * Auth for a pane launching a registered ap-* profile agent, or null for any other launch.
 * Read fresh from disk at spawn time so edits and deletes take effect without a restart.
 * Throws when the profile's endpoint is gone: launching on the account instead would
 * silently bill a different model provider.
 */
export function resolveAgentProfileSpawnAuth(
  launchAgent: unknown,
  dirs: AgentProfileStoreDirs = defaultAgentProfileStoreDirs()
): AgentProfileSpawnAuth | null {
  if (!isAgentProfileAgentId(launchAgent)) {
    return null
  }
  const profile = getAgentProfile(agentProfileSlugFromAgentId(launchAgent), dirs.profiles)
  if (!profile) {
    return null
  }
  if (profile.llmSource.kind === 'subscription') {
    return { kind: 'subscription' }
  }
  const endpoint = getLlmEndpoint(profile.llmSource.endpoint, dirs.endpoints)
  if (!endpoint) {
    throw new Error(
      `Agent profile "${profile.name}" uses LLM endpoint "${profile.llmSource.endpoint}", which no longer exists. Pick another model source in Settings.`
    )
  }
  return { kind: 'endpoint', env: llmEndpointEnv(endpoint) }
}

/**
 * The claude launch auth both spawn lanes apply: an ap-* profile on an LLM endpoint brings
 * its own ANTHROPIC_* env, and the official account auth must not run for it or it would
 * overwrite those vars. A subscription profile authenticates exactly like plain claude.
 */
export async function prepareClaudeLaunchAuth<T>(input: {
  isClaudeLaunch: boolean
  launchAgent: unknown
  prepareClaudeAuth: (() => Promise<T>) | undefined
  dirs?: AgentProfileStoreDirs
}): Promise<{
  llmEndpointEnv: Record<string, string> | null
  claudeAuth: T | null
}> {
  if (!input.isClaudeLaunch) {
    return { llmEndpointEnv: null, claudeAuth: null }
  }
  const profileAuth = resolveAgentProfileSpawnAuth(input.launchAgent, input.dirs)
  if (profileAuth?.kind === 'endpoint') {
    return { llmEndpointEnv: profileAuth.env, claudeAuth: null }
  }
  return {
    llmEndpointEnv: null,
    claudeAuth: input.prepareClaudeAuth ? await input.prepareClaudeAuth() : null
  }
}
