/**
 * Simple promise concurrency limiter.
 * Ensures no more than `limit` async tasks run at once.
 */
export function createLimiter(limit = 6) {
  const max = Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 1);
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= max) return;
    const item = queue.shift();
    if (!item) return;

    active++;
    item
      .fn()
      .then(item.resolve, item.reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}
