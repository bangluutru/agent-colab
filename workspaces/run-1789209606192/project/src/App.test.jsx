import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { App } from './App';

describe('App Component and Interactive Fireworks', () => {
  let mockRafId;
  let activeRafCallbacks;
  let virtualTime;

  beforeEach(() => {
    mockRafId = 0;
    activeRafCallbacks = new Map();
    virtualTime = 1000;

    // Polyfill PointerEvent for jsdom
    if (!window.PointerEvent) {
      window.PointerEvent = class PointerEvent extends window.MouseEvent {};
    }

    // Mock HTMLCanvasElement.getContext('2d')
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
    });

    // Provide default bounding client rect for canvas
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Deterministic requestAnimationFrame providing valid numeric timestamps (prevents NaN)
    window.requestAnimationFrame = vi.fn((cb) => {
      const id = ++mockRafId;
      const timer = setTimeout(() => {
        activeRafCallbacks.delete(id);
        virtualTime += 32; // Deterministic 32ms delta
        act(() => {
          cb(virtualTime);
        });
      }, 10);
      activeRafCallbacks.set(id, timer);
      return id;
    });

    window.cancelAnimationFrame = vi.fn((id) => {
      const timer = activeRafCallbacks.get(id);
      if (timer) {
        clearTimeout(timer);
        activeRafCallbacks.delete(id);
      }
    });
  });

  afterEach(() => {
    for (const timer of activeRafCallbacks.values()) {
      clearTimeout(timer);
    }
    activeRafCallbacks.clear();
    vi.restoreAllMocks();
  });

  it('renders title, stats, instructions and interactive controls', () => {
    render(<App />);

    // Brand and title
    expect(screen.getByText('Pháo Hoa Đêm Hội')).toBeInTheDocument();

    // Instructions
    expect(screen.getByText(/Nhấp hoặc chạm bất kỳ đâu/i)).toBeInTheDocument();

    // Stats
    expect(screen.getByTestId('stat-rockets')).toBeInTheDocument();
    expect(screen.getByTestId('stat-particles')).toBeInTheDocument();

    // Buttons
    const launchBtn = screen.getByRole('button', { name: /Bắn một quả pháo hoa/i });
    expect(launchBtn).toBeInTheDocument();

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    expect(autoBtn).toBeInTheDocument();

    const soundBtn = screen.getByRole('button', { name: /âm thanh/i });
    expect(soundBtn).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    expect(clearBtn).toBeInTheDocument();
  });

  it('toggles auto-fire mode when auto button is clicked', () => {
    render(<App />);

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    const initialPressed = autoBtn.getAttribute('aria-pressed');

    fireEvent.click(autoBtn);
    const updatedPressed = autoBtn.getAttribute('aria-pressed');
    expect(updatedPressed).not.toBe(initialPressed);

    // Verify button text updates
    expect(autoBtn.textContent).toMatch(/Tự động: (BẬT|TẮT)/);
  });

  it('triggers manual launch and asserts rocket count increment', async () => {
    render(<App />);

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    if (autoBtn.getAttribute('aria-pressed') === 'true') {
      fireEvent.click(autoBtn); // Turn off auto-fire for predictable count
    }

    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    fireEvent.click(clearBtn);

    const initialRockets = Number(screen.getByTestId('stat-rockets').textContent);
    expect(initialRockets).toBe(0);

    const launchBtn = screen.getByRole('button', { name: /Bắn một quả pháo hoa/i });
    fireEvent.click(launchBtn);

    await waitFor(() => {
      const rocketCount = Number(screen.getByTestId('stat-rockets').textContent);
      expect(rocketCount).toBeGreaterThanOrEqual(1);
    });
  });

  it('triggers manual launch on Space and Enter keyboard shortcuts', async () => {
    render(<App />);

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    if (autoBtn.getAttribute('aria-pressed') === 'true') {
      fireEvent.click(autoBtn);
    }
    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    fireEvent.click(clearBtn);

    // Press Space on window
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });

    await waitFor(() => {
      expect(Number(screen.getByTestId('stat-rockets').textContent)).toBe(1);
    });

    // Press Enter on window
    fireEvent.keyDown(window, { code: 'Enter', key: 'Enter' });

    await waitFor(() => {
      expect(Number(screen.getByTestId('stat-rockets').textContent)).toBe(2);
    });
  });

  it('does not trigger global launch shortcut when user is typing in an input element', async () => {
    render(<App />);

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    if (autoBtn.getAttribute('aria-pressed') === 'true') {
      fireEvent.click(autoBtn);
    }
    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    fireEvent.click(clearBtn);

    const testInput = document.createElement('input');
    document.body.appendChild(testInput);
    testInput.focus();

    fireEvent.keyDown(testInput, { code: 'Space', key: ' ' });

    // Wait short time and ensure no rockets launched
    await new Promise((r) => setTimeout(r, 60));
    expect(Number(screen.getByTestId('stat-rockets').textContent)).toBe(0);

    document.body.removeChild(testInput);
  });

  it('triggers manual launch when launch button has focus and is activated by Enter or Space', async () => {
    render(<App />);

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    if (autoBtn.getAttribute('aria-pressed') === 'true') {
      fireEvent.click(autoBtn);
    }
    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    fireEvent.click(clearBtn);

    const launchBtn = screen.getByRole('button', { name: /Bắn một quả pháo hoa/i });
    launchBtn.focus();
    expect(document.activeElement).toBe(launchBtn);

    // Focused button activation via Enter
    fireEvent.keyDown(launchBtn, { key: 'Enter', code: 'Enter' });
    fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(Number(screen.getByTestId('stat-rockets').textContent)).toBeGreaterThanOrEqual(1);
    });

    // Focused button activation via Space
    fireEvent.keyDown(launchBtn, { key: ' ', code: 'Space' });
    fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(Number(screen.getByTestId('stat-rockets').textContent)).toBeGreaterThanOrEqual(2);
    });
  });

  it('launches rocket on pointer/touch input on the canvas, filtering non-primary buttons', async () => {
    render(<App />);

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    if (autoBtn.getAttribute('aria-pressed') === 'true') {
      fireEvent.click(autoBtn);
    }
    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    fireEvent.click(clearBtn);

    const canvas = screen.getByRole('application', { name: /Vùng trời bắn pháo hoa/i });

    // Primary pointer/touch tap (button 0)
    fireEvent.pointerDown(canvas, { clientX: 450, clientY: 250, button: 0 });

    await waitFor(() => {
      expect(Number(screen.getByTestId('stat-rockets').textContent)).toBe(1);
    });

    // Secondary button (button 2 - right click) must be ignored
    fireEvent.pointerDown(canvas, { clientX: 450, clientY: 250, button: 2 });
    await new Promise((r) => setTimeout(r, 60));
    expect(Number(screen.getByTestId('stat-rockets').textContent)).toBe(1);
  });

  it('advances simulation progression: rockets travel and burst into particles', async () => {
    render(<App />);

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    if (autoBtn.getAttribute('aria-pressed') === 'true') {
      fireEvent.click(autoBtn);
    }
    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    fireEvent.click(clearBtn);

    const launchBtn = screen.getByRole('button', { name: /Bắn một quả pháo hoa/i });
    fireEvent.click(launchBtn);

    // Initial check: rocket in flight
    await waitFor(() => {
      expect(Number(screen.getByTestId('stat-rockets').textContent)).toBeGreaterThanOrEqual(1);
    });

    // As animation frames advance, rocket arrives at target and bursts into particles
    await waitFor(
      () => {
        const particleCount = Number(screen.getByTestId('stat-particles').textContent);
        expect(particleCount).toBeGreaterThan(0);
      },
      { timeout: 2500 }
    );
  });

  it('handles window resize and updates canvas scaling and dimensions', () => {
    render(<App />);

    const canvas = screen.getByRole('application', { name: /Vùng trời bắn pháo hoa/i });

    // Simulate window resize to 1024x768
    canvas.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 1024,
      height: 768,
      right: 1024,
      bottom: 768,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(canvas.width).toBeGreaterThanOrEqual(1024);
    expect(canvas.height).toBeGreaterThanOrEqual(768);
  });

  it('recovers cleanly from tab visibility hidden to visible without delta-time explosion', async () => {
    render(<App />);

    // Switch tab to hidden
    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Advance timers while hidden
    await new Promise((r) => setTimeout(r, 60));

    // Switch tab back to visible
    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Verify app continues rendering without crashing
    const launchBtn = screen.getByRole('button', { name: /Bắn một quả pháo hoa/i });
    fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(Number(screen.getByTestId('stat-rockets').textContent)).toBeGreaterThanOrEqual(1);
    });
  });

  it('clears fireworks when clear button is clicked', () => {
    render(<App />);

    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    fireEvent.click(clearBtn);

    const rocketStat = screen.getByTestId('stat-rockets');
    expect(rocketStat.textContent).toBe('0');
  });

  it('toggles sound fx enabled state', () => {
    render(<App />);

    const soundBtn = screen.getByRole('button', { name: /âm thanh/i });
    const initialTitle = soundBtn.getAttribute('title');

    fireEvent.click(soundBtn);
    const updatedTitle = soundBtn.getAttribute('title');
    expect(updatedTitle).not.toBe(initialTitle);
  });

  it('displays fallback message when 2d canvas context fails', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

    render(<App />);

    expect(
      screen.getByText('Trình duyệt không hỗ trợ Canvas 2D')
    ).toBeInTheDocument();
  });

  it('renders all four dock controls and supports both automatic-mode labels', () => {
    const { container } = render(<App />);

    const dock = container.querySelector('.control-dock');
    expect(dock).toBeInTheDocument();

    const buttons = dock.querySelectorAll('button');
    expect(buttons).toHaveLength(4);

    const [launchBtn, autoBtn, soundBtn, clearBtn] = buttons;
    expect(launchBtn).toHaveClass('btn-primary');
    expect(autoBtn).toHaveClass('btn-toggle');
    expect(soundBtn).toHaveClass('btn-icon-only');
    expect(clearBtn).toHaveClass('btn-icon-only');

    // Initial automatic-mode: BẬT
    expect(autoBtn).toHaveAttribute('aria-pressed', 'true');
    expect(autoBtn.textContent).toContain('Tự động: BẬT');

    // Toggle to TẮT
    fireEvent.click(autoBtn);
    expect(autoBtn).toHaveAttribute('aria-pressed', 'false');
    expect(autoBtn.textContent).toContain('Tự động: TẮT');

    // Toggle back to BẬT
    fireEvent.click(autoBtn);
    expect(autoBtn).toHaveAttribute('aria-pressed', 'true');
    expect(autoBtn.textContent).toContain('Tự động: BẬT');
  });

  it('launches rocket via direct touch input on canvas with debounce against duplicate pointer', async () => {
    render(<App />);

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    if (autoBtn.getAttribute('aria-pressed') === 'true') {
      fireEvent.click(autoBtn);
    }
    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    fireEvent.click(clearBtn);

    const canvas = screen.getByRole('application', { name: /Vùng trời bắn pháo hoa/i });

    // 1. Direct touch event
    fireEvent.touchStart(canvas, { touches: [{ clientX: 350, clientY: 200 }] });
    await waitFor(() => {
      expect(Number(screen.getByTestId('stat-rockets').textContent)).toBe(1);
    });

    // 2. Pointer down immediately followed by touchStart (debounce check)
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 220, button: 0 });
    fireEvent.touchStart(canvas, { touches: [{ clientX: 400, clientY: 220 }] });

    await waitFor(() => {
      // Should have incremented by only 1 (total 2), not double-fired to 3
      expect(Number(screen.getByTestId('stat-rockets').textContent)).toBe(2);
    });
  });

  it('performs complete cleanup of active rockets and burst particles', async () => {
    render(<App />);

    const autoBtn = screen.getByRole('button', { name: /Chế độ bắn tự động/i });
    if (autoBtn.getAttribute('aria-pressed') === 'true') {
      fireEvent.click(autoBtn);
    }

    const launchBtn = screen.getByRole('button', { name: /Bắn một quả pháo hoa/i });
    fireEvent.click(launchBtn);
    fireEvent.click(launchBtn);

    // Wait for particles to spawn
    await waitFor(
      () => {
        expect(Number(screen.getByTestId('stat-particles').textContent)).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );

    // Click cleanup
    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả pháo hoa/i });
    fireEvent.click(clearBtn);

    expect(screen.getByTestId('stat-rockets').textContent).toBe('0');
    expect(screen.getByTestId('stat-particles').textContent).toBe('0');
  });
});
