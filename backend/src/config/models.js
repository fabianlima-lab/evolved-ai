/**
 * Model configuration — Primary + Fallback
 *
 * Primary:  llama-3.3-70b-versatile via Groq (smarter, faster, free)
 * Fallback: meta/llama-3.1-8b-instruct via NVIDIA NIMs
 *
 * Both are OpenAI-compatible APIs.
 *
 * Decision: 70B is dramatically better at persona consistency, instruction
 * following, and not leaking markdown/tokens into WhatsApp. The 8B model
 * stays as fallback only — it produces lower quality but is a safety net
 * if Groq goes down.
 */

export const PRIMARY_CONFIG = {
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  baseURL: 'https://api.groq.com/openai/v1',
  temperature: 0.7,
  maxTokens: 600,
  timeoutMs: 30000,
};

export const FALLBACK_CONFIG = {
  provider: 'nvidia',
  model: 'meta/llama-3.1-8b-instruct',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  temperature: 0.7,
  maxTokens: 600,
  timeoutMs: 30000,
};

// Legacy exports for backward compatibility
export const MODEL_CONFIG = PRIMARY_CONFIG;
export const NVIDIA_BASE_URL = FALLBACK_CONFIG.baseURL;
export const GROQ_BASE_URL = PRIMARY_CONFIG.baseURL;

export const MODEL_TIERS = {
  1: { ...PRIMARY_CONFIG, name: 'Primary (Groq 70B)' },
  2: { ...FALLBACK_CONFIG, name: 'Fallback (NVIDIA 8B)' },
};

export const FALLBACK_CHAIN = {
  1: 2,    // Groq fails → try NVIDIA
  2: null, // NVIDIA fails → no more fallbacks
};
