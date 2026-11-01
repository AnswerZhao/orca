import { translate } from '@/i18n/i18n'
import { AGENT_PROFILE_ICON_COMPONENTS } from '@/lib/agent-profile-icons'
import { cn } from '@/lib/utils'
import {
  AGENT_PROFILE_ICONS,
  type AgentProfileEffort,
  type AgentProfileIcon,
  type AgentProfilePermissionMode
} from '../../../../shared/agent-profile'
import { AGENT_PROFILE_SUBSCRIPTION_MODEL_SUGGESTIONS } from './agent-profiles-pane-draft'

export function permissionModeLabel(mode: AgentProfilePermissionMode): string {
  switch (mode) {
    case 'manual':
      return translate('auto.components.settings.AgentProfilesPane.modeManual', 'Manual')
    case 'acceptEdits':
      return translate('auto.components.settings.AgentProfilesPane.modeAcceptEdits', 'Accept edits')
    case 'auto':
      return translate('auto.components.settings.AgentProfilesPane.modeAuto', 'Auto')
    case 'plan':
      return translate('auto.components.settings.AgentProfilesPane.modePlan', 'Plan')
    case 'dontAsk':
      return translate('auto.components.settings.AgentProfilesPane.modeDontAsk', "Don't ask")
    case 'bypassPermissions':
      return translate(
        'auto.components.settings.AgentProfilesPane.modeBypassPermissions',
        'Bypass permissions'
      )
  }
}

export function effortLabel(effort: AgentProfileEffort): string {
  switch (effort) {
    case 'low':
      return translate('auto.components.settings.AgentProfilesPane.effortLow', 'Low')
    case 'medium':
      return translate('auto.components.settings.AgentProfilesPane.effortMedium', 'Medium')
    case 'high':
      return translate('auto.components.settings.AgentProfilesPane.effortHigh', 'High')
    case 'xhigh':
      return translate('auto.components.settings.AgentProfilesPane.effortXhigh', 'Extra high')
    case 'max':
      return translate('auto.components.settings.AgentProfilesPane.effortMax', 'Max')
  }
}

const chipClass = (selected: boolean): string =>
  cn(
    'rounded-md border transition-colors',
    selected
      ? 'border-ring bg-accent text-accent-foreground'
      : 'border-border/60 text-muted-foreground hover:bg-accent'
  )

export function AgentProfileIconPicker({
  id,
  value,
  disabled,
  onChange
}: {
  id: string
  value: AgentProfileIcon
  disabled: boolean
  onChange: (icon: AgentProfileIcon) => void
}): React.JSX.Element {
  return (
    <div id={id} role="radiogroup" className="flex flex-wrap gap-1.5">
      {AGENT_PROFILE_ICONS.map((icon) => {
        const Icon = AGENT_PROFILE_ICON_COMPONENTS[icon]
        return (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={value === icon}
            aria-label={icon}
            title={icon}
            disabled={disabled}
            onClick={() => onChange(icon)}
            className={cn('flex size-8 items-center justify-center', chipClass(value === icon))}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}

/** One-click `--model` aliases for profiles that run on the Claude account subscription. */
export function AgentProfileModelSuggestions({
  value,
  disabled,
  onPick
}: {
  value: string
  disabled: boolean
  onPick: (model: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1">
      {AGENT_PROFILE_SUBSCRIPTION_MODEL_SUGGESTIONS.map((model) => (
        <button
          key={model}
          type="button"
          disabled={disabled}
          onClick={() => onPick(model)}
          className={cn('px-2 py-0.5 font-mono text-[11px]', chipClass(value.trim() === model))}
        >
          {model}
        </button>
      ))}
    </div>
  )
}
