// Transitional aliases for the cc-* agent code that agent profiles replace; delete with it.
import type { CcProviderAgentId } from './cc-provider-agent-id'
import type { LlmEndpointPublicView } from './llm-endpoint'

export {
  LLM_ENDPOINT_ENV_KEY_PATTERN as CC_PROVIDER_ENV_KEY_PATTERN,
  LLM_ENDPOINT_SLUG_PATTERN as CC_PROVIDER_SLUG_PATTERN,
  LlmEndpointConfigSchema as CcProviderConfigSchema,
  LlmEndpointPatchSchema as CcProviderPatchSchema
} from './llm-endpoint'
export type {
  LlmEndpointConfig as CcProviderConfig,
  LlmEndpointPatch as CcProviderPatch
} from './llm-endpoint'

export type CcProviderPublicView = LlmEndpointPublicView & { id: CcProviderAgentId }

export function ccProviderDisplayName(name: string): string {
  return `CC ${name}`
}
