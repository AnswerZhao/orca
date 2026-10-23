import {
  AGENT_PROFILE_SLUG_PATTERN,
  AgentProfileConfigSchema,
  DEFAULT_AGENT_PROFILE_PERMISSION_MODE,
  type AgentProfileConfigInput,
  type AgentProfileEffort,
  type AgentProfileIcon,
  type AgentProfilePatch,
  type AgentProfilePermissionMode,
  type AgentProfilePublicView
} from '../../../../shared/agent-profile'
import { translate } from '@/i18n/i18n'

/** Claude Code `--model` aliases offered when the profile runs on the signed-in subscription. */
export const AGENT_PROFILE_SUBSCRIPTION_MODEL_SUGGESTIONS = [
  'opus',
  'sonnet',
  'haiku',
  'fable'
] as const

export type AgentProfileDraft = {
  mode: 'add' | 'edit'
  /** Locked after creation — it names the on-disk file and the `ap-{slug}` agent id. */
  slug: string
  /** Once the user types a slug, renaming the profile stops overwriting it. */
  slugEdited: boolean
  name: string
  icon: AgentProfileIcon
  /** Endpoint slug the profile runs against; empty means the Claude account subscription. */
  endpoint: string
  /** Empty keeps the account default, or the endpoint's ANTHROPIC_MODEL. */
  model: string
  /** Empty leaves Claude Code's own effort default. */
  effort: AgentProfileEffort | ''
  permissionMode: AgentProfilePermissionMode
  rolePrompt: string
}

/**
 * Suggested slug for a profile name; empty when the name has no ASCII letters or digits
 * (e.g. a Chinese name), in which case the user must type one.
 */
export function suggestAgentProfileSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, 30)
    .replace(/-+$/, '')
}

export function draftBlankProfile(): AgentProfileDraft {
  return {
    mode: 'add',
    slug: '',
    slugEdited: false,
    name: '',
    icon: 'sparkles',
    endpoint: '',
    model: '',
    effort: '',
    permissionMode: DEFAULT_AGENT_PROFILE_PERMISSION_MODE,
    rolePrompt: ''
  }
}

export function draftFromProfileView(view: AgentProfilePublicView): AgentProfileDraft {
  return {
    mode: 'edit',
    slug: view.slug,
    slugEdited: true,
    name: view.name,
    icon: view.icon,
    endpoint: view.llmSource.kind === 'endpoint' ? view.llmSource.endpoint : '',
    model: view.model ?? '',
    effort: view.effort ?? '',
    permissionMode: view.permissionMode,
    rolePrompt: view.rolePrompt ?? ''
  }
}

/** Renaming a new profile keeps the slug in step with the name until the user edits the slug. */
export function applyProfileName(draft: AgentProfileDraft, name: string): AgentProfileDraft {
  const followsName = draft.mode === 'add' && !draft.slugEdited
  return {
    ...draft,
    name,
    ...(followsName ? { slug: suggestAgentProfileSlug(name) } : {})
  }
}

export function applyProfileSlug(draft: AgentProfileDraft, slug: string): AgentProfileDraft {
  // Why: clearing the field hands the slug back to the name-derived suggestion.
  return slug.trim()
    ? { ...draft, slug, slugEdited: true }
    : {
        ...draft,
        slug: suggestAgentProfileSlug(draft.name),
        slugEdited: false
      }
}

function draftConfigInput(draft: AgentProfileDraft): AgentProfileConfigInput {
  const model = draft.model.trim()
  const rolePrompt = draft.rolePrompt.trim()
  return {
    name: draft.name.trim(),
    icon: draft.icon,
    baseAgent: 'claude',
    llmSource: draft.endpoint
      ? { kind: 'endpoint', endpoint: draft.endpoint }
      : { kind: 'subscription' },
    ...(model ? { model } : {}),
    ...(draft.effort ? { effort: draft.effort } : {}),
    permissionMode: draft.permissionMode,
    ...(rolePrompt ? { rolePrompt } : {})
  }
}

/** Returns the first problem that blocks saving, or null. */
export function validateAgentProfileDraft(
  draft: AgentProfileDraft,
  existingSlugs: readonly string[],
  endpointSlugs: readonly string[]
): string | null {
  if (!draft.name.trim()) {
    return translate('auto.components.settings.AgentProfilesPane.nameRequired', 'Name is required')
  }
  if (draft.mode === 'add') {
    const slug = draft.slug.trim()
    if (!slug) {
      return translate(
        'auto.components.settings.AgentProfilesPane.slugRequired',
        'Enter a slug: the name has no letters or digits to derive one from'
      )
    }
    if (!AGENT_PROFILE_SLUG_PATTERN.test(slug)) {
      return translate(
        'auto.components.settings.AgentProfilesPane.slugInvalid',
        'Slug: 1-30 chars of lowercase letters, digits, or dashes; starts with a letter or digit'
      )
    }
    if (existingSlugs.includes(slug)) {
      return translate(
        'auto.components.settings.AgentProfilesPane.slugTaken',
        'Slug "{{slug}}" already exists — pick another slug',
        { slug }
      )
    }
  }
  if (draft.endpoint && !endpointSlugs.includes(draft.endpoint)) {
    return translate(
      'auto.components.settings.AgentProfilesPane.endpointMissing',
      'Endpoint "{{endpoint}}" no longer exists — pick another model source',
      { endpoint: draft.endpoint }
    )
  }
  const result = AgentProfileConfigSchema.safeParse(draftConfigInput(draft))
  return result.success
    ? null
    : (result.error.issues[0]?.message ??
        translate('auto.components.settings.AgentProfilesPane.invalid', 'Invalid profile'))
}

export function draftAddProfilePayload(draft: AgentProfileDraft): {
  slug: string
  config: AgentProfileConfigInput
} {
  return { slug: draft.slug.trim(), config: draftConfigInput(draft) }
}

/** Edit payload: emptied optional fields are sent as null so the stored values are cleared. */
export function draftUpdateProfilePatch(draft: AgentProfileDraft): {
  slug: string
  patch: AgentProfilePatch
} {
  const config = draftConfigInput(draft)
  return {
    slug: draft.slug,
    patch: {
      name: config.name,
      icon: draft.icon,
      llmSource: config.llmSource,
      model: config.model ?? null,
      effort: config.effort ?? null,
      permissionMode: draft.permissionMode,
      rolePrompt: config.rolePrompt ?? null
    }
  }
}
