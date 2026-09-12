export const STORAGE_KEY = 'todo_app_tasks';

/**
 * Validates that an item has the required task schema.
 * @param {unknown} item
 * @returns {boolean}
 */
export function isValidTask(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const { id, text, completed } = item;

  return (
    typeof id === 'string' &&
    id.trim().length > 0 &&
    typeof text === 'string' &&
    typeof completed === 'boolean'
  );
}

/**
 * Loads and validates tasks from localStorage.
 * Ensures task schema validity and ID uniqueness across the stored collection.
 * Returns an empty array if storage is empty, invalid, corrupted, or contains duplicate IDs.
 * @returns {Array<{ id: string, text: string, completed: boolean }>}
 */
export function loadTasks() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
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
  } catch (error) {
    console.warn('Failed to load tasks from localStorage:', error);
    return [];
  }
}

/**
 * Persists tasks array to localStorage.
 * Returns true on success, or false if storage fails or is inaccessible.
 * @param {Array<{ id: string, text: string, completed: boolean }>} tasks
 * @returns {boolean}
 */
export function saveTasks(tasks) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    if (!Array.isArray(tasks)) {
      return false;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.warn('Failed to save tasks to localStorage:', error);
    return false;
  }
}
