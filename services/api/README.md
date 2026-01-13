# Video Recipe API (dev stub)

Minimal API stub to accept video links (TikTok) and simulate recipe processing.

## Run locally
```bash
cd services/api
npm install
npm run dev   # or npm start
```

## Endpoints
- `POST /api/ingest` `{ "url": "https://www.tiktok.com/..." }` → `{ jobId, status }`
- `GET /api/jobs/:id` → returns job status/result (LLM stub completes after ~2s)

## Notes
- Jobs are persisted to `data/jobs/<id>.json` (simple file store; replace with Postgres/Redis in production).
- TikTok URL normalization strips query/hash; vm./vt. subdomains accepted.
- Processing pipeline shape:
  - normalize URL → resolve download URL
  - download video (yt-dlp)
  - extract audio (ffmpeg)
  - ASR transcript (whisper CLI if installed; otherwise stub)
  - sample frames (ffmpeg) + OCR on-screen text (tesseract CLI if installed; otherwise stub)
  - LLM to structured recipe JSON (stub unless OPENAI API integrated)
- Replace stubs with real: download → ffmpeg audio → ASR (captions/Whisper) → vision cues → LLM → recipe JSON.

## Prereqs (expected on PATH)
- `yt-dlp` for TikTok download/redirect handling
- `ffmpeg` for audio extraction and frame sampling
- `whisper` CLI for ASR (optional; if missing we now fall back to OpenAI ASR when available)
- `tesseract` CLI for OCR (optional; falls back to stub if missing)
- Set `OPENAI_API_KEY` to call a remote LLM, or keep using the local stub in `llm.js`.
- If outbound network/quota blocks OpenAI, ASR now falls back to an empty transcript instead of failing; install `whisper` CLI (`pip install openai-whisper`) to keep transcripts fully local. If you do not have the whisper CLI, leave `ASR_PROVIDER` as `auto`/`openai` so it uses the API path.
- LLM failures (network/quota) now fall back to a heuristic recipe so jobs complete instead of failing.

## Environment knobs (defaults)
- `FRAME_SAMPLE_FPS` (2): frames per second to extract (2 = every 0.5s).
- `MAX_FRAME_SAMPLES` (24): cap frames extracted to keep jobs small.
- `MAX_FRAME_IMAGES` (8): max frames sent to the LLM (picked evenly across samples).
- `OPENAI_RECIPE_MODEL` (`gpt-4o-mini`): model used for recipe + vision.
- `MAX_TRANSCRIPT_CHARS` / `MAX_OCR_CHARS`: truncation limits for payloads.
