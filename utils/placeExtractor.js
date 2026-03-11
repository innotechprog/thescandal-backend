const PLACE_PATTERNS = [
  /(?:in|at|around|near)\s+([A-Z][A-Za-z'.\-]*(?:\s+[A-Z][A-Za-z'.\-]*){0,4})/g,
  /#([A-Z][A-Za-z\-]{2,})/g,
];

const STOP_WORDS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'Someone', 'Everybody', 'Everyone', 'There', 'Here', 'Today',
]);

function cleanPlace(value = '') {
  const text = value.trim().replace(/[.,!?;:]+$/, '');
  if (!text) return null;
  if (text.length > 120) return null;
  if (STOP_WORDS.has(text)) return null;
  return text;
}

function extractPlaceMention(content = '') {
  if (!content) return null;

  for (const re of PLACE_PATTERNS) {
    re.lastIndex = 0;
    const match = re.exec(content);
    if (!match) continue;
    const candidate = cleanPlace(match[1] || '');
    if (candidate) return candidate;
  }

  return null;
}

module.exports = {
  extractPlaceMention,
};
