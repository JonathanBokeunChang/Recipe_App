# TikTok ToS-Compliant Implementation Plan

## Executive Summary

This plan redesigns the TikTok URL processing flow to comply with TikTok's Terms of Service by eliminating unauthorized video downloads. The solution implements a **Transcript-First Architecture** that leverages TikTok's official APIs and third-party transcript services, while preserving the high-quality Gemini video upload feature for user-provided videos.

**Key Changes:**
- **Remove:** yt-dlp video downloading (ToS violation)
- **Add:** TikTok Display API + Transcript API integration
- **Keep:** Gemini video upload for user-uploaded videos from camera roll
- **Result:** Fully compliant, maintains quality, reduces legal risk

---

## Problem Analysis

### Current Flow (NON-COMPLIANT)
```
User pastes TikTok URL → Backend validates → yt-dlp downloads video → Upload to Gemini → Recipe generation
```

**ToS Violations:**
- Downloads TikTok content without authorization (violates Section 8 of TikTok ToS)
- Uses unauthorized third-party tools (yt-dlp)
- Risk: Account/app bans, legal issues, reputation damage

**Files Involved:**
- [services/api/src/pipeline.js](services/api/src/pipeline.js) - Uses yt-dlp to download videos
- [services/api/src/tiktok.js](services/api/src/tiktok.js) - URL validation only
- [apps/mobile/app/paste-link.tsx](apps/mobile/app/paste-link.tsx) - TikTok URL input UI

---

## Recommended Solution: Transcript-First Architecture

### Three-Tier Approach

**Tier 1: Transcript-Based Recipe Extraction (PRIMARY - NEW)**
- Use TikTok oEmbed API to get video metadata (no auth required)
- Use third-party transcript API to extract captions/subtitles
- Feed transcript + metadata to Gemini text model for recipe structuring
- **Advantages:** ToS-compliant, fast (~30s), cost-effective ($0.005/request)
- **Limitations:** Requires videos to have captions (most cooking videos do)

**Tier 2: User Video Upload (SECONDARY - EXISTING)**
- User downloads video to their device (their personal use = compliant)
- User uploads from camera roll → Gemini video analysis (existing feature)
- **Advantages:** Highest quality extraction, user owns the content
- **Limitations:** Extra steps for user, larger bandwidth usage

**Tier 3: Fallback UI (TERTIARY - NEW)**
- Display TikTok embed player using oEmbed (compliant embedding)
- Show partial extraction results
- Prompt user to upload video or manually enter details
- **Advantages:** Always available, guides user to better options
- **Limitations:** Requires manual effort

### Why This Works

1. **Legal Compliance:** All TikTok interactions use official APIs (oEmbed) or user-owned content
2. **Quality Preservation:** Gemini excels at extracting recipes from transcripts (text understanding is Gemini's strength)
3. **User Experience:** Maintains <60s latency target, clear fallback messaging
4. **Cost Effective:** Transcript processing cheaper than video processing

---

## Implementation Details

### Phase 1: Backend API Integration

#### 1.1 Add TikTok oEmbed Integration

**Create new file:** [services/api/src/tiktok-oembed.js](services/api/src/tiktok-oembed.js)

```javascript
/**
 * TikTok oEmbed API integration (official, no auth required)
 * Docs: https://developers.tiktok.com/doc/embed-videos/
 */

export async function getTikTokOEmbed(videoUrl) {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
  const response = await fetch(oembedUrl);

  if (!response.ok) {
    throw new Error(`TikTok oEmbed failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    title: data.title,
    authorName: data.author_name,
    authorUrl: data.author_url,
    thumbnailUrl: data.thumbnail_url,
    embedHtml: data.html,
    providerName: data.provider_name,
    version: data.version
  };
}
```

#### 1.2 Add Transcript Extraction Service

**Create new file:** [services/api/src/transcript-api.js](services/api/src/transcript-api.js)

```javascript
/**
 * Third-party transcript API integration
 * Recommended: SupaData (https://supadata.ai/tiktok-transcript-api)
 * Alternative: SocialKit (https://www.socialkit.dev/tiktok-transcript-api)
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

async function extractViaSupaData(videoUrl) {
  const response = await fetch('https://api.supadata.ai/v1/tiktok/transcript', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TRANSCRIPT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: videoUrl })
  });

  if (!response.ok) {
    throw new Error(`Transcript extraction failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    text: data.transcript,
    segments: data.segments, // Array of {text, start, duration}
    language: data.language,
    confidence: data.confidence || 0.8
  };
}
```

#### 1.3 Add Gemini Transcript-to-Recipe Function

**Modify:** [services/api/src/llm.js](services/api/src/llm.js)

Add new function alongside existing `generateRecipeFromVideo()`:

```javascript
/**
 * Generate recipe from video transcript (text-based extraction)
 * Complements existing generateRecipeFromVideo() for user uploads
 */
export async function generateRecipeFromTranscript({ transcript, metadata, url }) {
  const config = getLlmConfig();

  try {
    console.info('[llm] generating recipe from transcript');

    const genAI = createClient();
    const model = genAI.getGenerativeModel({
      model: config.model, // 'gemini-1.5-flash'
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json'
      }
    });

    const prompt = `${SYSTEM_PROMPT}

Video Metadata:
- Title: ${metadata.title || 'Unknown'}
- Author: ${metadata.authorName || 'Unknown'}
- Source: TikTok cooking video

Video Transcript:
${transcript.text}

Extract the recipe from this cooking video transcript. Include all ingredients with quantities, numbered steps in order, estimated times, and macros. Mark any inferred data in assumptions.`;

    const result = await model.generateContent([{ text: prompt }]);
    const message = result.response.text();
    const parsed = JSON.parse(message);

    return normalizeRecipe(parsed, {
      url,
      videoAnalysis: false,
      transcriptBased: true,
      transcriptConfidence: transcript.confidence
    });

  } catch (err) {
    console.warn('[llm] transcript recipe extraction failed:', err?.message ?? err);
    return buildFallbackRecipe({ url, reason: 'transcript_processing_failed' });
  }
}
```

#### 1.4 Redesign Pipeline with Compliant Flow

**Modify:** [services/api/src/pipeline.js](services/api/src/pipeline.js)

Replace `runTikTokPipeline` with new compliant version:

```javascript
/**
 * NEW: ToS-compliant TikTok pipeline using transcript extraction
 * Replaces old yt-dlp download approach
 */
export async function runTikTokPipelineCompliant({ sourceUrl, jobId }) {
  const steps = [];

  try {
    // Step 1: Normalize URL (keep existing logic)
    const normalizedUrl = await runStep('normalize_url', async () => {
      const result = normalizeTikTokUrl(sourceUrl);
      if (!result.ok) throw new Error(result.error);
      return result.url;
    });

    // Step 2: Get video metadata via oEmbed (official API)
    const metadata = await runStep('fetch_metadata', async () => {
      return await getTikTokOEmbed(normalizedUrl);
    });

    // Step 3: Extract transcript via third-party API
    const transcript = await runStep('extract_transcript', async () => {
      try {
        return await extractTikTokTranscript(normalizedUrl);
      } catch (err) {
        console.warn('[pipeline] transcript extraction failed:', err.message);
        // Return partial result to trigger fallback
        return {
          text: '',
          confidence: 0,
          error: err.message
        };
      }
    });

    // Step 4: Generate recipe from transcript
    const recipe = await runStep('generate_recipe', async () => {
      if (!transcript.text || transcript.confidence < 0.3) {
        // Low confidence or no transcript - suggest upload
        return buildFallbackRecipe({
          url: normalizedUrl,
          metadata,
          reason: 'no_transcript_available',
          suggestion: 'upload_video_for_better_results'
        });
      }

      return await generateRecipeFromTranscript({
        transcript,
        metadata,
        url: normalizedUrl
      });
    });

    return {
      success: true,
      recipe,
      steps,
      metadata: {
        transcriptAvailable: !!transcript.text,
        transcriptConfidence: transcript.confidence,
        method: transcript.text ? 'transcript' : 'fallback'
      }
    };

  } catch (err) {
    console.error('[pipeline] TikTok pipeline failed:', err);
    throw err;
  }
}

/**
 * KEEP: Existing pipeline for user-uploaded videos
 * Used when user uploads video from camera roll
 */
export async function runLocalVideoPipeline({ videoPath, jobId }) {
  // Keep existing implementation using generateRecipeFromVideo()
  // This flow is ToS-compliant (user owns/uploaded the content)

  const steps = [];

  const recipe = await runStep('gemini_video_recipe', async () => {
    return await generateRecipeFromVideo({
      videoPath,
      url: null
    });
  });

  return {
    success: true,
    recipe,
    steps,
    metadata: {
      method: 'video_upload'
    }
  };
}
```

#### 1.5 Add Video Upload Endpoint

**Modify:** [services/api/src/index.js](services/api/src/index.js)

Add new endpoint for video uploads:

```javascript
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';

// Configure multer for video uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MOV, AVI allowed.'));
    }
  }
});

/**
 * NEW: Video upload endpoint
 * POST /api/upload-video
 * Body: multipart/form-data with 'video' field
 */
app.post('/api/upload-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const jobId = nanoid();
    const videoPath = req.file.path;

    // Create job
    createJob(jobId, { status: 'queued', source: 'video_upload' });

    // Process async
    runLocalVideoPipeline({ videoPath, jobId })
      .then(result => {
        updateJob(jobId, {
          status: 'completed',
          result: result.recipe,
          metadata: result.metadata
        });
      })
      .catch(err => {
        updateJob(jobId, {
          status: 'failed',
          error: err.message
        });
      })
      .finally(() => {
        // Clean up uploaded file
        fs.unlink(videoPath, (err) => {
          if (err) console.warn('[cleanup] failed to delete uploaded video:', err);
        });
      });

    res.status(202).json({ jobId, status: 'queued' });

  } catch (err) {
    console.error('[upload] video upload failed:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * MODIFY: Existing /api/ingest endpoint
 * Now routes to compliant pipeline
 */
app.post('/api/ingest', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  const jobId = nanoid();
  createJob(jobId, { status: 'queued', source: 'url' });

  // Use NEW compliant pipeline
  runTikTokPipelineCompliant({ sourceUrl: url, jobId })
    .then(result => {
      updateJob(jobId, {
        status: 'completed',
        result: result.recipe,
        metadata: result.metadata
      });
    })
    .catch(err => {
      updateJob(jobId, {
        status: 'failed',
        error: err.message
      });
    });

  res.status(202).json({ jobId, status: 'queued' });
});
```

---

### Phase 2: Mobile App Updates

#### 2.1 Update Paste Link Screen with Fallback Messaging

**Modify:** [apps/mobile/app/paste-link.tsx](apps/mobile/app/paste-link.tsx)

Key changes:
1. Keep TikTok URL input (routes to new compliant backend)
2. Add messaging about transcript-based extraction
3. Show confidence indicators in results
4. Offer "Upload Video" button when confidence is low
5. Display TikTok embed when transcript unavailable

```typescript
// Add new state for metadata
const [extractionMetadata, setExtractionMetadata] = useState<{
  transcriptAvailable: boolean;
  transcriptConfidence: number;
  method: string;
} | null>(null);

// Update polling to capture metadata
useEffect(() => {
  // ... existing polling logic ...

  if (job.status === 'completed') {
    setRecipe(job.result);
    setExtractionMetadata(job.metadata);
    // Show confidence warning if needed
    if (job.metadata?.transcriptConfidence < 0.7) {
      // Show banner: "Low confidence extraction. Upload video for better results."
    }
  }
}, [jobId]);

// Add upload video button in results
{extractionMetadata?.transcriptConfidence < 0.7 && (
  <TouchableOpacity
    style={styles.uploadButton}
    onPress={() => router.push('/upload-video')}
  >
    <Text>Upload Video for Better Results</Text>
  </TouchableOpacity>
)}
```

#### 2.2 Create Video Upload Screen

**Create new file:** [apps/mobile/app/upload-video.tsx](apps/mobile/app/upload-video.tsx)

```typescript
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function UploadVideoScreen() {
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  async function pickAndUploadVideo() {
    try {
      setUploading(true);

      // Pick video from device
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true
      });

      if (result.type === 'cancel') {
        setUploading(false);
        return;
      }

      // Upload to backend
      const formData = new FormData();
      formData.append('video', {
        uri: result.uri,
        type: 'video/mp4',
        name: 'upload.mp4'
      } as any);

      const response = await fetch(`${API_URL}/upload-video`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const data = await response.json();
      setJobId(data.jobId);

      // Start polling (reuse existing polling logic)
      // ...

    } catch (err) {
      console.error('Upload failed:', err);
      Alert.alert('Upload Failed', err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Cooking Video</Text>
      <Text style={styles.subtitle}>
        For best recipe extraction, upload the video directly from your device
      </Text>

      <TouchableOpacity
        style={styles.pickButton}
        onPress={pickAndUploadVideo}
        disabled={uploading}
      >
        <Text>{uploading ? 'Uploading...' : 'Choose Video'}</Text>
      </TouchableOpacity>

      {jobId && <ProcessingStatus jobId={jobId} />}
    </View>
  );
}
```

#### 2.3 Update Home Screen with Upload Option

**Modify:** [apps/mobile/app/(tabs)/index.tsx](apps/mobile/app/(tabs)/index.tsx)

Add prominent "Upload Video" button alongside "Paste Video Link":

```typescript
<View style={styles.actionButtons}>
  <TouchableOpacity
    style={styles.primaryButton}
    onPress={() => router.push('/upload-video')}
  >
    <Text style={styles.primaryButtonText}>Upload Video</Text>
    <Text style={styles.buttonSubtext}>Best quality</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.secondaryButton}
    onPress={() => router.push('/paste-link')}
  >
    <Text style={styles.secondaryButtonText}>Paste Link</Text>
    <Text style={styles.buttonSubtext}>Quick & easy</Text>
  </TouchableOpacity>
</View>
```

---

### Phase 3: Environment Configuration

#### 3.1 Add New Environment Variables

**Create/Update:** [services/api/.env.example](services/api/.env.example)

```bash
# Existing
GEMINI_API_KEY=your_gemini_api_key_here

# NEW: Transcript API (choose one provider)
TRANSCRIPT_API_PROVIDER=supadata  # or 'socialkit'
TRANSCRIPT_API_KEY=your_transcript_api_key_here

# Optional: For future TikTok Display API access (requires approval)
# TIKTOK_CLIENT_KEY=your_client_key
# TIKTOK_CLIENT_SECRET=your_client_secret
```

#### 3.2 Update Environment Validation

**Modify:** [services/api/src/env.js](services/api/src/env.js)

```javascript
export function logEnvStatus() {
  const required = {
    'GEMINI_API_KEY': !!process.env.GEMINI_API_KEY,
    'TRANSCRIPT_API_KEY': !!process.env.TRANSCRIPT_API_KEY
  };

  const optional = {
    'FDC_API_KEY': !!process.env.FDC_API_KEY,
    'TIKTOK_CLIENT_KEY': !!process.env.TIKTOK_CLIENT_KEY
  };

  // Log warnings for missing required keys
  for (const [key, present] of Object.entries(required)) {
    if (!present) {
      console.warn(`[env] Missing required: ${key}`);
    }
  }

  // Log info for optional keys
  for (const [key, present] of Object.entries(optional)) {
    console.info(`[env] ${key}: ${present ? 'set' : 'not set (optional)'}`);
  }
}
```

---

### Phase 4: Migration & Deployment Strategy

#### 4.1 Feature Flag Approach

Add environment variable for gradual rollout:

```bash
# Feature flags
USE_COMPLIANT_PIPELINE=true  # Set to 'true' to enable new flow
ALLOW_VIDEO_UPLOAD=true      # Set to 'true' to enable upload feature
```

Update [services/api/src/index.js](services/api/src/index.js):

```javascript
app.post('/api/ingest', async (req, res) => {
  const useCompliant = process.env.USE_COMPLIANT_PIPELINE === 'true';

  if (useCompliant) {
    // New compliant pipeline
    runTikTokPipelineCompliant({ sourceUrl: url, jobId });
  } else {
    // Old pipeline (deprecated, will be removed)
    runTikTokPipeline({ sourceUrl: url, jobId });
  }
});
```

#### 4.2 Deployment Steps

1. **Deploy backend with feature flag OFF**
   - Merge code but keep `USE_COMPLIANT_PIPELINE=false`
   - Verify no regressions

2. **Enable for internal testing**
   - Set `USE_COMPLIANT_PIPELINE=true` on staging
   - Test with 20+ diverse TikTok videos
   - Validate recipe quality matches or exceeds old approach

3. **Gradual production rollout**
   - Week 1: 10% of traffic
   - Week 2: 50% of traffic
   - Week 3: 100% of traffic

4. **Monitor metrics**
   - Success rate (target >80%)
   - Latency (target <60s)
   - User feedback scores

5. **Remove old code**
   - After 2 weeks at 100%, remove yt-dlp pipeline
   - Delete deprecated functions
   - Update documentation

#### 4.3 User Communication

**In-app messaging:**
- "We've improved our TikTok integration for better compliance and quality"
- "For videos without captions, try uploading directly for best results"
- Show confidence indicators on all extractions

**Documentation updates:**
- Update README with new API requirements
- Add troubleshooting guide for low-confidence extractions
- Document video upload feature

---

## Testing Strategy

### Unit Tests

**New test file:** [services/api/src/__tests__/transcript-api.test.js](services/api/src/__tests__/transcript-api.test.js)

```javascript
describe('Transcript API Integration', () => {
  it('should extract transcript from TikTok URL', async () => {
    const result = await extractTikTokTranscript(SAMPLE_URL);
    expect(result.text).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle videos without transcripts gracefully', async () => {
    // Test error handling
  });
});
```

### Integration Tests

**Test scenarios:**
1. TikTok URL with captions → Successful recipe extraction
2. TikTok URL without captions → Fallback response with suggestions
3. Video upload → High-quality recipe extraction
4. Invalid URL → Clear error message
5. API failures → Graceful degradation

### Manual QA Checklist

- [ ] Test 20+ TikTok cooking videos (diverse creators, languages)
- [ ] Compare recipe quality: transcript vs video upload
- [ ] Verify confidence scores are accurate
- [ ] Test fallback UI with embed player
- [ ] Verify no video downloads occur (check temp directories)
- [ ] Test upload flow end-to-end
- [ ] Verify latency <60s for both flows
- [ ] Test error scenarios (API down, invalid URLs, etc.)

---

## API Integration Setup Guides

### SupaData Transcript API Setup

1. **Sign up:** Visit https://supadata.ai
2. **Get API key:** Dashboard → API Keys → Create New
3. **Pricing:** Free tier: 100 requests/month, Paid: $0.005/request
4. **Set environment variable:** `TRANSCRIPT_API_KEY=your_key_here`
5. **Test:** `curl -X POST https://api.supadata.ai/v1/tiktok/transcript -H "Authorization: Bearer YOUR_KEY" -d '{"url":"https://tiktok.com/@user/video/123"}'`

### Alternative: SocialKit API Setup

1. **Sign up:** Visit https://www.socialkit.dev
2. **Subscribe:** Choose TikTok Transcript API plan
3. **Get credentials:** Dashboard → API Credentials
4. **Set variables:** `TRANSCRIPT_API_PROVIDER=socialkit` and `TRANSCRIPT_API_KEY=your_key`

### TikTok oEmbed (No Setup Required)

- **Endpoint:** `https://www.tiktok.com/oembed?url={VIDEO_URL}`
- **No authentication required**
- **Rate limits:** Not officially documented, be respectful
- **Docs:** https://developers.tiktok.com/doc/embed-videos/

---

## Cost Analysis

### Current Flow (Non-Compliant)
- yt-dlp: Free (but illegal)
- Gemini video upload: ~$0.002-0.005 per video
- **Risk cost:** Potential ban, legal issues (PRICELESS)

### New Flow (Compliant)

**Per TikTok URL request:**
- TikTok oEmbed: Free
- Transcript API: $0.005 (SupaData pricing)
- Gemini text processing: ~$0.0001
- **Total:** ~$0.005 per URL

**Per video upload request:**
- Gemini video upload: ~$0.002-0.005
- **Total:** ~$0.005 per upload (same as before)

**Monthly estimates (1000 requests):**
- 70% URLs, 30% uploads: ~$5.65/month
- Previous cost: ~$3.50/month (illegal)
- **Net increase:** ~$2.15/month for legal compliance ✅

---

## Risk Mitigation

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Transcript API downtime | High | Implement retry logic, fallback to embed UI, cache successful requests | Planned |
| Poor transcript quality | Medium | Show confidence scores, suggest upload option, A/B test prompts | Planned |
| TikTok oEmbed rate limits | Low | Implement caching, exponential backoff, monitor usage | Planned |
| User resistance to upload | Medium | Clear messaging about benefits, make upload flow frictionless | Planned |
| Recipe quality degradation | High | A/B test transcript vs video approaches, tune Gemini prompts, gather user feedback | Testing phase |
| Cost increase | Low | Monitor usage, optimize API calls, implement caching | Ongoing |

---

## Success Metrics

### Compliance (Critical)
- ✅ Zero unauthorized video downloads
- ✅ All TikTok interactions via official APIs or user-owned content
- ✅ No ToS violations detected

### Quality (Primary)
- 🎯 Recipe extraction success rate >80%
- 🎯 User satisfaction score >4/5
- 🎯 Confidence score accuracy within 10%

### Performance (Secondary)
- 🎯 Latency <60s (90th percentile)
- 🎯 API success rate >95%
- 🎯 Cost per recipe <$0.01

### Adoption (Tertiary)
- 📊 Video upload adoption rate >20%
- 📊 Reduced support tickets about extraction quality
- 📊 Positive user feedback on compliance messaging

---

## Critical Files Summary

### Files to Modify
1. **[services/api/src/pipeline.js](services/api/src/pipeline.js)** - Replace yt-dlp with transcript pipeline
2. **[services/api/src/llm.js](services/api/src/llm.js)** - Add `generateRecipeFromTranscript()`
3. **[services/api/src/index.js](services/api/src/index.js)** - Add upload endpoint, update /api/ingest
4. **[apps/mobile/app/paste-link.tsx](apps/mobile/app/paste-link.tsx)** - Add confidence UI, upload suggestions
5. **[apps/mobile/app/(tabs)/index.tsx](apps/mobile/app/(tabs)/index.tsx)** - Add upload button

### Files to Create
1. **[services/api/src/tiktok-oembed.js](services/api/src/tiktok-oembed.js)** - TikTok oEmbed client
2. **[services/api/src/transcript-api.js](services/api/src/transcript-api.js)** - Transcript service integration
3. **[apps/mobile/app/upload-video.tsx](apps/mobile/app/upload-video.tsx)** - Video upload UI
4. **[services/api/src/__tests__/transcript-api.test.js](services/api/src/__tests__/transcript-api.test.js)** - Integration tests

### Files to Eventually Delete
1. **[services/api/src/pipeline.js](services/api/src/pipeline.js)** - Remove old `runTikTokPipeline()` function (after migration)

---

## Verification Plan

After implementation, verify compliance and quality:

### Compliance Verification
```bash
# 1. Check no video downloads occur
cd services/api
rm -rf /tmp/video-recipe-*
npm run dev
# Submit TikTok URL via app
# Verify no new directories created in /tmp/

# 2. Verify all TikTok API calls are official
# Check network logs for:
# ✅ https://www.tiktok.com/oembed (official)
# ✅ https://api.supadata.ai/v1/tiktok/transcript (authorized third-party)
# ❌ No yt-dlp subprocess calls

# 3. Test upload flow works
# Upload video from device
# Verify uses existing Gemini video pipeline
```

### Quality Verification
```bash
# 1. Run tests
cd services/api
npm test

# 2. Compare extraction quality
# Test same 20 videos with:
# - Old flow (if still available in staging)
# - New transcript flow
# - Upload flow
# Compare: ingredient accuracy, step completeness, macro estimates

# 3. Monitor production metrics
# Dashboard tracking:
# - Success rate by method (transcript vs upload)
# - Average confidence scores
# - User feedback ratings
# - Cost per request
```

---

## Alternative Approaches Considered

### ❌ Alternative 1: Direct Gemini URL Processing
- **Pros:** Single API call, high quality
- **Cons:** Gemini doesn't support TikTok URLs (requires public video files)
- **Status:** Not technically viable

### ❌ Alternative 2: TikTok Official Display/Content API
- **Pros:** Official, potentially highest quality
- **Cons:** Requires per-user OAuth, strict approval process, only accesses user's own content
- **Status:** Too restrictive (can't access arbitrary TikTok videos)

### ❌ Alternative 3: Web Scraping
- **Pros:** Could work technically
- **Cons:** Still violates ToS, fragile, risk of IP bans, arms race with anti-scraping
- **Status:** Rejected (doesn't solve compliance issue)

### ✅ Alternative 4: Transcript-First (SELECTED)
- **Pros:** ToS-compliant, fast, cost-effective, works for most cooking videos
- **Cons:** Requires captions (most cooking videos have them)
- **Status:** Selected as primary approach with upload as fallback

### 🤔 Alternative 5: YouTube-Only Pivot (Last Resort)
- **Pros:** YouTube has more permissive APIs, Gemini supports YouTube URLs
- **Cons:** Loses TikTok content source (major feature regression)
- **Status:** Keep as backup plan if TikTok approach fails

---

## Timeline & Next Steps

### Immediate (This Week)
1. **Decision:** Approve this plan
2. **Setup:** Register for SupaData transcript API
3. **Prototype:** Build transcript → recipe flow in isolation
4. **Validate:** Test with 5-10 sample TikTok videos

### Week 1: Backend Foundation
- Implement TikTok oEmbed integration
- Implement transcript API integration
- Add `generateRecipeFromTranscript()` to LLM service
- Write unit tests

### Week 2: Pipeline Integration
- Build new compliant pipeline
- Add video upload endpoint
- Implement feature flags
- Integration testing

### Week 3: Mobile Updates
- Update paste-link screen with confidence UI
- Create upload-video screen
- Update home screen
- End-to-end testing

### Week 4: Testing & Refinement
- Manual QA with diverse videos
- A/B test quality vs old approach
- Tune Gemini prompts for transcript processing
- Performance optimization

### Week 5: Deployment
- Deploy with feature flag disabled
- Enable for internal testing
- Gradual rollout (10% → 50% → 100%)
- Monitor metrics

### Week 6+: Cleanup
- Remove old yt-dlp code
- Update documentation
- Gather user feedback
- Iterate on prompts and UI

---

## User Decisions (Confirmed)

1. **Transcript API provider:** ✅ SupaData ($0.005/request)
2. **Implementation priority:** ✅ Transcript flow first, then video upload
3. **Quality threshold:** ✅ 80% recipe extraction success rate minimum
4. **Migration approach:** Gradual rollout with feature flags (5-week timeline)

---

## Conclusion

This plan transforms the TikTok integration from a ToS-violating download-based system to a **fully compliant, multi-modal extraction platform**. By leveraging transcripts as the primary data source and preserving video upload as a premium option, we:

✅ **Eliminate legal risk** (no unauthorized downloads)
✅ **Maintain quality** (Gemini excels at transcript understanding)
✅ **Preserve user experience** (<60s latency, clear fallbacks)
✅ **Control costs** (~$0.005/request, minimal increase)
✅ **Future-proof architecture** (can add TikTok official APIs when approved)

The transcript-first approach is the **optimal balance** of compliance, quality, cost, and user experience.

---

## Sources

Research sources consulted for this plan:

- [TikTok Developer Terms of Service](https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en)
- [TikTok Terms of Service](https://www.tiktok.com/legal/page/row/terms-of-service/en)
- [TikTok API Guide 2026](https://getlate.dev/blog/tiktok-api)
- [TikTok Embed Videos Documentation](https://developers.tiktok.com/doc/embed-videos/)
- [Best Recipe Apps for Social Media Imports](https://honeydewcook.com/blog/recipe-apps-social-media-imports)
- [SupaData TikTok Transcript API](https://supadata.ai/tiktok-transcript-api)
- [SocialKit TikTok Transcript API](https://www.socialkit.dev/tiktok-transcript-api)
- [How to Embed TikTok Videos Legally](https://taggbox.com/blog/embed-tiktok-video-on-website/)
