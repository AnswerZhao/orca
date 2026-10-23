import { ipcMain } from 'electron'
import { syncAgentProfileAgents } from '../agent-profiles/agent-profile-agent-registration'
import {
  deleteAgentProfile,
  deleteUnreferencedLlmEndpoint,
  listAgentProfiles,
  saveAgentProfile,
  toAgentProfilePublicView,
  updateAgentProfile
} from '../agent-profiles/agent-profile-store'
import {
  listLlmEndpoints,
  saveLlmEndpoint,
  toLlmEndpointPublicView,
  updateLlmEndpoint
} from '../agent-profiles/llm-endpoint-store'
import type { AgentProfilePublicView } from '../../shared/agent-profile'
import type { LlmEndpointPublicView } from '../../shared/llm-endpoint'

function requireSlug(slug: unknown, kind: 'Endpoint' | 'Profile'): string {
  if (typeof slug !== 'string') {
    throw new Error(`${kind} slug must be a string`)
  }
  return slug
}

/** Runs a store mutation, then re-syncs the ap-* registry so spawns see the new state. */
function mutate<T>(run: () => T): T {
  try {
    return run()
  } finally {
    syncAgentProfileAgents()
  }
}

export function registerAgentProfileHandlers(): void {
  // Why: the apiKey never crosses this boundary — every endpoint return value is the redacted view.
  ipcMain.handle('llmEndpoints:list', (): LlmEndpointPublicView[] =>
    listLlmEndpoints().map(toLlmEndpointPublicView)
  )
  ipcMain.handle(
    'llmEndpoints:add',
    (_event, slug: unknown, config: unknown): LlmEndpointPublicView =>
      mutate(() => toLlmEndpointPublicView(saveLlmEndpoint(requireSlug(slug, 'Endpoint'), config)))
  )
  ipcMain.handle(
    'llmEndpoints:update',
    (_event, slug: unknown, patch: unknown): LlmEndpointPublicView =>
      mutate(() => toLlmEndpointPublicView(updateLlmEndpoint(requireSlug(slug, 'Endpoint'), patch)))
  )
  ipcMain.handle('llmEndpoints:delete', (_event, slug: unknown): boolean =>
    mutate(() => deleteUnreferencedLlmEndpoint(requireSlug(slug, 'Endpoint')))
  )

  ipcMain.handle('agentProfiles:list', (): AgentProfilePublicView[] =>
    listAgentProfiles().map(toAgentProfilePublicView)
  )
  ipcMain.handle(
    'agentProfiles:add',
    (_event, slug: unknown, config: unknown): AgentProfilePublicView =>
      mutate(() => toAgentProfilePublicView(saveAgentProfile(requireSlug(slug, 'Profile'), config)))
  )
  ipcMain.handle(
    'agentProfiles:update',
    (_event, slug: unknown, patch: unknown): AgentProfilePublicView =>
      mutate(() =>
        toAgentProfilePublicView(updateAgentProfile(requireSlug(slug, 'Profile'), patch))
      )
  )
  ipcMain.handle('agentProfiles:delete', (_event, slug: unknown): boolean =>
    mutate(() => deleteAgentProfile(requireSlug(slug, 'Profile')))
  )
}
