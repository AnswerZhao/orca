import { describe, expect, it } from 'vitest'
import {
  AGENT_PROFILE_ROLE_PROMPT_MAX_LENGTH,
  AgentProfileConfigSchema,
  AgentProfilePatchSchema
} from './agent-profile'
import {
  agentProfileAgentId,
  agentProfileSlugFromAgentId,
  isAgentProfileAgentId
} from './agent-profile-agent-id'

const SUBSCRIPTION = { kind: 'subscription' } as const

describe('AgentProfileConfigSchema', () => {
  it('fills defaults for a minimal profile', () => {
    expect(AgentProfileConfigSchema.parse({ name: 'Architect', llmSource: SUBSCRIPTION })).toEqual({
      name: 'Architect',
      icon: 'sparkles',
      baseAgent: 'claude',
      llmSource: SUBSCRIPTION,
      permissionMode: 'auto'
    })
  })

  it('accepts a full endpoint-backed profile', () => {
    const profile = {
      name: '审查员',
      icon: 'shield',
      baseAgent: 'claude',
      llmSource: { kind: 'endpoint', endpoint: 'kimi' },
      model: 'opus[1m]',
      effort: 'xhigh',
      permissionMode: 'plan',
      rolePrompt: 'You review code; never edit files.'
    }
    expect(AgentProfileConfigSchema.parse(profile)).toEqual(profile)
  })

  it('rejects unknown modes, efforts, icons and agents', () => {
    const base = { name: 'X', llmSource: SUBSCRIPTION }
    for (const bad of [
      { permissionMode: 'default' },
      { effort: 'ultra' },
      { icon: 'unicorn' },
      { baseAgent: 'codex' }
    ]) {
      expect(
        AgentProfileConfigSchema.safeParse({ ...base, ...bad }).success,
        JSON.stringify(bad)
      ).toBe(false)
    }
  })

  it('rejects a model with whitespace and a bad endpoint slug', () => {
    expect(
      AgentProfileConfigSchema.safeParse({ name: 'X', llmSource: SUBSCRIPTION, model: 'opus --x' })
        .success
    ).toBe(false)
    expect(
      AgentProfileConfigSchema.safeParse({
        name: 'X',
        llmSource: { kind: 'endpoint', endpoint: '-x' }
      }).success
    ).toBe(false)
  })

  it('treats a blank role prompt as invalid and caps its length', () => {
    const base = { name: 'X', llmSource: SUBSCRIPTION }
    expect(AgentProfileConfigSchema.safeParse({ ...base, rolePrompt: '  ' }).success).toBe(false)
    expect(
      AgentProfileConfigSchema.safeParse({
        ...base,
        rolePrompt: 'a'.repeat(AGENT_PROFILE_ROLE_PROMPT_MAX_LENGTH + 1)
      }).success
    ).toBe(false)
  })
})

describe('AgentProfilePatchSchema', () => {
  it('applies no defaults, so an empty patch changes nothing', () => {
    expect(AgentProfilePatchSchema.parse({})).toEqual({})
  })

  it('uses null to clear optional fields', () => {
    expect(AgentProfilePatchSchema.parse({ model: null, effort: null, rolePrompt: null })).toEqual({
      model: null,
      effort: null,
      rolePrompt: null
    })
  })

  it('cannot change the base agent', () => {
    expect(AgentProfilePatchSchema.parse({ baseAgent: 'codex' })).toEqual({})
  })
})

describe('agent profile agent id', () => {
  it('round-trips a slug through the ap- prefix', () => {
    const id = agentProfileAgentId('architect')
    expect(id).toBe('ap-architect')
    expect(isAgentProfileAgentId(id)).toBe(true)
    expect(agentProfileSlugFromAgentId(id)).toBe('architect')
    expect(isAgentProfileAgentId('ap-')).toBe(false)
    expect(isAgentProfileAgentId('cc-kimi')).toBe(false)
  })
})
