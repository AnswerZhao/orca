import { Loader2, Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AGENT_PROFILE_ICON_COMPONENTS } from '@/lib/agent-profile-icons'
import { cn } from '@/lib/utils'
import {
  AGENT_PROFILE_EFFORTS,
  AGENT_PROFILE_PERMISSION_MODES,
  AGENT_PROFILE_ROLE_PROMPT_MAX_LENGTH
} from '../../../../shared/agent-profile'
import { agentProfileAgentId } from '../../../../shared/agent-profile-agent-id'
import type { LlmEndpointPublicView } from '../../../../shared/llm-endpoint'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Textarea } from '../ui/textarea'
import {
  applyProfileName,
  applyProfileSlug,
  type AgentProfileDraft
} from './agent-profiles-pane-draft'
import {
  AgentProfileIconPicker,
  AgentProfileModelSuggestions,
  effortLabel,
  permissionModeLabel
} from './agent-profiles-pane-fields'

// Why sentinels: Radix Select reserves the empty string for "no selection".
const SUBSCRIPTION_SOURCE = '__subscription'
const DEFAULT_EFFORT = '__default'

type AgentProfilesPaneEditorProps = {
  draft: AgentProfileDraft
  endpoints: readonly LlmEndpointPublicView[]
  /** Shown in the footer status line; null when nothing to display yet. */
  validationError: string | null
  /** Blocks saving (validation failed) even when the message is not shown yet. */
  saveDisabled: boolean
  busy: boolean
  confirmingDelete: boolean
  onDraftChange: (draft: AgentProfileDraft) => void
  onSave: () => void
  onDelete: () => void
}

/** Right side of the profiles master-detail pane: header (delete) / scrollable form / pinned footer. */
export function AgentProfilesPaneEditor({
  draft,
  endpoints,
  validationError,
  saveDisabled,
  busy,
  confirmingDelete,
  onDraftChange,
  onSave,
  onDelete
}: AgentProfilesPaneEditorProps): React.JSX.Element {
  const isEdit = draft.mode === 'edit'
  const endpoint = endpoints.find((candidate) => candidate.slug === draft.endpoint)
  const HeaderIcon = AGENT_PROFILE_ICON_COMPONENTS[draft.icon]
  const mono = (text: string): React.JSX.Element => <span className="font-mono">{text}</span>
  // Why mt-auto on controls: a wrapped description in one column must not push its control
  // below its row neighbor's.
  const fieldShell = (
    id: string,
    label: string,
    description: React.ReactNode,
    control: React.ReactNode,
    span2 = false
  ): React.JSX.Element => (
    <div className={cn('flex flex-col gap-2', span2 && 'col-span-2')}>
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="mt-auto">{control}</div>
    </div>
  )
  const section = (title: string, children: React.ReactNode): React.JSX.Element => (
    <section className="space-y-3">
      <h3 className="text-2xs font-semibold tracking-[0.05em] text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">{children}</div>
    </section>
  )

  const modelDescription = endpoint
    ? translate(
        'auto.components.settings.AgentProfilesPane.modelEndpointHint',
        "Empty uses the endpoint's ANTHROPIC_MODEL"
      )
    : translate(
        'auto.components.settings.AgentProfilesPane.modelSubscriptionHint',
        'Empty uses the account default'
      )
  const modelPlaceholder = endpoint
    ? (endpoint.env.ANTHROPIC_MODEL ?? '')
    : translate('auto.components.settings.AgentProfilesPane.modelPlaceholder', 'Account default')

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-6 py-3.5">
        <HeaderIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">
          {isEdit
            ? draft.name
            : draft.name ||
              translate('auto.components.settings.AgentProfilesPane.newProfile', 'New profile')}
        </span>
        {draft.slug ? (
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {agentProfileAgentId(draft.slug)}
          </span>
        ) : null}
        <span className="flex-1" />
        {isEdit ? (
          <Button
            variant={confirmingDelete ? 'destructive' : 'ghost'}
            size="xs"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 className="size-3" />
            {confirmingDelete
              ? translate(
                  'auto.components.settings.AgentProfilesPane.confirmDelete',
                  'Confirm delete'
                )
              : translate('auto.components.settings.AgentProfilesPane.delete', 'Delete')}
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek px-6 py-5">
        <div className="max-w-[640px] space-y-7">
          {section(
            translate('auto.components.settings.AgentProfilesPane.identitySection', 'Identity'),
            <>
              {fieldShell(
                'agent-profile-icon',
                translate('auto.components.settings.AgentProfilesPane.icon', 'Icon'),
                null,
                <AgentProfileIconPicker
                  id="agent-profile-icon"
                  value={draft.icon}
                  disabled={busy}
                  onChange={(icon) => onDraftChange({ ...draft, icon })}
                />,
                true
              )}
              {fieldShell(
                'agent-profile-name',
                translate('auto.components.settings.AgentProfilesPane.name', 'Name'),
                translate(
                  'auto.components.settings.AgentProfilesPane.nameHint',
                  'Shown in the agent picker'
                ),
                <Input
                  id="agent-profile-name"
                  value={draft.name}
                  onChange={(e) => onDraftChange(applyProfileName(draft, e.target.value))}
                  disabled={busy}
                />
              )}
              {fieldShell(
                'agent-profile-slug',
                translate('auto.components.settings.AgentProfilesPane.slug', 'Slug'),
                isEdit
                  ? translate(
                      'auto.components.settings.AgentProfilesPane.slugLockedHint',
                      'Fixed after creation'
                    )
                  : translate(
                      'auto.components.settings.AgentProfilesPane.slugHint',
                      'Suggested from the name; type one if the name has no letters'
                    ),
                <Input
                  id="agent-profile-slug"
                  value={draft.slug}
                  onChange={(e) => onDraftChange(applyProfileSlug(draft, e.target.value))}
                  spellCheck={false}
                  disabled={busy || isEdit}
                />
              )}
            </>
          )}
          {section(
            translate('auto.components.settings.AgentProfilesPane.runtimeSection', 'Runtime'),
            <>
              {fieldShell(
                'agent-profile-provider',
                translate('auto.components.settings.AgentProfilesPane.provider', 'Provider'),
                translate(
                  'auto.components.settings.AgentProfilesPane.providerHint',
                  'Profiles run the installed Claude Code CLI'
                ),
                <Input id="agent-profile-provider" value="Claude Code" readOnly disabled />
              )}
              {fieldShell(
                'agent-profile-source',
                translate('auto.components.settings.AgentProfilesPane.source', 'Model source'),
                translate(
                  'auto.components.settings.AgentProfilesPane.sourceHint',
                  'Signed-in account, or a saved LLM endpoint'
                ),
                <Select
                  value={draft.endpoint || SUBSCRIPTION_SOURCE}
                  onValueChange={(value) =>
                    onDraftChange({
                      ...draft,
                      endpoint: value === SUBSCRIPTION_SOURCE ? '' : value
                    })
                  }
                  disabled={busy}
                >
                  <SelectTrigger id="agent-profile-source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SUBSCRIPTION_SOURCE}>
                      {translate(
                        'auto.components.settings.AgentProfilesPane.sourceSubscription',
                        'Claude account (subscription)'
                      )}
                    </SelectItem>
                    {endpoints.map((candidate) => (
                      <SelectItem key={candidate.slug} value={candidate.slug}>
                        {candidate.name}
                      </SelectItem>
                    ))}
                    {draft.endpoint && !endpoint ? (
                      // Keeps a dangling reference visible so the validation error has a subject.
                      <SelectItem value={draft.endpoint}>{draft.endpoint}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              )}
              {fieldShell(
                'agent-profile-model',
                translate('auto.components.settings.AgentProfilesPane.model', 'Model'),
                <>
                  {mono('--model')} · {modelDescription}
                </>,
                <div className="space-y-2">
                  <Input
                    id="agent-profile-model"
                    value={draft.model}
                    onChange={(e) => onDraftChange({ ...draft, model: e.target.value })}
                    placeholder={modelPlaceholder}
                    spellCheck={false}
                    disabled={busy}
                  />
                  {endpoint ? null : (
                    <AgentProfileModelSuggestions
                      value={draft.model}
                      disabled={busy}
                      onPick={(model) => onDraftChange({ ...draft, model })}
                    />
                  )}
                </div>,
                true
              )}
              {fieldShell(
                'agent-profile-mode',
                translate('auto.components.settings.AgentProfilesPane.mode', 'Mode'),
                mono('--permission-mode'),
                <Select
                  value={draft.permissionMode}
                  onValueChange={(value) => {
                    const mode = AGENT_PROFILE_PERMISSION_MODES.find((m) => m === value)
                    if (mode) {
                      onDraftChange({ ...draft, permissionMode: mode })
                    }
                  }}
                  disabled={busy}
                >
                  <SelectTrigger id="agent-profile-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_PROFILE_PERMISSION_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {permissionModeLabel(mode)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {fieldShell(
                'agent-profile-effort',
                translate('auto.components.settings.AgentProfilesPane.effort', 'Thinking'),
                mono('--effort'),
                <Select
                  value={draft.effort || DEFAULT_EFFORT}
                  onValueChange={(value) =>
                    onDraftChange({
                      ...draft,
                      effort: AGENT_PROFILE_EFFORTS.find((e) => e === value) ?? ''
                    })
                  }
                  disabled={busy}
                >
                  <SelectTrigger id="agent-profile-effort" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_EFFORT}>
                      {translate(
                        'auto.components.settings.AgentProfilesPane.effortDefault',
                        'Claude Code default'
                      )}
                    </SelectItem>
                    {AGENT_PROFILE_EFFORTS.map((effort) => (
                      <SelectItem key={effort} value={effort}>
                        {effortLabel(effort)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
          {section(
            translate('auto.components.settings.AgentProfilesPane.promptSection', 'Role prompt'),
            fieldShell(
              'agent-profile-role-prompt',
              translate('auto.components.settings.AgentProfilesPane.rolePrompt', 'Role prompt'),
              <>
                {mono('--append-system-prompt-file')} ·{' '}
                {translate(
                  'auto.components.settings.AgentProfilesPane.rolePromptHint',
                  "Appended to Claude Code's system prompt"
                )}
              </>,
              <div className="space-y-2">
                <Textarea
                  id="agent-profile-role-prompt"
                  className="min-h-40"
                  value={draft.rolePrompt}
                  onChange={(e) => onDraftChange({ ...draft, rolePrompt: e.target.value })}
                  maxLength={AGENT_PROFILE_ROLE_PROMPT_MAX_LENGTH}
                  placeholder={translate(
                    'auto.components.settings.AgentProfilesPane.rolePromptPlaceholder',
                    'You are a software architect. Before writing code, …'
                  )}
                  disabled={busy}
                />
                <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                  <li>
                    {translate(
                      'auto.components.settings.AgentProfilesPane.rolePromptNewSessions',
                      'Changes apply to new sessions only; running sessions keep the prompt they started with.'
                    )}
                  </li>
                  <li>
                    {translate(
                      'auto.components.settings.AgentProfilesPane.rolePromptRemote',
                      'Not applied over SSH or in WSL; the other settings still are.'
                    )}
                  </li>
                </ul>
              </div>,
              true
            )
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-border/60 px-6 py-3">
        <p
          className={`min-h-4 flex-1 text-[11px] ${validationError ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {validationError ??
            translate(
              'auto.components.settings.AgentProfilesPane.footerHint',
              'Saved profiles appear in the agent picker as their own agents.'
            )}
        </p>
        <Button size="sm" disabled={busy || saveDisabled} onClick={onSave}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
          {isEdit
            ? translate('auto.components.settings.AgentProfilesPane.saveChanges', 'Save changes')
            : translate('auto.components.settings.AgentProfilesPane.save', 'Save')}
        </Button>
      </div>
    </div>
  )
}
