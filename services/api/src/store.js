import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data', 'jobs');

/**
 * Ensure the DATA_DIR directory exists, creating it and any missing parent directories.
 *
 * If the directory already exists, this is a no-op; otherwise the directory tree is created.
 */
async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export class JobStore {
  constructor() {
    this.ready = ensureDir();
  }

  async create(job) {
    await this.ready;
    const file = this.filePath(job.id);
    await fs.writeFile(file, JSON.stringify(job, null, 2));
    return job;
  }

  async update(id, patch) {
    await this.ready;
    const current = await this.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await fs.writeFile(this.filePath(id), JSON.stringify(next, null, 2));
    return next;
  }

  async get(id) {
    await this.ready;
    try {
      const raw = await fs.readFile(this.filePath(id), 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  filePath(id) {
    return path.join(DATA_DIR, `${id}.json`);
  }
}