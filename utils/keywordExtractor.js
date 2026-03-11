const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'was', 'were', 'are', 'you', 'your',
  'their', 'they', 'them', 'about', 'just', 'into', 'over', 'under', 'when', 'where', 'what', 'will',
  'would', 'could', 'should', 'after', 'before', 'while', 'there', 'here', 'been', 'being', 'also', 'very',
  'then', 'than', 'because', 'anonymous', 'post', 'comment', 'scandal', 'incident'
]);

function extractKeywords(text = '', maxCount = 12) {
  if (!text) return [];

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^#/, ''))
    .filter((w) => w.length >= 3)
    .filter((w) => !STOP_WORDS.has(w));

  const freq = new Map();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxCount)
    .map(([word]) => word);
}

module.exports = { extractKeywords };
