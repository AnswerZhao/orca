import { i18n } from './i18n'
import { getTranslationResourceVersion } from './translation-resource-version'

// Why: search metadata and catalogs call translate() during build. Caching per
// active locale keeps lookups cheap while still refreshing after language changes.
// `version` invalidates for non-locale changes (e.g. dynamic ap-* profile entries).
export function createLocalizedCatalog<T>(builder: () => T, version?: () => unknown): () => T {
  let cachedLocale: string | undefined
  let cachedResourceVersion = -1
  let cachedValue: T | undefined
  let cachedVersion: unknown

  return () => {
    const nextVersion = version?.()
    const resourceVersion = getTranslationResourceVersion()
    if (
      cachedLocale !== i18n.language ||
      cachedResourceVersion !== resourceVersion ||
      cachedValue === undefined ||
      nextVersion !== cachedVersion
    ) {
      cachedValue = builder()
      cachedLocale = i18n.language
      cachedVersion = nextVersion
      cachedResourceVersion = resourceVersion
    }
    return cachedValue
  }
}
