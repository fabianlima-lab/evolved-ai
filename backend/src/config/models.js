/**
 * Model configuration — Primary + Fallback + Safety Net
 *
 * Primary:    Claude Sonnet 4.6 via Anthropic (smartest, best persona adherence)
 * Fallback:   llama-3.3-70b-versatile via Groq (fast, free tier)
 * Safety Net: meta/llama-3.1-8b-instruct via NVIDIA NIMs
 *
 * Anthropic uses its own SDK (not OpenAI-compatible).
 * Groq and NVIDIA are OpenAI-compatible APIs.
 */

export const PRIMARY_CONFIG = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  temperature: 0.7,
  maxTokens: 600,
  timeoutMs: 30000,
};

export const FALLBACK_CONFIG = {
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  baseURL: 'https://api.groq.com/openai/v1',
  temperature: 0.7,
  maxTokens: 600,
  timeoutMs: 30000,
};

export const SAFETY_NET_CONFIG = {
  provider: 'nvidia',
  model: 'meta/llama-3.1-8b-instruct',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  temperature: 0.7,
  maxTokens: 600,
  timeoutMs: 30000,
};

// Legacy exports for backward compatibility
export const MODEL_CONFIG = PRIMARY_CONFIG;
export const NVIDIA_BASE_URL = SAFETY_NET_CONFIG.baseURL;
export const GROQ_BASE_URL = FALLBACK_CONFIG.baseURL;

export const MODEL_TIERS = {
  1: { ...PRIMARY_CONFIG, name: 'Primary (Anthropic Sonnet 4.6)' },
  2: { ...FALLBACK_CONFIG, name: 'Fallback (Groq 70B)' },
  3: { ...SAFETY_NET_CONFIG, name: 'Safety Net (NVIDIA 8B)' },
};

export const FALLBACK_CHAIN = {
  1: 2,    // Anthropic fails → try Groq
  2: 3,    // Groq fails → try NVIDIA
  3: null, // NVIDIA fails → no more fallbacks
};
