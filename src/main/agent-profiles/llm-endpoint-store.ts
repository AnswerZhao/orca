import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  LLM_ENDPOINT_SLUG_PATTERN,
  LlmEndpointConfigSchema,
  LlmEndpointPatchSchema,
  type LlmEndpointConfig,
  type LlmEndpointPublicView
} from '../../shared/llm-endpoint'
import { hardenExistingSecureFile, writeSecureJsonFile } from '../../shared/secure-file'

export type LlmEndpoint = LlmEndpointConfig & { slug: string }

export function llmEndpointsDir(): string {
  return join(homedir(), '.orca', 'llm-endpoints')
}

function endpointPath(slug: string, dir: string): string {
  return join(dir, `${slug}.json`)
}

/** Reads and validates every `*.json` in the endpoint dir; unreadable or invalid files are skipped with a warning. */
export function listLlmEndpoints(dir: string = llmEndpointsDir()): LlmEndpoint[] {
  if (!existsSync(dir)) {
    return []
  }
  const endpoints: LlmEndpoint[] = []
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json')) {
      continue
    }
    const slug = entry.slice(0, -'.json'.length)
    if (!LLM_ENDPOINT_SLUG_PATTERN.test(slug)) {
      console.warn(`[llm-endpoints] Skipping ${entry}: file stem is not a valid endpoint slug`)
      continue
    }
    const path = join(dir, entry)
    try {
      hardenExistingSecureFile(path)
      const parsed = LlmEndpointConfigSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
      if (!parsed.success) {
        console.warn(
          `[llm-endpoints] Skipping ${entry}: ${parsed.error.issues[0]?.message ?? 'invalid endpoint config'}`
        )
        continue
      }
      endpoints.push({ ...parsed.data, slug })
    } catch (error) {
      console.warn(`[llm-endpoints] Skipping unreadable endpoint file ${entry}:`, error)
    }
  }
  return endpoints.sort((a, b) => a.slug.localeCompare(b.slug))
}

export function getLlmEndpoint(slug: string, dir: string = llmEndpointsDir()): LlmEndpoint | null {
  return listLlmEndpoints(dir).find((endpoint) => endpoint.slug === slug) ?? null
}

/** Redacted view for IPC/renderer — the apiKey never leaves the main process. */
export function toLlmEndpointPublicView(endpoint: LlmEndpoint): LlmEndpointPublicView {
  const { slug, name, preset, env } = endpoint
  return preset ? { slug, name, preset, env } : { slug, name, env }
}

export function saveLlmEndpoint(
  slug: string,
  input: unknown,
  dir: string = llmEndpointsDir()
): LlmEndpoint {
  if (!LLM_ENDPOINT_SLUG_PATTERN.test(slug)) {
    throw new Error(
      'Endpoint slug must be 1-30 chars of lowercase letters, digits, or dashes, starting with a letter or digit'
    )
  }
  const parsed = LlmEndpointConfigSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Invalid endpoint config: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
  }
  // Why: the file holds an API key, so a write whose 0600 restriction did not take is a failure.
  if (!writeSecureJsonFile(endpointPath(slug, dir), parsed.data)) {
    throw new Error('Endpoint could not be stored securely on this device')
  }
  return { ...parsed.data, slug }
}

/**
 * Applies a partial patch to an existing endpoint. An omitted apiKey keeps the stored one,
 * so the renderer can edit everything else without the secret ever crossing IPC.
 */
export function updateLlmEndpoint(
  slug: string,
  patch: unknown,
  dir: string = llmEndpointsDir()
): LlmEndpoint {
  const existing = getLlmEndpoint(slug, dir)
  if (!existing) {
    throw new Error(`Endpoint "${slug}" does not exist`)
  }
  const parsed = LlmEndpointPatchSchema.safeParse(patch)
  if (!parsed.success) {
    throw new Error(`Invalid endpoint patch: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
  }
  const { slug: _slug, ...existingConfig } = existing
  return saveLlmEndpoint(slug, { ...existingConfig, ...parsed.data }, dir)
}

/** Removes the endpoint file; callers guarding profile references use `deleteUnreferencedLlmEndpoint`. */
export function deleteLlmEndpoint(slug: string, dir: string = llmEndpointsDir()): boolean {
  if (!LLM_ENDPOINT_SLUG_PATTERN.test(slug)) {
    return false
  }
  const path = endpointPath(slug, dir)
  if (!existsSync(path)) {
    return false
  }
  rmSync(path)
  return true
}

/** Environment the `claude` CLI needs to talk to this Anthropic-compatible endpoint. */
export function llmEndpointEnv(endpoint: LlmEndpoint): Record<string, string> {
  return { ...endpoint.env, ANTHROPIC_AUTH_TOKEN: endpoint.apiKey }
}
