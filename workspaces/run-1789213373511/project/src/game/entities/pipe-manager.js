import {
  CANVAS_WIDTH,
  PIPE_WIDTH,
  PIPE_GAP,
  PIPE_SPEED,
  PIPE_SPAWN_INTERVAL,
  MIN_PIPE_HEIGHT,
  MAX_PIPE_HEIGHT,
} from '../constants.js';

/**
 * Creates a new pipe manager instance
 */
export function createPipeManager() {
  return {
    pipes: [],
    spawnTimer: 0,
    spawnInterval: PIPE_SPAWN_INTERVAL,
    speed: PIPE_SPEED,
    nextId: 1,
  };
}

/**
 * Creates and spawns a single pipe pair at the right edge of the screen
 */
export function spawnPipe(manager, customTopHeight = null) {
  const topHeight =
    customTopHeight !== null
      ? customTopHeight
      : Math.floor(
          MIN_PIPE_HEIGHT + Math.random() * (MAX_PIPE_HEIGHT - MIN_PIPE_HEIGHT)
        );

  const pipe = {
    id: manager.nextId++,
    x: CANVAS_WIDTH,
    width: PIPE_WIDTH,
    topHeight,
    gap: PIPE_GAP,
    passed: false,
  };

  manager.pipes.push(pipe);
  return pipe;
}

/**
 * Updates all pipes: moves them, spawns new ones, detects scoring, and prunes offscreen ones.
 * @param {Object} manager - Pipe manager
 * @param {number} dt - Delta time in seconds
 * @param {number} birdX - Current bird horizontal position for scoring check
 * @returns {{ pointsAwarded: number }}
 */
export function updatePipes(manager, dt, birdX) {
  let pointsAwarded = 0;

  // Advance spawn timer
  manager.spawnTimer += dt;
  if (manager.spawnTimer >= manager.spawnInterval) {
    manager.spawnTimer -= manager.spawnInterval;
    spawnPipe(manager);
  }

  // Move each pipe and check scoring
  for (let i = 0; i < manager.pipes.length; i++) {
    const pipe = manager.pipes[i];
    pipe.x -= manager.speed * dt;

    // Award point when the bird's left/center edge successfully clears the pipe's right edge
    if (!pipe.passed && birdX > pipe.x + pipe.width) {
      pipe.passed = true;
      pointsAwarded += 1;
    }
  }

  // Prune pipes that have fully moved past the left screen edge
  manager.pipes = manager.pipes.filter((pipe) => pipe.x + pipe.width > 0);

  return { pointsAwarded };
}

/**
 * Clears all active pipes and resets timers
 */
export function resetPipes(manager) {
  manager.pipes = [];
  manager.spawnTimer = 0;
  manager.nextId = 1;
}
