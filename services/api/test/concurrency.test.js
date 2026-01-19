import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../src/utils/concurrency.js';

test('createLimiter enforces concurrency ceiling', async () => {
  const limiter = createLimiter(3);
  let active = 0;
  let maxActive = 0;

  const tasks = Array.from({ length: 10 }, (_, i) =>
    limiter(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      return i;
    })
  );

  const results = await Promise.all(tasks);

  assert.equal(maxActive <= 3, true);
  assert.deepEqual(results, Array.from({ length: 10 }, (_, i) => i));
});

test('createLimiter defaults to 1 or higher', async () => {
  const limiter = createLimiter(0);
  let active = 0;
  let maxActive = 0;

  const tasks = [1, 2, 3].map((n) =>
    limiter(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return n * 2;
    })
  );

  const results = await Promise.all(tasks);

  assert.equal(maxActive, 1);
  assert.deepEqual(results, [2, 4, 6]);
});
