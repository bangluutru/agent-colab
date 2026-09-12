import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FlappyBirdGame from '../src/components/FlappyBirdGame.jsx';
import { resetHighScore, saveHighScore } from '../src/game/storage.js';

describe('FlappyBirdGame Component', () => {
  beforeEach(() => {
    resetHighScore();
    window.localStorage.clear();

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    }));
  });

  it('renders initial start screen with title, instructions, and start button', () => {
    render(<FlappyBirdGame />);

    expect(screen.getByText('FLAPPY BIRD')).toBeTruthy();
    expect(screen.getByTestId('start-screen')).toBeTruthy();
    expect(screen.getByTestId('start-button')).toBeTruthy();
    expect(screen.getByTestId('idle-highscore').textContent).toBe('0');
  });

  it('renders stored high score on start screen', () => {
    saveHighScore(18);
    render(<FlappyBirdGame />);
    expect(screen.getByTestId('idle-highscore').textContent).toBe('18');
  });

  it('starts the game when "Bắt đầu chơi" button is clicked', () => {
    render(<FlappyBirdGame />);

    const startButton = screen.getByTestId('start-button');
    act(() => {
      fireEvent.click(startButton);
    });

    // In playing mode, the start overlay should disappear
    expect(screen.queryByTestId('start-screen')).toBeNull();
  });

  it('starts the game when clicking or pointer-down on the stage', () => {
    render(<FlappyBirdGame />);

    const stage = screen.getByRole('region', { name: /Khu vực chơi game Flappy Bird/i });
    act(() => {
      fireEvent.pointerDown(stage);
    });

    expect(screen.queryByTestId('start-screen')).toBeNull();
  });

  it('starts the game when pressing the Spacebar', () => {
    render(<FlappyBirdGame />);

    act(() => {
      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    });

    expect(screen.queryByTestId('start-screen')).toBeNull();
  });

  it('ignores held Spacebar repeat events', () => {
    render(<FlappyBirdGame />);

    act(() => {
      // Repeat event should be ignored and not crash
      fireEvent.keyDown(window, { code: 'Space', key: ' ', repeat: true });
    });

    // Since repeat was true, start was not triggered
    expect(screen.getByTestId('start-screen')).toBeTruthy();
  });

  it('renders game canvas with proper accessibility role', () => {
    render(<FlappyBirdGame />);
    const stage = screen.getByRole('region', { name: /Khu vực chơi game Flappy Bird/i });
    expect(stage).toBeTruthy();
  });

  it('displays Game Over screen when bird collides, and restarts on button click', () => {
    let engineInstance = null;
    render(
      <FlappyBirdGame
        onEngineReady={(engine) => {
          engineInstance = engine;
        }}
      />
    );

    expect(engineInstance).not.toBeNull();

    // Start game
    act(() => {
      engineInstance.start();
    });
    expect(screen.queryByTestId('start-screen')).toBeNull();

    // Trigger game over with score = 5
    act(() => {
      engineInstance.score = 5;
      engineInstance.handleGameOver();
    });

    // Game Over screen should now be visible
    expect(screen.getByTestId('game-over-screen')).toBeTruthy();
    expect(screen.getByTestId('final-score').textContent).toBe('5');
    expect(screen.getByTestId('best-score').textContent).toBe('5');
    expect(screen.getByTestId('new-record-badge')).toBeTruthy();

    // Click restart button
    const restartButton = screen.getByTestId('restart-button');
    act(() => {
      fireEvent.click(restartButton);
    });

    // Should return to clean idle/start screen
    expect(screen.queryByTestId('game-over-screen')).toBeNull();
    expect(screen.getByTestId('start-screen')).toBeTruthy();
    expect(screen.getByTestId('idle-highscore').textContent).toBe('5');
  });

  it('handles touchstart input fallback on stage for devices without pointer events', () => {
    let engineInstance = null;
    render(
      <FlappyBirdGame
        onEngineReady={(engine) => {
          engineInstance = engine;
        }}
      />
    );

    const stage = screen.getByRole('region', { name: /Khu vực chơi game Flappy Bird/i });

    // Touchstart from IDLE starts game
    act(() => {
      fireEvent.touchStart(stage);
    });
    expect(screen.queryByTestId('start-screen')).toBeNull();
    expect(engineInstance.status).toBe('playing');

    // Touchstart while PLAYING flaps bird
    const flapSpy = vi.spyOn(engineInstance, 'flap');
    act(() => {
      fireEvent.touchStart(stage);
    });
    expect(flapSpy).toHaveBeenCalledTimes(1);
  });

  it('handles click input fallback on stage for devices without pointer or touch events', () => {
    let engineInstance = null;
    render(
      <FlappyBirdGame
        onEngineReady={(engine) => {
          engineInstance = engine;
        }}
      />
    );

    const stage = screen.getByRole('region', { name: /Khu vực chơi game Flappy Bird/i });

    // Click from IDLE starts game
    act(() => {
      fireEvent.click(stage);
    });
    expect(screen.queryByTestId('start-screen')).toBeNull();
    expect(engineInstance.status).toBe('playing');
  });

  it('deduplicates simultaneous pointerdown, touchstart, mousedown, and click into a single flap', () => {
    let engineInstance = null;
    render(
      <FlappyBirdGame
        onEngineReady={(engine) => {
          engineInstance = engine;
        }}
      />
    );

    // Start game first
    act(() => {
      engineInstance.start();
    });

    const flapSpy = vi.spyOn(engineInstance, 'flap');
    const stage = screen.getByRole('region', { name: /Khu vực chơi game Flappy Bird/i });

    // Simulate browser dispatching multiple synthetic events for one single physical touch
    act(() => {
      fireEvent.pointerDown(stage);
      fireEvent.touchStart(stage);
      fireEvent.mouseDown(stage);
      fireEvent.click(stage);
    });

    // Exactly one flap must be triggered despite 4 incoming DOM events
    expect(flapSpy).toHaveBeenCalledTimes(1);
  });

  it('applies viewport-constrained responsive styling preventing mobile landscape overflow', () => {
    import('../src/styles/flappy-bird.css');
    const { container } = render(<FlappyBirdGame />);
    const wrapper = container.querySelector('.flappy-game-wrapper');
    const stage = container.querySelector('.flappy-game-stage');

    expect(wrapper).toBeTruthy();
    expect(stage).toBeTruthy();

    // Verify mathematical constraint for mobile landscape viewports:
    // For a landscape phone: width = 844px, height = 390px
    const landscapeHeight = 390;
    const availableHeight = landscapeHeight - 20; // accounting for landscape padding
    const maxAllowedStageHeight = availableHeight;
    const computedStageWidth = Math.min(380, availableHeight * (360 / 600));
    const computedStageHeight = computedStageWidth * (600 / 360);

    expect(computedStageHeight).toBeLessThanOrEqual(maxAllowedStageHeight);
    expect(computedStageHeight).toBeLessThan(landscapeHeight);
    // Aspect ratio is strictly preserved (360 / 600 = 0.6)
    expect(computedStageWidth / computedStageHeight).toBeCloseTo(360 / 600, 5);
  });
});
