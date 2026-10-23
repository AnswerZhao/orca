import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import type {
  CcProviderConfig,
  CcProviderPatch,
  CcProviderPublicView
} from '../../shared/cc-provider'

export const ccProvidersApi = {
  list: (): Promise<CcProviderPublicView[]> => ipcRenderer.invoke('ccProviders:list'),
  add: (slug: string, config: CcProviderConfig): Promise<CcProviderPublicView> =>
    ipcRenderer.invoke('ccProviders:add', slug, config),
  update: (slug: string, patch: CcProviderPatch): Promise<CcProviderPublicView> =>
    ipcRenderer.invoke('ccProviders:update', slug, patch),
  delete: (slug: string): Promise<boolean> => ipcRenderer.invoke('ccProviders:delete', slug)
} satisfies PreloadApi['ccProviders']
