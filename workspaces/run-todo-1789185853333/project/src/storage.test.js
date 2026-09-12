import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, isValidTask, getDefaultStorage, loadTasks, saveTasks } from './storage';

describe('storage module', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('isValidTask', () => {
    it('returns true for valid task objects', () => {
      expect(isValidTask({ id: '1', text: 'Buy milk', completed: false })).toBe(true);
      expect(isValidTask({ id: 'task-abc', text: 'Clean room', completed: true })).toBe(true);
    });

    it('returns false for non-objects or null', () => {
      expect(isValidTask(null)).toBe(false);
      expect(isValidTask(undefined)).toBe(false);
      expect(isValidTask('string')).toBe(false);
      expect(isValidTask(123)).toBe(false);
      expect(isValidTask([])).toBe(false);
    });

    it('returns false for missing or blank id', () => {
      expect(isValidTask({ text: 'Task', completed: false })).toBe(false);
      expect(isValidTask({ id: '', text: 'Task', completed: false })).toBe(false);
      expect(isValidTask({ id: '   ', text: 'Task', completed: false })).toBe(false);
      expect(isValidTask({ id: 123, text: 'Task', completed: false })).toBe(false);
    });

    it('returns false for missing or blank text', () => {
      expect(isValidTask({ id: '1', completed: false })).toBe(false);
      expect(isValidTask({ id: '1', text: '', completed: false })).toBe(false);
      expect(isValidTask({ id: '1', text: '   ', completed: false })).toBe(false);
      expect(isValidTask({ id: '1', text: 456, completed: false })).toBe(false);
    });

    it('returns false for non-boolean completed', () => {
      expect(isValidTask({ id: '1', text: 'Task' })).toBe(false);
      expect(isValidTask({ id: '1', text: 'Task', completed: 'false' })).toBe(false);
      expect(isValidTask({ id: '1', text: 'Task', completed: 0 })).toBe(false);
      expect(isValidTask({ id: '1', text: 'Task', completed: null })).toBe(false);
    });
  });

  describe('loadTasks', () => {
    it('returns empty array when key does not exist', () => {
      expect(loadTasks()).toEqual([]);
    });

    it('loads valid tasks from localStorage', () => {
      const tasks = [
        { id: '1', text: 'Task 1', completed: false },
        { id: '2', text: 'Task 2', completed: true },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      expect(loadTasks()).toEqual(tasks);
    });

    it('returns empty array when raw data is malformed JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{ invalid json');
      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array when stored data is not an array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ message: 'not an array' }));
      expect(loadTasks()).toEqual([]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify('just a string'));
      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array when array contains invalid items', () => {
      const invalidTasks = [
        { id: '1', text: 'Task 1', completed: false },
        { id: '2', text: '', completed: false }, // blank text
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invalidTasks));
      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array when array contains duplicate ids', () => {
      const duplicateTasks = [
        { id: 'dup-id', text: 'Task 1', completed: false },
        { id: 'dup-id', text: 'Task 2', completed: false },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(duplicateTasks));
      expect(loadTasks()).toEqual([]);
    });

    it('handles storage read failure gracefully', () => {
      const mockStorage = {
        getItem: vi.fn(() => {
          throw new Error('SecurityError: Access is denied');
        }),
      };
      expect(loadTasks(mockStorage)).toEqual([]);
    });

    it('handles null storage gracefully', () => {
      expect(loadTasks(null)).toEqual([]);
    });

    it('handles window.localStorage access throwing without crashing', () => {
      const originalLocalStorage = window.localStorage;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('SecurityError: The operation is insecure');
        },
      });

      try {
        expect(loadTasks()).toEqual([]);
        expect(consoleErrorSpy).toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          value: originalLocalStorage,
        });
      }
    });
  });

  describe('saveTasks', () => {
    it('saves tasks to localStorage successfully', () => {
      const tasks = [{ id: '1', text: 'Task 1', completed: false }];
      const result = saveTasks(tasks);
      expect(result).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(tasks));
    });

    it('returns false when input is not an array', () => {
      expect(saveTasks(null)).toBe(false);
      expect(saveTasks('string')).toBe(false);
      expect(saveTasks({})).toBe(false);
    });

    it('handles quota exceeded errors without throwing', () => {
      const mockStorage = {
        setItem: vi.fn(() => {
          const err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        }),
      };
      const tasks = [{ id: '1', text: 'Task 1', completed: false }];
      expect(saveTasks(tasks, mockStorage)).toBe(false);
    });

    it('handles null storage gracefully', () => {
      expect(saveTasks([{ id: '1', text: 'Task 1', completed: false }], null)).toBe(false);
    });

    it('handles window.localStorage access throwing without crashing', () => {
      const originalLocalStorage = window.localStorage;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('SecurityError: The operation is insecure');
        },
      });

      try {
        const tasks = [{ id: '1', text: 'Task 1', completed: false }];
        expect(saveTasks(tasks)).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          value: originalLocalStorage,
        });
      }
    });
  });

  describe('getDefaultStorage', () => {
    it('returns window.localStorage when accessible', () => {
      expect(getDefaultStorage()).toBe(window.localStorage);
    });

    it('returns undefined and logs error when accessing window.localStorage throws', () => {
      const originalLocalStorage = window.localStorage;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('SecurityError: Access is denied');
        },
      });

      try {
        expect(getDefaultStorage()).toBeUndefined();
        expect(consoleErrorSpy).toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          value: originalLocalStorage,
        });
      }
    });
  });
});
