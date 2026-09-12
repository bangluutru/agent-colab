import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  generateId,
  validateTask,
  loadTasks,
  saveTasks,
} from './storage';

describe('storage utility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('generateId', () => {
    it('generates non-empty unique strings', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
      expect(id1).not.toBe(id2);
    });

    it('falls back gracefully when crypto.randomUUID is unavailable', () => {
      const originalCrypto = globalThis.crypto;
      // @ts-ignore
      delete globalThis.crypto;

      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.startsWith('task_')).toBe(true);

      globalThis.crypto = originalCrypto;
    });
  });

  describe('validateTask', () => {
    it('accepts a valid task and trims fields', () => {
      const seen = new Set();
      const result = validateTask(
        { id: ' 123 ', text: '  Clean kitchen  ', completed: false },
        seen
      );
      expect(result).toEqual({
        id: '123',
        text: 'Clean kitchen',
        completed: false,
      });
      expect(seen.has('123')).toBe(true);
    });

    it('rejects null, non-objects, and arrays', () => {
      expect(validateTask(null)).toBeNull();
      expect(validateTask('string')).toBeNull();
      expect(validateTask(123)).toBeNull();
      expect(validateTask([])).toBeNull();
    });

    it('rejects missing, empty, or whitespace-only ids', () => {
      expect(validateTask({ text: 'Valid', completed: false })).toBeNull();
      expect(validateTask({ id: '', text: 'Valid', completed: false })).toBeNull();
      expect(validateTask({ id: '   ', text: 'Valid', completed: false })).toBeNull();
      expect(validateTask({ id: 123, text: 'Valid', completed: false })).toBeNull();
    });

    it('rejects missing, empty, or whitespace-only text', () => {
      expect(validateTask({ id: '1', completed: false })).toBeNull();
      expect(validateTask({ id: '1', text: '', completed: false })).toBeNull();
      expect(validateTask({ id: '1', text: '   ', completed: false })).toBeNull();
      expect(validateTask({ id: '1', text: null, completed: false })).toBeNull();
    });

    it('rejects non-boolean completed values', () => {
      expect(validateTask({ id: '1', text: 'Valid', completed: 'true' })).toBeNull();
      expect(validateTask({ id: '1', text: 'Valid', completed: null })).toBeNull();
      expect(validateTask({ id: '1', text: 'Valid', completed: 1 })).toBeNull();
    });

    it('rejects duplicate ids across items', () => {
      const seen = new Set(['duplicate-id']);
      expect(
        validateTask({ id: 'duplicate-id', text: 'Valid text', completed: false }, seen)
      ).toBeNull();
    });
  });

  describe('loadTasks', () => {
    it('returns empty array if storage is null', () => {
      expect(loadTasks(null)).toEqual([]);
    });

    it('returns empty array when storage key is missing or empty', () => {
      expect(loadTasks()).toEqual([]);
      localStorage.setItem(STORAGE_KEY, '');
      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array on malformed JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{ broken json');
      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array if parsed JSON is not an array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: '1' }));
      expect(loadTasks()).toEqual([]);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(12345));
      expect(loadTasks()).toEqual([]);

      localStorage.setItem(STORAGE_KEY, JSON.stringify('string'));
      expect(loadTasks()).toEqual([]);
    });

    it('discards invalid task records and preserves valid ones', () => {
      const records = [
        { id: 'task-1', text: 'Buy groceries', completed: false },
        { id: '', text: 'Invalid id', completed: false },
        { id: 'task-2', text: '   ', completed: false },
        { id: 'task-3', text: 'Clean bathroom', completed: 'not-bool' },
        null,
        'invalid item',
        { id: 'task-1', text: 'Duplicate ID', completed: true },
        { id: 'task-4', text: 'Read book', completed: true },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

      const loaded = loadTasks();
      expect(loaded).toEqual([
        { id: 'task-1', text: 'Buy groceries', completed: false },
        { id: 'task-4', text: 'Read book', completed: true },
      ]);
    });

    it('handles localStorage read exceptions safely without crashing', () => {
      const mockStorage = {
        getItem: vi.fn(() => {
          throw new Error('Access denied');
        }),
        setItem: vi.fn(),
      };
      // @ts-ignore
      const loaded = loadTasks(mockStorage);
      expect(loaded).toEqual([]);
    });
  });

  describe('saveTasks', () => {
    it('returns error result when storage is null', () => {
      const result = saveTasks([], null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage is not available');
    });

    it('serializes and saves tasks successfully', () => {
      const sample = [{ id: '1', text: 'Hello', completed: false }];
      const result = saveTasks(sample);
      expect(result.success).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(sample));
    });

    it('handles localStorage write exceptions and returns error result', () => {
      const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
      };
      // @ts-ignore
      const result = saveTasks([{ id: '1', text: 'Test', completed: false }], mockStorage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('QuotaExceededError');
    });
  });
});
