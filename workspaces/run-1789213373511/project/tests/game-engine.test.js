import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../src/game/game-engine.js';
import { GAME_STATUS, PLAYABLE_HEIGHT } from '../src/game/constants.js';
import { resetHighScore } from '../src/game/storage.js';

describe('GameEngine', () => {
  let mockCanvas;
  let mockCtx;

  beforeEach(() => {
    resetHighScore();
    window.localStorage.clear();

    mockCtx = {
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
    };

    mockCanvas = {
      getContext: vi.fn(() => mockCtx),
    };
  });

  it('initializes with IDLE status, 0 score, and bird at starting position', () => {
    const onStateChange = vi.fn();
    const engine = new GameEngine(mockCanvas, { onStateChange });

    expect(engine.status).toBe(GAME_STATUS.IDLE);
    expect(engine.score).toBe(0);
    expect(engine.pipeManager.pipes.length).toBe(0);
    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: GAME_STATUS.IDLE,
        score: 0,
      })
    );
  });

  it('transitions from IDLE to PLAYING on start() or flap()', () => {
    const engine = new GameEngine(mockCanvas);
    expect(engine.status).toBe(GAME_STATUS.IDLE);

    engine.flap(); // Flapping while IDLE starts the game
    expect(engine.status).toBe(GAME_STATUS.PLAYING);
    expect(engine.bird.velocity).toBeLessThan(0); // Upward boost
  });

  it('clamps delta time in update to prevent huge skips', () => {
    const engine = new GameEngine(mockCanvas);
    engine.start();

    // Large dt e.g. 5 seconds (simulating tab inactive)
    const initialY = engine.bird.y;
    engine.update(5.0);

    // Clamped dt is 0.1s, bird shouldn't have plummeted 5 seconds worth of gravity
    expect(engine.bird.velocity).toBeLessThanOrEqual(500);
  });

  it('increments score and updates high score when pipes are cleared', () => {
    const onScore = vi.fn();
    const onStateChange = vi.fn();
    const engine = new GameEngine(mockCanvas, { onScore, onStateChange });
    engine.start();

    // Manually push a pipe positioned so that bird passes it
    engine.pipeManager.pipes.push({
      id: 1,
      x: 70, // Bird is at x=80, pipe width 52, right edge 122 -> pass it by setting x=20
      width: 52,
      topHeight: 100,
      gap: 150,
      passed: false,
    });
    engine.pipeManager.pipes[0].x = 20; // bird.x (80) > pipe.x + pipe.width (72)

    engine.update(0.016);

    expect(engine.score).toBe(1);
    expect(engine.highScore).toBe(1);
    expect(engine.isNewHighScore).toBe(true);
    expect(onScore).toHaveBeenCalledWith(1);
  });

  it('detects collision with ground and triggers gameOver', () => {
    const onGameOver = vi.fn();
    const engine = new GameEngine(mockCanvas, { onGameOver });
    engine.start();

    // Move bird to ground
    engine.bird.y = PLAYABLE_HEIGHT + 10;
    engine.update(0.016);

    expect(engine.status).toBe(GAME_STATUS.GAME_OVER);
    expect(onGameOver).toHaveBeenCalled();
  });

  it('restarts cleanly back to IDLE status with 0 score and empty pipes', () => {
    const engine = new GameEngine(mockCanvas);
    engine.start();
    engine.score = 10;
    engine.status = GAME_STATUS.GAME_OVER;

    engine.restart();
    expect(engine.status).toBe(GAME_STATUS.IDLE);
    expect(engine.score).toBe(0);
    expect(engine.pipeManager.pipes.length).toBe(0);
  });

  it('stops the animation loop and cancels requestAnimationFrame on game over', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const engine = new GameEngine(mockCanvas);
    engine.startLoop();
    engine.start();
    expect(engine.status).toBe(GAME_STATUS.PLAYING);
    expect(engine.isRunning).toBe(true);
    expect(engine.animationFrameId).not.toBeNull();

    // Trigger game over
    engine.bird.y = PLAYABLE_HEIGHT + 20;
    engine.update(0.016);

    expect(engine.status).toBe(GAME_STATUS.GAME_OVER);
    expect(engine.isRunning).toBe(false);
    expect(engine.animationFrameId).toBeNull();
    expect(cancelSpy).toHaveBeenCalled();

    // Verify calling loop while stopped does not reschedule frames
    const reqSpy = vi.spyOn(window, 'requestAnimationFrame');
    engine.loop(2000);
    expect(reqSpy).not.toHaveBeenCalled();
    expect(engine.animationFrameId).toBeNull();
  });

  it('renders final game state once on game over transition', () => {
    const engine = new GameEngine(mockCanvas);
    const renderSpy = vi.spyOn(engine, 'render');
    engine.start();

    // Trigger game over directly
    engine.handleGameOver();
    expect(engine.status).toBe(GAME_STATUS.GAME_OVER);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(engine.isRunning).toBe(false);
  });

  it('restarts cleanly with exactly one active animation loop across repeated restarts', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const reqSpy = vi.spyOn(window, 'requestAnimationFrame');
    const engine = new GameEngine(mockCanvas);

    // Initial start
    engine.startLoop();
    expect(engine.isRunning).toBe(true);

    // Repeated restarts in succession
    cancelSpy.mockClear();
    reqSpy.mockClear();
    for (let i = 0; i < 5; i++) {
      engine.restart();
    }

    // Each restart cancels the previous loop and starts exactly one new loop
    expect(cancelSpy).toHaveBeenCalledTimes(5);
    expect(reqSpy).toHaveBeenCalledTimes(5);
    expect(engine.isRunning).toBe(true);
    expect(engine.animationFrameId).not.toBeNull();
  });

  it('stops and cleans up animation loops on destroy', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const engine = new GameEngine(mockCanvas);
    engine.startLoop();
    expect(engine.isRunning).toBe(true);

    engine.destroy();
    expect(engine.isRunning).toBe(false);
    expect(cancelSpy).toHaveBeenCalled();
  });
});
