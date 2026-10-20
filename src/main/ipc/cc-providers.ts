import { ipcMain } from 'electron'
import { syncCcProviderAgents } from '../cc-providers/cc-provider-agent-registration'
import {
  deleteCcProvider,
  listCcProviders,
  saveCcProvider,
  toCcProviderPublicView,
  updateCcProvider
} from '../cc-providers/cc-provider-store'
import type { CcProviderPublicView } from '../../shared/cc-provider'

function listPublicProviders(): CcProviderPublicView[] {
  return listCcProviders().map(toCcProviderPublicView)
}

export function registerCcProviderHandlers(): void {
  // Why: the apiKey never crosses this boundary — every return value is the redacted view.
  ipcMain.handle('ccProviders:list', (): CcProviderPublicView[] => listPublicProviders())
  ipcMain.handle(
    'ccProviders:add',
    (_event, slug: unknown, config: unknown): CcProviderPublicView => {
      if (typeof slug !== 'string') {
        throw new Error('Provider slug must be a string')
      }
      const saved = saveCcProvider(slug, config)
      syncCcProviderAgents()
      return toCcProviderPublicView(saved)
    }
  )
  ipcMain.handle(
    'ccProviders:update',
    (_event, slug: unknown, patch: unknown): CcProviderPublicView => {
      if (typeof slug !== 'string') {
        throw new Error('Provider slug must be a string')
      }
      const saved = updateCcProvider(slug, patch)
      syncCcProviderAgents()
      return toCcProviderPublicView(saved)
    }
  )
  ipcMain.handle('ccProviders:delete', (_event, slug: unknown): boolean => {
    if (typeof slug !== 'string') {
      throw new Error('Provider slug must be a string')
    }
    const deleted = deleteCcProvider(slug)
    syncCcProviderAgents()
    return deleted
  })
}
