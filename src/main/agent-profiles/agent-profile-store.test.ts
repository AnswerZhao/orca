import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isTuiAgent, TUI_AGENT_CONFIG } from '../../shared/tui-agent-config'
import { tuiAgentDisplayName } from '../../shared/tui-agent-display-names'
import {
  listDynamicTuiAgentIds,
  resolveDynamicDetectedTuiAgentIds,
  unregisterDynamicTuiAgent
} from '../../shared/tui-agent-dynamic-registry'
import { syncAgentProfileAgents } from './agent-profile-agent-registration'
import {
  agentProfilePromptsDir,
  deleteAgentProfile,
  deleteUnreferencedLlmEndpoint,
  getAgentProfile,
  listAgentProfiles,
  saveAgentProfile,
  updateAgentProfile,
  type AgentProfileStoreDirs
} from './agent-profile-store'
import { getLlmEndpoint, saveLlmEndpoint } from './llm-endpoint-store'

const KIMI_ENDPOINT = {
  name: 'Kimi',
  apiKey: 'sk-test-key',
  env: {
    ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic',
    ANTHROPIC_MODEL: 'kimi-k3'
  }
}

const ARCHITECT = {
  name: 'Architect',
  icon: 'compass',
  llmSource: { kind: 'subscription' },
  model: 'opus',
  effort: 'high',
  rolePrompt: 'You design systems.'
}

let root: string
let dirs: AgentProfileStoreDirs

function promptFiles(): string[] {
  const dir = agentProfilePromptsDir(dirs.profiles)
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-agent-profiles-'))
  dirs = {
    profiles: join(root, 'agent-profiles'),
    endpoints: join(root, 'llm-endpoints')
  }
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  for (const id of listDynamicTuiAgentIds()) {
    unregisterDynamicTuiAgent(id)
  }
})

describe('agent-profile-store', () => {
  it('saves a profile with schema defaults applied and lists it back', () => {
    const saved = saveAgentProfile('architect', ARCHITECT, dirs)
    expect(saved).toMatchObject({
      ...ARCHITECT,
      slug: 'architect',
      id: 'ap-architect',
      baseAgent: 'claude',
      permissionMode: 'auto'
    })
    expect(
      JSON.parse(readFileSync(join(dirs.profiles, 'architect.json'), 'utf8'))
    ).not.toHaveProperty('slug')
    expect(listAgentProfiles(dirs.profiles).map((profile) => profile.id)).toEqual(['ap-architect'])
  })

  it('skips invalid files and bad slugs, and ignores the prompts dir', () => {
    saveAgentProfile('architect', ARCHITECT, dirs)
    writeFileSync(join(dirs.profiles, 'broken.json'), '{not json')
    writeFileSync(join(dirs.profiles, 'noname.json'), JSON.stringify({ ...ARCHITECT, name: '' }))
    writeFileSync(join(dirs.profiles, 'Bad Slug.json'), JSON.stringify(ARCHITECT))
    expect(listAgentProfiles(dirs.profiles).map((profile) => profile.slug)).toEqual(['architect'])
    expect(listAgentProfiles(join(root, 'missing'))).toEqual([])
  })

  it('rejects invalid slugs and a reference to a missing endpoint', () => {
    expect(() => saveAgentProfile('../evil', ARCHITECT, dirs)).toThrow(/slug/)
    expect(() =>
      saveAgentProfile(
        'coder',
        { ...ARCHITECT, llmSource: { kind: 'endpoint', endpoint: 'kimi' } },
        dirs
      )
    ).toThrow(/"kimi" does not exist/)
    saveLlmEndpoint('kimi', KIMI_ENDPOINT, dirs.endpoints)
    expect(
      saveAgentProfile(
        'coder',
        { ...ARCHITECT, llmSource: { kind: 'endpoint', endpoint: 'kimi' } },
        dirs
      ).llmSource
    ).toEqual({ kind: 'endpoint', endpoint: 'kimi' })
  })

  it('writes the role prompt to a 0600 content-addressed file', () => {
    saveAgentProfile('architect', ARCHITECT, dirs)
    const [file] = promptFiles()
    expect(file).toMatch(/^architect-[0-9a-f]{12}\.md$/)
    const path = join(agentProfilePromptsDir(dirs.profiles), file)
    expect(readFileSync(path, 'utf8')).toBe(ARCHITECT.rolePrompt)
    expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  it('prunes stale prompt files of the same slug only', () => {
    saveAgentProfile('dev', { ...ARCHITECT, rolePrompt: 'one' }, dirs)
    saveAgentProfile('dev-ops', { ...ARCHITECT, rolePrompt: 'ops' }, dirs)
    const devOps = promptFiles().find((file) => file.startsWith('dev-ops-'))
    updateAgentProfile('dev', { rolePrompt: 'two' }, dirs)
    const files = promptFiles()
    expect(files).toHaveLength(2)
    expect(files).toContain(devOps)
    updateAgentProfile('dev', { rolePrompt: null }, dirs)
    expect(promptFiles()).toEqual([devOps])
  })

  it('updates fields, clears optional fields with null, and keeps the rest', () => {
    saveAgentProfile('architect', ARCHITECT, dirs)
    const updated = updateAgentProfile(
      'architect',
      { name: 'Lead', model: null, permissionMode: 'plan' },
      dirs
    )
    expect(updated).toMatchObject({
      name: 'Lead',
      effort: 'high',
      permissionMode: 'plan'
    })
    expect(updated).not.toHaveProperty('model')
    expect(getAgentProfile('architect', dirs.profiles)).not.toHaveProperty('model')
  })

  it('rejects patches on missing profiles and invalid patches', () => {
    expect(() => updateAgentProfile('ghost', { name: 'x' }, dirs)).toThrow(/does not exist/)
    saveAgentProfile('architect', ARCHITECT, dirs)
    expect(() => updateAgentProfile('architect', { effort: 'extreme' }, dirs)).toThrow(/patch/)
    expect(() => updateAgentProfile('architect', { baseAgent: 'codex' }, dirs)).not.toThrow()
    expect(getAgentProfile('architect', dirs.profiles)?.baseAgent).toBe('claude')
  })

  it('deletes the profile and its prompt files', () => {
    saveAgentProfile('architect', ARCHITECT, dirs)
    expect(deleteAgentProfile('architect', dirs.profiles)).toBe(true)
    expect(getAgentProfile('architect', dirs.profiles)).toBeNull()
    expect(promptFiles()).toEqual([])
    expect(deleteAgentProfile('architect', dirs.profiles)).toBe(false)
    expect(deleteAgentProfile('../outside', dirs.profiles)).toBe(false)
  })
})

describe('deleteUnreferencedLlmEndpoint', () => {
  it('refuses while a profile references the endpoint, then deletes once it is free', () => {
    saveLlmEndpoint('kimi', KIMI_ENDPOINT, dirs.endpoints)
    saveAgentProfile(
      'coder',
      {
        ...ARCHITECT,
        name: 'Coder',
        llmSource: { kind: 'endpoint', endpoint: 'kimi' }
      },
      dirs
    )
    expect(() => deleteUnreferencedLlmEndpoint('kimi', dirs)).toThrow(
      /used by agent profile "Coder"/
    )
    expect(getLlmEndpoint('kimi', dirs.endpoints)).not.toBeNull()
    updateAgentProfile('coder', { llmSource: { kind: 'subscription' } }, dirs)
    expect(deleteUnreferencedLlmEndpoint('kimi', dirs)).toBe(true)
    expect(getLlmEndpoint('kimi', dirs.endpoints)).toBeNull()
  })
})

describe('syncAgentProfileAgents', () => {
  it('registers ap-* agents named after the profile and unregisters removed ones', () => {
    expect(isTuiAgent('ap-architect')).toBe(false)
    saveAgentProfile('architect', ARCHITECT, dirs)
    expect(syncAgentProfileAgents(dirs.profiles)).toEqual(['ap-architect'])
    expect(isTuiAgent('ap-architect')).toBe(true)
    expect(tuiAgentDisplayName('ap-architect')).toBe('Architect')
    expect(Object.entries(TUI_AGENT_CONFIG)).toContainEqual([
      'ap-architect',
      TUI_AGENT_CONFIG.claude
    ])
    // Installed-agent detection reports a profile agent exactly when its claude CLI is found.
    expect(resolveDynamicDetectedTuiAgentIds(new Set(['claude']), 'darwin')).toEqual([
      'ap-architect'
    ])
    expect(resolveDynamicDetectedTuiAgentIds(new Set(['codex']), 'darwin')).toEqual([])
    deleteAgentProfile('architect', dirs.profiles)
    expect(syncAgentProfileAgents(dirs.profiles)).toEqual([])
    expect(isTuiAgent('ap-architect')).toBe(false)
  })
})
