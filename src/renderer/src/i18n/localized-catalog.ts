import { i18n } from './i18n'

// Why: search metadata and catalogs call translate() during build. Caching per
// active locale keeps lookups cheap while still refreshing after language changes.
// `version` invalidates for non-locale changes (e.g. dynamic cc-* provider entries).
export function createLocalizedCatalog<T>(builder: () => T, version?: () => unknown): () => T {
  let cachedLocale: string | undefined
  let cachedValue: T | undefined
  let cachedVersion: unknown

  return () => {
    const nextVersion = version?.()
    if (
      cachedLocale !== i18n.language ||
      cachedValue === undefined ||
      nextVersion !== cachedVersion
    ) {
      cachedLocale = i18n.language
      cachedVersion = nextVersion
      cachedValue = builder()
    }
    return cachedValue
  }
}
