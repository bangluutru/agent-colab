import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskForm } from './TaskForm';

describe('TaskForm component', () => {
  it('renders input with visible label and submit button', () => {
    render(<TaskForm onAddTask={vi.fn()} />);

    const label = screen.getByLabelText('New task');
    expect(label).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
  });

  it('submits trimmed text and clears input on button click', async () => {
    const user = userEvent.setup();
    const handleAddTask = vi.fn();
    render(<TaskForm onAddTask={handleAddTask} />);

    const input = screen.getByLabelText('New task');
    const button = screen.getByRole('button', { name: /add task/i });

    await user.type(input, '  Buy groceries  ');
    await user.click(button);

    expect(handleAddTask).toHaveBeenCalledTimes(1);
    expect(handleAddTask).toHaveBeenCalledWith('Buy groceries');
    expect(input).toHaveValue('');
  });

  it('submits trimmed text and clears input on Enter key', async () => {
    const user = userEvent.setup();
    const handleAddTask = vi.fn();
    render(<TaskForm onAddTask={handleAddTask} />);

    const input = screen.getByLabelText('New task');

    await user.type(input, 'Walk the dog{enter}');

    expect(handleAddTask).toHaveBeenCalledTimes(1);
    expect(handleAddTask).toHaveBeenCalledWith('Walk the dog');
    expect(input).toHaveValue('');
  });

  it('does not submit when input is empty or whitespace only', async () => {
    const user = userEvent.setup();
    const handleAddTask = vi.fn();
    render(<TaskForm onAddTask={handleAddTask} />);

    const input = screen.getByLabelText('New task');
    const button = screen.getByRole('button', { name: /add task/i });

    // Empty click
    await user.click(button);
    expect(handleAddTask).not.toHaveBeenCalled();

    // Whitespace click
    await user.type(input, '    ');
    await user.click(button);
    expect(handleAddTask).not.toHaveBeenCalled();

    // Whitespace enter
    await user.type(input, '{enter}');
    expect(handleAddTask).not.toHaveBeenCalled();
  });
});
