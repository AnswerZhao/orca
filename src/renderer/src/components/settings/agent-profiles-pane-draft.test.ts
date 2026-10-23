import { describe, expect, it } from 'vitest'
import {
  AgentProfileConfigSchema,
  AgentProfilePatchSchema,
  type AgentProfilePublicView
} from '../../../../shared/agent-profile'
import {
  applyProfileName,
  applyProfileSlug,
  draftAddProfilePayload,
  draftBlankProfile,
  draftFromProfileView,
  draftUpdateProfilePatch,
  suggestAgentProfileSlug,
  validateAgentProfileDraft
} from './agent-profiles-pane-draft'

const VIEW: AgentProfilePublicView = {
  id: 'ap-reviewer',
  slug: 'reviewer',
  name: 'Reviewer',
  icon: 'shield',
  baseAgent: 'claude',
  llmSource: { kind: 'endpoint', endpoint: 'kimi' },
  model: 'kimi-k3',
  effort: 'high',
  permissionMode: 'plan',
  rolePrompt: 'Review diffs strictly.'
}

describe('slug suggestion', () => {
  it('derives a slug from ASCII names', () => {
    expect(suggestAgentProfileSlug('Code Reviewer')).toBe('code-reviewer')
    expect(suggestAgentProfileSlug('  GLM 架构师 v2 ')).toBe('glm-v2')
  })

  it('returns empty for names with no ASCII letters or digits', () => {
    expect(suggestAgentProfileSlug('架构师')).toBe('')
  })

  it('caps the slug at 30 chars without a trailing dash', () => {
    const slug = suggestAgentProfileSlug(`${'a'.repeat(29)} b`)
    expect(slug).toBe('a'.repeat(29))
  })
})

describe('name and slug editing', () => {
  it('a new profile slug follows the name until the slug is edited', () => {
    let draft = applyProfileName(draftBlankProfile(), 'Architect')
    expect(draft.slug).toBe('architect')
    draft = applyProfileSlug(draft, 'arch')
    draft = applyProfileName(draft, 'Lead Architect')
    expect(draft.slug).toBe('arch')
  })

  it('clearing the slug hands it back to the name suggestion', () => {
    let draft = applyProfileSlug(applyProfileName(draftBlankProfile(), 'Architect'), 'arch')
    draft = applyProfileSlug(draft, '')
    expect(draft).toMatchObject({ slug: 'architect', slugEdited: false })
  })

  it('renaming an existing profile never touches its slug', () => {
    const draft = applyProfileName(draftFromProfileView(VIEW), 'Strict Reviewer')
    expect(draft.slug).toBe('reviewer')
  })
})

describe('validation', () => {
  it('defaults validate once a name is set', () => {
    const draft = applyProfileName(draftBlankProfile(), 'Architect')
    expect(validateAgentProfileDraft(draft, [], [])).toBeNull()
  })

  it('requires a hand-typed slug for a name with no derivable slug', () => {
    const draft = applyProfileName(draftBlankProfile(), '架构师')
    expect(validateAgentProfileDraft(draft, [], [])).toMatch(/slug/i)
    expect(validateAgentProfileDraft(applyProfileSlug(draft, 'architect'), [], [])).toBeNull()
  })

  it('rejects empty names, bad and duplicate slugs', () => {
    expect(validateAgentProfileDraft(draftBlankProfile(), [], [])).toMatch(/Name/)
    const draft = applyProfileName(draftBlankProfile(), 'Architect')
    expect(validateAgentProfileDraft(applyProfileSlug(draft, 'Bad Slug'), [], [])).toMatch(/Slug/)
    expect(validateAgentProfileDraft(draft, ['architect'], [])).toMatch(/already exists/)
  })

  it('rejects an endpoint source that is no longer saved', () => {
    const draft = draftFromProfileView(VIEW)
    expect(validateAgentProfileDraft(draft, ['reviewer'], ['kimi'])).toBeNull()
    expect(validateAgentProfileDraft(draft, ['reviewer'], [])).toMatch(/kimi/)
  })

  it('surfaces schema errors such as a multi-token model', () => {
    const draft = {
      ...applyProfileName(draftBlankProfile(), 'Architect'),
      model: 'opus 4'
    }
    expect(validateAgentProfileDraft(draft, [], [])).toMatch(/single token/)
  })
})

describe('payloads', () => {
  it('add payload omits empty optional fields and parses with the shared schema', () => {
    const draft = applyProfileName(draftBlankProfile(), 'Architect')
    const { slug, config } = draftAddProfilePayload({
      ...draft,
      rolePrompt: '  '
    })
    expect(slug).toBe('architect')
    expect(config).toEqual({
      name: 'Architect',
      icon: 'sparkles',
      baseAgent: 'claude',
      llmSource: { kind: 'subscription' },
      permissionMode: 'auto'
    })
    expect(AgentProfileConfigSchema.safeParse(config).success).toBe(true)
  })

  it('edit round-trips a view into an equivalent patch', () => {
    const { slug, patch } = draftUpdateProfilePatch(draftFromProfileView(VIEW))
    expect(slug).toBe('reviewer')
    expect(patch).toEqual({
      name: 'Reviewer',
      icon: 'shield',
      llmSource: { kind: 'endpoint', endpoint: 'kimi' },
      model: 'kimi-k3',
      effort: 'high',
      permissionMode: 'plan',
      rolePrompt: 'Review diffs strictly.'
    })
  })

  it('edit sends null for cleared optional fields and switches to subscription', () => {
    const draft = {
      ...draftFromProfileView(VIEW),
      endpoint: '',
      model: '',
      effort: '' as const,
      rolePrompt: ''
    }
    const { patch } = draftUpdateProfilePatch(draft)
    expect(patch).toMatchObject({
      llmSource: { kind: 'subscription' },
      model: null,
      effort: null,
      rolePrompt: null
    })
    expect(AgentProfilePatchSchema.safeParse(patch).success).toBe(true)
  })
})
