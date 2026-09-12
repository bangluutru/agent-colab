export const STORAGE_KEY = 'todo_app_tasks_v1';

/**
 * Generate a unique ID using crypto.randomUUID if available,
 * falling back to a timestamp-random combination.
 *
 * @returns {string} Unique task ID
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Validates a single task record.
 *
 * @param {unknown} item
 * @param {Set<string>} seenIds
 * @returns {{ id: string, text: string, completed: boolean } | null}
 */
export function validateTask(item, seenIds = new Set()) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const { id, text, completed } = item;

  if (typeof id !== 'string' || id.trim() === '') {
    return null;
  }

  const trimmedId = id.trim();
  if (seenIds.has(trimmedId)) {
    return null;
  }

  if (typeof text !== 'string' || text.trim() === '') {
    return null;
  }

  if (typeof completed !== 'boolean') {
    return null;
  }

  seenIds.add(trimmedId);
  return {
    id: trimmedId,
    text: text.trim(),
    completed,
  };
}

/**
 * Loads tasks from localStorage with guarded parsing and validation.
 *
 * @param {Storage | null} [storage]
 * @returns {Array<{ id: string, text: string, completed: boolean }>}
 */
export function loadTasks(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const seenIds = new Set();
    const validTasks = [];

    for (const item of parsed) {
      const valid = validateTask(item, seenIds);
      if (valid) {
        validTasks.push(valid);
      }
    }

    return validTasks;
  } catch {
    return [];
  }
}

/**
 * Persists tasks to localStorage, catching any errors and returning status.
 *
 * @param {Array<{ id: string, text: string, completed: boolean }>} tasks
 * @param {Storage | null} [storage]
 * @returns {{ success: boolean, error?: string }}
 */
export function saveTasks(tasks, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) {
    return { success: false, error: 'Storage is not available' };
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save tasks',
    };
  }
}
