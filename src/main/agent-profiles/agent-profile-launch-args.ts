import { agentArgTerminatorIndex } from '../../shared/agent-session-option-agent-args'
import {
  agentProfileSlugFromAgentId,
  isAgentProfileAgentId
} from '../../shared/agent-profile-agent-id'
import { findOptionOccurrence } from '../../shared/command-option-occurrence'
import {
  quoteStartupArg,
  tokenizeStartupCommand,
  type AgentStartupShell
} from '../../shared/tui-agent-startup-shell'
import {
  agentProfilesDir,
  ensureAgentProfileRolePromptFile,
  getAgentProfile
} from './agent-profile-store'

export type AgentProfileLaunchArgs = {
  model?: string
  effort?: string
  permissionMode?: string
  rolePromptFile?: string
}

// Each profile field maps to one claude flag; any listed alias already on the command wins.
const PROFILE_ARG_RULES: readonly {
  field: keyof AgentProfileLaunchArgs
  flag: string
  aliases: readonly string[]
}[] = [
  { field: 'model', flag: '--model', aliases: ['--model', '-m'] },
  { field: 'effort', flag: '--effort', aliases: ['--effort'] },
  {
    field: 'permissionMode',
    flag: '--permission-mode',
    aliases: ['--permission-mode', '--dangerously-skip-permissions']
  },
  {
    field: 'rolePromptFile',
    flag: '--append-system-prompt-file',
    aliases: ['--append-system-prompt', '--append-system-prompt-file']
  }
]

const CLAUDE_EXECUTABLE_PATTERN = /(^|[\\/])claude(\.cmd|\.exe)?$/i

/**
 * Inserts the profile's claude flags before the command's `--` terminator (or at its end),
 * skipping any flag the command already carries. Returns null when the command's shape
 * cannot be edited safely: no claude executable token, or shell syntax after it with no
 * `--` to anchor on.
 */
export function injectAgentProfileLaunchArgs(
  command: string,
  launchArgs: AgentProfileLaunchArgs,
  shell: AgentStartupShell
): string | null {
  const tokenized = tokenizeStartupCommand(command, shell)
  if (!tokenized.ok) {
    return null
  }
  const { tokens, spans } = tokenized
  const executableIndex = tokens.findIndex((token) => CLAUDE_EXECUTABLE_PATTERN.test(token))
  if (executableIndex === -1) {
    return null
  }
  const argsStart = executableIndex + 1
  // Why: shell syntax (`;`, `&&`, `$(…)`) after claude ends the part this tokenizer models.
  const divergentOffset = spans.slice(argsStart).findIndex((span) => span.divergesFromShell)
  const argsEnd = divergentOffset === -1 ? tokens.length : argsStart + divergentOffset
  const agentTokens = tokens.slice(argsStart, argsEnd)
  const terminator = agentArgTerminatorIndex('claude', agentTokens)
  const optionTokens = agentTokens.slice(0, terminator)
  const inserted: string[] = []
  for (const rule of PROFILE_ARG_RULES) {
    const value = launchArgs[rule.field]
    if (value && !findOptionOccurrence(optionTokens, rule.aliases, false)) {
      inserted.push(rule.flag, value)
    }
  }
  if (inserted.length === 0) {
    return command
  }
  const insertedText = inserted.map((token) => quoteStartupArg(token, shell)).join(' ')
  if (terminator < agentTokens.length) {
    const at = spans[argsStart + terminator].start
    return `${command.slice(0, at)}${insertedText} ${command.slice(at)}`
  }
  if (argsEnd < tokens.length) {
    return null
  }
  const at = spans[tokens.length - 1].end
  return `${command.slice(0, at)} ${insertedText}${command.slice(at)}`
}

/**
 * The launch command with a profile agent's defaults applied, or the command unchanged for
 * every other agent. Role prompts ride a file on this machine, so SSH and WSL launches,
 * which cannot read it, go without one.
 */
export function applyAgentProfileLaunchArgs(input: {
  launchAgent: unknown
  command: string | undefined
  /** SSH or WSL: the prompt file path does not exist where claude runs. */
  runsOffThisHost: boolean
  shell: AgentStartupShell
  profilesDir?: string
}): string | undefined {
  const { command, launchAgent } = input
  if (command === undefined || !isAgentProfileAgentId(launchAgent)) {
    return command
  }
  const profilesDir = input.profilesDir ?? agentProfilesDir()
  const profile = getAgentProfile(agentProfileSlugFromAgentId(launchAgent), profilesDir)
  if (!profile) {
    return command
  }
  let rolePromptFile: string | undefined
  if (profile.rolePrompt && input.runsOffThisHost) {
    console.warn(
      `[agent-profiles] "${profile.name}": role prompt skipped; SSH and WSL launches cannot read the local prompt file`
    )
  } else if (profile.rolePrompt) {
    rolePromptFile = ensureAgentProfileRolePromptFile(profile.slug, profile.rolePrompt, profilesDir)
  }
  const injected = injectAgentProfileLaunchArgs(
    command,
    {
      model: profile.model,
      effort: profile.effort,
      permissionMode: profile.permissionMode,
      rolePromptFile
    },
    input.shell
  )
  if (injected === null) {
    console.warn(
      `[agent-profiles] "${profile.name}": launch command has no editable claude invocation; profile settings not applied`
    )
    return command
  }
  return injected
}
