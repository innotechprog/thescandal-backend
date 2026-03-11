/**
 * Generates a random anonymous username in the format AdjectiveNoun123.
 * No user data involved — purely random each call.
 */

const ADJECTIVES = [
  'Silent', 'Dark', 'Swift', 'Brave', 'Hidden', 'Ghost', 'Shadow', 'Stealth',
  'Fierce', 'Wild', 'Bold', 'Calm', 'Sharp', 'Free', 'Iron', 'Stone', 'Lone',
  'Blaze', 'Frost', 'Storm', 'Amber', 'Crimson', 'Azure', 'Hollow', 'Shattered',
  'Neon', 'Phantom', 'Rogue', 'Coded', 'Masked', 'Veiled', 'Muted', 'Burning',
  'Hollow', 'Falling', 'Rising', 'Wandering', 'Lost', 'Broken', 'Sealed',
];

const NOUNS = [
  'Wolf', 'Hawk', 'Bear', 'Fox', 'Eagle', 'Tiger', 'Lion', 'Raven',
  'Storm', 'River', 'Blade', 'Shield', 'Arrow', 'Flame', 'Wind', 'Tide',
  'Cipher', 'Signal', 'Pulse', 'Ember', 'Ash', 'Void', 'Spectre', 'Echo',
  'Whisper', 'Shard', 'Nexus', 'Comet', 'Dagger', 'Spark', 'Drift', 'Surge',
  'Witness', 'Source', 'Leak', 'Report', 'Voice', 'Dispatch', 'Chronicle',
];

function generateUsername() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100–999
  return `${adj}${noun}${num}`;
}

module.exports = { generateUsername };
