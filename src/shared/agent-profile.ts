import { z } from 'zod'
import type { AgentProfileAgentId } from './agent-profile-agent-id'
import { LLM_ENDPOINT_SLUG_PATTERN } from './llm-endpoint'

/** File stem of `~/.orca/agent-profiles/{slug}.json`; becomes the `ap-${slug}` agent id suffix. */
export const AGENT_PROFILE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,29}$/

/** Icon keys the renderer maps to its own icon components. */
export const AGENT_PROFILE_ICONS = [
  'sparkles',
  'bot',
  'brain',
  'code',
  'compass',
  'shield',
  'bug',
  'rocket',
  'book',
  'pen'
] as const

export type AgentProfileIcon = (typeof AGENT_PROFILE_ICONS)[number]

/** `claude --effort` choices (Claude Code 2.1.309). */
export const AGENT_PROFILE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export type AgentProfileEffort = (typeof AGENT_PROFILE_EFFORTS)[number]

/** `claude --permission-mode` choices (Claude Code 2.1.309). */
export const AGENT_PROFILE_PERMISSION_MODES = [
  'manual',
  'acceptEdits',
  'auto',
  'plan',
  'dontAsk',
  'bypassPermissions'
] as const

export type AgentProfilePermissionMode = (typeof AGENT_PROFILE_PERMISSION_MODES)[number]

export const DEFAULT_AGENT_PROFILE_PERMISSION_MODE: AgentProfilePermissionMode = 'auto'

export const AGENT_PROFILE_ROLE_PROMPT_MAX_LENGTH = 20_000

/** Where the profile's model access comes from: the agent's own signed-in account, or a saved endpoint. */
export const AgentProfileLlmSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('subscription') }),
  z.object({
    kind: z.literal('endpoint'),
    endpoint: z.string().regex(LLM_ENDPOINT_SLUG_PATTERN, 'endpoint must be an endpoint slug')
  })
])

export type AgentProfileLlmSource = z.infer<typeof AgentProfileLlmSourceSchema>

export const AgentProfileConfigSchema = z.object({
  name: z.string().trim().min(1).max(40),
  icon: z.enum(AGENT_PROFILE_ICONS).default('sparkles'),
  baseAgent: z.literal('claude').default('claude'),
  llmSource: AgentProfileLlmSourceSchema,
  /** `--model` value; absent keeps the account default or the endpoint's ANTHROPIC_MODEL. */
  model: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^\S+$/, 'model must be a single token')
    .optional(),
  effort: z.enum(AGENT_PROFILE_EFFORTS).optional(),
  permissionMode: z
    .enum(AGENT_PROFILE_PERMISSION_MODES)
    .default(DEFAULT_AGENT_PROFILE_PERMISSION_MODE),
  /** Appended to Claude Code's system prompt; recorded per conversation, so edits reach new sessions only. */
  rolePrompt: z.string().trim().min(1).max(AGENT_PROFILE_ROLE_PROMPT_MAX_LENGTH).optional()
})

/** Parsed (defaults applied) profile as stored on disk. */
export type AgentProfileConfig = z.infer<typeof AgentProfileConfigSchema>

/** What callers send to create or replace a profile; defaulted fields may be omitted. */
export type AgentProfileConfigInput = z.input<typeof AgentProfileConfigSchema>

/** Patch shape for edits; `null` clears an optional field. */
export const AgentProfilePatchSchema = AgentProfileConfigSchema.extend({
  model: AgentProfileConfigSchema.shape.model.unwrap().nullable(),
  effort: AgentProfileConfigSchema.shape.effort.unwrap().nullable(),
  rolePrompt: AgentProfileConfigSchema.shape.rolePrompt.unwrap().nullable(),
  icon: z.enum(AGENT_PROFILE_ICONS),
  permissionMode: z.enum(AGENT_PROFILE_PERMISSION_MODES)
})
  .omit({ baseAgent: true })
  .partial()

export type AgentProfilePatch = z.infer<typeof AgentProfilePatchSchema>

/** Profiles hold no secrets, so the IPC view is the full config plus its identity. */
export type AgentProfilePublicView = AgentProfileConfig & {
  id: AgentProfileAgentId
  slug: string
}
