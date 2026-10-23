// Why its own module: `orca skills` loads it outside Electron, so it must stay free of
// agent-detection.ts's integration clients.
import {
  getTuiAgentDetectionProbeCommands,
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedTuiAgentIds
} from '../../shared/tui-agent-detection-commands'
import { resolveDynamicDetectedTuiAgentIds } from '../../shared/tui-agent-dynamic-registry'
import { hydrateShellPathForAgentDetection } from '../ipc/agent-detection-shell-path'
import {
  getPreflightWslTarget,
  type PreflightRuntimeContext
} from '../ipc/preflight-runtime-target'
import { detectAgentCommandsOnHost } from './agent-command-detection'

export async function detectInstalledAgents(context?: PreflightRuntimeContext): Promise<string[]> {
  const runtime = getPreflightWslTarget(context) ? 'wsl' : process.platform
  const commands = getTuiAgentDetectionProbeCommands(KNOWN_TUI_AGENT_DETECTION_COMMANDS, runtime)
  const foundCommands = await detectAgentCommandsOnHost(commands, { context })
  return [
    ...resolveDetectedTuiAgentIds(KNOWN_TUI_AGENT_DETECTION_COMMANDS, foundCommands, runtime),
    ...resolveDynamicDetectedTuiAgentIds(foundCommands, runtime)
  ]
}

export async function detectInstalledAgentsWithShellPathHydration(
  context?: PreflightRuntimeContext
): Promise<string[]> {
  await hydrateShellPathForAgentDetection(context)
  return detectInstalledAgents(context)
}
