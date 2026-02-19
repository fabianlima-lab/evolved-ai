// ─────────────────────────────────────────────────────
// Voice Transcription Service
//
// Handles WhatsApp voice notes by:
//   1. Downloading the audio from Baileys media
//   2. Sending to OpenAI Whisper API for transcription
//   3. Returning the text to be processed as a normal message
//
// Uses the OpenAI SDK already installed in the project
// (same one used for Groq/NVIDIA via OpenAI-compatible API).
// ─────────────────────────────────────────────────────

import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import env from '../config/env.js';

/**
 * Transcribe a voice note buffer using OpenAI Whisper API.
 *
 * @param {Buffer} audioBuffer - Raw audio data (OGG/Opus from WhatsApp)
 * @param {string} [mimeType='audio/ogg'] - MIME type of the audio
 * @returns {Promise<{text: string|null, error: string|null, durationMs: number}>}
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg') {
  if (!audioBuffer || audioBuffer.length === 0) {
    return { text: null, error: 'empty_audio', durationMs: 0 };
  }

  // Check for API key — we use OpenAI Whisper (works with GROQ_API_KEY too on Groq's Whisper endpoint)
  const apiKey = env.GROQ_API_KEY || env.OPENAI_API_KEY;
  const baseURL = env.GROQ_API_KEY
    ? 'https://api.groq.com/openai/v1'
    : 'https://api.openai.com/v1';
  const model = env.GROQ_API_KEY ? 'whisper-large-v3' : 'whisper-1';

  if (!apiKey) {
    console.warn('[VOICE] No API key for Whisper transcription (need GROQ_API_KEY or OPENAI_API_KEY)');
    return { text: null, error: 'not_configured', durationMs: 0 };
  }

  const startTime = Date.now();

  // Write buffer to a temp file (Whisper API needs a file upload)
  const ext = mimeType.includes('ogg') ? '.ogg' : '.mp3';
  const tempPath = join(tmpdir(), `voice-${randomUUID()}${ext}`);

  try {
    await writeFile(tempPath, audioBuffer);

    // Build multipart form data
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, `voice${ext}`);
    formData.append('model', model);
    formData.append('language', 'en');
    formData.append('response_format', 'json');

    const response = await fetch(`${baseURL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[VOICE] Whisper API error ${response.status}: ${errorBody}`);
      return { text: null, error: `whisper_${response.status}`, durationMs };
    }

    const data = await response.json();
    const text = data.text?.trim();

    if (!text) {
      return { text: null, error: 'empty_transcription', durationMs };
    }

    console.log(`[VOICE] Transcribed ${audioBuffer.length} bytes in ${durationMs}ms: "${text.slice(0, 80)}..."`);
    return { text, error: null, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[VOICE] Transcription error: ${err.message}`);
    return { text: null, error: 'transcription_failed', durationMs };
  } finally {
    // Clean up temp file
    await unlink(tempPath).catch(() => {});
  }
}

/**
 * Check if voice transcription is available.
 */
export function isVoiceConfigured() {
  return !!(env.GROQ_API_KEY || env.OPENAI_API_KEY);
}
