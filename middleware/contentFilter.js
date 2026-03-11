/**
 * Basic keyword-based content filter.
 *
 * This is intentionally minimal — a whistleblower platform should not
 * over-censor legitimate disclosures.  Add or remove terms as appropriate
 * for your community guidelines.
 *
 * The list intentionally avoids geo-political or identity-based terms.
 */

const BLOCKED_TERMS = [
  // Spam / scam
  'buy now', 'click here', 'free money', 'make money fast',
  'limited offer', 'act now', 'guaranteed income',
  // Generic abuse markers (extend as needed)
  'xxx', 'porn', 'onlyfans.com',
];

/**
 * Returns true if `text` contains any blocked term.
 *
 * @param {string} text  Content to check.
 * @returns {boolean}
 */
function containsBlockedContent(text) {
  const lower = text.toLowerCase();
  return BLOCKED_TERMS.some((term) => lower.includes(term));
}

module.exports = { containsBlockedContent };
