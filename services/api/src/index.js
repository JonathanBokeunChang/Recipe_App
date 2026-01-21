import cors from 'cors';
import express from 'express';
import multer from 'multer';
import os from 'node:os';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { logEnvStatus } from './env.js';
import { runTikTokPipeline, runTikTokPipelineCompliant, runLocalVideoPipeline, runRecipeImagePipeline } from './pipeline.js';
import { normalizeTikTokUrl } from './tiktok.js';
import { JobStore } from './store.js';
import { modifyRecipeForGoal } from './llm.js';
import { estimateMacros } from './macros.js';

const app = express();
const port = process.env.PORT || 4000;
const store = new JobStore();

logEnvStatus();

app.use(cors());
app.use(express.json());

// Configure multer for video uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MOV, AVI, MPEG allowed.'));
    }
  }
});

const imageUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const name = file.originalname?.toLowerCase() || '';
    const hasValidExt = /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(name);
    if (allowedMimes.includes(file.mimetype) || hasValidExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Upload a JPG, PNG, WEBP, or HEIC image.'));
    }
  }
});

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
    // Use compliant pipeline by default (can be controlled with feature flag)
    const useCompliant = process.env.USE_COMPLIANT_PIPELINE !== 'false'; // Default to true

    let result;
    if (useCompliant) {
      console.log('[processJob] Using ToS-compliant pipeline (transcript-based)');
      result = await runTikTokPipelineCompliant({
        sourceUrl: current.sourceUrl,
      });
    } else {
      console.log('[processJob] Using legacy pipeline (yt-dlp) - DEPRECATED');
      result = await runTikTokPipeline({
        sourceUrl: current.sourceUrl,
      });
    }

    const { recipe, steps, metadata, durationMs } = result;

    await store.update(id, {
      status: 'completed',
      result: recipe,
      steps,
      metadata,
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

/**
 * NEW: Video upload endpoint
 * POST /api/upload-video
 * Body: multipart/form-data with 'video' field
 * Used when user uploads video from their device (ToS-compliant)
 */
app.post('/api/upload-video', (req, res, next) => {
  const contentType = req.get('content-type') || '';
  console.log('[upload-video] Request received:', {
    contentType,
    contentLength: req.get('content-length'),
    method: req.method,
    hasBoundary: contentType.includes('boundary='),
  });

  // Check if content-type is correct for multipart
  if (!contentType.includes('multipart/form-data')) {
    console.error('[upload-video] Invalid content-type:', contentType);
    return res.status(400).json({
      error: 'Content-Type must be multipart/form-data',
      received: contentType || '(none)',
    });
  }

  if (!contentType.includes('boundary=')) {
    console.error('[upload-video] Missing boundary in content-type:', contentType);
    return res.status(400).json({
      error: 'Missing boundary in Content-Type header',
      hint: 'multipart/form-data requests require a boundary parameter',
      received: contentType,
    });
  }

  next();
}, (req, res, next) => {
  // Wrap multer to catch errors gracefully
  upload.single('video')(req, res, (err) => {
    if (err) {
      console.error('[upload-video] Multer error:', {
        name: err.name,
        message: err.message,
        code: err.code,
      });
      return next(err);
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('[upload-video] After multer middleware:', {
      hasFile: !!req.file,
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
    });

    if (!req.file) {
      console.error('[upload-video] No file received');
      return res.status(400).json({ error: 'No video file provided' });
    }

    console.log('[upload-video] Received video upload:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const jobId = nanoid();
    const videoPath = req.file.path;

    // Create job
    const job = {
      id: jobId,
      status: 'queued',
      provider: 'video_upload',
      sourceUrl: null,
      videoPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.create(job);

    // Process async
    (async () => {
      try {
        await store.update(jobId, { status: 'processing' });

        const result = await runLocalVideoPipeline({ videoPath });
        const { recipe, steps, metadata, durationMs } = result;

        await store.update(jobId, {
          status: 'completed',
          result: recipe,
          steps,
          metadata,
          durationMs,
        });
      } catch (err) {
        console.error('[upload-video] Processing failed:', err);
        await store.update(jobId, {
          status: 'failed',
          error: err?.message ?? 'Video processing failed',
        });
      } finally {
        // Clean up uploaded file
        fs.unlink(videoPath, (err) => {
          if (err) console.warn('[upload-video] failed to delete uploaded video:', err);
          else console.log('[upload-video] cleaned up video file:', videoPath);
        });
      }
    })();

    res.status(202).json({ jobId, status: 'queued' });

  } catch (err) {
    console.error('[upload-video] video upload failed:', err);

    // Clean up file if it was uploaded
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(500).json({ error: err?.message ?? 'Video upload failed' });
  }
});

/**
 * NEW: Recipe image upload endpoint
 * POST /api/upload-recipe-image
 * Body: multipart/form-data with 'image' field (typed or handwritten recipe photo)
 */
app.post('/api/upload-recipe-image', (req, res, next) => {
  const contentType = req.get('content-type') || '';
  console.log('[upload-image] Request received:', {
    contentType,
    contentLength: req.get('content-length'),
    method: req.method,
    hasBoundary: contentType.includes('boundary='),
  });

  if (!contentType.includes('multipart/form-data')) {
    console.error('[upload-image] Invalid content-type:', contentType);
    return res.status(400).json({
      error: 'Content-Type must be multipart/form-data',
      received: contentType || '(none)',
    });
  }

  if (!contentType.includes('boundary=')) {
    console.error('[upload-image] Missing boundary in content-type:', contentType);
    return res.status(400).json({
      error: 'Missing boundary in Content-Type header',
      hint: 'multipart/form-data requests require a boundary parameter',
      received: contentType,
    });
  }

  next();
}, (req, res, next) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) {
      console.error('[upload-image] Multer error:', {
        name: err.name,
        message: err.message,
        code: err.code,
      });
      return next(err);
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('[upload-image] After multer middleware:', {
      hasFile: !!req.file,
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {}),
    });

    if (!req.file) {
      console.error('[upload-image] No file received');
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('[upload-image] Received image upload:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    const jobId = nanoid();
    const imagePath = req.file.path;

    const job = {
      id: jobId,
      status: 'queued',
      provider: 'recipe_image',
      sourceUrl: null,
      imagePath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.create(job);

    (async () => {
      try {
        await store.update(jobId, { status: 'processing' });

        const result = await runRecipeImagePipeline({
          imagePath,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        });

        const { recipe, steps, metadata, durationMs } = result;

        await store.update(jobId, {
          status: 'completed',
          result: recipe,
          steps,
          metadata,
          durationMs,
        });
      } catch (err) {
        console.error('[upload-image] Processing failed:', err);
        await store.update(jobId, {
          status: 'failed',
          error: err?.message ?? 'Image processing failed',
        });
      } finally {
        fs.unlink(imagePath, (err) => {
          if (err) console.warn('[upload-image] failed to delete uploaded image:', err);
          else console.log('[upload-image] cleaned up image file:', imagePath);
        });
      }
    })();

    res.status(202).json({ jobId, status: 'queued' });
  } catch (err) {
    console.error('[upload-image] image upload failed:', err);

    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(500).json({ error: err?.message ?? 'Image upload failed' });
  }
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
    const { recipe, goalType, userContext } = req.body;

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
    const modification = await modifyRecipeForGoal(recipe, goalType, userContext ?? {});

    // Return the new structured response format with the modified recipe
    res.json({
      originalRecipe: recipe,
      modifiedRecipe: modification.modifiedRecipe,
      analysis: modification.analysis,
      edits: modification.edits,
      stepUpdates: modification.stepUpdates || [],
      summary: modification.summary,
      warnings: modification.warnings || [],
      substitutionPlan: modification.substitutionPlan || null,
      goalType,
    });
  } catch (err) {
    console.error('[modify] Error:', err);
    res.status(500).json({ error: err?.message ?? 'Failed to modify recipe' });
  }
});

app.post('/api/macros/estimate', async (req, res) => {
  try {
    const { recipe } = req.body ?? {};
    if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) {
      return res.status(400).json({ error: 'recipe.ingredients is required' });
    }
    const result = await estimateMacros(recipe);
    res.json(result);
  } catch (err) {
    console.error('[macros] Error:', err);
    res.status(500).json({ error: err?.message ?? 'Failed to estimate macros' });
  }
});

// Global error handler - MUST be after all routes
app.use((err, req, res, next) => {
  console.error('[express] Error middleware caught:', {
    name: err.name,
    message: err.message,
    code: err.code,
    contentType: req.get('content-type'),
    stack: err.stack?.split('\n').slice(0, 5).join('\n'),
  });

  if (err.message && err.message.includes('Boundary not found')) {
    return res.status(400).json({
      error: 'Invalid multipart/form-data request. Missing boundary in Content-Type header.',
      hint: 'Ensure Content-Type is multipart/form-data with a boundary parameter.',
      details: err.message
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Maximum size is 100MB.'
    });
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: err.message
    });
  }

  return res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(port, () => {
  console.log(`Video recipe API listening on port ${port}`);
});
