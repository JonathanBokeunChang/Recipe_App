import './env.js';

const FDC_API_KEY = process.env.FDC_API_KEY;
const SEARCH_URL =
  'https://api.nal.usda.gov/fdc/v1/foods/search?dataType=Foundation,SR%20Legacy&pageSize=1&query=';

// Simple in-memory cache (per process) to avoid repeated USDA calls.
const cache = new Map();
const TTL_MS = 30 * 60 * 1000;

const NUTRIENT_KEYS = {
  calories: 'Energy',
  protein: 'Protein',
  carbs: 'Carbohydrate, by difference',
  fat: 'Total lipid (fat)',
  fiber: 'Fiber, total dietary',
  sodium: 'Sodium, Na',
};

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FDC request failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function searchFdcFood(query) {
  if (!FDC_API_KEY) {
    throw new Error('FDC_API_KEY is missing');
  }

  const key = `search:${query.toLowerCase()}`;
  const cached = getFromCache(key);
  if (cached) return cached;

  const data = await fetchJson(`${SEARCH_URL}${encodeURIComponent(query)}&api_key=${FDC_API_KEY}`);
  const food = data.foods?.[0];
  if (!food) return null;

  const normalized = normalizeFood(food);
  setCache(key, normalized);
  return normalized;
}

function normalizeFood(food) {
  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    nutrients: extractNutrients(food.foodNutrients ?? []),
  };
}

function extractNutrients(foodNutrients) {
  const nutrients = {};
  for (const [key, name] of Object.entries(NUTRIENT_KEYS)) {
    const match = foodNutrients.find((n) => n.nutrientName === name);
    if (match && typeof match.value === 'number') {
      nutrients[key] = match.value;
    }
  }
  return nutrients;
}

export function hasFdcKey() {
  return Boolean(FDC_API_KEY);
}
