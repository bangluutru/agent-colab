import { describe, it, expect } from 'vitest';
import {
  createPipeManager,
  spawnPipe,
  updatePipes,
  resetPipes,
} from '../src/game/entities/pipe-manager.js';
import {
  CANVAS_WIDTH,
  PIPE_WIDTH,
  PIPE_GAP,
  PIPE_SPEED,
  MIN_PIPE_HEIGHT,
  MAX_PIPE_HEIGHT,
} from '../src/game/constants.js';

describe('Pipe Manager Entity', () => {
  it('creates an empty pipe manager', () => {
    const manager = createPipeManager();
    expect(manager.pipes).toEqual([]);
    expect(manager.speed).toBe(PIPE_SPEED);
  });

  it('spawns a pipe pair with valid dimensions and right-edge position', () => {
    const manager = createPipeManager();
    const pipe = spawnPipe(manager);

    expect(pipe.x).toBe(CANVAS_WIDTH);
    expect(pipe.width).toBe(PIPE_WIDTH);
    expect(pipe.gap).toBe(PIPE_GAP);
    expect(pipe.passed).toBe(false);
    expect(pipe.topHeight).toBeGreaterThanOrEqual(MIN_PIPE_HEIGHT);
    expect(pipe.topHeight).toBeLessThanOrEqual(MAX_PIPE_HEIGHT);
    expect(manager.pipes.length).toBe(1);
  });

  it('moves pipes leftward according to dt and speed', () => {
    const manager = createPipeManager();
    const pipe = spawnPipe(manager, 150);
    const initialX = pipe.x;

    updatePipes(manager, 0.1, 50);
    expect(pipe.x).toBeCloseTo(initialX - PIPE_SPEED * 0.1, 1);
  });

  it('spawns pipes periodically based on spawnInterval', () => {
    const manager = createPipeManager();
    expect(manager.pipes.length).toBe(0);

    // Update with dt less than spawn interval
    updatePipes(manager, 1.0, 50);
    expect(manager.pipes.length).toBe(0);

    // Advance past spawn interval (1.75s)
    updatePipes(manager, 0.8, 50);
    expect(manager.pipes.length).toBe(1);
  });

  it('awards 1 point when bird passes the pipe, and never awards double points', () => {
    const manager = createPipeManager();
    const pipe = spawnPipe(manager, 150);
    pipe.x = 100; // Pipe extends from 100 to 100 + 52 = 152

    // Bird is before pipe
    let result = updatePipes(manager, 0.01, 80);
    expect(result.pointsAwarded).toBe(0);
    expect(pipe.passed).toBe(false);

    // Bird is beyond pipe (80 + x > 152) -> bird at 160
    result = updatePipes(manager, 0.01, 160);
    expect(result.pointsAwarded).toBe(1);
    expect(pipe.passed).toBe(true);

    // Subsequent frame: pipe already marked passed, no additional points
    result = updatePipes(manager, 0.01, 160);
    expect(result.pointsAwarded).toBe(0);
  });

  it('prunes offscreen pipes', () => {
    const manager = createPipeManager();
    const pipe = spawnPipe(manager, 150);
    pipe.x = -60; // Far past left boundary (-10)

    updatePipes(manager, 0.01, 200);
    expect(manager.pipes.length).toBe(0);
  });

  it('resets all pipes and timers', () => {
    const manager = createPipeManager();
    spawnPipe(manager);
    spawnPipe(manager);
    expect(manager.pipes.length).toBe(2);

    resetPipes(manager);
    expect(manager.pipes.length).toBe(0);
    expect(manager.spawnTimer).toBe(0);
  });
});
