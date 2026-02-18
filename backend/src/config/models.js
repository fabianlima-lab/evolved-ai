/**
 * Model configuration — Single model per locked decision.
 *
 * Uses meta/llama-3.1-8b-instruct for ALL queries.
 * No tier routing. One model, consistent personality.
 *
 * NVIDIA NIMs (OpenAI-compatible API).
 */

export const MODEL_CONFIG = {
  model: 'meta/llama-3.1-8b-instruct',
  temperature: 0.7,
  maxTokens: 600,   // Enough for conversational response + action tags
  timeoutMs: 30000,
};

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// Legacy exports for backward compatibility during transition
export const MODEL_TIERS = {
  1: { ...MODEL_CONFIG, name: 'Default' },
};
export const FALLBACK_CHAIN = { 1: null };
