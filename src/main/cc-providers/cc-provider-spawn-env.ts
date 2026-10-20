import { CC_PROVIDER_AGENT_PREFIX, isCcProviderAgentId } from '../../shared/tui-agent'
import { ccProviderEnv, getCcProvider } from './cc-provider-store'

/**
 * Env to inject when the pane launches a registered cc-* provider agent, or null.
 * Read fresh from disk at spawn time so edits and deletes take effect without a restart.
 */
export function resolveCcProviderSpawnEnv(
  launchAgent: unknown,
  dir?: string
): Record<string, string> | null {
  if (!isCcProviderAgentId(launchAgent)) {
    return null
  }
  const provider = getCcProvider(launchAgent.slice(CC_PROVIDER_AGENT_PREFIX.length), dir)
  return provider ? ccProviderEnv(provider) : null
}
