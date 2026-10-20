import type { TuiAgent } from './tui-agent'
import {
  getTuiAgentDetectCommands,
  TUI_AGENT_CONFIG,
  type TuiAgentConfig,
  type TuiAgentDetectionRuntime
} from './tui-agent-config'
import { listDynamicTuiAgentIds, lookupDynamicTuiAgentConfig } from './tui-agent-dynamic-registry'

export type TuiAgentDetectionCommand = {
  id: TuiAgent
  cmd: string
  /** Ask an execution host to report this CLI's `--version` output when found. */
  reportVersion?: true
  requiredCommands?: readonly string[]
  unsupportedRuntimes?: readonly TuiAgentDetectionRuntime[]
}

export const KNOWN_TUI_AGENT_DETECTION_COMMANDS = buildTuiAgentDetectionCommands()

function buildTuiAgentDetectionCommands(): TuiAgentDetectionCommand[] {
  return Object.entries(TUI_AGENT_CONFIG).flatMap(([id, config]) =>
    getTuiAgentDetectCommands(config).map((cmd) =>
      buildTuiAgentDetectionCommand(id as TuiAgent, cmd, config)
    )
  )
}

function buildTuiAgentDetectionCommand(
  id: TuiAgent,
  cmd: string,
  config: TuiAgentConfig
): TuiAgentDetectionCommand {
  return {
    id,
    cmd,
    ...(config.detectRequiredCommands?.length
      ? { requiredCommands: config.detectRequiredCommands }
      : {}),
    ...(config.detectUnsupportedRuntimes?.length
      ? { unsupportedRuntimes: config.detectUnsupportedRuntimes }
      : {})
  }
}

export function getTuiAgentDetectionProbeCommands(
  commands: readonly TuiAgentDetectionCommand[],
  runtime: TuiAgentDetectionRuntime
): string[] {
  return [
    ...new Set(
      commands.flatMap((command) =>
        isDetectionUnsupportedInRuntime(command, runtime)
          ? []
          : [command.cmd, ...(command.requiredCommands ?? [])]
      )
    )
  ]
}

export function resolveDetectedTuiAgentIds(
  commands: readonly TuiAgentDetectionCommand[],
  foundCommands: ReadonlySet<string>,
  runtime: TuiAgentDetectionRuntime
): TuiAgent[] {
  const detected = commands
    .filter(
      (command) =>
        !isDetectionUnsupportedInRuntime(command, runtime) &&
        foundCommands.has(command.cmd) &&
        (command.requiredCommands ?? []).every((required) => foundCommands.has(required))
    )
    .map(({ id }) => id)
  return [...new Set(detected)]
}

export function isDetectionUnsupportedInRuntime(
  command: TuiAgentDetectionCommand,
  runtime: TuiAgentDetectionRuntime
): boolean {
  return command.unsupportedRuntimes?.includes(runtime) === true
}

/** Registered cc-* providers ride an existing CLI (claude), so they count as installed
 *  exactly when that CLI is. KNOWN_TUI_AGENT_DETECTION_COMMANDS is frozen at module load,
 *  before main registers providers, so dynamic agents must be merged in here. */
export function resolveDynamicDetectedTuiAgentIds(
  foundCommands: ReadonlySet<string>,
  runtime: TuiAgentDetectionRuntime
): TuiAgent[] {
  const detected: TuiAgent[] = []
  for (const id of listDynamicTuiAgentIds()) {
    const config = lookupDynamicTuiAgentConfig(id)
    if (!config || config.detectUnsupportedRuntimes?.includes(runtime)) {
      continue
    }
    if (!getTuiAgentDetectCommands(config).some((cmd) => foundCommands.has(cmd))) {
      continue
    }
    if (!(config.detectRequiredCommands ?? []).every((cmd) => foundCommands.has(cmd))) {
      continue
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the registry only stores isCcProviderAgentId-checked ids, which are valid TuiAgent values.
    detected.push(id as TuiAgent)
  }
  return detected
}
