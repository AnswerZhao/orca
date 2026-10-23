import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyAgentProfileLaunchArgs,
  injectAgentProfileLaunchArgs
} from './agent-profile-launch-args'
import { saveAgentProfile } from './agent-profile-store'

describe('injectAgentProfileLaunchArgs', () => {
  const all = {
    model: 'opus',
    effort: 'high',
    permissionMode: 'auto',
    rolePromptFile: '/p/r.md'
  }

  it('appends every flag after the existing args when there is no terminator', () => {
    expect(injectAgentProfileLaunchArgs('claude --verbose', all, 'posix')).toBe(
      "claude --verbose '--model' 'opus' '--effort' 'high' '--permission-mode' 'auto' '--append-system-prompt-file' '/p/r.md'"
    )
  })

  it('inserts before the -- terminator so the prompt stays positional', () => {
    expect(
      injectAgentProfileLaunchArgs("claude --verbose -- 'fix the bug'", { model: 'opus' }, 'posix')
    ).toBe("claude --verbose '--model' 'opus' -- 'fix the bug'")
  })

  it('treats a -- consumed as an option value as an argument, not the terminator', () => {
    expect(injectAgentProfileLaunchArgs('claude --settings -- x', { model: 'opus' }, 'posix')).toBe(
      "claude --settings -- x '--model' 'opus'"
    )
  })

  it('lets flags already on the command win over profile defaults', () => {
    expect(
      injectAgentProfileLaunchArgs(
        'claude -m sonnet --effort=low --dangerously-skip-permissions --append-system-prompt hi',
        all,
        'posix'
      )
    ).toBe('claude -m sonnet --effort=low --dangerously-skip-permissions --append-system-prompt hi')
    expect(
      injectAgentProfileLaunchArgs(
        'claude --model sonnet',
        { model: 'opus', effort: 'max' },
        'posix'
      )
    ).toBe("claude --model sonnet '--effort' 'max'")
    expect(
      injectAgentProfileLaunchArgs(
        'claude --permission-mode plan',
        { permissionMode: 'auto' },
        'posix'
      )
    ).toBe('claude --permission-mode plan')
  })

  it('ignores flags after the terminator when checking for conflicts', () => {
    expect(
      injectAgentProfileLaunchArgs("claude -- '--model sonnet'", { model: 'opus' }, 'posix')
    ).toBe("claude '--model' 'opus' -- '--model sonnet'")
  })

  it('quotes values for the target shell', () => {
    const path = "/Users/o'neil/My Prompts/a.md"
    expect(
      injectAgentProfileLaunchArgs('claude', { model: 'opus[1m]', rolePromptFile: path }, 'posix')
    ).toBe(
      `claude '--model' 'opus[1m]' '--append-system-prompt-file' '/Users/o'"'"'neil/My Prompts/a.md'`
    )
    expect(
      injectAgentProfileLaunchArgs(
        "& 'C:\\bin\\claude.cmd' -- 'hi'",
        { rolePromptFile: "C:\\Users\\o'neil\\a.md" },
        'powershell'
      )
    ).toBe(
      "& 'C:\\bin\\claude.cmd' '--append-system-prompt-file' 'C:\\Users\\o''neil\\a.md' -- 'hi'"
    )
    expect(injectAgentProfileLaunchArgs('claude', { model: 'opus' }, 'cmd')).toBe(
      'claude "--model" "opus"'
    )
  })

  it('finds claude behind env prefixes, paths and agentCmdOverrides wrappers', () => {
    expect(
      injectAgentProfileLaunchArgs('FOO=1 /opt/bin/claude --resume abc', { model: 'opus' }, 'posix')
    ).toBe("FOO=1 /opt/bin/claude --resume abc '--model' 'opus'")
    expect(injectAgentProfileLaunchArgs('cd /w && claude -- hi', { model: 'opus' }, 'posix')).toBe(
      "cd /w && claude '--model' 'opus' -- hi"
    )
  })

  it('returns null when the command has no claude token or unanchored shell syntax after it', () => {
    expect(injectAgentProfileLaunchArgs('ccr code', { model: 'opus' }, 'posix')).toBeNull()
    expect(injectAgentProfileLaunchArgs('claude; echo done', { model: 'opus' }, 'posix')).toBeNull()
    expect(injectAgentProfileLaunchArgs("claude 'unclosed", { model: 'opus' }, 'posix')).toBeNull()
  })

  it('returns the command unchanged when there is nothing to add', () => {
    expect(injectAgentProfileLaunchArgs('claude -- hi', {}, 'posix')).toBe('claude -- hi')
  })
})

describe('applyAgentProfileLaunchArgs', () => {
  let root: string
  let profilesDir: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-ap-launch-args-'))
    profilesDir = join(root, 'agent-profiles')
    saveAgentProfile(
      'architect',
      {
        name: 'Architect',
        llmSource: { kind: 'subscription' },
        model: 'opus',
        rolePrompt: 'You design systems.'
      },
      { profiles: profilesDir, endpoints: join(root, 'llm-endpoints') }
    )
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('applies the profile, writing the role prompt file for local launches', () => {
    const command = applyAgentProfileLaunchArgs({
      launchAgent: 'ap-architect',
      command: 'claude',
      runsOffThisHost: false,
      shell: 'posix',
      profilesDir
    })
    const match = /'--append-system-prompt-file' '([^']+)'$/.exec(command ?? '')
    expect(command).toContain("'--model' 'opus' '--permission-mode' 'auto'")
    expect(match).not.toBeNull()
    expect(readFileSync(match![1], 'utf8')).toBe('You design systems.')
  })

  it('skips only the role prompt, with a warning, for SSH and WSL launches', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      applyAgentProfileLaunchArgs({
        launchAgent: 'ap-architect',
        command: 'claude',
        runsOffThisHost: true,
        shell: 'posix',
        profilesDir
      })
    ).toBe("claude '--model' 'opus' '--permission-mode' 'auto'")
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('role prompt skipped'))
  })

  it('leaves other agents, unknown profiles, and absent commands alone', () => {
    const base = {
      runsOffThisHost: false,
      shell: 'posix' as const,
      profilesDir
    }
    expect(
      applyAgentProfileLaunchArgs({
        ...base,
        launchAgent: 'claude',
        command: 'claude'
      })
    ).toBe('claude')
    expect(
      applyAgentProfileLaunchArgs({
        ...base,
        launchAgent: 'ap-ghost',
        command: 'claude'
      })
    ).toBe('claude')
    expect(
      applyAgentProfileLaunchArgs({
        ...base,
        launchAgent: 'ap-architect',
        command: undefined
      })
    ).toBeUndefined()
  })

  it('keeps an uneditable command as-is and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      applyAgentProfileLaunchArgs({
        launchAgent: 'ap-architect',
        command: 'ccr code',
        runsOffThisHost: false,
        shell: 'posix',
        profilesDir
      })
    ).toBe('ccr code')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no editable claude invocation'))
  })
})
