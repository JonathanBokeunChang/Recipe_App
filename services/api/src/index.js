import cors from 'cors';
import express from 'express';
import { nanoid } from 'nanoid';
import { logEnvStatus } from './env.js';
import { runTikTokPipeline } from './pipeline.js';
import { normalizeTikTokUrl } from './tiktok.js';
import { JobStore } from './store.js';

const app = express();
const port = process.env.PORT || 4000;
const store = new JobStore();
logEnvStatus();

app.use(cors());
app.use(express.json());

/**
 * Create and enqueue a new processing job for the given source URL and provider.
 *
 * The job is persisted and processing is started asynchronously; the function
 * returns immediately with the created job record in 'queued' state.
 *
 * @param {Object} params - Creation parameters.
 * @param {string} params.sourceUrl - The normalized source URL to process.
 * @param {string} params.provider - The content provider identifier (e.g., 'tiktok').
 * @returns {Object} The created job object containing `id`, `status` ('queued'), `provider`, `sourceUrl`, `createdAt`, and `updatedAt`.
 */
async function createJob({ sourceUrl, provider }) {
  const id = nanoid();
  const job = {
    id,
    status: 'queued',
    provider,
    sourceUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await store.create(job);

  // Fire and forget processing pipeline
  processJob(id).catch((err) => {
    store.update(id, {
      status: 'failed',
      error: err?.message ?? 'Processing failed',
    });
  });

  return job;
}

/**
 * Execute the processing pipeline for a job and update the job record with progress and outcome.
 *
 * If the job id does not exist the function exits without side effects. While processing, the job's
 * status is set to "processing". On success the job is updated to "completed" with the pipeline
 * `result`, `steps`, and `durationMs`. On failure the job is updated to "failed" with an error message.
 *
 * @param {string} id - The identifier of the job to process.
 */
async function processJob(id) {
  const current = await store.get(id);
  if (!current) return;
  await store.update(id, { status: 'processing' });

  try {
    const { recipe, steps, durationMs } = await runTikTokPipeline({
      sourceUrl: current.sourceUrl,
    });

    await store.update(id, {
      status: 'completed',
      result: recipe,
      steps,
      durationMs,
    });
  } catch (err) {
    await store.update(id, {
      status: 'failed',
      error: err?.message ?? 'Processing failed',
    });
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/ingest', (req, res) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const normalized = normalizeTikTokUrl(url);
  if (!normalized.ok) {
    return res.status(400).json({ error: normalized.error });
  }

  createJob({ sourceUrl: normalized.url, provider: 'tiktok' })
    .then((job) => {
      res.status(202).json({ jobId: job.id, status: job.status });
    })
    .catch((err) => {
      console.error('Failed to create job', err);
      res.status(500).json({ error: 'Failed to create job' });
    });
});

app.get('/api/jobs/:id', (req, res) => {
  store
    .get(req.params.id)
    .then((job) => {
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json(job);
    })
    .catch((err) => {
      res.status(500).json({ error: err?.message ?? 'Error fetching job' });
    });
});

app.listen(port, () => {
  console.log(`Video recipe API listening on port ${port}`);
});