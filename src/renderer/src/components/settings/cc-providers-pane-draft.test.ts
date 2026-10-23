import { describe, expect, it } from 'vitest'
import type { CcProviderPublicView } from '../../../../shared/cc-provider'
import { CC_PROVIDER_PRESETS, getCcProviderPreset } from '../../../../shared/cc-provider-presets'
import {
  applyDraftFormField,
  applyDraftJsonText,
  CC_PROVIDER_API_KEY_MASK,
  draftBlank,
  draftFromPreset,
  draftFromView,
  draftAddPayload,
  draftUpdatePatch,
  slugifyCcProviderName,
  validateCcProviderDraft
} from './cc-providers-pane-draft'

const KIMI = getCcProviderPreset('kimi')!

const VIEW: CcProviderPublicView = {
  id: 'cc-kimi',
  slug: 'kimi',
  name: 'Kimi',
  preset: 'kimi',
  env: { ...KIMI.env }
}

describe('draft construction', () => {
  it('preset draft prefills everything but the apiKey', () => {
    const draft = draftFromPreset(KIMI)
    expect(draft).toMatchObject({
      mode: 'add',
      slug: 'kimi',
      name: 'Kimi',
      preset: 'kimi',
      apiKey: ''
    })
    expect(draft.env).toEqual(KIMI.env)
    expect(JSON.parse(draft.json).env).toEqual(KIMI.env)
  })

  it('edit draft masks the apiKey in the JSON column', () => {
    const draft = draftFromView(VIEW)
    expect(draft.mode).toBe('edit')
    expect(draft.apiKey).toBe('')
    expect(JSON.parse(draft.json).apiKey).toBe(CC_PROVIDER_API_KEY_MASK)
  })

  it('every preset produces a draft that validates once a key is typed', () => {
    for (const preset of CC_PROVIDER_PRESETS) {
      const draft = applyDraftFormField(draftFromPreset(preset), 'apiKey', 'sk-x')
      expect(validateCcProviderDraft(draft, []), preset.key).toBeNull()
    }
  })
})

describe('form → JSON sync', () => {
  it('merges form fields into the JSON text', () => {
    let draft = draftFromPreset(KIMI)
    draft = applyDraftFormField(draft, 'ANTHROPIC_MODEL', 'kimi-k3-turbo')
    draft = applyDraftFormField(draft, 'name', 'Kimi Turbo')
    const parsed = JSON.parse(draft.json)
    expect(parsed.env.ANTHROPIC_MODEL).toBe('kimi-k3-turbo')
    expect(parsed.name).toBe('Kimi Turbo')
    expect(parsed.env.API_TIMEOUT_MS).toBeUndefined()
  })

  it('clearing a form env field deletes the key from the JSON', () => {
    let draft = draftFromPreset(KIMI)
    draft = applyDraftFormField(draft, 'ANTHROPIC_SMALL_FAST_MODEL', '  ')
    expect(JSON.parse(draft.json).env.ANTHROPIC_SMALL_FAST_MODEL).toBeUndefined()
  })

  it('does not clobber a broken in-progress JSON edit', () => {
    let draft = draftFromPreset(KIMI)
    draft = applyDraftJsonText(draft, '{ "env": {')
    expect(draft.jsonError).toBeTruthy()
    draft = applyDraftFormField(draft, 'name', 'Other')
    expect(draft.json).toBe('{ "env": {')
  })
})

describe('JSON → form sync', () => {
  it('refills form fields from pasted JSON, including a real apiKey', () => {
    let draft = draftBlank()
    draft = applyDraftJsonText(
      draft,
      JSON.stringify({
        name: 'Pasted',
        apiKey: 'sk-pasted',
        env: { ANTHROPIC_BASE_URL: 'https://x.dev/anthropic' }
      })
    )
    expect(draft.jsonError).toBeNull()
    expect(draft.name).toBe('Pasted')
    expect(draft.apiKey).toBe('sk-pasted')
    expect(draft.env.ANTHROPIC_BASE_URL).toBe('https://x.dev/anthropic')
  })

  it('keeps the stored key when the JSON still shows the mask', () => {
    let draft = draftFromView(VIEW)
    draft = applyDraftJsonText(draft, draft.json.replace('kimi-k3', 'kimi-k3-turbo'))
    expect(draft.apiKey).toBe('')
    expect(draft.env.ANTHROPIC_MODEL).toBe('kimi-k3-turbo')
  })

  it('flags syntax errors and non-object JSON', () => {
    expect(applyDraftJsonText(draftBlank(), '{oops').jsonError).toBeTruthy()
    expect(applyDraftJsonText(draftBlank(), '[1]').jsonError).toBeTruthy()
  })
})

describe('validation', () => {
  it('requires an apiKey on add but not on edit', () => {
    expect(validateCcProviderDraft(draftFromPreset(KIMI), [])).toBe('API key is required')
    expect(validateCcProviderDraft(draftFromView(VIEW), ['kimi'])).toBeNull()
  })

  it('rejects duplicate and malformed slugs on add', () => {
    let draft = applyDraftFormField(draftFromPreset(KIMI), 'apiKey', 'sk-x')
    expect(validateCcProviderDraft(draft, ['kimi'])).toMatch(/already exists/)
    draft = applyDraftFormField(draft, 'slug', 'Bad Slug')
    expect(validateCcProviderDraft(draft, [])).toMatch(/Slug/)
  })

  it('rejects env whitelist violations coming from pasted JSON', () => {
    let draft = draftFromPreset(KIMI)
    draft = applyDraftFormField(draft, 'apiKey', 'sk-x')
    const parsed = JSON.parse(draft.json)
    parsed.env.PATH = '/evil'
    draft = applyDraftJsonText(draft, JSON.stringify(parsed))
    expect(validateCcProviderDraft(draft, [])).toMatch(/env keys must match/)
  })
})

describe('payloads', () => {
  it('add payload derives the slug from the name when left blank', () => {
    let draft = draftFromPreset(KIMI)
    draft = applyDraftFormField(draft, 'slug', '')
    draft = applyDraftFormField(draft, 'name', 'My Kimi')
    draft = applyDraftFormField(draft, 'apiKey', 'sk-x')
    expect(draftAddPayload(draft).slug).toBe('my-kimi')
  })

  it('update patch omits the apiKey unless a new one was typed', () => {
    const unchanged = draftUpdatePatch(draftFromView(VIEW))
    expect(unchanged.patch.apiKey).toBeUndefined()
    let draft = draftFromView(VIEW)
    draft = applyDraftFormField(draft, 'apiKey', 'sk-rotated')
    expect(draftUpdatePatch(draft).patch.apiKey).toBe('sk-rotated')
  })

  it('slugify keeps names within the slug pattern', () => {
    expect(slugifyCcProviderName('GLM 工作号')).toBe('glm')
    expect(slugifyCcProviderName('!!!')).toBe('custom')
  })
})
