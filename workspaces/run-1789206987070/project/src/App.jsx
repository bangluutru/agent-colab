import React, { useState, useEffect, useRef } from 'react';
import { loadTasks, saveTasks, generateId } from './storage';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';

export function App() {
  const [tasks, setTasks] = useState(() => loadTasks());
  const [warningMessage, setWarningMessage] = useState(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const result = saveTasks(tasks);
    if (!result.success) {
      setWarningMessage('Warning: Storage is unavailable. Changes may not persist on reload.');
    } else {
      setWarningMessage(null);
    }
  }, [tasks]);

  const handleAddTask = (text) => {
    const newTask = {
      id: generateId(),
      text,
      completed: false,
    };
    setTasks((prevTasks) => [...prevTasks, newTask]);
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
    <main className="app-container">
      <header className="app-header">
        <h1 className="app-title">Todo App</h1>
      </header>

      {warningMessage && (
        <div role="alert" className="warning-banner">
          {warningMessage}
        </div>
      )}

      <section className="card">
        <TaskForm onAddTask={handleAddTask} />
        <TaskList
          tasks={tasks}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
        />
      </section>
    </main>
  );
}

export default App;
