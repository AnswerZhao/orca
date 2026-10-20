import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export const getCcProvidersPaneSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.ccProviders.search.presets.title', 'Presets'),
    description: translate(
      'auto.components.settings.ccProviders.search.presets.description',
      'Add a provider from a built-in preset (Kimi, GLM, DeepSeek); only the API key is required.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.ccProviders.search.kw.kimi', 'kimi'),
      ...translateSearchKeyword(
        'auto.components.settings.ccProviders.search.kw.moonshot',
        'moonshot'
      ),
      ...translateSearchKeyword('auto.components.settings.ccProviders.search.kw.glm', 'glm'),
      ...translateSearchKeyword('auto.components.settings.ccProviders.search.kw.zhipu', 'zhipu'),
      ...translateSearchKeyword(
        'auto.components.settings.ccProviders.search.kw.deepseek',
        'deepseek'
      )
    ]
  },
  {
    title: translate('auto.components.settings.ccProviders.search.custom.title', 'Custom provider'),
    description: translate(
      'auto.components.settings.ccProviders.search.custom.description',
      'Configure any Anthropic-compatible endpoint by editing the provider JSON directly.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.ccProviders.search.kw.anthropic',
        'anthropic compatible'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.ccProviders.search.kw.baseUrl',
        'base url'
      ),
      ...translateSearchKeyword('auto.components.settings.ccProviders.search.kw.env', 'env json'),
      ...translateSearchKeyword('auto.components.settings.ccProviders.search.kw.apiKey', 'api key')
    ]
  }
])
