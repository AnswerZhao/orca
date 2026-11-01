import { mkdtempSync, rmSync } from 'node:fs'
import type * as Os from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const home = vi.hoisted(() => ({ path: '' }))

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof Os>()
  return { ...actual, homedir: () => home.path || actual.homedir() }
})

import { syncAgentProfileAgents } from '../../agent-profiles/agent-profile-agent-registration'
import { saveAgentProfile } from '../../agent-profiles/agent-profile-store'
import {
  listDynamicTuiAgentIds,
  unregisterDynamicTuiAgent
} from '../../../shared/tui-agent-dynamic-registry'
import {
  assemblePtySpawnLaunchOptions,
  type PtySpawnLaunchOptionsInput
} from './spawn-options-assembly'

function launchInput(
  overrides: Partial<Omit<PtySpawnLaunchOptionsInput, 'args'>> & {
    args?: Partial<PtySpawnLaunchOptionsInput['args']>
  } = {}
): PtySpawnLaunchOptionsInput {
  const { args, ...rest } = overrides
  return {
    args: { cols: 80, rows: 24, launchAgent: 'ap-architect', ...args },
    env: {},
    envToDelete: [],
    launchCommand: 'claude',
    cwd: undefined,
    isDaemonHostSpawn: false,
    preAdoptedStablePane: false,
    isNewSession: true,
    codexRuntime: 'host',
    expectedWslDistro: null,
    requestedAgentTeamsPath: '',
    selectedCodexHomePath: null,
    shellOverride: undefined,
    paneKey: undefined,
    sessionId: undefined,
    spawnIntent: undefined,
    store: undefined,
    claudeAuth: null,
    ...rest
  }
}

async function launchCommand(input: PtySpawnLaunchOptionsInput): Promise<string | undefined> {
  return (await assemblePtySpawnLaunchOptions(input)).spawnOptions.command
}

describe.runIf(process.platform !== 'win32')(
  'assemblePtySpawnLaunchOptions with agent profiles',
  () => {
    beforeAll(() => {
      home.path = mkdtempSync(join(tmpdir(), 'orca-ap-assembly-'))
      saveAgentProfile('architect', {
        name: 'Architect',
        llmSource: { kind: 'subscription' },
        model: 'opus',
        rolePrompt: 'You design systems.'
      })
      syncAgentProfileAgents()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    afterAll(() => {
      for (const id of listDynamicTuiAgentIds()) {
        unregisterDynamicTuiAgent(id)
      }
      rmSync(home.path, { recursive: true, force: true })
      home.path = ''
    })

    it('injects the profile flags and prompt file into a local launch and keeps launchAgent', async () => {
      const { spawnOptions, launchCommand: returned } =
        await assemblePtySpawnLaunchOptions(launchInput())
      expect(spawnOptions.command).toMatch(
        new RegExp(
          `^claude '--model' 'opus' '--permission-mode' 'auto' '--append-system-prompt-file' '${join(home.path, '.orca', 'agent-profiles', '.prompts')}/architect-[0-9a-f]{12}\\.md'$`
        )
      )
      expect(returned).toBe(spawnOptions.command)
      expect(spawnOptions.launchAgent).toBe('ap-architect')
    })

    it('injects into a resume command too, before its -- terminator', async () => {
      expect(
        await launchCommand(launchInput({ launchCommand: "claude --resume abc -- 'go on'" }))
      ).toMatch(/^claude --resume abc '--model' 'opus' .* -- 'go on'$/)
    })

    it('skips only the role prompt for SSH and WSL launches', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const expected = "claude '--model' 'opus' '--permission-mode' 'auto'"
      expect(await launchCommand(launchInput({ args: { connectionId: 'ssh-1' } }))).toBe(expected)
      expect(await launchCommand(launchInput({ codexRuntime: 'wsl' }))).toBe(expected)
    })

    it('leaves adopted panes and non-profile agents untouched', async () => {
      expect(await launchCommand(launchInput({ preAdoptedStablePane: true }))).toBe('claude')
      expect(await launchCommand(launchInput({ args: { launchAgent: 'claude' } }))).toBe('claude')
    })
  }
)
