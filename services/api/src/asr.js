import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { runCommand } from './exec.js';
import './env.js';

/**
 * Orchestrates transcription for an audio file using configured ASR providers and fallbacks.
 *
 * Attempts Whisper CLI when configured; falls back to OpenAI ASR if available. Returns a truncated
 * transcript or a short unavailable-message when no provider can produce a transcript.
 *
 * @param {Object} params - Function parameters.
 * @param {string} params.audioPath - Filesystem path to the audio file to transcribe.
 * @param {string} params.workdir - Working directory used for temporary Whisper CLI output.
 * @param {string} [params.sourceUrl] - Optional original source URL to include in recoverable-error messages.
 * @returns {string} The transcript or a short message indicating transcript unavailability; text is truncated to the configured maximum length.
 * @throws {Error} If `audioPath` is missing.
 * @throws {Error} If the provider is `openai` but `OPENAI_API_KEY` is not set.
 * @throws {Error} If transcription with the configured providers ultimately fails.
 */
export async function transcribeAudio({ audioPath, workdir, sourceUrl }) {
  if (!audioPath) throw new Error('audioPath is required for transcription.');
  const config = getAsrConfig();
  const { provider } = config;
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  if (provider !== 'openai') {
    console.info('[asr] trying whisper CLI');
    const cliResult = await tryWhisperCli({ audioPath, workdir, provider });
    if (cliResult) return cliResult;

    if (provider === 'whisper') {
      if (hasApiKey) {
        console.warn('whisper CLI missing or failed; falling back to OpenAI ASR.');
      } else {
        console.warn(
          'whisper CLI missing or failed and OPENAI_API_KEY is not set; continuing without transcript.'
        );
        return truncate(
          'Transcript unavailable; install whisper CLI or provide OPENAI_API_KEY to enable ASR.'
        );
      }
    }
  }

  if (!hasApiKey) {
    if (provider === 'openai') {
      throw new Error('OPENAI_API_KEY is missing. Provide it or install whisper CLI.');
    }
    return truncate(
      'Transcript unavailable; no ASR provider succeeded (missing OPENAI_API_KEY and whisper CLI).'
    );
  }

  console.info('[asr] using OpenAI ASR model', getAsrConfig().openaiAsrModel);
  const openaiResult = await transcribeWithOpenAI({ audioPath, sourceUrl });
  if (openaiResult) return openaiResult;
  throw new Error('Transcription failed. Check ASR configuration and try again.');
}

/**
 * Attempts to transcribe audio using the local Whisper CLI and returns a truncated transcript on success.
 *
 * If the Whisper CLI is not available or fails and the active provider is not explicitly "whisper", the function returns `null`
 * to indicate the caller should fall back to another ASR provider. If the active provider is "whisper", errors from the CLI are rethrown.
 *
 * @param {Object} params
 * @param {string} params.audioPath - Path to the audio file to transcribe.
 * @param {string} params.workdir - Working directory where Whisper will write output files.
 * @param {string} [params.provider] - Optional configured ASR provider; when set to `"whisper"` the function treats CLI failures as fatal.
 * @returns {string|null} The truncated transcript if Whisper succeeded, or `null` if the CLI is missing or failed and fallback is allowed.
 * @throws {Error} If the Whisper CLI fails and the active provider is `"whisper"`.
 */
async function tryWhisperCli({ audioPath, workdir, provider }) {
  const { whisperModel } = getAsrConfig();
  const outputBase = path.join(workdir, 'asr');
  try {
    await runCommand('whisper', [
      audioPath,
      '--model',
      whisperModel,
      '--language',
      'en',
      '--output_format',
      'txt',
      '--output_dir',
      workdir,
      '--fp16',
      'False',
    ]);
    const txt = await fsp.readFile(`${outputBase}.txt`, 'utf-8');
    return truncate(txt);
  } catch (err) {
    const activeProvider = provider || getAsrConfig().provider;
    if (err?.code === 'ENOENT') {
      if (activeProvider !== 'whisper') {
        console.warn('whisper CLI not found on PATH; falling back to OpenAI ASR.');
      }
      return null; // whisper CLI missing
    }
    if (activeProvider === 'whisper') {
      throw err;
    }
    console.warn('whisper CLI failed; falling back to OpenAI ASR:', err?.message ?? err);
    return null;
  }
}

/**
 * Transcribes an audio file using OpenAI's ASR model.
 *
 * Attempts to return a truncated transcript string. If a recoverable OpenAI error occurs
 * (network/quota), returns a truncated message indicating transcript unavailability
 * (optionally including the provided source URL). Non-recoverable errors are thrown.
 *
 * @param {Object} params
 * @param {string} params.audioPath - Path to the local audio file to transcribe.
 * @param {string} [params.sourceUrl] - Optional original source URL to include in fallback messages.
 * @returns {string} The transcript or a truncated explanatory message when transcription cannot be obtained.
 * @throws {Error} If OPENAI_API_KEY is not set or if transcription fails with a non-recoverable error.
 */
async function transcribeWithOpenAI({ audioPath, sourceUrl }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Provide it or install whisper CLI.');
  }
  const { openaiAsrModel } = getAsrConfig();
  const client = new OpenAI({ apiKey });
  const stream = fs.createReadStream(audioPath);

  try {
    const transcription = await client.audio.transcriptions.create({
      file: stream,
      model: openaiAsrModel,
      language: 'en',
      response_format: 'text',
    });
    return truncate(transcription);
  } catch (err) {
    // If the network/quota is blocked, fall back to an empty transcript so the pipeline can still continue.
    if (isRecoverableAsrError(err)) {
      console.warn('OpenAI ASR issue, continuing without transcript:', err?.message ?? err);
      const reason = err?.message ?? err;
      const suffix = sourceUrl ? `. Source: ${sourceUrl}` : '';
      return truncate(`Transcript unavailable; OpenAI ASR issue: ${reason}${suffix}`);
    }
    throw new Error(
      `OpenAI ASR failed${sourceUrl ? ` for ${sourceUrl}` : ''}: ${err?.message ?? err}`
    );
  }
}

/**
 * Trims input to a string and truncates it to the configured maximum transcript length.
 * @param {*} text - Value to normalize and truncate; non-strings will be coerced to string.
 * @returns {string} The trimmed text, or a truncated version ending with an ellipsis (`…`) if it exceeded `maxTranscriptChars`.
 */
function truncate(text) {
  if (!text) return '';
  const clean = text.toString().trim();
  const { maxTranscriptChars } = getAsrConfig();
  if (clean.length <= maxTranscriptChars) return clean;
  return `${clean.slice(0, maxTranscriptChars)}…`;
}

/**
 * Determines whether an ASR error is likely transient or recoverable (for example, network, timeout, TLS/certificate, or quota issues).
 * @param {*} err - The error object to evaluate; may include `code`, `status`, `message`, or a `cause`.
 * @returns {boolean} `true` if the error is likely recoverable (network/connect/timeouts, socket/TLS/certificate issues, or quota/429 conditions), `false` otherwise.
 */
function isRecoverableAsrError(err) {
  const code = err?.code || err?.cause?.code;
  const msg = (err?.message || err?.toString?.() || '').toLowerCase();
  const networkCodes = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ETIMEDOUT',
    'ERR_SOCKET_CLOSED',
  ]);
  if (code && networkCodes.has(code)) return true;
  if (Number(err?.status) === 429 || msg.includes('quota')) return true;
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('connect') ||
    msg.includes('timed out') ||
    msg.includes('socket') ||
    msg.includes('tls') ||
    msg.includes('certificate')
  );
}

/**
 * Load ASR runtime configuration from environment variables, applying sensible defaults.
 *
 * @returns {{provider: string, whisperModel: string, openaiAsrModel: string, maxTranscriptChars: number}}
 * An object containing ASR configuration:
 * - provider: active ASR provider ('auto', 'whisper', or 'openai'); defaults to 'auto'.
 * - whisperModel: model name to use for the Whisper CLI; defaults to 'tiny'.
 * - openaiAsrModel: OpenAI ASR model name; defaults to 'whisper-1'.
 * - maxTranscriptChars: maximum characters allowed for returned transcripts; numeric, defaults to 12000.
 */
function getAsrConfig() {
  return {
    provider: process.env.ASR_PROVIDER || 'auto', // auto | whisper | openai
    whisperModel: process.env.WHISPER_MODEL || 'tiny',
    openaiAsrModel: process.env.OPENAI_ASR_MODEL || 'whisper-1',
    maxTranscriptChars: Number(process.env.MAX_TRANSCRIPT_CHARS ?? 12000),
  };
}