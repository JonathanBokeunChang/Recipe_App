const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
]);

export function normalizeTikTokUrl(input) {
  const trimmed = input?.trim?.();
  if (!trimmed) return { ok: false, error: 'Enter a TikTok URL' };
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, error: 'Enter a valid URL' };
  }

  const host = url.hostname.toLowerCase();
  const isTikTok = TIKTOK_HOSTS.has(host) || host.endsWith('.tiktok.com');
  if (!isTikTok) {
    return { ok: false, error: 'Only TikTok links are supported right now' };
  }

  if (!url.pathname || url.pathname === '/') {
    return { ok: false, error: 'Paste the full TikTok video link' };
  }

  url.search = '';
  url.hash = '';

  return { ok: true, url: url.toString() };
}
