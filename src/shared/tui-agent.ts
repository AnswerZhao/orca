/** Built-in agents, known at compile time. Dynamic `cc-*` provider entries widen this
 *  into `TuiAgent`; tables keyed by every built-in stay `Record<StaticTuiAgent, …>`. */
export type StaticTuiAgent =
  | 'claude' // Claude Code
  | 'claude-agent-teams' // Claude Code Agent Teams via Orca native panes
  | 'codebuddy' // CodeBuddy Code
  | 'openclaude' // OpenClaude
  | 'codex' // OpenAI Codex
  | 'autohand' // Autohand Code CLI
  | 'opencode' // OpenCode
  | 'opencode2' // OpenCode 2 beta
  | 'mimo-code'
  | 'pi' // Pi (pi.dev)
  | 'omp' // OMP (omp.sh)
  | 'qoder' // Qoder CLI
  | 'qoder-cn' // Qoder CLI China
  | 'gemini' // Gemini CLI
  | 'antigravity' // Google Antigravity CLI
  | 'aider' // Aider
  | 'goose' // Goose
  | 'amp' // Amp
  | 'kilo' // Kilocode
  | 'kiro' // Kiro
  | 'crush' // Charm/Crush
  | 'aug' // Augment/Auggie
  | 'cline' // Cline
  | 'codebuff' // Codebuff
  | 'freebuff' // Freebuff
  | 'command-code' // Command Code
  | 'continue' // Continue
  | 'cursor' // Cursor
  | 'droid' // Factory Droid
  | 'kimi' // Kimi
  | 'mistral-vibe' // Mistral Vibe
  | 'qwen-code' // Qwen Code
  | 'rovo' // Rovo Dev
  | 'hermes' // Hermes Agent
  | 'openclaw' // OpenClaw
  | 'copilot' // GitHub Copilot CLI
  | 'grok' // xAI Grok CLI
  | 'devin' // Devin CLI
  | 'ante' // Ante (Antigma Labs)
  | 'trae' // Trae CLI
  | 'muse' // Muse (Meta `muse` CLI)
  | 'zcode' // ZCode (Z.ai `zcode` CLI)
  | 'prime-agent' // Prime Agent (Prime Intellect)
  | 'dsh' // DeepSeek Harness (`dsh`, launched through its `dsh-tui` terminal profile)
  | 'jcode' // Jcode

/** Agent id prefix for user-defined Claude-compatible providers (`~/.orca/cc-providers/*.json`). */
export const CC_PROVIDER_AGENT_PREFIX = 'cc-'

/** A dynamic provider agent id, e.g. `cc-kimi`. Registered at runtime, not in TUI_AGENT_CONFIG. */
export type CcProviderAgentId = `${typeof CC_PROVIDER_AGENT_PREFIX}${string}`

export function isCcProviderAgentId(value: unknown): value is CcProviderAgentId {
  return (
    typeof value === 'string' &&
    value.length > CC_PROVIDER_AGENT_PREFIX.length &&
    value.startsWith(CC_PROVIDER_AGENT_PREFIX)
  )
}

/** All AI coding agents Orca knows how to launch. Used for the agent picker in the new-workspace
 *  flow and for the default-agent setting. Extend `StaticTuiAgent` as new built-in agents are added. */
export type TuiAgent = StaticTuiAgent | CcProviderAgentId
