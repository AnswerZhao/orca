import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  AGENT_PROFILE_SLUG_PATTERN,
  AgentProfileConfigSchema,
  AgentProfilePatchSchema,
  type AgentProfileConfig,
  type AgentProfilePublicView
} from '../../shared/agent-profile'
import { agentProfileAgentId, type AgentProfileAgentId } from '../../shared/agent-profile-agent-id'
import { writeSecureFile, writeSecureJsonFile } from '../../shared/secure-file'
import { deleteLlmEndpoint, getLlmEndpoint, llmEndpointsDir } from './llm-endpoint-store'

export type AgentProfile = AgentProfileConfig & {
  slug: string
  id: AgentProfileAgentId
}

/** Profiles reference endpoints, so the stores that check those references take both dirs. */
export type AgentProfileStoreDirs = { profiles: string; endpoints: string }

export function agentProfilesDir(): string {
  return join(homedir(), '.orca', 'agent-profiles')
}

export function defaultAgentProfileStoreDirs(): AgentProfileStoreDirs {
  return { profiles: agentProfilesDir(), endpoints: llmEndpointsDir() }
}

function profilePath(slug: string, dir: string): string {
  return join(dir, `${slug}.json`)
}

/** Role prompt files live beside the profiles; the dot keeps them out of the `*.json` scan. */
export function agentProfilePromptsDir(profilesDir: string = agentProfilesDir()): string {
  return join(profilesDir, '.prompts')
}

function rolePromptFileName(slug: string, rolePrompt: string): string {
  const sha12 = createHash('sha256').update(rolePrompt).digest('hex').slice(0, 12)
  return `${slug}-${sha12}.md`
}

/** Matches `<slug>-<sha12>.md` for exactly this slug, so `dev` never claims `dev-ops-…` files. */
function isRolePromptFileOf(slug: string, entry: string): boolean {
  return new RegExp(`^${slug}-[0-9a-f]{12}\\.md$`).test(entry)
}

function toAgentProfile(slug: string, config: AgentProfileConfig): AgentProfile {
  return { ...config, slug, id: agentProfileAgentId(slug) }
}

/** Reads and validates every `*.json` in the profile dir; unreadable or invalid files are skipped with a warning. */
export function listAgentProfiles(dir: string = agentProfilesDir()): AgentProfile[] {
  if (!existsSync(dir)) {
    return []
  }
  const profiles: AgentProfile[] = []
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json')) {
      continue
    }
    const slug = entry.slice(0, -'.json'.length)
    if (!AGENT_PROFILE_SLUG_PATTERN.test(slug)) {
      console.warn(`[agent-profiles] Skipping ${entry}: file stem is not a valid profile slug`)
      continue
    }
    try {
      const parsed = AgentProfileConfigSchema.safeParse(
        JSON.parse(readFileSync(join(dir, entry), 'utf8'))
      )
      if (!parsed.success) {
        console.warn(
          `[agent-profiles] Skipping ${entry}: ${parsed.error.issues[0]?.message ?? 'invalid profile config'}`
        )
        continue
      }
      profiles.push(toAgentProfile(slug, parsed.data))
    } catch (error) {
      console.warn(`[agent-profiles] Skipping unreadable profile file ${entry}:`, error)
    }
  }
  return profiles.sort((a, b) => a.slug.localeCompare(b.slug))
}

export function getAgentProfile(
  slug: string,
  dir: string = agentProfilesDir()
): AgentProfile | null {
  return listAgentProfiles(dir).find((profile) => profile.slug === slug) ?? null
}

export function toAgentProfilePublicView(profile: AgentProfile): AgentProfilePublicView {
  return { ...profile }
}

/**
 * Writes the profile's role prompt to its content-addressed file and returns the path.
 * Same content, same path: a resumed session's file is still there after unrelated edits.
 */
export function ensureAgentProfileRolePromptFile(
  slug: string,
  rolePrompt: string,
  profilesDir: string = agentProfilesDir()
): string {
  const path = join(agentProfilePromptsDir(profilesDir), rolePromptFileName(slug, rolePrompt))
  if (!existsSync(path) && !writeSecureFile(path, rolePrompt)) {
    console.warn(`[agent-profiles] Role prompt file could not be restricted to this user: ${path}`)
  }
  return path
}

/** Deletes this slug's prompt files other than `keep`, e.g. after an edit or a delete. */
function pruneRolePromptFiles(slug: string, profilesDir: string, keep?: string): void {
  const dir = agentProfilePromptsDir(profilesDir)
  if (!existsSync(dir)) {
    return
  }
  for (const entry of readdirSync(dir)) {
    if (entry !== keep && isRolePromptFileOf(slug, entry)) {
      rmSync(join(dir, entry), { force: true })
    }
  }
}

function assertEndpointExists(config: AgentProfileConfig, endpointsDir: string): void {
  if (
    config.llmSource.kind === 'endpoint' &&
    !getLlmEndpoint(config.llmSource.endpoint, endpointsDir)
  ) {
    throw new Error(`LLM endpoint "${config.llmSource.endpoint}" does not exist`)
  }
}

export function saveAgentProfile(
  slug: string,
  input: unknown,
  dirs: AgentProfileStoreDirs = defaultAgentProfileStoreDirs()
): AgentProfile {
  if (!AGENT_PROFILE_SLUG_PATTERN.test(slug)) {
    throw new Error(
      'Profile slug must be 1-30 chars of lowercase letters, digits, or dashes, starting with a letter or digit'
    )
  }
  const parsed = AgentProfileConfigSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Invalid profile config: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
  }
  assertEndpointExists(parsed.data, dirs.endpoints)
  writeSecureJsonFile(profilePath(slug, dirs.profiles), parsed.data)
  if (parsed.data.rolePrompt) {
    ensureAgentProfileRolePromptFile(slug, parsed.data.rolePrompt, dirs.profiles)
  }
  pruneRolePromptFiles(
    slug,
    dirs.profiles,
    parsed.data.rolePrompt ? rolePromptFileName(slug, parsed.data.rolePrompt) : undefined
  )
  return toAgentProfile(slug, parsed.data)
}

/** Applies a partial patch to an existing profile; `null` clears an optional field. */
export function updateAgentProfile(
  slug: string,
  patch: unknown,
  dirs: AgentProfileStoreDirs = defaultAgentProfileStoreDirs()
): AgentProfile {
  const existing = getAgentProfile(slug, dirs.profiles)
  if (!existing) {
    throw new Error(`Profile "${slug}" does not exist`)
  }
  const parsed = AgentProfilePatchSchema.safeParse(patch)
  if (!parsed.success) {
    throw new Error(`Invalid profile patch: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
  }
  const { slug: _slug, id: _id, ...merged } = existing
  const next: Record<string, unknown> = { ...merged }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === null) {
      delete next[key]
    } else if (value !== undefined) {
      next[key] = value
    }
  }
  return saveAgentProfile(slug, next, dirs)
}

export function deleteAgentProfile(slug: string, dir: string = agentProfilesDir()): boolean {
  if (!AGENT_PROFILE_SLUG_PATTERN.test(slug)) {
    return false
  }
  const path = profilePath(slug, dir)
  if (!existsSync(path)) {
    return false
  }
  rmSync(path)
  pruneRolePromptFiles(slug, dir)
  return true
}

/** Deletes an endpoint only when no profile references it, so no profile is left unlaunchable. */
export function deleteUnreferencedLlmEndpoint(
  slug: string,
  dirs: AgentProfileStoreDirs = defaultAgentProfileStoreDirs()
): boolean {
  const referencing = listAgentProfiles(dirs.profiles).filter(
    (profile) => profile.llmSource.kind === 'endpoint' && profile.llmSource.endpoint === slug
  )
  if (referencing.length > 0) {
    throw new Error(
      `LLM endpoint "${slug}" is used by agent profile${referencing.length > 1 ? 's' : ''} ${referencing
        .map((profile) => `"${profile.name}"`)
        .join(', ')}`
    )
  }
  return deleteLlmEndpoint(slug, dirs.endpoints)
}
