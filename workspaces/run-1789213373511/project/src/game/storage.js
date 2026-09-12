import { STORAGE_KEY } from './constants.js';

let memoryFallbackScore = 0;

/**
 * Checks if localStorage is accessible
 */
function isLocalStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely retrieve the high score.
 * Returns 0 if no score saved or if storage is corrupted/unavailable.
 */
export function getHighScore() {
  if (isLocalStorageAvailable()) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null && typeof stored === 'string') {
        const trimmed = stored.trim();
        // Strict format: non-empty string consisting only of ASCII digits
        if (/^\d+$/.test(trimmed)) {
          const parsed = Number(trimmed);
          if (Number.isSafeInteger(parsed) && parsed >= 0) {
            return parsed;
          }
        }
      }
    } catch {
      // Fallback to memory
    }
  }
  return Number.isSafeInteger(memoryFallbackScore) && memoryFallbackScore >= 0
    ? memoryFallbackScore
    : 0;
}

/**
 * Safely save a new high score.
 * Only updates if newScore is greater than the current high score.
 * Returns the current high score.
 */
export function saveHighScore(newScore) {
  let numericScore = 0;
  if (
    typeof newScore === 'number' &&
    Number.isFinite(newScore) &&
    !Number.isNaN(newScore) &&
    newScore >= 0
  ) {
    const floored = Math.floor(newScore);
    if (Number.isSafeInteger(floored) && floored >= 0) {
      numericScore = floored;
    }
  }

  const currentBest = getHighScore();

  if (numericScore > currentBest) {
    if (isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(STORAGE_KEY, numericScore.toString());
      } catch {
        // Fallback to memory
      }
    }
    memoryFallbackScore = numericScore;
    return numericScore;
  }

  return currentBest;
}

/**
 * Reset stored high score (primarily for test resets)
 */
export function resetHighScore() {
  memoryFallbackScore = 0;
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}
