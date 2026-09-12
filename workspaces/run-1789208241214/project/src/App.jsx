import React, { useState, useEffect, useRef } from 'react';
import { loadTasks, saveTasks } from './taskStorage';
import './styles.css';

/**
 * Generates a unique task identifier.
 * Uses crypto.randomUUID if available, with a timestamp-random fallback.
 * @returns {string}
 */
export function generateTaskId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [tasks, setTasks] = useState(() => loadTasks());
  const [input, setInput] = useState('');
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveTasks(tasks);
  }, [tasks]);

  const handleAddTask = (e) => {
    e.preventDefault();
    const trimmedText = input.trim();
    if (!trimmedText) {
      return;
    }

    const newTask = {
      id: generateTaskId(),
      text: trimmedText,
      completed: false,
    };

    setTasks((prevTasks) => [...prevTasks, newTask]);
    setInput('');
  };

  const handleToggleTask = (id) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleDeleteTask = (id) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
  };

  return (
    <main className="todo-app">
      <header className="todo-header">
        <h1>Todo App</h1>
      </header>

      <form onSubmit={handleAddTask} aria-label="Add task form" className="todo-form">
        <label htmlFor="task-input" className="visually-hidden">
          Task description
        </label>
        <input
          id="task-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What needs to be done?"
          aria-label="New task description"
          className="todo-input"
        />
        <button type="submit" className="todo-add-btn">
          Add Task
        </button>
      </form>

      {tasks.length === 0 ? (
        <p className="empty-state" data-testid="empty-state">
          No tasks yet. Add a task to get started!
        </p>
      ) : (
        <ul className="todo-list" aria-label="Tasks">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={`todo-item ${task.completed ? 'completed' : ''}`}
            >
              <input
                type="checkbox"
                id={`task-${task.id}`}
                checked={task.completed}
                onChange={() => handleToggleTask(task.id)}
                aria-label={`Mark "${task.text}" as ${
                  task.completed ? 'incomplete' : 'complete'
                }`}
                className="todo-checkbox"
              />
              <label htmlFor={`task-${task.id}`} className="todo-text">
                {task.text}
              </label>
              <button
                type="button"
                onClick={() => handleDeleteTask(task.id)}
                aria-label={`Delete "${task.text}"`}
                className="todo-delete-btn"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
