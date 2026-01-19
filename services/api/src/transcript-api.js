/**
 * Third-party transcript API integration for TikTok videos
 * Primary: SupaData (https://supadata.ai/tiktok-transcript-api)
 * Alternative: SocialKit (https://www.socialkit.dev/tiktok-transcript-api)
 *
 * This module extracts captions/transcripts from TikTok videos using official APIs
 * without downloading the video file. This is ToS-compliant.
 */

/**
 * Extract transcript from a TikTok video URL
 * @param {string} videoUrl - The TikTok video URL
 * @returns {Promise<Object>} Transcript data with text, segments, language, and confidence
 */
export async function extractTikTokTranscript(videoUrl) {
  const provider = process.env.TRANSCRIPT_API_PROVIDER || 'supadata';

  if (provider === 'supadata') {
    return extractViaSupaData(videoUrl);
  } else if (provider === 'socialkit') {
    return extractViaSocialKit(videoUrl);
  }

  throw new Error(`Unknown transcript provider: ${provider}`);
}

/**
 * Extract transcript using SupaData API
 * @param {string} videoUrl - The TikTok video URL
 * @returns {Promise<Object>} Transcript data
 */
async function extractViaSupaData(videoUrl) {
  const apiKey = process.env.TRANSCRIPT_API_KEY;

  if (!apiKey) {
    throw new Error('TRANSCRIPT_API_KEY is missing. Set it to enable transcript extraction.');
  }

  try {
    console.info('[transcript-api] extracting transcript via SupaData');

    const response = await fetch('https://api.supadata.ai/v1/tiktok/transcript', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: videoUrl })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SupaData API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // SupaData returns transcript in various formats
    // We normalize to a consistent structure
    return {
      text: data.transcript || data.text || '',
      segments: data.segments || [], // Array of {text, start, duration}
      language: data.language || 'unknown',
      confidence: data.confidence || 0.8
    };
  } catch (err) {
    console.error('[transcript-api] SupaData extraction failed:', err.message);
    throw new Error(`Transcript extraction failed: ${err.message}`);
  }
}

/**
 * Extract transcript using SocialKit API (alternative provider)
 * @param {string} videoUrl - The TikTok video URL
 * @returns {Promise<Object>} Transcript data
 */
async function extractViaSocialKit(videoUrl) {
  const apiKey = process.env.TRANSCRIPT_API_KEY;

  if (!apiKey) {
    throw new Error('TRANSCRIPT_API_KEY is missing. Set it to enable transcript extraction.');
  }

  try {
    console.info('[transcript-api] extracting transcript via SocialKit');

    const response = await fetch('https://api.socialkit.dev/v1/tiktok/transcript', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: videoUrl })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SocialKit API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    return {
      text: data.transcript || data.text || '',
      segments: data.segments || data.captions || [],
      language: data.language || data.lang || 'unknown',
      confidence: data.confidence || data.score || 0.8
    };
  } catch (err) {
    console.error('[transcript-api] SocialKit extraction failed:', err.message);
    throw new Error(`Transcript extraction failed: ${err.message}`);
  }
}
