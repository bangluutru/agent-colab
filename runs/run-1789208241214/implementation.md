# IMPLEMENTATION REPORT

## Summary
## 🧠 Thinking
**Goal**: Xây dựng ứng dụng Todo web app hoàn chỉnh bằng React với tính năng thêm/xóa/hoàn thành task, lưu trữ localStorage bền vững, giao diện responsive chống tràn chữ, kiểm thử đơn vị bao phủ toàn bộ edge cases, và vượt qua `npm test` cũng như `npm run build`.
**The Floor**:
1. Mục tiêu đích thực: Một Todo app React production-ready, accessible, testable, build sạch sẽ, tuân thủ nghiêm ngặt kế hoạch được duyệt của Codex.
2. Luồng kết thúc ở đâu: Khởi tạo/tải từ localStorage -> hiển thị UI/empty state -> người dùng nhập task / nhấn Enter hoặc Add -> toggle / delete độc lập theo unique id -> lưu lại vào localStorage mà không ghi đè dữ liệu hợp lệ lúc khởi tạo -> build và test pass 100%.
3. Chi tiết sót: Input khoảng trắng bị từ chối; task text trùng nhau vẫn hoạt động độc lập; unbroken string dài không gây tràn layout (break-word / overflow-wrap); lỗi storage không làm crash app; test suite chạy không bị treo watch mode; accessibility với aria-label và label liên kết.
**Files to read**: [package.json](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/package.json), [vite.config.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/vite.config.js), [index.html](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/index.html).
**Blast radius**: Greenfield repository. Chỉ cấu hình thêm `setupFiles` trong `vite.config.js` và tạo các file mới trong `src/`.
**Approach**:
1. Cập nhật `vite.config.js` để hỗ trợ `setupFiles: ['./src/setupTests.js']`.
2. Tạo `src/setupTests.js` import `@testing-library/jest-dom`.
3. Tạo `src/taskStorage.js` và test suite `src/taskStorage.test.js`.
4. Tạo `src/styles.css` với responsive layout và word wrapping.
5. Tạo `src/App.jsx` và test suite `src/App.test.jsx`.
6. Tạo `src/main.jsx`.
7. Kiểm thử với `npm test` và `npm run build`.
**Risk**: Mocking localStorage trong jsdom môi trường Vitest cần đảm bảo cách ly giữa các bài test.
**Confidence**: HIGH
### 1. Kết quả (Outcome)
Đã hoàn thành xây dựng ứng dụng Todo web app bằng React theo đúng kế hoạch triển khai của Codex. Ứng dụng hỗ trợ đầy đủ các chức năng thêm, xóa, đánh dấu hoàn thành, lưu trữ bền vững với `localStorage`, xử lý lỗi ngoại lệ, giao diện responsive chống tràn chữ, đạt chuẩn accessibility và vượt qua 32/32 unit tests cùng lệnh production build.

---

### 2. Chi tiết các file được tạo & chỉnh sửa

- [vite.config.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/vite.config.js): Cấu hình thêm `setupFiles: ['./src/setupTests.js']` để Vitest tự động nạp matchers của `@testing-library/jest-dom`.
- [src/setupTests.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/src/setupTests.js): Khởi tạo test environment với `@testing-library/jest-dom`.
- [src/taskStorage.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/src/taskStorage.js): Module phụ trách kiểm tra hợp lệ cấu trúc task (`isValidTask`), tải dữ liệu an toàn (`loadTasks`), và lưu trữ (`saveTasks`) với `try/catch` bọc quanh các thao tác localStorage.
- [src/taskStorage.test.js](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/src/taskStorage.test.js): Bộ 14 unit tests kiểm thử toàn diện module lưu trữ (dữ liệu rỗng, dữ liệu lỗi, JSON hỏng, ngoại lệ quota/quyền truy cập).
- [src/App.jsx](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/src/App.jsx): Component chính quản lý state tasks (lazy initialization từ storage), hiệu ứng lưu bền vững chỉ kích hoạt sau lần render đầu tiên (tránh ghi đè storage khi khởi động), form thêm task hỗ trợ Enter & Add button, toggle hoàn thành và xóa task theo unique id.
- [src/App.test.jsx](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/src/App.test.jsx): Bộ 18 unit tests cho App component, bao phủ thêm/xóa/toggle, chuỗi text trùng nhau, chuỗi dài không ngắt, khôi phục từ storage, và khả năng duy trì hoạt động in-memory khi storage bị lỗi.
- [src/styles.css](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/src/styles.css): Stylesheet responsive (hỗ trợ viewport 320px đến desktop), áp dụng `word-break: break-word` & `overflow-wrap: anywhere` chống tràn ngang, hiệu ứng gạch ngang trạng thái completed, và focus-visible cho accessibility.
- [src/main.jsx](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/src/main.jsx): Điểm khởi chạy React mount vào phần tử `#root`.
- [.gitignore](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/workspaces/run-1789208241214/project/.gitignore): Bỏ qua `node_modules`, `dist`, `.DS_Store`.

---

### 3. Kiến trúc giải pháp (Architecture Highlights)

1. **State & Persistence Synchronization**:
   - Khởi tạo tasks bằng `useState(() => loadTasks())` đảm bảo chỉ đọc storage một lần đồng bộ khi mount.
   - Sử dụng `useRef(true)` trong `useEffect` để bỏ qua lượt render đầu tiên, ngăn chặn việc ghi đè mảng rỗng lên dữ liệu đã lưu trong localStorage.
   - Khi task thay đổi (thêm, xóa, toggle), `saveTasks(tasks)` sẽ tự động đồng bộ xuống storage. Khi xóa task cuối cùng, mảng rỗng `[]` được lưu chuẩn xác.
2. **Stable Identity Isolation**:
   - Hàm `generateTaskId()` sử dụng `crypto.randomUUID()` kết hợp fallback thời gian + random string. Các task có cùng nội dung text vẫn sở hữu ID riêng biệt và được xóa/toggle độc lập.
3. **Resilience & Fault Tolerance**:
   - `loadTasks()` và `saveTasks()` tự bắt toàn bộ ngoại lệ (như khi người dùng tắt cookie/localStorage hoặc vượt hạn mức QuotaExceededError). App vẫn hoạt động in-memory mà không bị crash.
4. **Accessible UI & Layout Safety**:
   - Cung cấp `aria-label`, `<label htmlFor="...">`, và hỗ trợ phím Enter/Space đầy đủ.
   - Task text được bọc `min-width: 0; flex: 1; word-break: break-word; overflow-wrap: anywhere;` giúp các chuỗi ký tự dài không thể làm vỡ layout.

---

### 4. Bằng chứng kiểm chứng thực tế (Verification Evidence)

#### 4.1. Unit Test Suite (`npm test` / `vitest run`)
```
 RUN  v2.1.9 /Users/tranhaibang/.../project

 ✓ src/taskStorage.test.js (14 tests) 8ms
 ✓ src/App.test.jsx (18 tests) 880ms

 Test Files  2 passed (2)
      Tests  32 passed (32)
   Duration  1.69s
```
*Kết quả*: 32/32 tests passed, kiểm thử không bị kẹt watch mode.

#### 4.2. Production Build (`npm run build` / `vite build`)
```
> autonomous-app@0.1.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 32 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:  0.27 kB
dist/assets/index-BOfg8vSY.css    3.28 kB │ gzip:  1.13 kB
dist/assets/index-CupJ0vfH.js   145.09 kB │ gzip: 46.77 kB
✓ built in 341ms
```
*Kết quả*: Exit code 0, bundle thành công với đầy đủ assets.

---

### 5. Giả định đã tự quyết (Decisions Made)
- **ID Generator**: Đã áp dụng `crypto.randomUUID` kèm fallback `Date.now() + Math.random()` để tương thích tốt cả trong môi trường trình duyệt hiện đại lẫn các phiên bản jsdom cũ.
- **Key Storage**: Sử dụng namespaced key `'todo_app_tasks'` để tránh xung đột dữ liệu với các ứng dụng khác trên cùng origin.

### 6. Weakest Link
- Khi trình duyệt bật chế độ Private Browsing chặn hoàn toàn storage hoặc ổ cứng đầy, dữ liệu chỉ tồn tại in-memory trong phiên làm việc hiện tại và sẽ mất khi reload (đã được cảnh báo qua `console.warn` và không làm gián đoạn trải nghiệm của người dùng).


## Tests
```
Implementation finished. Awaiting verification tests.
```

## Diff
```diff
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000..0ca39c0
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,3 @@
+node_modules
+dist
+.DS_Store
diff --git a/src/App.jsx b/src/App.jsx
new file mode 100644
index 0000000..e8f97b6
--- /dev/null
+++ b/src/App.jsx
@@ -0,0 +1,121 @@
+import React, { useState, useEffect, useRef } from 'react';
+import { loadTasks, saveTasks } from './taskStorage';
+import './styles.css';
+
+/**
+ * Generates a unique task identifier.
+ * Uses crypto.randomUUID if available, with a timestamp-random fallback.
+ * @returns {string}
+ */
+export function generateTaskId() {
+  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
+    return crypto.randomUUID();
+  }
+  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
+}
+
+export default function App() {
+  const [tasks, setTasks] = useState(() => loadTasks());
+  const [input, setInput] = useState('');
+  const isFirstRender = useRef(true);
+
+  useEffect(() => {
+    if (isFirstRender.current) {
+      isFirstRender.current = false;
+      return;
+    }
+    saveTasks(tasks);
+  }, [tasks]);
+
+  const handleAddTask = (e) => {
+    e.preventDefault();
+    const trimmedText = input.trim();
+    if (!trimmedText) {
+      return;
+    }
+
+    const newTask = {
+      id: generateTaskId(),
+      text: trimmedText,
+      completed: false,
+    };
+
+    setTasks((prevTasks) => [...prevTasks, newTask]);
+    setInput('');
+  };
+
+  const handleToggleTask = (id) => {
+    setTasks((prevTasks) =>
+      prevTasks.map((task) =>
+        task.id === id ? { ...task, completed: !task.completed } : task
+      )
+    );
+  };
+
+  const handleDeleteTask = (id) => {
+    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
+  };
+
+  return (
+    <main className="todo-app">
+      <header className="todo-header">
+        <h1>Todo App</h1>
+      </header>
+
+      <form onSubmit={handleAddTask} aria-label="Add task form" className="todo-form">
+        <label htmlFor="task-input" className="visually-hidden">
+          Task description
+        </label>
+        <input
+          id="task-input"
+          type="text"
+          value={input}
+          onChange={(e) => setInput(e.target.value)}
+          placeholder="What needs to be done?"
+          aria-label="New task description"
+          className="todo-input"
+        />
+        <button type="submit" className="todo-add-btn">
+          Add Task
+        </button>
+      </form>
+
+      {tasks.length === 0 ? (
+        <p className="empty-state" data-testid="empty-state">
+          No tasks yet. Add a task to get started!
+        </p>
+      ) : (
+        <ul className="todo-list" aria-label="Tasks">
+          {tasks.map((task) => (
+            <li
+              key={task.id}
+              className={`todo-item ${task.completed ? 'completed' : ''}`}
+            >
+              <input
+                type="checkbox"
+                id={`task-${task.id}`}
+                checked={task.completed}
+                onChange={() => handleToggleTask(task.id)}
+                aria-label={`Mark "${task.text}" as ${
+                  task.completed ? 'incomplete' : 'complete'
+                }`}
+                className="todo-checkbox"
+              />
+              <label htmlFor={`task-${task.id}`} className="todo-text">
+                {task.text}
+              </label>
+              <button
+                type="button"
+                onClick={() => handleDeleteTask(task.id)}
+                aria-label={`Delete "${task.text}"`}
+                className="todo-delete-btn"
+              >
+                Delete
+              </button>
+            </li>
+          ))}
+        </ul>
+      )}
+    </main>
+  );
+}
diff --git a/src/App.test.jsx b/src/App.test.jsx
new file mode 100644
index 0000000..b3efafb
--- /dev/null
+++ b/src/App.test.jsx
@@ -0,0 +1,318 @@
+import React from 'react';
+import { render, screen } from '@testing-library/react';
+import userEvent from '@testing-library/user-event';
+import { describe, it, expect, beforeEach, vi } from 'vitest';
+import App from './App';
+import { STORAGE_KEY } from './taskStorage';
+
+describe('App Component', () => {
+  beforeEach(() => {
+    localStorage.clear();
+    vi.restoreAllMocks();
+  });
+
+  describe('Initial rendering & empty state', () => {
+    it('displays the heading and empty state when no tasks exist', () => {
+      render(<App />);
+
+      expect(screen.getByRole('heading', { level: 1, name: /todo app/i })).toBeInTheDocument();
+      expect(screen.getByTestId('empty-state')).toHaveTextContent(
+        /no tasks yet\. add a task to get started!/i
+      );
+      expect(screen.queryByRole('list')).not.toBeInTheDocument();
+    });
+
+    it('has an accessible input with placeholder and an add button', () => {
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      expect(input).toBeInTheDocument();
+      expect(input).toHaveAttribute('placeholder', 'What needs to be done?');
+
+      const addButton = screen.getByRole('button', { name: /add task/i });
+      expect(addButton).toBeInTheDocument();
+    });
+  });
+
+  describe('Adding tasks', () => {
+    it('adds a task via Add button, trims whitespace, and clears input', async () => {
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      const addButton = screen.getByRole('button', { name: /add task/i });
+
+      await user.type(input, '   Buy groceries   ');
+      await user.click(addButton);
+
+      expect(input).toHaveValue('');
+      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
+
+      const taskItem = screen.getByText('Buy groceries');
+      expect(taskItem).toBeInTheDocument();
+
+      const checkbox = screen.getByRole('checkbox', {
+        name: 'Mark "Buy groceries" as complete',
+      });
+      expect(checkbox).not.toBeChecked();
+    });
+
+    it('adds a task via pressing Enter key in input', async () => {
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+
+      await user.type(input, 'Walk the dog{enter}');
+
+      expect(input).toHaveValue('');
+      expect(screen.getByText('Walk the dog')).toBeInTheDocument();
+    });
+
+    it('ignores empty input and whitespace-only submissions', async () => {
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      const addButton = screen.getByRole('button', { name: /add task/i });
+
+      // Empty submission
+      await user.click(addButton);
+      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
+
+      // Whitespace-only submission via button
+      await user.type(input, '     ');
+      await user.click(addButton);
+      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
+
+      // Whitespace-only submission via Enter
+      await user.type(input, '   {enter}');
+      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
+    });
+
+    it('allows tasks with identical text while keeping them distinct', async () => {
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+
+      await user.type(input, 'Read a book{enter}');
+      await user.type(input, 'Read a book{enter}');
+
+      const items = screen.getAllByText('Read a book');
+      expect(items).toHaveLength(2);
+
+      const checkboxes = screen.getAllByRole('checkbox');
+      expect(checkboxes).toHaveLength(2);
+
+      // Check the first one only
+      await user.click(checkboxes[0]);
+      expect(checkboxes[0]).toBeChecked();
+      expect(checkboxes[1]).not.toBeChecked();
+    });
+  });
+
+  describe('Toggling task completion', () => {
+    it('toggles task completion and updates visual state', async () => {
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      await user.type(input, 'Finish homework{enter}');
+
+      const checkbox = screen.getByRole('checkbox', {
+        name: 'Mark "Finish homework" as complete',
+      });
+      const listItem = checkbox.closest('li');
+
+      expect(checkbox).not.toBeChecked();
+      expect(listItem).not.toHaveClass('completed');
+
+      // Toggle to complete
+      await user.click(checkbox);
+      expect(checkbox).toBeChecked();
+      expect(listItem).toHaveClass('completed');
+      expect(
+        screen.getByRole('checkbox', { name: 'Mark "Finish homework" as incomplete' })
+      ).toBeInTheDocument();
+
+      // Toggle back to incomplete
+      await user.click(checkbox);
+      expect(checkbox).not.toBeChecked();
+      expect(listItem).not.toHaveClass('completed');
+    });
+  });
+
+  describe('Deleting tasks', () => {
+    it('deletes an individual task without affecting other tasks', async () => {
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      await user.type(input, 'Task One{enter}');
+      await user.type(input, 'Task Two{enter}');
+      await user.type(input, 'Task Three{enter}');
+
+      expect(screen.getByText('Task One')).toBeInTheDocument();
+      expect(screen.getByText('Task Two')).toBeInTheDocument();
+      expect(screen.getByText('Task Three')).toBeInTheDocument();
+
+      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
+      // Delete 'Task Two'
+      await user.click(deleteButtons[1]);
+
+      expect(screen.queryByText('Task Two')).not.toBeInTheDocument();
+      expect(screen.getByText('Task One')).toBeInTheDocument();
+      expect(screen.getByText('Task Three')).toBeInTheDocument();
+    });
+
+    it('deletes only the target task when duplicate text exists', async () => {
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      await user.type(input, 'Duplicate Task{enter}');
+      await user.type(input, 'Duplicate Task{enter}');
+
+      const deleteButtons = screen.getAllByRole('button', { name: /delete "duplicate task"/i });
+      expect(deleteButtons).toHaveLength(2);
+
+      await user.click(deleteButtons[0]);
+
+      const remaining = screen.getAllByText('Duplicate Task');
+      expect(remaining).toHaveLength(1);
+    });
+
+    it('restores the empty state when the final task is deleted', async () => {
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      await user.type(input, 'Only task{enter}');
+
+      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
+
+      const deleteBtn = screen.getByRole('button', { name: 'Delete "Only task"' });
+      await user.click(deleteBtn);
+
+      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
+    });
+  });
+
+  describe('LocalStorage persistence & restore', () => {
+    it('restores tasks and their completion state from localStorage on startup', () => {
+      const initialTasks = [
+        { id: 'task-1', text: 'Persistent Task 1', completed: false },
+        { id: 'task-2', text: 'Persistent Task 2', completed: true },
+      ];
+      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTasks));
+
+      render(<App />);
+
+      expect(screen.getByText('Persistent Task 1')).toBeInTheDocument();
+      expect(screen.getByText('Persistent Task 2')).toBeInTheDocument();
+
+      const checkboxes = screen.getAllByRole('checkbox');
+      expect(checkboxes[0]).not.toBeChecked();
+      expect(checkboxes[1]).toBeChecked();
+    });
+
+    it('does not overwrite existing localStorage tasks on initial mount', () => {
+      const initialTasks = [{ id: '1', text: 'Pre-existing', completed: false }];
+      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTasks));
+
+      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
+
+      render(<App />);
+
+      expect(setItemSpy).not.toHaveBeenCalled();
+      expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(initialTasks);
+    });
+
+    it('persists added task to localStorage', async () => {
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      await user.type(input, 'New persisted task{enter}');
+
+      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
+      expect(stored).toHaveLength(1);
+      expect(stored[0].text).toBe('New persisted task');
+      expect(stored[0].completed).toBe(false);
+    });
+
+    it('persists toggle change to localStorage', async () => {
+      const initialTasks = [{ id: '1', text: 'Toggle me', completed: false }];
+      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTasks));
+
+      const user = userEvent.setup();
+      render(<App />);
+
+      const checkbox = screen.getByRole('checkbox');
+      await user.click(checkbox);
+
+      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
+      expect(stored[0].completed).toBe(true);
+    });
+
+    it('persists deletion to localStorage and saves empty array on final delete', async () => {
+      const initialTasks = [{ id: '1', text: 'Delete me', completed: false }];
+      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTasks));
+
+      const user = userEvent.setup();
+      render(<App />);
+
+      const deleteBtn = screen.getByRole('button', { name: /delete/i });
+      await user.click(deleteBtn);
+
+      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
+      expect(stored).toEqual([]);
+    });
+  });
+
+  describe('Resilience and edge cases', () => {
+    it('handles localStorage read failure on initial load without crashing', () => {
+      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
+        throw new Error('Access denied');
+      });
+
+      render(<App />);
+
+      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
+    });
+
+    it('continues in-memory operations if localStorage write fails', async () => {
+      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
+        throw new Error('Quota exceeded');
+      });
+
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      await user.type(input, 'Operation continues{enter}');
+
+      expect(screen.getByText('Operation continues')).toBeInTheDocument();
+
+      const checkbox = screen.getByRole('checkbox');
+      await user.click(checkbox);
+      expect(checkbox).toBeChecked();
+
+      const deleteBtn = screen.getByRole('button', { name: /delete/i });
+      await user.click(deleteBtn);
+      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
+    });
+
+    it('handles extremely long unbroken strings without breaking', async () => {
+      const longText = 'a'.repeat(120);
+      const user = userEvent.setup();
+      render(<App />);
+
+      const input = screen.getByRole('textbox', { name: /new task description/i });
+      await user.type(input, `${longText}{enter}`);
+
+      expect(screen.getByText(longText)).toBeInTheDocument();
+    });
+  });
+});
diff --git a/src/main.jsx b/src/main.jsx
new file mode 100644
index 0000000..d76b758
--- /dev/null
+++ b/src/main.jsx
@@ -0,0 +1,9 @@
+import React from 'react';
+import ReactDOM from 'react-dom/client';
+import App from './App';
+
+ReactDOM.createRoot(document.getElementById('root')).render(
+  <React.StrictMode>
+    <App />
+  </React.StrictMode>
+);
diff --git a/src/setupTests.js b/src/setupTests.js
new file mode 100644
index 0000000..7b0828b
--- /dev/null
+++ b/src/setupTests.js
@@ -0,0 +1 @@
+import '@testing-library/jest-dom';
diff --git a/src/styles.css b/src/styles.css
new file mode 100644
index 0000000..375ef48
--- /dev/null
+++ b/src/styles.css
@@ -0,0 +1,204 @@
+:root {
+  --color-primary: #3b82f6;
+  --color-primary-hover: #2563eb;
+  --color-danger: #ef4444;
+  --color-danger-hover: #dc2626;
+  --color-bg: #f8fafc;
+  --color-card: #ffffff;
+  --color-text: #1e293b;
+  --color-text-muted: #64748b;
+  --color-border: #e2e8f0;
+  --radius-md: 8px;
+  --radius-sm: 6px;
+  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
+  --font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
+}
+
+*, *::before, *::after {
+  box-sizing: border-box;
+  margin: 0;
+  padding: 0;
+}
+
+body {
+  font-family: var(--font-family);
+  background-color: var(--color-bg);
+  color: var(--color-text);
+  line-height: 1.5;
+  min-height: 100vh;
+  padding: 1rem;
+}
+
+.todo-app {
+  width: 100%;
+  max-width: 560px;
+  margin: 2rem auto;
+  background: var(--color-card);
+  border-radius: var(--radius-md);
+  box-shadow: var(--shadow);
+  padding: 1.5rem;
+  border: 1px solid var(--color-border);
+}
+
+.todo-header {
+  margin-bottom: 1.5rem;
+  text-align: center;
+}
+
+.todo-header h1 {
+  font-size: 1.75rem;
+  font-weight: 700;
+  color: var(--color-text);
+}
+
+.todo-form {
+  display: flex;
+  gap: 0.5rem;
+  margin-bottom: 1.5rem;
+  width: 100%;
+}
+
+.todo-input {
+  flex: 1;
+  min-width: 0;
+  padding: 0.625rem 0.875rem;
+  font-size: 1rem;
+  border: 1px solid var(--color-border);
+  border-radius: var(--radius-sm);
+  outline: none;
+  background-color: #fff;
+  color: var(--color-text);
+  transition: border-color 0.2s, box-shadow 0.2s;
+}
+
+.todo-input:focus-visible {
+  border-color: var(--color-primary);
+  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
+}
+
+.todo-add-btn {
+  padding: 0.625rem 1.25rem;
+  font-size: 1rem;
+  font-weight: 600;
+  color: #fff;
+  background-color: var(--color-primary);
+  border: none;
+  border-radius: var(--radius-sm);
+  cursor: pointer;
+  white-space: nowrap;
+  transition: background-color 0.2s;
+}
+
+.todo-add-btn:hover {
+  background-color: var(--color-primary-hover);
+}
+
+.todo-add-btn:focus-visible {
+  outline: 2px solid var(--color-primary);
+  outline-offset: 2px;
+}
+
+.todo-list {
+  list-style: none;
+  display: flex;
+  flex-direction: column;
+  gap: 0.5rem;
+}
+
+.todo-item {
+  display: flex;
+  align-items: center;
+  gap: 0.75rem;
+  padding: 0.75rem;
+  border: 1px solid var(--color-border);
+  border-radius: var(--radius-sm);
+  background-color: #fff;
+  transition: background-color 0.15s, border-color 0.15s;
+}
+
+.todo-item.completed {
+  background-color: #f1f5f9;
+  border-color: #cbd5e1;
+}
+
+.todo-checkbox {
+  width: 1.15rem;
+  height: 1.15rem;
+  cursor: pointer;
+  accent-color: var(--color-primary);
+  flex-shrink: 0;
+}
+
+.todo-text {
+  flex: 1;
+  min-width: 0;
+  font-size: 1rem;
+  cursor: pointer;
+  word-break: break-word;
+  overflow-wrap: anywhere;
+  transition: color 0.15s;
+}
+
+.todo-item.completed .todo-text {
+  text-decoration: line-through;
+  color: var(--color-text-muted);
+}
+
+.todo-delete-btn {
+  padding: 0.375rem 0.75rem;
+  font-size: 0.875rem;
+  font-weight: 500;
+  color: var(--color-danger);
+  background: transparent;
+  border: 1px solid var(--color-danger);
+  border-radius: var(--radius-sm);
+  cursor: pointer;
+  flex-shrink: 0;
+  transition: background-color 0.15s, color 0.15s;
+}
+
+.todo-delete-btn:hover {
+  background-color: var(--color-danger);
+  color: #fff;
+}
+
+.todo-delete-btn:focus-visible {
+  outline: 2px solid var(--color-danger);
+  outline-offset: 2px;
+}
+
+.empty-state {
+  text-align: center;
+  padding: 2rem 1rem;
+  color: var(--color-text-muted);
+  font-size: 0.95rem;
+  border: 2px dashed var(--color-border);
+  border-radius: var(--radius-sm);
+}
+
+.visually-hidden {
+  position: absolute;
+  width: 1px;
+  height: 1px;
+  padding: 0;
+  margin: -1px;
+  overflow: hidden;
+  clip: rect(0, 0, 0, 0);
+  white-space: nowrap;
+  border: 0;
+}
+
+@media (max-width: 420px) {
+  .todo-app {
+    padding: 1rem;
+    margin: 1rem auto;
+  }
+
+  .todo-form {
+    flex-direction: column;
+  }
+
+  .todo-add-btn {
+    width: 100%;
+  }
+}
diff --git a/src/taskStorage.js b/src/taskStorage.js
new file mode 100644
index 0000000..8f2cec5
--- /dev/null
+++ b/src/taskStorage.js
@@ -0,0 +1,73 @@
+export const STORAGE_KEY = 'todo_app_tasks';
+
+/**
+ * Validates that an item has the required task schema.
+ * @param {unknown} item
+ * @returns {boolean}
+ */
+export function isValidTask(item) {
+  if (!item || typeof item !== 'object') {
+    return false;
+  }
+
+  const { id, text, completed } = item;
+
+  return (
+    typeof id === 'string' &&
+    id.trim().length > 0 &&
+    typeof text === 'string' &&
+    typeof completed === 'boolean'
+  );
+}
+
+/**
+ * Loads and validates tasks from localStorage.
+ * Returns an empty array if storage is empty, invalid, or inaccessible.
+ * @returns {Array<{ id: string, text: string, completed: boolean }>}
+ */
+export function loadTasks() {
+  try {
+    if (typeof window === 'undefined' || !window.localStorage) {
+      return [];
+    }
+
+    const raw = window.localStorage.getItem(STORAGE_KEY);
+    if (raw === null) {
+      return [];
+    }
+
+    const parsed = JSON.parse(raw);
+    if (!Array.isArray(parsed)) {
+      return [];
+    }
+
+    return parsed.filter(isValidTask);
+  } catch (error) {
+    console.warn('Failed to load tasks from localStorage:', error);
+    return [];
+  }
+}
+
+/**
+ * Persists tasks array to localStorage.
+ * Returns true on success, or false if storage fails or is inaccessible.
+ * @param {Array<{ id: string, text: string, completed: boolean }>} tasks
+ * @returns {boolean}
+ */
+export function saveTasks(tasks) {
+  try {
+    if (typeof window === 'undefined' || !window.localStorage) {
+      return false;
+    }
+
+    if (!Array.isArray(tasks)) {
+      return false;
+    }
+
+    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
+    return true;
+  } catch (error) {
+    console.warn('Failed to save tasks to localStorage:', error);
+    return false;
+  }
+}
diff --git a/src/taskStorage.test.js b/src/taskStorage.test.js
new file mode 100644
index 0000000..adf0e8c
--- /dev/null
+++ b/src/taskStorage.test.js
@@ -0,0 +1,129 @@
+import { describe, it, expect, beforeEach, vi } from 'vitest';
+import { STORAGE_KEY, isValidTask, loadTasks, saveTasks } from './taskStorage';
+
+describe('taskStorage', () => {
+  beforeEach(() => {
+    localStorage.clear();
+    vi.restoreAllMocks();
+  });
+
+  describe('isValidTask', () => {
+    it('returns true for a valid task object', () => {
+      expect(isValidTask({ id: 'task-1', text: 'Buy milk', completed: false })).toBe(true);
+      expect(isValidTask({ id: 'task-2', text: 'Clean room', completed: true })).toBe(true);
+    });
+
+    it('returns false for null, undefined, or non-objects', () => {
+      expect(isValidTask(null)).toBe(false);
+      expect(isValidTask(undefined)).toBe(false);
+      expect(isValidTask('string')).toBe(false);
+      expect(isValidTask(123)).toBe(false);
+      expect(isValidTask([])).toBe(false);
+    });
+
+    it('returns false when id is missing, not a string, or whitespace only', () => {
+      expect(isValidTask({ text: 'No id', completed: false })).toBe(false);
+      expect(isValidTask({ id: 123, text: 'Number id', completed: false })).toBe(false);
+      expect(isValidTask({ id: '', text: 'Empty id', completed: false })).toBe(false);
+      expect(isValidTask({ id: '   ', text: 'Whitespace id', completed: false })).toBe(false);
+    });
+
+    it('returns false when text is missing or not a string', () => {
+      expect(isValidTask({ id: '1', completed: false })).toBe(false);
+      expect(isValidTask({ id: '1', text: null, completed: false })).toBe(false);
+      expect(isValidTask({ id: '1', text: 123, completed: false })).toBe(false);
+    });
+
+    it('returns false when completed is missing or not a boolean', () => {
+      expect(isValidTask({ id: '1', text: 'Task' })).toBe(false);
+      expect(isValidTask({ id: '1', text: 'Task', completed: 'false' })).toBe(false);
+      expect(isValidTask({ id: '1', text: 'Task', completed: null })).toBe(false);
+      expect(isValidTask({ id: '1', text: 'Task', completed: 0 })).toBe(false);
+    });
+  });
+
+  describe('loadTasks', () => {
+    it('returns an empty array when localStorage key is empty', () => {
+      expect(loadTasks()).toEqual([]);
+    });
+
+    it('loads and returns valid tasks from localStorage', () => {
+      const stored = [
+        { id: '1', text: 'First task', completed: false },
+        { id: '2', text: 'Second task', completed: true },
+      ];
+      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
+
+      expect(loadTasks()).toEqual(stored);
+    });
+
+    it('filters out malformed task items and keeps valid ones', () => {
+      const stored = [
+        { id: '1', text: 'Valid task', completed: false },
+        { id: 'bad-1', text: 123, completed: false },
+        { id: '', text: 'Bad id', completed: false },
+        null,
+        'random string',
+        { id: '2', text: 'Another valid task', completed: true },
+      ];
+      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
+
+      expect(loadTasks()).toEqual([
+        { id: '1', text: 'Valid task', completed: false },
+        { id: '2', text: 'Another valid task', completed: true },
+      ]);
+    });
+
+    it('returns empty array when stored data is not a JSON array', () => {
+      localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
+      expect(loadTasks()).toEqual([]);
+
+      localStorage.setItem(STORAGE_KEY, JSON.stringify(42));
+      expect(loadTasks()).toEqual([]);
+    });
+
+    it('returns empty array when JSON is completely malformed', () => {
+      localStorage.setItem(STORAGE_KEY, '{ invalid json');
+      expect(loadTasks()).toEqual([]);
+    });
+
+    it('returns empty array gracefully if localStorage throws an error', () => {
+      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
+        throw new Error('Access denied');
+      });
+
+      expect(loadTasks()).toEqual([]);
+    });
+  });
+
+  describe('saveTasks', () => {
+    it('persists tasks array to localStorage under STORAGE_KEY', () => {
+      const tasks = [
+        { id: '1', text: 'Task 1', completed: false },
+        { id: '2', text: 'Task 2', completed: true },
+      ];
+
+      const success = saveTasks(tasks);
+      expect(success).toBe(true);
+
+      const raw = localStorage.getItem(STORAGE_KEY);
+      expect(raw).not.toBeNull();
+      expect(JSON.parse(raw)).toEqual(tasks);
+    });
+
+    it('returns false if tasks is not an array', () => {
+      expect(saveTasks(null)).toBe(false);
+      expect(saveTasks('invalid')).toBe(false);
+      expect(saveTasks({ id: '1' })).toBe(false);
+    });
+
+    it('returns false gracefully when localStorage.setItem throws', () => {
+      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
+        throw new Error('QuotaExceededError');
+      });
+
+      const tasks = [{ id: '1', text: 'Task 1', completed: false }];
+      expect(saveTasks(tasks)).toBe(false);
+    });
+  });
+});
diff --git a/vite.config.js b/vite.config.js
index f974185..330666b 100644
--- a/vite.config.js
+++ b/vite.config.js
@@ -6,5 +6,6 @@ export default defineConfig({
   test: {
     globals: true,
     environment: 'jsdom',
+    setupFiles: ['./src/setupTests.js'],
   },
 });
```
