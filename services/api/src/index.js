import cors from 'cors';
import express from 'express';
import { nanoid } from 'nanoid';
import { logEnvStatus } from './env.js';
import { runTikTokPipeline } from './pipeline.js';
import { normalizeTikTokUrl } from './tiktok.js';
import { JobStore } from './store.js';
import { modifyRecipeForGoal } from './llm.js';

const app = express();
const port = process.env.PORT || 4000;
const store = new JobStore();

logEnvStatus();

app.use(cors());
app.use(express.json());

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

app.post('/api/recipes/modify', async (req, res) => {
  try {
    const { recipe, goalType } = req.body;

    if (!recipe || !goalType) {
      return res.status(400).json({ error: 'recipe and goalType are required' });
    }

    if (!['bulk', 'lean_bulk', 'cut'].includes(goalType)) {
      return res.status(400).json({ error: 'goalType must be bulk, lean_bulk, or cut' });
    }

    if (!recipe.macros || !recipe.ingredients || !recipe.steps) {
      return res.status(400).json({ error: 'recipe must include macros, ingredients, and steps' });
    }

    console.log(`[modify] Starting modification for goal: ${goalType}`);

    // Use Gemini to propose micro-edits based on available levers
    const modification = await modifyRecipeForGoal(recipe, goalType);

    // Return the new structured response format with the modified recipe
    res.json({
      originalRecipe: recipe,
      modifiedRecipe: modification.modifiedRecipe,
      analysis: modification.analysis,
      edits: modification.edits,
      stepUpdates: modification.stepUpdates || [],
      summary: modification.summary,
      warnings: modification.warnings || [],
      goalType,
    });
  } catch (err) {
    console.error('[modify] Error:', err);
    res.status(500).json({ error: err?.message ?? 'Failed to modify recipe' });
  }
});

app.listen(port, () => {
  console.log(`Video recipe API listening on port ${port}`);
});
