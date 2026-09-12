import React from 'react';

export function TaskList({ tasks, onToggleTask, onDeleteTask }) {
  if (tasks.length === 0) {
    return <p className="empty-state">No tasks yet. Add one above!</p>;
  }

  return (
    <ul className="task-list" aria-label="Task list">
      {tasks.map((task) => (
        <li
          key={task.id}
          className={`task-item ${task.completed ? 'completed' : ''}`}
        >
          <label className="task-content">
            <input
              type="checkbox"
              className="task-checkbox"
              checked={task.completed}
              onChange={() => onToggleTask(task.id)}
              aria-label={`Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`}
            />
            <span className="task-text">{task.text}</span>
          </label>
          <button
            type="button"
            className="btn-delete"
            onClick={() => onDeleteTask(task.id)}
            aria-label={`Delete "${task.text}"`}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
