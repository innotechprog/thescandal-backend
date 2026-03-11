const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OPENAI_API_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const LOCATION_PATTERNS = [
  /(?:incident|happened|occurred|attack|accident|fire|flood|robbery|theft)\s+(?:in|at|around|near)\s+([A-Z][A-Za-z'.\-]*(?:\s+[A-Z][A-Za-z'.\-]*){0,4})/g,
  /(?:in|at|around|near|from)\s+([A-Z][A-Za-z'.\-]*(?:\s+[A-Z][A-Za-z'.\-]*){0,4})/g,
];

function uniqueStrings(values = []) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function extractCandidates(content = '') {
  const candidates = [];

  for (const re of LOCATION_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      candidates.push(match[1]);
    }
  }

  // Capture hashtag-like location tags, e.g. #Ikeja #Lagos
  const tagMatches = content.match(/#([A-Z][A-Za-z\-]{2,})/g) || [];
  for (const tag of tagMatches) {
    candidates.push(tag.replace('#', ''));
  }

  return uniqueStrings(candidates).slice(0, 6);
}

async function geocodeCandidate(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2200);

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        // Nominatim requires identifying User-Agent for fair use.
        'User-Agent': 'TheScandal/1.0 (location-detection)',
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0];
    const lat = Number(first.lat);
    const lng = Number(first.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      sourceText: query,
      displayName: first.display_name || query,
      lat,
      lng,
      confidence: 0.82,
    };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function detectWithOpenAI(content = '') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2600);

  try {
    const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'Extract likely location from user text. Return JSON only with keys: place (string or null), country (string or null), confidence (0..1).',
          },
          {
            role: 'user',
            content,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== 'string') return null;

    const parsed = JSON.parse(raw);
    const place = typeof parsed.place === 'string' ? parsed.place.trim() : '';
    const country = typeof parsed.country === 'string' ? parsed.country.trim() : '';
    const confidence = Number(parsed.confidence);

    if (!place) return null;

    return {
      sourceText: place,
      displayName: place,
      country: country || null,
      lat: null,
      lng: null,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.7,
    };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function detectIncidentLocation(content = '') {
  const aiDetected = await detectWithOpenAI(content);
  if (aiDetected) return aiDetected;

  const candidates = extractCandidates(content);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const detected = await geocodeCandidate(candidate);
    if (detected) return detected;
  }

  // If geocoder is unavailable, keep a low-confidence text-only fallback.
  return {
    sourceText: candidates[0],
    displayName: candidates[0],
    country: null,
    lat: null,
    lng: null,
    confidence: 0.35,
  };
}

module.exports = {
  detectIncidentLocation,
};
