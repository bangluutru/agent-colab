import React, { useState, useEffect } from 'react';
import { TaskForm } from './components/TaskForm';
import { TaskItem } from './components/TaskItem';
import { loadTasks, saveTasks } from './storage';
import './styles.css';

/**
 * Generates a stable unique ID for a new task.
 * @returns {string}
 */
export function generateTaskId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function App() {
  const [tasks, setTasks] = useState(() => loadTasks());

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const handleAddTask = (trimmedText) => {
    const newTask = {
      id: generateTaskId(),
      text: trimmedText,
      completed: false,
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleToggleTask = (id) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleDeleteTask = (id) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  return (
    <div className="app-container">
      <div className="app-card">
        <header className="app-header">
          <h1 className="app-title">Todo List</h1>
          <p className="app-subtitle">Stay organized and get things done</p>
        </header>

        <main>
          <TaskForm onAddTask={handleAddTask} />

          {totalCount > 0 && (
            <div className="task-stats" aria-live="polite">
              <span>{totalCount} {totalCount === 1 ? 'task' : 'tasks'} total</span>
              <span>{completedCount} of {totalCount} completed</span>
            </div>
          )}

          {totalCount === 0 ? (
            <p className="empty-state" data-testid="empty-state">
              No tasks yet. Add one above!
            </p>
          ) : (
            <ul className="task-list" aria-label="Tasks list">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                />
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
