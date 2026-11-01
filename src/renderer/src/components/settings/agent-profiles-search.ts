import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export const getAgentProfilesPaneSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate(
      'auto.components.settings.agentProfiles.search.endpoints.title',
      'LLM endpoints'
    ),
    description: translate(
      'auto.components.settings.agentProfiles.search.endpoints.description',
      'Add an Anthropic-compatible endpoint from a preset (Kimi, GLM, DeepSeek) or as custom JSON.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.agentProfiles.search.kw.kimi', 'kimi'),
      ...translateSearchKeyword(
        'auto.components.settings.agentProfiles.search.kw.moonshot',
        'moonshot'
      ),
      ...translateSearchKeyword('auto.components.settings.agentProfiles.search.kw.glm', 'glm'),
      ...translateSearchKeyword('auto.components.settings.agentProfiles.search.kw.zhipu', 'zhipu'),
      ...translateSearchKeyword(
        'auto.components.settings.agentProfiles.search.kw.deepseek',
        'deepseek'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agentProfiles.search.kw.anthropic',
        'anthropic compatible'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agentProfiles.search.kw.baseUrl',
        'base url'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agentProfiles.search.kw.apiKey',
        'api key'
      )
    ]
  },
  {
    title: translate(
      'auto.components.settings.agentProfiles.search.profiles.title',
      'Agent profiles'
    ),
    description: translate(
      'auto.components.settings.agentProfiles.search.profiles.description',
      'Create Claude Code agents with their own model, permission mode, thinking effort and role prompt.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.agentProfiles.search.kw.role',
        'role prompt'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agentProfiles.search.kw.systemPrompt',
        'system prompt'
      ),
      ...translateSearchKeyword('auto.components.settings.agentProfiles.search.kw.model', 'model'),
      ...translateSearchKeyword(
        'auto.components.settings.agentProfiles.search.kw.permissionMode',
        'permission mode'
      ),
      ...translateSearchKeyword('auto.components.settings.agentProfiles.search.kw.effort', 'effort')
    ]
  }
])
