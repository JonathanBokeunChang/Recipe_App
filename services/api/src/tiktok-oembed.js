/**
 * TikTok oEmbed API integration (official, no auth required)
 * Docs: https://developers.tiktok.com/doc/embed-videos/
 *
 * This module uses TikTok's official oEmbed API to fetch video metadata
 * without downloading the video file. This is ToS-compliant.
 */

/**
 * Fetch video metadata using TikTok's official oEmbed API
 * @param {string} videoUrl - The TikTok video URL
 * @returns {Promise<Object>} Video metadata including title, author, thumbnail, etc.
 */
export async function getTikTokOEmbed(videoUrl) {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;

  try {
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      throw new Error(`TikTok oEmbed failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      title: data.title || 'Untitled TikTok Video',
      authorName: data.author_name || 'Unknown',
      authorUrl: data.author_url || '',
      thumbnailUrl: data.thumbnail_url || '',
      embedHtml: data.html || '',
      providerName: data.provider_name || 'TikTok',
      version: data.version || '1.0'
    };
  } catch (err) {
    console.error('[tiktok-oembed] Failed to fetch oEmbed data:', err.message);
    throw new Error(`Failed to fetch TikTok video metadata: ${err.message}`);
  }
}
