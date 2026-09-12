import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getHighScore,
  saveHighScore,
  resetHighScore,
} from '../src/game/storage.js';
import { STORAGE_KEY } from '../src/game/constants.js';

describe('Storage Module', () => {
  beforeEach(() => {
    resetHighScore();
    window.localStorage.clear();
  });

  it('returns 0 when no high score is saved', () => {
    expect(getHighScore()).toBe(0);
  });

  it('saves and retrieves high score correctly', () => {
    const result = saveHighScore(15);
    expect(result).toBe(15);
    expect(getHighScore()).toBe(15);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('15');
  });

  it('does not overwrite high score with a lower score', () => {
    saveHighScore(20);
    const result = saveHighScore(10);
    expect(result).toBe(20);
    expect(getHighScore()).toBe(20);
  });

  it('updates high score when a higher score is achieved', () => {
    saveHighScore(10);
    const result = saveHighScore(25);
    expect(result).toBe(25);
    expect(getHighScore()).toBe(25);
  });

  it('handles invalid non-numeric inputs gracefully', () => {
    saveHighScore(5);
    saveHighScore(NaN);
    saveHighScore(-10);
    saveHighScore('invalid');
    expect(getHighScore()).toBe(5);
  });

  it('rejects Infinity and -Infinity without corrupting storage or fallback', () => {
    saveHighScore(10);
    const resultInf = saveHighScore(Infinity);
    expect(resultInf).toBe(10);
    expect(getHighScore()).toBe(10);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('10');

    const resultNegInf = saveHighScore(-Infinity);
    expect(resultNegInf).toBe(10);
    expect(getHighScore()).toBe(10);
  });

  it('handles corrupted localStorage value', () => {
    window.localStorage.setItem(STORAGE_KEY, 'corrupted_string');
    expect(getHighScore()).toBe(0);
  });

  it('rejects partially numeric corrupted strings such as 12junk', () => {
    window.localStorage.setItem(STORAGE_KEY, '12junk');
    expect(getHighScore()).toBe(0);

    window.localStorage.setItem(STORAGE_KEY, 'junk12');
    expect(getHighScore()).toBe(0);

    window.localStorage.setItem(STORAGE_KEY, 'Infinity');
    expect(getHighScore()).toBe(0);

    window.localStorage.setItem(STORAGE_KEY, '-5');
    expect(getHighScore()).toBe(0);

    window.localStorage.setItem(STORAGE_KEY, '3.14');
    expect(getHighScore()).toBe(0);
  });

  it('accepts trimmed valid numeric strings from localStorage', () => {
    window.localStorage.setItem(STORAGE_KEY, '  35  ');
    expect(getHighScore()).toBe(35);
  });

  it('falls back to in-memory storage when localStorage throws an error', () => {
    const originalSetItem = window.localStorage.setItem;
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const saved = saveHighScore(42);
    expect(saved).toBe(42);
    expect(getHighScore()).toBe(42);

    window.localStorage.setItem = originalSetItem;
  });
});
