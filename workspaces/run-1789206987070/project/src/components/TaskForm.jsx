import React, { useState } from 'react';

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
    <form onSubmit={handleSubmit} className="task-form" aria-label="Add a task">
      <label htmlFor="task-input" className="visually-hidden">
        New task description
      </label>
      <input
        id="task-input"
        type="text"
        className="task-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What needs to be done?"
        autoComplete="off"
      />
      <button type="submit" className="btn-add">
        Add
      </button>
    </form>
  );
}
