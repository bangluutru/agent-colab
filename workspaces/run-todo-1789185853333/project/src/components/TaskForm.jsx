import React, { useState } from 'react';

/**
 * TaskForm component for adding new tasks.
 * @param {{ onAddTask: (text: string) => void }} props
 */
export function TaskForm({ onAddTask }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    onAddTask(trimmed);
    setText('');
  };

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="task-input" className="task-form-label">
        New task
      </label>
      <div className="task-form-row">
        <input
          id="task-input"
          type="text"
          className="task-input"
          placeholder="What needs to be done?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn-add">
          Add Task
        </button>
      </div>
    </form>
  );
}

export default TaskForm;
