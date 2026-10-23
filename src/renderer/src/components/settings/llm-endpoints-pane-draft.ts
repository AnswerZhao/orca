import { z } from 'zod'
import {
  LLM_ENDPOINT_SLUG_PATTERN,
  LlmEndpointConfigSchema,
  type LlmEndpointConfig,
  type LlmEndpointPublicView
} from '../../../../shared/llm-endpoint'
import type { LlmEndpointPreset } from '../../../../shared/llm-endpoint-presets'
import { translate } from '@/i18n/i18n'

/** Placeholder shown in place of the real key when editing; saving with it keeps the stored key. */
export const LLM_ENDPOINT_API_KEY_MASK = '••••••••'

/** Form columns edit only these env keys; everything else lives only in the JSON column. */
export const LLM_ENDPOINT_FORM_ENV_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL'
] as const

export type LlmEndpointFormEnvKey = (typeof LLM_ENDPOINT_FORM_ENV_KEYS)[number]

export type LlmEndpointDraft = {
  mode: 'add' | 'edit'
  /** Locked after creation — it names the on-disk file that agent profiles reference. */
  slug: string
  name: string
  preset?: string
  /** Empty on edit means "keep the stored key". */
  apiKey: string
  env: Record<string, string>
  /** Full JSON text of {name, preset?, apiKey, env} — the save-time source of truth. */
  json: string
  jsonError: string | null
}

/**
 * Loose shape of the JSON column while it is being edited (unknown keys pass through; the
 * strict LlmEndpointConfigSchema decides validity at save time). Parsed with zod instead of
 * type assertions so the quality gate's no-assertions rule holds.
 */
const DraftJsonSchema = z.looseObject({
  name: z.string().optional(),
  preset: z.string().optional(),
  apiKey: z.string().optional(),
  env: z.record(z.string(), z.string()).optional()
})

type ParsedDraftJson = z.infer<typeof DraftJsonSchema>

function parseDraftJson(text: string): {
  data: ParsedDraftJson | null
  error: string | null
} {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return {
      data: null,
      error: translate(
        'auto.components.settings.LlmEndpointsPane.invalidJson',
        'Invalid JSON syntax'
      )
    }
  }
  const result = DraftJsonSchema.safeParse(raw)
  return result.success
    ? { data: result.data, error: null }
    : {
        data: null,
        error: translate(
          'auto.components.settings.LlmEndpointsPane.jsonObjectRequired',
          'JSON must be an object with string fields'
        )
      }
}

function draftJson(draft: {
  name: string
  preset?: string
  apiKey: string
  env: Record<string, string>
  mode: 'add' | 'edit'
}): string {
  const apiKey = draft.apiKey || (draft.mode === 'edit' ? LLM_ENDPOINT_API_KEY_MASK : '')
  return JSON.stringify(
    {
      name: draft.name,
      ...(draft.preset ? { preset: draft.preset } : {}),
      apiKey,
      env: draft.env
    },
    null,
    2
  )
}

export function draftFromPreset(preset: LlmEndpointPreset): LlmEndpointDraft {
  const base = {
    mode: 'add' as const,
    slug: preset.key,
    name: preset.name,
    preset: preset.key,
    apiKey: '',
    env: { ...preset.env }
  }
  return { ...base, json: draftJson(base), jsonError: null }
}

export function draftBlank(): LlmEndpointDraft {
  const base = {
    mode: 'add' as const,
    slug: '',
    name: '',
    apiKey: '',
    env: {}
  }
  return { ...base, json: draftJson(base), jsonError: null }
}

export function draftFromView(view: LlmEndpointPublicView): LlmEndpointDraft {
  const base = {
    mode: 'edit' as const,
    slug: view.slug,
    name: view.name,
    ...(view.preset ? { preset: view.preset } : {}),
    apiKey: '',
    env: { ...view.env }
  }
  return { ...base, json: draftJson(base), jsonError: null }
}

export function slugifyLlmEndpointName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'custom'
  )
}

/** Form → JSON: merges the field into the draft and regenerates the JSON text, unless the
 *  JSON column is mid-edit with a syntax error (then it would clobber the user's text). */
export function applyDraftFormField(
  draft: LlmEndpointDraft,
  field: 'name' | 'apiKey' | 'slug' | LlmEndpointFormEnvKey,
  value: string
): LlmEndpointDraft {
  const next: LlmEndpointDraft = { ...draft, env: { ...draft.env } }
  if (field === 'name' || field === 'apiKey' || field === 'slug') {
    next[field] = value
  } else {
    const trimmed = value.trim()
    if (trimmed) {
      next.env[field] = trimmed
    } else {
      delete next.env[field]
    }
  }
  if (draft.jsonError === null) {
    next.json = draftJson(next)
  }
  return next
}

/** JSON → form: a parseable text refills the form fields; a broken one is flagged and the
 *  form stays untouched so the user can keep fixing the text. */
export function applyDraftJsonText(draft: LlmEndpointDraft, text: string): LlmEndpointDraft {
  const { data, error } = parseDraftJson(text)
  if (!data) {
    return { ...draft, json: text, jsonError: error }
  }
  const env = data.env ? { ...data.env } : draft.env
  const apiKey =
    data.apiKey !== undefined && data.apiKey !== LLM_ENDPOINT_API_KEY_MASK
      ? data.apiKey
      : draft.apiKey
  return {
    ...draft,
    json: text,
    jsonError: null,
    name: data.name ?? draft.name,
    env,
    apiKey
  }
}

/** Validates the JSON column (the save-time truth). Returns an error message, or null. */
export function validateLlmEndpointDraft(
  draft: LlmEndpointDraft,
  existingSlugs: readonly string[]
): string | null {
  if (draft.jsonError) {
    return draft.jsonError
  }
  const { data, error } = parseDraftJson(draft.json)
  if (!data) {
    return (
      error ??
      translate('auto.components.settings.LlmEndpointsPane.invalidJson', 'Invalid JSON syntax')
    )
  }
  const env = data.env ?? {}
  if (draft.mode === 'add') {
    const slug = draft.slug.trim() || slugifyLlmEndpointName(draft.name)
    if (!LLM_ENDPOINT_SLUG_PATTERN.test(slug)) {
      return 'Slug: 1-30 chars of lowercase letters, digits, or dashes; starts with a letter or digit'
    }
    if (existingSlugs.includes(slug)) {
      return `Slug "${slug}" already exists — rename or pick another slug`
    }
  }
  const apiKeyFromJson = data.apiKey?.trim() ?? ''
  const effectiveKey =
    draft.apiKey.trim() ||
    (apiKeyFromJson && apiKeyFromJson !== LLM_ENDPOINT_API_KEY_MASK ? apiKeyFromJson : '')
  if (draft.mode === 'add' && !effectiveKey) {
    return 'API key is required'
  }
  const candidate = {
    name: data.name ?? draft.name,
    ...(draft.preset ? { preset: draft.preset } : {}),
    // Why: on edit the key may stay on disk; validate the shape with a stand-in.
    apiKey: effectiveKey || 'sk-unchanged',
    env
  }
  const result = LlmEndpointConfigSchema.safeParse(candidate)
  return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid endpoint config')
}

function requireDraftJson(draft: LlmEndpointDraft): ParsedDraftJson {
  const { data } = parseDraftJson(draft.json)
  if (!data) {
    throw new Error('draft JSON must be valid before building a payload')
  }
  return data
}

export function draftAddPayload(draft: LlmEndpointDraft): {
  slug: string
  config: LlmEndpointConfig
} {
  const data = requireDraftJson(draft)
  const name = (data.name ?? draft.name).trim()
  const apiKey = draft.apiKey.trim() || (data.apiKey ?? '')
  return {
    slug: draft.slug.trim() || slugifyLlmEndpointName(name),
    config: {
      name,
      ...(draft.preset ? { preset: draft.preset } : {}),
      apiKey,
      env: data.env ?? {}
    }
  }
}

/** Edit payload: apiKey rides along only when the user typed a new one. */
export function draftUpdatePatch(draft: LlmEndpointDraft): {
  slug: string
  patch: {
    name: string
    preset?: string
    apiKey?: string
    env: Record<string, string>
  }
} {
  const data = requireDraftJson(draft)
  const jsonKey = data.apiKey?.trim() ?? ''
  const newKey =
    draft.apiKey.trim() || (jsonKey && jsonKey !== LLM_ENDPOINT_API_KEY_MASK ? jsonKey : '')
  return {
    slug: draft.slug,
    patch: {
      name: (data.name ?? draft.name).trim(),
      ...(draft.preset ? { preset: draft.preset } : {}),
      ...(newKey ? { apiKey: newKey } : {}),
      env: data.env ?? {}
    }
  }
}
