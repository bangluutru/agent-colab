import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, isValidTask, loadTasks, saveTasks } from './taskStorage';

describe('taskStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('isValidTask', () => {
    it('returns true for a valid task object', () => {
      expect(isValidTask({ id: 'task-1', text: 'Buy milk', completed: false })).toBe(true);
      expect(isValidTask({ id: 'task-2', text: 'Clean room', completed: true })).toBe(true);
    });

    it('returns false for null, undefined, or non-objects', () => {
      expect(isValidTask(null)).toBe(false);
      expect(isValidTask(undefined)).toBe(false);
      expect(isValidTask('string')).toBe(false);
      expect(isValidTask(123)).toBe(false);
      expect(isValidTask([])).toBe(false);
    });

    it('returns false when id is missing, not a string, or whitespace only', () => {
      expect(isValidTask({ text: 'No id', completed: false })).toBe(false);
      expect(isValidTask({ id: 123, text: 'Number id', completed: false })).toBe(false);
      expect(isValidTask({ id: '', text: 'Empty id', completed: false })).toBe(false);
      expect(isValidTask({ id: '   ', text: 'Whitespace id', completed: false })).toBe(false);
    });

    it('returns false when text is missing or not a string', () => {
      expect(isValidTask({ id: '1', completed: false })).toBe(false);
      expect(isValidTask({ id: '1', text: null, completed: false })).toBe(false);
      expect(isValidTask({ id: '1', text: 123, completed: false })).toBe(false);
    });

    it('returns false when completed is missing or not a boolean', () => {
      expect(isValidTask({ id: '1', text: 'Task' })).toBe(false);
      expect(isValidTask({ id: '1', text: 'Task', completed: 'false' })).toBe(false);
      expect(isValidTask({ id: '1', text: 'Task', completed: null })).toBe(false);
      expect(isValidTask({ id: '1', text: 'Task', completed: 0 })).toBe(false);
    });
  });

  describe('loadTasks', () => {
    it('returns an empty array when localStorage key is empty', () => {
      expect(loadTasks()).toEqual([]);
    });

    it('loads and returns valid tasks from localStorage', () => {
      const stored = [
        { id: '1', text: 'First task', completed: false },
        { id: '2', text: 'Second task', completed: true },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      expect(loadTasks()).toEqual(stored);
    });

    it('returns empty array when stored data contains malformed task items', () => {
      const stored = [
        { id: '1', text: 'Valid task', completed: false },
        { id: 'bad-1', text: 123, completed: false },
        { id: '', text: 'Bad id', completed: false },
        null,
        'random string',
        { id: '2', text: 'Another valid task', completed: true },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array when stored array contains a valid task and null', () => {
      const stored = [
        { id: '1', text: 'Valid task', completed: false },
        null,
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array when stored data is not a JSON array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
      expect(loadTasks()).toEqual([]);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(42));
      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array when JSON is completely malformed', () => {
      localStorage.setItem(STORAGE_KEY, '{ invalid json');
      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array when stored tasks contain duplicate IDs', () => {
      const stored = [
        { id: 'same', text: 'Task 1', completed: false },
        { id: 'same', text: 'Task 2', completed: true },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array when stored items contain duplicate IDs even if one is malformed', () => {
      const stored = [
        { id: 'dup-id', text: 'Task 1', completed: false },
        { id: 'dup-id', text: 123, completed: false },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      expect(loadTasks()).toEqual([]);
    });

    it('returns empty array gracefully if localStorage throws an error', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Access denied');
      });

      expect(loadTasks()).toEqual([]);
    });
  });

  describe('saveTasks', () => {
    it('persists tasks array to localStorage under STORAGE_KEY', () => {
      const tasks = [
        { id: '1', text: 'Task 1', completed: false },
        { id: '2', text: 'Task 2', completed: true },
      ];

      const success = saveTasks(tasks);
      expect(success).toBe(true);

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw)).toEqual(tasks);
    });

    it('returns false if tasks is not an array', () => {
      expect(saveTasks(null)).toBe(false);
      expect(saveTasks('invalid')).toBe(false);
      expect(saveTasks({ id: '1' })).toBe(false);
    });

    it('returns false gracefully when localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const tasks = [{ id: '1', text: 'Task 1', completed: false }];
      expect(saveTasks(tasks)).toBe(false);
    });
  });
});
