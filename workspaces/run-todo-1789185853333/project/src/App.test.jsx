import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { STORAGE_KEY } from './storage';

describe('App component (Integration)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders initial empty state when no tasks are stored', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /todo list/i })).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toHaveTextContent(/no tasks yet/i);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('restores existing saved tasks on initial load', () => {
    const saved = [
      { id: 't1', text: 'Existing task 1', completed: false },
      { id: 't2', text: 'Existing task 2', completed: true },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    render(<App />);

    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    expect(screen.getByText('Existing task 1')).toBeInTheDocument();
    expect(screen.getByText('Existing task 2')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();

    expect(screen.getByText(/1 of 2 completed/i)).toBeInTheDocument();
  });

  it('adds a new task, trims whitespace, clears input, and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText('New task');
    const addButton = screen.getByRole('button', { name: /add task/i });

    await user.type(input, '   Write unit tests   ');
    await user.click(addButton);

    // Verified in UI
    expect(screen.getByText('Write unit tests')).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

    // Verified in localStorage
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).toHaveLength(1);
    expect(saved[0].text).toBe('Write unit tests');
    expect(saved[0].completed).toBe(false);
  });

  it('adds a task via Enter key', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText('New task');
    await user.type(input, 'Read a book{enter}');

    expect(screen.getByText('Read a book')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('does not add empty or whitespace-only tasks', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText('New task');
    const addButton = screen.getByRole('button', { name: /add task/i });

    await user.type(input, '    ');
    await user.click(addButton);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('toggles task completion status and updates persistence', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText('New task');
    await user.type(input, 'Do laundry{enter}');

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/0 of 1 completed/i)).toBeInTheDocument();

    // Toggle to completed
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByText(/1 of 1 completed/i)).toBeInTheDocument();

    let saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved[0].completed).toBe(true);

    // Toggle back to active
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/0 of 1 completed/i)).toBeInTheDocument();

    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved[0].completed).toBe(false);
  });

  it('deletes a specific task and updates persistence', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText('New task');
    await user.type(input, 'First task{enter}');
    await user.type(input, 'Second task{enter}');

    expect(screen.getByText('First task')).toBeInTheDocument();
    expect(screen.getByText('Second task')).toBeInTheDocument();

    // Delete the first task
    const deleteFirstBtn = screen.getByRole('button', { name: /delete "first task"/i });
    await user.click(deleteFirstBtn);

    expect(screen.queryByText('First task')).not.toBeInTheDocument();
    expect(screen.getByText('Second task')).toBeInTheDocument();

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).toHaveLength(1);
    expect(saved[0].text).toBe('Second task');
  });

  it('shows empty state and persists empty array when final task is deleted', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText('New task');
    await user.type(input, 'Sole task{enter}');

    expect(screen.getByText('Sole task')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /delete "sole task"/i });
    await user.click(deleteBtn);

    expect(screen.queryByText('Sole task')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).toEqual([]);
  });

  it('allows duplicate task text with independent IDs, toggling, and deletion', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText('New task');
    await user.type(input, 'Repeat task{enter}');
    await user.type(input, 'Repeat task{enter}');

    const taskItems = screen.getAllByRole('listitem');
    expect(taskItems).toHaveLength(2);

    const checkboxes = screen.getAllByRole('checkbox');
    const deleteButtons = screen.getAllByRole('button', { name: /delete "repeat task"/i });

    // Toggle only the first one
    await user.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();

    // Delete only the second one
    await user.click(deleteButtons[1]);

    const remainingItems = screen.getAllByRole('listitem');
    expect(remainingItems).toHaveLength(1);
    expect(within(remainingItems[0]).getByRole('checkbox')).toBeChecked();

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).toHaveLength(1);
    expect(saved[0].completed).toBe(true);
  });

  it('handles corrupted localStorage gracefully without crashing', () => {
    localStorage.setItem(STORAGE_KEY, 'corrupted JSON string!!!');

    expect(() => render(<App />)).not.toThrow();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('restores persisted tasks accurately across component unmount and remount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    const input = screen.getByLabelText('New task');
    await user.type(input, 'Task to persist across unmount{enter}');
    await user.type(input, 'Second task to complete{enter}');

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    expect(screen.getByText('Task to persist across unmount')).toBeInTheDocument();
    expect(screen.getByText('Second task to complete')).toBeInTheDocument();
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();

    // Verify localStorage has both tasks before unmounting
    const savedBeforeUnmount = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(savedBeforeUnmount).toHaveLength(2);
    expect(savedBeforeUnmount[1].completed).toBe(true);

    // Unmount the component
    unmount();

    // Verify DOM elements are unmounted
    expect(screen.queryByText('Task to persist across unmount')).not.toBeInTheDocument();
    expect(screen.queryByText('Second task to complete')).not.toBeInTheDocument();

    // Remount the component
    render(<App />);

    // Verify state was restored from localStorage
    expect(screen.getByText('Task to persist across unmount')).toBeInTheDocument();
    expect(screen.getByText('Second task to complete')).toBeInTheDocument();

    const remountedCheckboxes = screen.getAllByRole('checkbox');
    expect(remountedCheckboxes).toHaveLength(2);
    expect(remountedCheckboxes[0]).not.toBeChecked();
    expect(remountedCheckboxes[1]).toBeChecked();
    expect(screen.getByText(/1 of 2 completed/i)).toBeInTheDocument();

    // Verify we can continue modifying state after remount
    const remountedInput = screen.getByLabelText('New task');
    await user.type(remountedInput, 'Third task added after remount{enter}');
    expect(screen.getByText('Third task added after remount')).toBeInTheDocument();

    const savedAfterRemount = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(savedAfterRemount).toHaveLength(3);
    expect(savedAfterRemount[2].text).toBe('Third task added after remount');
  });

  it('handles window.localStorage access throwing gracefully on mount without crashing', () => {
    const originalLocalStorage = window.localStorage;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: Access is denied');
      },
    });

    try {
      expect(() => render(<App />)).not.toThrow();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });
});
