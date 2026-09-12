import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';
import * as storageModule from './storage';

describe('Todo App Integration & Component Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders initial empty state when no tasks are stored', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /todo app/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/what needs to be done\?/i)).toBeInTheDocument();
    expect(screen.getByText(/no tasks yet\. add one above!/i)).toBeInTheDocument();
  });

  it('adds a task via the Add button and clears the input field', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    const addButton = screen.getByRole('button', { name: /^add$/i });

    await user.type(input, 'Buy groceries');
    await user.click(addButton);

    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(screen.queryByText(/no tasks yet/i)).not.toBeInTheDocument();
  });

  it('adds a task by pressing Enter key', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    await user.type(input, 'Write automated tests{enter}');

    expect(screen.getByText('Write automated tests')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('trims task text before adding', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    await user.type(input, '   Spaced task text   {enter}');

    expect(screen.getByText('Spaced task text')).toBeInTheDocument();
    expect(screen.queryByText('   Spaced task text   ')).not.toBeInTheDocument();
  });

  it('rejects empty and whitespace-only submissions', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    const addButton = screen.getByRole('button', { name: /^add$/i });

    await user.click(addButton);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();

    await user.type(input, '     {enter}');
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it('renders task text containing HTML safely as plain text', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    const htmlText = '<img src="x" onerror="alert(1)" /><b>Bold Text</b>';

    await user.type(input, `${htmlText}{enter}`);

    const element = screen.getByText(htmlText);
    expect(element).toBeInTheDocument();
    expect(element.tagName.toLowerCase()).toBe('span');
    expect(document.querySelector('img')).toBeNull();
  });

  it('toggles task completion status and updates styling', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    await user.type(input, 'Finish homework{enter}');

    const checkbox = screen.getByRole('checkbox', {
      name: /mark "finish homework" as complete/i,
    });
    expect(checkbox).not.toBeChecked();

    const listItem = screen.getByText('Finish homework').closest('li');
    expect(listItem).not.toHaveClass('completed');

    // Toggle complete
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(listItem).toHaveClass('completed');

    // Toggle back to incomplete
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(listItem).not.toHaveClass('completed');
  });

  it('deletes an individual task using its delete button', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    await user.type(input, 'Task to be removed{enter}');
    expect(screen.getByText('Task to be removed')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /delete "task to be removed"/i });
    await user.click(deleteBtn);

    expect(screen.queryByText('Task to be removed')).not.toBeInTheDocument();
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it('removes only the targeted task when duplicate task texts exist', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    await user.type(input, 'Repeat Task{enter}');
    await user.type(input, 'Repeat Task{enter}');

    const taskItems = screen.getAllByText('Repeat Task');
    expect(taskItems).toHaveLength(2);

    const deleteButtons = screen.getAllByRole('button', { name: /delete "repeat task"/i });
    expect(deleteButtons).toHaveLength(2);

    // Delete first item
    await user.click(deleteButtons[0]);

    const remainingTasks = screen.getAllByText('Repeat Task');
    expect(remainingTasks).toHaveLength(1);
  });

  it('restores saved tasks from localStorage on initial render', () => {
    const initialTasks = [
      { id: 'item-1', text: 'Saved Item 1', completed: false },
      { id: 'item-2', text: 'Saved Item 2', completed: true },
    ];
    localStorage.setItem(storageModule.STORAGE_KEY, JSON.stringify(initialTasks));

    render(<App />);

    expect(screen.getByText('Saved Item 1')).toBeInTheDocument();
    const checkbox1 = screen.getByRole('checkbox', {
      name: /mark "saved item 1" as complete/i,
    });
    expect(checkbox1).not.toBeChecked();

    expect(screen.getByText('Saved Item 2')).toBeInTheDocument();
    const checkbox2 = screen.getByRole('checkbox', {
      name: /mark "saved item 2" as incomplete/i,
    });
    expect(checkbox2).toBeChecked();
  });

  it('persists changes to localStorage across add, toggle, and delete', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    await user.type(input, 'Persist Me{enter}');

    let stored = JSON.parse(localStorage.getItem(storageModule.STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Persist Me');
    expect(stored[0].completed).toBe(false);

    // Toggle completion
    const checkbox = screen.getByRole('checkbox', {
      name: /mark "persist me" as complete/i,
    });
    await user.click(checkbox);

    stored = JSON.parse(localStorage.getItem(storageModule.STORAGE_KEY) || '[]');
    expect(stored[0].completed).toBe(true);

    // Unmount and remount (simulating reload)
    unmount();
    render(<App />);

    expect(screen.getByText('Persist Me')).toBeInTheDocument();
    const reloadedCheckbox = screen.getByRole('checkbox', {
      name: /mark "persist me" as incomplete/i,
    });
    expect(reloadedCheckbox).toBeChecked();

    // Delete final task -> persists empty array
    const deleteBtn = screen.getByRole('button', { name: /delete "persist me"/i });
    await user.click(deleteBtn);

    stored = JSON.parse(localStorage.getItem(storageModule.STORAGE_KEY) || '[]');
    expect(stored).toEqual([]);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it('handles corrupted localStorage data gracefully without crashing', () => {
    localStorage.setItem(storageModule.STORAGE_KEY, '{"notAnArray": 123, broken json');

    expect(() => render(<App />)).not.toThrow();
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it('displays a non-blocking warning when localStorage saving fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(storageModule, 'saveTasks').mockReturnValue({
      success: false,
      error: 'Storage quota exceeded',
    });

    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    await user.type(input, 'Test Task{enter}');

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /warning: storage is unavailable/i
    );
  });

  it('handles rapid consecutive additions without losing updates', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText(/what needs to be done\?/i);
    await user.type(input, 'Task Alpha{enter}');
    await user.type(input, 'Task Beta{enter}');
    await user.type(input, 'Task Gamma{enter}');

    expect(screen.getByText('Task Alpha')).toBeInTheDocument();
    expect(screen.getByText('Task Beta')).toBeInTheDocument();
    expect(screen.getByText('Task Gamma')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(storageModule.STORAGE_KEY) || '[]');
    expect(stored).toHaveLength(3);
    expect(stored.map((t) => t.text)).toEqual(['Task Alpha', 'Task Beta', 'Task Gamma']);
  });
});
