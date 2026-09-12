import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY } from './taskStorage';

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Initial rendering & empty state', () => {
    it('displays the heading and empty state when no tasks exist', () => {
      render(<App />);

      expect(screen.getByRole('heading', { level: 1, name: /todo app/i })).toBeInTheDocument();
      expect(screen.getByTestId('empty-state')).toHaveTextContent(
        /no tasks yet\. add a task to get started!/i
      );
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('has an accessible input with placeholder and an add button', () => {
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'What needs to be done?');

      const addButton = screen.getByRole('button', { name: /add task/i });
      expect(addButton).toBeInTheDocument();
    });
  });

  describe('Adding tasks', () => {
    it('adds a task via Add button, trims whitespace, and clears input', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      const addButton = screen.getByRole('button', { name: /add task/i });

      await user.type(input, '   Buy groceries   ');
      await user.click(addButton);

      expect(input).toHaveValue('');
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

      const taskItem = screen.getByText('Buy groceries');
      expect(taskItem).toBeInTheDocument();

      const checkbox = screen.getByRole('checkbox', {
        name: 'Mark "Buy groceries" as complete',
      });
      expect(checkbox).not.toBeChecked();
    });

    it('adds a task via pressing Enter key in input', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });

      await user.type(input, 'Walk the dog{enter}');

      expect(input).toHaveValue('');
      expect(screen.getByText('Walk the dog')).toBeInTheDocument();
    });

    it('ignores empty input and whitespace-only submissions', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      const addButton = screen.getByRole('button', { name: /add task/i });

      // Empty submission
      await user.click(addButton);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();

      // Whitespace-only submission via button
      await user.type(input, '     ');
      await user.click(addButton);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();

      // Whitespace-only submission via Enter
      await user.type(input, '   {enter}');
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('allows tasks with identical text while keeping them distinct', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });

      await user.type(input, 'Read a book{enter}');
      await user.type(input, 'Read a book{enter}');

      const items = screen.getAllByText('Read a book');
      expect(items).toHaveLength(2);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);

      // Check the first one only
      await user.click(checkboxes[0]);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  describe('Toggling task completion', () => {
    it('toggles task completion and updates visual state', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      await user.type(input, 'Finish homework{enter}');

      const checkbox = screen.getByRole('checkbox', {
        name: 'Mark "Finish homework" as complete',
      });
      const listItem = checkbox.closest('li');

      expect(checkbox).not.toBeChecked();
      expect(listItem).not.toHaveClass('completed');

      // Toggle to complete
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
      expect(listItem).toHaveClass('completed');
      expect(
        screen.getByRole('checkbox', { name: 'Mark "Finish homework" as incomplete' })
      ).toBeInTheDocument();

      // Toggle back to incomplete
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
      expect(listItem).not.toHaveClass('completed');
    });
  });

  describe('Deleting tasks', () => {
    it('deletes an individual task without affecting other tasks', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      await user.type(input, 'Task One{enter}');
      await user.type(input, 'Task Two{enter}');
      await user.type(input, 'Task Three{enter}');

      expect(screen.getByText('Task One')).toBeInTheDocument();
      expect(screen.getByText('Task Two')).toBeInTheDocument();
      expect(screen.getByText('Task Three')).toBeInTheDocument();

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      // Delete 'Task Two'
      await user.click(deleteButtons[1]);

      expect(screen.queryByText('Task Two')).not.toBeInTheDocument();
      expect(screen.getByText('Task One')).toBeInTheDocument();
      expect(screen.getByText('Task Three')).toBeInTheDocument();
    });

    it('deletes only the target task when duplicate text exists', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      await user.type(input, 'Duplicate Task{enter}');
      await user.type(input, 'Duplicate Task{enter}');

      const deleteButtons = screen.getAllByRole('button', { name: /delete "duplicate task"/i });
      expect(deleteButtons).toHaveLength(2);

      await user.click(deleteButtons[0]);

      const remaining = screen.getAllByText('Duplicate Task');
      expect(remaining).toHaveLength(1);
    });

    it('restores the empty state when the final task is deleted', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      await user.type(input, 'Only task{enter}');

      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

      const deleteBtn = screen.getByRole('button', { name: 'Delete "Only task"' });
      await user.click(deleteBtn);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('LocalStorage persistence & restore', () => {
    it('restores tasks and their completion state from localStorage on startup', () => {
      const initialTasks = [
        { id: 'task-1', text: 'Persistent Task 1', completed: false },
        { id: 'task-2', text: 'Persistent Task 2', completed: true },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTasks));

      render(<App />);

      expect(screen.getByText('Persistent Task 1')).toBeInTheDocument();
      expect(screen.getByText('Persistent Task 2')).toBeInTheDocument();

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).toBeChecked();
    });

    it('does not overwrite existing localStorage tasks on initial mount', () => {
      const initialTasks = [{ id: '1', text: 'Pre-existing', completed: false }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTasks));

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      render(<App />);

      expect(setItemSpy).not.toHaveBeenCalled();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(initialTasks);
    });

    it('persists added task to localStorage', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      await user.type(input, 'New persisted task{enter}');

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored).toHaveLength(1);
      expect(stored[0].text).toBe('New persisted task');
      expect(stored[0].completed).toBe(false);
    });

    it('persists toggle change to localStorage', async () => {
      const initialTasks = [{ id: '1', text: 'Toggle me', completed: false }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTasks));

      const user = userEvent.setup();
      render(<App />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored[0].completed).toBe(true);
    });

    it('persists deletion to localStorage and saves empty array on final delete', async () => {
      const initialTasks = [{ id: '1', text: 'Delete me', completed: false }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTasks));

      const user = userEvent.setup();
      render(<App />);

      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteBtn);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored).toEqual([]);
    });
    it('persists changes across unmount and remount (add, toggle, delete, order, and completion)', async () => {
      const user = userEvent.setup();
      const { unmount } = render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });

      // Add 3 tasks
      await user.type(input, 'First Task{enter}');
      await user.type(input, 'Second Task{enter}');
      await user.type(input, 'Third Task{enter}');

      expect(screen.getByText('First Task')).toBeInTheDocument();
      expect(screen.getByText('Second Task')).toBeInTheDocument();
      expect(screen.getByText('Third Task')).toBeInTheDocument();

      // Toggle Second Task to complete
      const secondCheckbox = screen.getByRole('checkbox', {
        name: 'Mark "Second Task" as complete',
      });
      await user.click(secondCheckbox);
      expect(secondCheckbox).toBeChecked();

      // Delete First Task
      const deleteFirstBtn = screen.getByRole('button', {
        name: 'Delete "First Task"',
      });
      await user.click(deleteFirstBtn);
      expect(screen.queryByText('First Task')).not.toBeInTheDocument();

      // Add Fourth Task
      await user.type(input, 'Fourth Task{enter}');
      expect(screen.getByText('Fourth Task')).toBeInTheDocument();

      // Unmount the component completely
      unmount();

      // Remount a fresh instance to simulate page reload / new session
      render(<App />);

      // Deleted task must not be restored
      expect(screen.queryByText('First Task')).not.toBeInTheDocument();

      // Verify all remaining tasks are restored in exact order
      const taskItems = screen.getAllByRole('listitem');
      expect(taskItems).toHaveLength(3);
      expect(taskItems[0]).toHaveTextContent('Second Task');
      expect(taskItems[1]).toHaveTextContent('Third Task');
      expect(taskItems[2]).toHaveTextContent('Fourth Task');

      // Verify completion states survived remount
      const remountedCheckboxes = screen.getAllByRole('checkbox');
      expect(remountedCheckboxes[0]).toBeChecked();
      expect(remountedCheckboxes[1]).not.toBeChecked();
      expect(remountedCheckboxes[2]).not.toBeChecked();

      // Verify visual classes
      expect(taskItems[0]).toHaveClass('completed');
      expect(taskItems[1]).not.toHaveClass('completed');
      expect(taskItems[2]).not.toHaveClass('completed');

      // Further mutations on remounted component work independently
      await user.click(remountedCheckboxes[1]);
      expect(remountedCheckboxes[1]).toBeChecked();
      expect(taskItems[1]).toHaveClass('completed');
    });

    it('rejects stored tasks with duplicate IDs and falls back to empty state', () => {
      const corruptTasks = [
        { id: 'same-id', text: 'Corrupt Task 1', completed: false },
        { id: 'same-id', text: 'Corrupt Task 2', completed: true },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(corruptTasks));

      render(<App />);

      // Duplicate IDs are rejected so tasks do not reach task state
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.queryByText('Corrupt Task 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Corrupt Task 2')).not.toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('falls back to empty state when stored tasks contain mixed valid and invalid entries', () => {
      const mixedTasks = [
        { id: 'valid-1', text: 'Valid Task 1', completed: false },
        null,
        { id: 'bad-2', text: 123, completed: false },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mixedTasks));

      render(<App />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.queryByText('Valid Task 1')).not.toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('Resilience and edge cases', () => {
    it('handles localStorage read failure on initial load without crashing', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Access denied');
      });

      render(<App />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('continues in-memory operations if localStorage write fails', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      await user.type(input, 'Operation continues{enter}');

      expect(screen.getByText('Operation continues')).toBeInTheDocument();

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteBtn);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('handles extremely long unbroken strings without breaking and applies overflow protection classes', async () => {
      const longText = 'a'.repeat(120);
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByRole('textbox', { name: /new task description/i });
      await user.type(input, `${longText}{enter}`);

      const taskLabel = screen.getByText(longText);
      expect(taskLabel).toBeInTheDocument();
      expect(taskLabel).toHaveClass('todo-text');

      // Verify controls are present and accessible alongside the long text
      const listItem = taskLabel.closest('li');
      expect(listItem).toBeInTheDocument();
      expect(listItem).toHaveClass('todo-item');

      const checkbox = screen.getByRole('checkbox', {
        name: `Mark "${longText}" as complete`,
      });
      expect(checkbox).toBeInTheDocument();

      const deleteBtn = screen.getByRole('button', {
        name: `Delete "${longText}"`,
      });
      expect(deleteBtn).toBeInTheDocument();
    });
  });
});
