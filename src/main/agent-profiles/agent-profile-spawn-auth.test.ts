import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareClaudeLaunchAuth, resolveAgentProfileSpawnAuth } from './agent-profile-spawn-auth'
import { saveAgentProfile, type AgentProfileStoreDirs } from './agent-profile-store'
import { deleteLlmEndpoint, saveLlmEndpoint } from './llm-endpoint-store'

const KIMI = {
  name: 'Kimi',
  apiKey: 'sk-test-key',
  env: {
    ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic',
    ANTHROPIC_MODEL: 'kimi-k3',
    API_TIMEOUT_MS: '3000000'
  }
}

let root: string
let dirs: AgentProfileStoreDirs

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-ap-spawn-auth-'))
  dirs = {
    profiles: join(root, 'agent-profiles'),
    endpoints: join(root, 'llm-endpoints')
  }
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('resolveAgentProfileSpawnAuth', () => {
  it('leaves a subscription profile on the account auth path', () => {
    saveAgentProfile('architect', { name: 'Architect', llmSource: { kind: 'subscription' } }, dirs)
    expect(resolveAgentProfileSpawnAuth('ap-architect', dirs)).toEqual({
      kind: 'subscription'
    })
  })

  it('returns the endpoint env plus ANTHROPIC_AUTH_TOKEN for an endpoint profile', () => {
    saveLlmEndpoint('kimi', KIMI, dirs.endpoints)
    saveAgentProfile(
      'coder',
      { name: 'Coder', llmSource: { kind: 'endpoint', endpoint: 'kimi' } },
      dirs
    )
    expect(resolveAgentProfileSpawnAuth('ap-coder', dirs)).toEqual({
      kind: 'endpoint',
      env: { ...KIMI.env, ANTHROPIC_AUTH_TOKEN: KIMI.apiKey }
    })
  })

  it('throws when the referenced endpoint no longer exists', () => {
    saveLlmEndpoint('kimi', KIMI, dirs.endpoints)
    saveAgentProfile(
      'coder',
      { name: 'Coder', llmSource: { kind: 'endpoint', endpoint: 'kimi' } },
      dirs
    )
    deleteLlmEndpoint('kimi', dirs.endpoints)
    expect(() => resolveAgentProfileSpawnAuth('ap-coder', dirs)).toThrow(
      /LLM endpoint "kimi", which no longer exists/
    )
  })

  it('returns null for built-in agents, unknown profiles, and non-strings', () => {
    expect(resolveAgentProfileSpawnAuth('claude', dirs)).toBeNull()
    expect(resolveAgentProfileSpawnAuth('ap-ghost', dirs)).toBeNull()
    expect(resolveAgentProfileSpawnAuth('ap-', dirs)).toBeNull()
    expect(resolveAgentProfileSpawnAuth('cc-kimi', dirs)).toBeNull()
    expect(resolveAgentProfileSpawnAuth(undefined, dirs)).toBeNull()
    expect(resolveAgentProfileSpawnAuth(42, dirs)).toBeNull()
  })
})

describe('prepareClaudeLaunchAuth', () => {
  const ACCOUNT_AUTH = { envPatch: { CLAUDE_CONFIG_DIR: '/acct' } }

  beforeEach(() => {
    saveLlmEndpoint('kimi', KIMI, dirs.endpoints)
    saveAgentProfile('architect', { name: 'Architect', llmSource: { kind: 'subscription' } }, dirs)
    saveAgentProfile(
      'coder',
      { name: 'Coder', llmSource: { kind: 'endpoint', endpoint: 'kimi' } },
      dirs
    )
  })

  async function prepare(launchAgent: unknown, isClaudeLaunch = true) {
    const prepareClaudeAuth = vi.fn(async () => ACCOUNT_AUTH)
    const result = await prepareClaudeLaunchAuth({
      isClaudeLaunch,
      launchAgent,
      prepareClaudeAuth,
      dirs
    })
    return { result, prepareClaudeAuth }
  }

  it('runs account auth and injects no env for a subscription profile', async () => {
    const { result, prepareClaudeAuth } = await prepare('ap-architect')
    expect(result).toEqual({ llmEndpointEnv: null, claudeAuth: ACCOUNT_AUTH })
    expect(prepareClaudeAuth).toHaveBeenCalledOnce()
  })

  it('injects the endpoint env and skips account auth for an endpoint profile', async () => {
    const { result, prepareClaudeAuth } = await prepare('ap-coder')
    expect(result).toEqual({
      llmEndpointEnv: { ...KIMI.env, ANTHROPIC_AUTH_TOKEN: KIMI.apiKey },
      claudeAuth: null
    })
    expect(prepareClaudeAuth).not.toHaveBeenCalled()
  })

  it('keeps plain claude on account auth and skips non-claude launches entirely', async () => {
    expect((await prepare('claude')).result.claudeAuth).toBe(ACCOUNT_AUTH)
    const nonClaude = await prepare('ap-coder', false)
    expect(nonClaude.result).toEqual({
      llmEndpointEnv: null,
      claudeAuth: null
    })
    expect(nonClaude.prepareClaudeAuth).not.toHaveBeenCalled()
  })

  it('fails the launch when the endpoint is gone instead of falling back to the account', async () => {
    deleteLlmEndpoint('kimi', dirs.endpoints)
    await expect(prepare('ap-coder')).rejects.toThrow(/no longer exists/)
  })
})
