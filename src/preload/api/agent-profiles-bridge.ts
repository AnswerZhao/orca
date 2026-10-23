import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import type {
  LlmEndpointConfig,
  LlmEndpointPatch,
  LlmEndpointPublicView
} from '../../shared/llm-endpoint'
import type {
  AgentProfileConfigInput,
  AgentProfilePatch,
  AgentProfilePublicView
} from '../../shared/agent-profile'

export const llmEndpointsApi = {
  list: (): Promise<LlmEndpointPublicView[]> => ipcRenderer.invoke('llmEndpoints:list'),
  add: (slug: string, config: LlmEndpointConfig): Promise<LlmEndpointPublicView> =>
    ipcRenderer.invoke('llmEndpoints:add', slug, config),
  update: (slug: string, patch: LlmEndpointPatch): Promise<LlmEndpointPublicView> =>
    ipcRenderer.invoke('llmEndpoints:update', slug, patch),
  delete: (slug: string): Promise<boolean> => ipcRenderer.invoke('llmEndpoints:delete', slug)
} satisfies PreloadApi['llmEndpoints']

export const agentProfilesApi = {
  list: (): Promise<AgentProfilePublicView[]> => ipcRenderer.invoke('agentProfiles:list'),
  add: (slug: string, config: AgentProfileConfigInput): Promise<AgentProfilePublicView> =>
    ipcRenderer.invoke('agentProfiles:add', slug, config),
  update: (slug: string, patch: AgentProfilePatch): Promise<AgentProfilePublicView> =>
    ipcRenderer.invoke('agentProfiles:update', slug, patch),
  delete: (slug: string): Promise<boolean> => ipcRenderer.invoke('agentProfiles:delete', slug)
} satisfies PreloadApi['agentProfiles']
