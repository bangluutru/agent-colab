import { describe, it, expect, vi } from 'vitest';
import { renderGame } from '../src/game/renderer.js';
import { createBird } from '../src/game/entities/bird.js';
import { createPipeManager, spawnPipe } from '../src/game/entities/pipe-manager.js';
import { GAME_STATUS } from '../src/game/constants.js';

describe('Renderer Module', () => {
  const createMockCtx = () => ({
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
  });

  it('safely handles null or undefined ctx', () => {
    expect(() => renderGame(null, {})).not.toThrow();
  });

  it('renders sky, ground, clouds, and bird in IDLE status', () => {
    const ctx = createMockCtx();
    const bird = createBird();
    const pipeManager = createPipeManager();

    renderGame(ctx, {
      bird,
      pipeManager,
      score: 0,
      status: GAME_STATUS.IDLE,
      groundOffset: 10,
      cloudOffset: 5,
    });

    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled(); // Sky & ground
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('renders active pipes and in-game score in PLAYING status', () => {
    const ctx = createMockCtx();
    const bird = createBird();
    const pipeManager = createPipeManager();
    spawnPipe(pipeManager, 140);

    renderGame(ctx, {
      bird,
      pipeManager,
      score: 7,
      status: GAME_STATUS.PLAYING,
      groundOffset: 50,
      cloudOffset: 20,
    });

    // Both top and bottom pipes drawn
    expect(ctx.strokeRect).toHaveBeenCalled();
    // In-game score rendered
    expect(ctx.fillText).toHaveBeenCalledWith('7', expect.any(Number), expect.any(Number));
    expect(ctx.strokeText).toHaveBeenCalledWith('7', expect.any(Number), expect.any(Number));
  });

  it('renders without error in GAME_OVER status', () => {
    const ctx = createMockCtx();
    const bird = createBird();
    const pipeManager = createPipeManager();

    renderGame(ctx, {
      bird,
      pipeManager,
      score: 12,
      status: GAME_STATUS.GAME_OVER,
      groundOffset: 100,
      cloudOffset: 30,
    });

    expect(ctx.clearRect).toHaveBeenCalled();
  });
});
