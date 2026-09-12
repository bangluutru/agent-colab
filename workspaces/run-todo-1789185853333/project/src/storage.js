export const STORAGE_KEY = 'todo-app.tasks.v1';

/**
 * Validates whether an item matches the required Task structure:
 * - non-null object
 * - id: non-empty string
 * - text: non-blank string
 * - completed: boolean
 * @param {unknown} task
 * @returns {boolean}
 */
export function isValidTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    return false;
  }

  const { id, text, completed } = task;

  return (
    typeof id === 'string' &&
    id.trim().length > 0 &&
    typeof text === 'string' &&
    text.trim().length > 0 &&
    typeof completed === 'boolean'
  );
}

/**
 * Safely retrieves the default storage object (window.localStorage).
 * Catches SecurityError/DOMException if window.localStorage access is disallowed.
 * @returns {Storage | undefined}
 */
export function getDefaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch (err) {
    console.error('Failed to access localStorage:', err);
    return undefined;
  }
}

/**
 * Safely loads tasks from localStorage or custom storage.
 * Returns an empty array if storage is missing, malformed, or invalid.
 * @param {Storage} [storage]
 * @returns {Array<{ id: string, text: string, completed: boolean }>}
 */
export function loadTasks(storage) {
  try {
    const targetStorage = storage !== undefined ? storage : getDefaultStorage();
    if (!targetStorage) {
      return [];
    }

    const raw = targetStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const seenIds = new Set();
    for (const item of parsed) {
      if (!isValidTask(item)) {
        return [];
      }
      if (seenIds.has(item.id)) {
        return [];
      }
      seenIds.add(item.id);
    }

    return parsed;
  } catch (err) {
    console.error('Failed to load tasks from storage:', err);
    return [];
  }
}

/**
 * Safely saves tasks to localStorage or custom storage.
 * Catches quota or permission errors so the application remains usable in memory.
 * @param {Array<{ id: string, text: string, completed: boolean }>} tasks
 * @param {Storage} [storage]
 * @returns {boolean} True if saved successfully, false otherwise.
 */
export function saveTasks(tasks, storage) {
  try {
    const targetStorage = storage !== undefined ? storage : getDefaultStorage();
    if (!targetStorage || !Array.isArray(tasks)) {
      return false;
    }

    targetStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (err) {
    console.error('Failed to save tasks to storage:', err);
    return false;
  }
}
