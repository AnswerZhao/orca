import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  CC_PROVIDER_SLUG_PATTERN,
  CcProviderConfigSchema,
  CcProviderPatchSchema,
  type CcProviderConfig,
  type CcProviderPublicView
} from '../../shared/cc-provider'
import { CC_PROVIDER_AGENT_PREFIX, type CcProviderAgentId } from '../../shared/tui-agent'
import { hardenExistingSecureFile, writeSecureJsonFile } from '../../shared/secure-file'

export type CcProvider = CcProviderConfig & { slug: string; id: CcProviderAgentId }

export function ccProvidersDir(): string {
  return join(homedir(), '.orca', 'cc-providers')
}

function providerPath(slug: string, dir: string): string {
  return join(dir, `${slug}.json`)
}

function toCcProvider(slug: string, config: CcProviderConfig): CcProvider {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: callers validate `slug` against CC_PROVIDER_SLUG_PATTERN, so the prefixed id is always a valid cc-* agent id.
  const id = `${CC_PROVIDER_AGENT_PREFIX}${slug}` as CcProviderAgentId
  return { ...config, slug, id }
}

/** Reads and validates every `*.json` in the provider dir; unreadable or invalid files are skipped with a warning. */
export function listCcProviders(dir: string = ccProvidersDir()): CcProvider[] {
  if (!existsSync(dir)) {
    return []
  }
  const providers: CcProvider[] = []
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json')) {
      continue
    }
    const slug = entry.slice(0, -'.json'.length)
    if (!CC_PROVIDER_SLUG_PATTERN.test(slug)) {
      console.warn(`[cc-providers] Skipping ${entry}: file stem is not a valid provider slug`)
      continue
    }
    const path = join(dir, entry)
    try {
      hardenExistingSecureFile(path)
      const parsed = CcProviderConfigSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
      if (!parsed.success) {
        console.warn(
          `[cc-providers] Skipping ${entry}: ${parsed.error.issues[0]?.message ?? 'invalid provider config'}`
        )
        continue
      }
      providers.push(toCcProvider(slug, parsed.data))
    } catch (error) {
      console.warn(`[cc-providers] Skipping unreadable provider file ${entry}:`, error)
    }
  }
  return providers.sort((a, b) => a.slug.localeCompare(b.slug))
}

export function getCcProvider(slug: string, dir: string = ccProvidersDir()): CcProvider | null {
  return listCcProviders(dir).find((provider) => provider.slug === slug) ?? null
}

/** Redacted view for IPC/renderer — the apiKey never leaves the main process. */
export function toCcProviderPublicView(provider: CcProvider): CcProviderPublicView {
  const { slug, id, name, preset, env } = provider
  return preset ? { id, slug, name, preset, env } : { id, slug, name, env }
}

export function saveCcProvider(
  slug: string,
  input: unknown,
  dir: string = ccProvidersDir()
): CcProvider {
  if (!CC_PROVIDER_SLUG_PATTERN.test(slug)) {
    throw new Error(
      'Provider slug must be 1-30 chars of lowercase letters, digits, or dashes, starting with a letter or digit'
    )
  }
  const parsed = CcProviderConfigSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Invalid provider config: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
  }
  // Why: the file holds an API key, so a write whose 0600 restriction did not take is a failure.
  if (!writeSecureJsonFile(providerPath(slug, dir), parsed.data)) {
    throw new Error('Provider could not be stored securely on this device')
  }
  return toCcProvider(slug, parsed.data)
}

/**
 * Applies a partial patch to an existing provider. An omitted apiKey keeps the stored one,
 * so the renderer can edit everything else without the secret ever crossing IPC.
 */
export function updateCcProvider(
  slug: string,
  patch: unknown,
  dir: string = ccProvidersDir()
): CcProvider {
  const existing = getCcProvider(slug, dir)
  if (!existing) {
    throw new Error(`Provider "${slug}" does not exist`)
  }
  const parsed = CcProviderPatchSchema.safeParse(patch)
  if (!parsed.success) {
    throw new Error(`Invalid provider patch: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
  }
  const { slug: _slug, id: _id, ...existingConfig } = existing
  return saveCcProvider(slug, { ...existingConfig, ...parsed.data }, dir)
}

export function deleteCcProvider(slug: string, dir: string = ccProvidersDir()): boolean {
  if (!CC_PROVIDER_SLUG_PATTERN.test(slug)) {
    return false
  }
  const path = providerPath(slug, dir)
  if (!existsSync(path)) {
    return false
  }
  rmSync(path)
  return true
}

/** Environment the `claude` CLI needs to talk to this Anthropic-compatible provider. */
export function ccProviderEnv(provider: CcProvider): Record<string, string> {
  return { ...provider.env, ANTHROPIC_AUTH_TOKEN: provider.apiKey }
}
