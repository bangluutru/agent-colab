import React from 'react';

/**
 * TaskItem renders a single task row with toggle checkbox, label, and delete action.
 * @param {{
 *   task: { id: string, text: string, completed: boolean },
 *   onToggleTask: (id: string) => void,
 *   onDeleteTask: (id: string) => void
 * }} props
 */
export function TaskItem({ task, onToggleTask, onDeleteTask }) {
  const checkboxId = `task-checkbox-${task.id}`;

  return (
    <li className={`task-item ${task.completed ? 'completed' : ''}`}>
      <div className="task-content">
        <input
          type="checkbox"
          id={checkboxId}
          className="task-checkbox"
          checked={task.completed}
          onChange={() => onToggleTask(task.id)}
          aria-label={`Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`}
        />
        <label
          htmlFor={checkboxId}
          className={`task-label ${task.completed ? 'task-completed-text' : ''}`}
        >
          {task.text}
        </label>
      </div>
      <button
        type="button"
        className="btn-delete"
        onClick={() => onDeleteTask(task.id)}
        aria-label={`Delete "${task.text}"`}
      >
        Delete
      </button>
    </li>
  );
}

export default TaskItem;
