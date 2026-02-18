/**
 * Model configuration — Primary + Fallback
 *
 * Primary:  meta/llama-3.1-8b-instruct via NVIDIA NIMs
 * Fallback: llama-3.3-70b-versatile via Groq (free, faster, smarter)
 *
 * Both are OpenAI-compatible APIs.
 */

export const PRIMARY_CONFIG = {
  provider: 'nvidia',
  model: 'meta/llama-3.1-8b-instruct',
  baseURL: 'https://integrate.api.nvidia.com/v1',
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

// Legacy exports for backward compatibility
export const MODEL_CONFIG = PRIMARY_CONFIG;
export const NVIDIA_BASE_URL = PRIMARY_CONFIG.baseURL;
export const GROQ_BASE_URL = FALLBACK_CONFIG.baseURL;

export const MODEL_TIERS = {
  1: { ...PRIMARY_CONFIG, name: 'Primary (NVIDIA)' },
  2: { ...FALLBACK_CONFIG, name: 'Fallback (Groq)' },
};

export const FALLBACK_CHAIN = {
  1: 2,    // NVIDIA fails → try Groq
  2: null, // Groq fails → no more fallbacks
};
