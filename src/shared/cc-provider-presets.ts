// Transitional aliases for the cc-* agent code that agent profiles replace; delete with it.
export {
  LLM_ENDPOINT_PRESETS as CC_PROVIDER_PRESETS,
  getLlmEndpointPreset as getCcProviderPreset
} from './llm-endpoint-presets'
export type { LlmEndpointPreset as CcProviderPreset } from './llm-endpoint-presets'
