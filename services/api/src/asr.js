import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { runCommand } from './exec.js';
import './env.js';

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

function truncate(text) {
  if (!text) return '';
  const clean = text.toString().trim();
  const { maxTranscriptChars } = getAsrConfig();
  if (clean.length <= maxTranscriptChars) return clean;
  return `${clean.slice(0, maxTranscriptChars)}…`;
}

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

function getAsrConfig() {
  return {
    provider: process.env.ASR_PROVIDER || 'auto', // auto | whisper | openai
    whisperModel: process.env.WHISPER_MODEL || 'tiny',
    openaiAsrModel: process.env.OPENAI_ASR_MODEL || 'whisper-1',
    maxTranscriptChars: Number(process.env.MAX_TRANSCRIPT_CHARS ?? 12000),
  };
}
