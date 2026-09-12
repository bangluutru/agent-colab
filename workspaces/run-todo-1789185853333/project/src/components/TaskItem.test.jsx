import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskItem } from './TaskItem';

describe('TaskItem component', () => {
  const sampleTask = {
    id: 'test-1',
    text: 'Write documentation',
    completed: false,
  };

  it('renders task text, unchecked checkbox, and delete button', () => {
    render(
      <TaskItem
        task={sampleTask}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText('Write documentation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete "write documentation"/i })).toBeInTheDocument();
  });

  it('renders checked checkbox and completed style when completed is true', () => {
    const completedTask = { ...sampleTask, completed: true };
    const { container } = render(
      <TaskItem
        task={completedTask}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(container.querySelector('.task-item')).toHaveClass('completed');
    expect(screen.getByText('Write documentation')).toHaveClass('task-completed-text');
  });

  it('invokes onToggleTask when checkbox is clicked', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();
    render(
      <TaskItem
        task={sampleTask}
        onToggleTask={handleToggle}
        onDeleteTask={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(handleToggle).toHaveBeenCalledTimes(1);
    expect(handleToggle).toHaveBeenCalledWith('test-1');
  });

  it('invokes onDeleteTask when delete button is clicked', async () => {
    const user = userEvent.setup();
    const handleDelete = vi.fn();
    render(
      <TaskItem
        task={sampleTask}
        onToggleTask={vi.fn()}
        onDeleteTask={handleDelete}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /delete "write documentation"/i });
    await user.click(deleteBtn);

    expect(handleDelete).toHaveBeenCalledTimes(1);
    expect(handleDelete).toHaveBeenCalledWith('test-1');
  });

  it('safely displays HTML-like characters as plain text', () => {
    const htmlTask = {
      id: 'test-html',
      text: '<script>alert("xss")</script> & <b>bold</b>',
      completed: false,
    };
    render(
      <TaskItem
        task={htmlTask}
        onToggleTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />
    );

    expect(screen.getByText('<script>alert("xss")</script> & <b>bold</b>')).toBeInTheDocument();
  });
});
