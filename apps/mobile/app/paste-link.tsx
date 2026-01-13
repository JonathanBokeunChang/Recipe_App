import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { API_BASE_URL } from '@/constants/api';
import { useColorScheme } from '@/components/useColorScheme';

type VideoSource = 'tiktok';

type ParseResult =
  | { ok: true; provider: VideoSource; normalizedUrl: string }
  | { ok: false; error: string };

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
]);

/**
 * Normalize a user-provided URL string into a URL object or indicate invalid input.
 *
 * Trims surrounding whitespace and ensures the string includes a protocol (defaults to `https` if absent) before attempting to parse it as a URL.
 *
 * @param input - The raw URL string provided by the user
 * @returns A `URL` instance for the normalized input, or `null` if the input is empty or cannot be parsed as a valid URL
 */
function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

/**
 * Parse and validate a user-provided video URL and return a normalized TikTok link ready for processing.
 *
 * Attempts to normalize the input into a URL, verifies the host is TikTok, ensures a non-empty path,
 * strips query and fragment components, and returns the normalized URL and provider on success.
 *
 * @param input - The raw URL string supplied by the user
 * @returns `{ ok: true; provider: 'tiktok'; normalizedUrl: string }` on success, or `{ ok: false; error: string }` on failure
 */
function parseVideoLink(input: string): ParseResult {
  const url = normalizeUrl(input);
  if (!url) {
    return { ok: false, error: 'Enter a valid URL.' };
  }

  const host = url.hostname.toLowerCase();
  const isTikTok = TIKTOK_HOSTS.has(host) || host.endsWith('.tiktok.com');
  if (!isTikTok) {
    return { ok: false, error: 'Only TikTok links are supported right now.' };
  }

  if (!url.pathname || url.pathname === '/') {
    return { ok: false, error: 'Paste the full TikTok video link.' };
  }

  url.search = '';
  url.hash = '';

  return { ok: true, provider: 'tiktok', normalizedUrl: url.toString() };
}

/**
 * Screen that lets the user paste a TikTok video link, validate and submit it for backend processing, and view job status and the extracted result.
 *
 * Renders an input for a video URL, controls to check and start processing, status and error messages, a normalized-link preview when available, and a detailed result view after processing completes.
 *
 * @returns A React element rendering the paste-link UI and its interactive states.
 */
export default function PasteLinkScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const [input, setInput] = React.useState('');
  const [status, setStatus] = React.useState<
    'idle' | 'error' | 'ready' | 'processing' | 'completed'
  >('idle');
  const [message, setMessage] = React.useState('');
  const [normalizedUrl, setNormalizedUrl] = React.useState<string | null>(null);
  const [provider, setProvider] = React.useState<VideoSource | null>(null);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [resultPreview, setResultPreview] = React.useState<any>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const validate = () => {
    const result = parseVideoLink(input);
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      setNormalizedUrl(null);
      setProvider(null);
      return;
    }

    setStatus('ready');
    setMessage('TikTok link detected. Ready to start processing.');
    setNormalizedUrl(result.normalizedUrl);
    setProvider(result.provider);
  };

  const submit = () => {
    const result = parseVideoLink(input);
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      setNormalizedUrl(null);
      setProvider(null);
      return;
    }

    setStatus('processing');
    setMessage('Sending to backend…');
    setNormalizedUrl(result.normalizedUrl);
    setProvider(result.provider);
    setResultPreview(null);

    fetch(`${API_BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: result.normalizedUrl }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to queue job');
        }
        return res.json();
      })
      .then((data) => {
        setJobId(data.jobId);
        setMessage('Queued for processing…');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Failed to queue job');
      });
  };

  React.useEffect(() => {
    if (!jobId) return;
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(() => {
      fetch(`${API_BASE_URL}/api/jobs/${jobId}`)
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch job status');
          return res.json();
        })
        .then((job) => {
          if (job.status === 'completed') {
            setStatus('completed');
            setMessage('Recipe generated.');
            setResultPreview(job.result);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (job.status === 'failed') {
            setStatus('error');
            setMessage(job.error || 'Processing failed.');
            if (pollRef.current) clearInterval(pollRef.current);
          } else {
            setStatus('processing');
            setMessage('Processing…');
          }
        })
        .catch((err) => {
          setStatus('error');
          setMessage(err.message || 'Failed to fetch job status');
          if (pollRef.current) clearInterval(pollRef.current);
        });
    }, 1200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Paste a video link</Text>
          <Text style={styles.subtitle}>
            We currently support TikTok links. If extraction fails, we will prompt you to
            upload the video.
          </Text>
        </View>

        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0B0F19">
          <Text style={styles.label}>Video link</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://www.tiktok.com/@creator/video/123"
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#0F172A' : '#F3F4F6',
                color: isDark ? '#F9FAFB' : '#111827',
              },
            ]}
            value={input}
            onChangeText={(text) => {
              setInput(text);
              setStatus('idle');
              setMessage('');
              setNormalizedUrl(null);
              setProvider(null);
            }}
          />

          <Pressable style={styles.secondaryButton} onPress={validate}>
            <Text style={styles.secondaryButtonText}>Check link</Text>
          </Pressable>

          {provider && normalizedUrl ? (
            <View style={styles.preview}>
              <View style={styles.badge} lightColor="#ECFEFF" darkColor="#0F172A">
                <Text style={styles.badgeText}>TikTok</Text>
              </View>
              <Text style={styles.previewText}>{normalizedUrl}</Text>
            </View>
          ) : null}

          {message ? (
            <Text
              style={[
                styles.message,
                status === 'error' ? styles.messageError : styles.messageSuccess,
              ]}
            >
              {message}
            </Text>
          ) : null}

          <Pressable
            style={[styles.primaryButton, status === 'processing' && styles.primaryDisabled]}
            onPress={submit}
            disabled={status === 'processing'}
          >
            {status === 'processing' ? (
              <ActivityIndicator color={isDark ? '#111827' : '#F9FAFB'} />
            ) : (
              <Text style={styles.primaryButtonText}>Start processing</Text>
            )}
          </Pressable>
        </View>

        {status === 'completed' && resultPreview ? (
          <View style={styles.resultCard} lightColor="#F9FAFB" darkColor="#0B1224">
            <Text style={styles.resultTitle}>{resultPreview.title}</Text>
            <Text style={styles.resultBody}>
              {resultPreview.ingredients?.length ?? 0} ingredients ·{' '}
              {resultPreview.steps?.length ?? 0} steps
            </Text>
            <Text style={styles.resultBody}>
              Macros (est.): {resultPreview.macros?.calories ?? '?'} kcal · P
              {resultPreview.macros?.protein ?? '?'} C{resultPreview.macros?.carbs ?? '?'} F
              {resultPreview.macros?.fat ?? '?'}
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              {resultPreview.ingredients?.map((item: any, idx: number) => (
                <View key={`${item.name}-${idx}`} style={styles.listRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.listText}>
                    {item.quantity ? `${item.quantity} ` : ''}
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Steps</Text>
              {resultPreview.steps?.map((step: string, idx: number) => (
                <View key={`step-${idx}`} style={styles.stepRow}>
                  <Text style={styles.stepNumber}>{idx + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            {resultPreview.assumptions?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assumptions</Text>
                {resultPreview.assumptions.map((assumption: string, idx: number) => (
                  <View key={`assumption-${idx}`} style={styles.listRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.listText}>{assumption}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.75,
  },
  card: {
    marginTop: 24,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#111827',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  preview: {
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewText: {
    fontSize: 12,
    opacity: 0.7,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageError: {
    color: '#DC2626',
  },
  messageSuccess: {
    color: '#059669',
  },
  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  resultBody: {
    fontSize: 13,
    opacity: 0.8,
  },
  section: {
    marginTop: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4B5563',
  },
  listText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepNumber: {
    width: 20,
    textAlign: 'center',
    fontWeight: '700',
    color: '#111827',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.95,
  },
});