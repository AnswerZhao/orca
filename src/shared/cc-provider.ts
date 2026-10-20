import { z } from 'zod'
import type { CcProviderAgentId } from './tui-agent'

/** File stem of `~/.orca/cc-providers/{slug}.json`; becomes the `cc-${slug}` agent id suffix. */
export const CC_PROVIDER_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,29}$/

/**
 * Env keys a provider config may inject. Covers everything the vendors' Claude Code
 * onboarding guides use, and nothing that could hijack the process (PATH, NODE_OPTIONS…).
 */
export const CC_PROVIDER_ENV_KEY_PATTERN =
  /^(ANTHROPIC_[A-Z0-9_]*|CLAUDE_CODE_[A-Z0-9_]*|API_TIMEOUT_MS)$/

/**
 * Keys that must never ride the env dict: `apiKey` is the single secret channel (0600 file,
 * redacted from IPC), so a credential smuggled into `env` would leak into the public view.
 */
const CC_PROVIDER_FORBIDDEN_ENV_KEYS = new Set(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'])

const envValueSchema = z.string().trim().min(1)

function isValidBaseUrl(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * On-disk shape of a user-defined Claude-compatible provider: the spawn-time env dict is the
 * source of truth (vendors' official Claude Code setups differ in which ANTHROPIC_* keys they
 * need), with apiKey stored separately so it alone can be redacted. The apiKey stays
 * main-process only.
 */
export const CcProviderConfigSchema = z.object({
  name: z.string().trim().min(1).max(40),
  /** Informational marker of the built-in preset this provider was created from, if any. */
  preset: z.string().trim().min(1).max(30).optional(),
  apiKey: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !/[\r\n]/.test(value), { message: 'API key must be a single line' }),
  env: z
    .record(z.string(), envValueSchema)
    // Why a record-level refine instead of a key schema: zod surfaces key-schema failures as a
    // generic "Invalid key in record", which gives the user no idea which rule they broke.
    .refine((env) => Object.keys(env).every((key) => CC_PROVIDER_ENV_KEY_PATTERN.test(key)), {
      message: 'env keys must match ANTHROPIC_* / CLAUDE_CODE_* / API_TIMEOUT_MS'
    })
    .refine((env) => !Object.keys(env).some((key) => CC_PROVIDER_FORBIDDEN_ENV_KEYS.has(key)), {
      message: 'credentials belong in the apiKey field, not env'
    })
    .refine((env) => isValidBaseUrl(env.ANTHROPIC_BASE_URL), {
      message: 'env.ANTHROPIC_BASE_URL must be a valid URL'
    })
})

export type CcProviderConfig = z.infer<typeof CcProviderConfigSchema>

/** Patch shape for edits: every field optional; an omitted apiKey keeps the stored one. */
export const CcProviderPatchSchema = CcProviderConfigSchema.partial()

export type CcProviderPatch = z.infer<typeof CcProviderPatchSchema>

/** Redacted view safe to send to the renderer over IPC — never carries the apiKey. */
export type CcProviderPublicView = {
  id: CcProviderAgentId
  slug: string
  name: string
  preset?: string
  env: Record<string, string>
}
