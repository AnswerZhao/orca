import { useCallback, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { LlmEndpointPublicView } from '../../../../shared/llm-endpoint'
import { AgentProfilesPane } from './AgentProfilesPane'
import { LlmEndpointsPane } from './LlmEndpointsPane'
import { SettingsSubsectionHeader } from './SettingsFormControls'

/** Settings → Agent Profiles: the saved LLM endpoints, then the profiles that may use them. */
export function AgentProfilesSettingsPane(): React.JSX.Element {
  // Why lifted here: the profile editor's model-source picker lists the endpoints this pane edits.
  const [endpoints, setEndpoints] = useState<readonly LlmEndpointPublicView[]>([])
  const reloadEndpoints = useCallback(async (): Promise<readonly LlmEndpointPublicView[]> => {
    const next = await window.api.llmEndpoints.list()
    setEndpoints(next)
    return next
  }, [])

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SettingsSubsectionHeader
          title={translate(
            'auto.components.settings.AgentProfilesSettingsPane.endpointsTitle',
            'LLM endpoints'
          )}
          description={translate(
            'auto.components.settings.AgentProfilesSettingsPane.endpointsDescription',
            'Anthropic-compatible endpoints (Kimi, GLM, DeepSeek, custom) a profile can run Claude Code against. API keys stay on this machine.'
          )}
        />
        <LlmEndpointsPane endpoints={endpoints} reload={reloadEndpoints} />
      </section>
      <section className="space-y-3">
        <SettingsSubsectionHeader
          title={translate(
            'auto.components.settings.AgentProfilesSettingsPane.profilesTitle',
            'Agent profiles'
          )}
          description={translate(
            'auto.components.settings.AgentProfilesSettingsPane.profilesDescription',
            'Named Claude Code setups: model source, model, mode, thinking and a role prompt. Each one appears in the agent picker.'
          )}
        />
        <AgentProfilesPane endpoints={endpoints} />
      </section>
    </div>
  )
}
