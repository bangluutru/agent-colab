import {
  BIRD_WIDTH,
  BIRD_HEIGHT,
  BIRD_INITIAL_X,
  BIRD_INITIAL_Y,
  GRAVITY,
  FLAP_STRENGTH,
  MAX_FALL_SPEED,
  PLAYABLE_HEIGHT,
} from '../constants.js';

/**
 * Creates a fresh bird instance
 */
export function createBird(initialX = BIRD_INITIAL_X, initialY = BIRD_INITIAL_Y) {
  return {
    x: initialX,
    y: initialY,
    width: BIRD_WIDTH,
    height: BIRD_HEIGHT,
    velocity: 0,
    gravity: GRAVITY,
    flapStrength: FLAP_STRENGTH,
    rotation: 0, // In radians
    wingPhase: 0, // For flapping animation
    idleTimer: 0,
  };
}

/**
 * Applies an upward impulse to the bird
 */
export function flapBird(bird) {
  bird.velocity = bird.flapStrength;
}

/**
 * Updates bird physics and animation for one frame
 * @param {Object} bird - Bird state
 * @param {number} dt - Delta time in seconds
 * @param {string} status - 'idle' | 'playing' | 'gameOver'
 */
export function updateBird(bird, dt, status = 'playing') {
  if (status === 'idle') {
    // Gentle sine wave bobbing in idle mode
    bird.idleTimer += dt * 3.5;
    bird.y = BIRD_INITIAL_Y + Math.sin(bird.idleTimer) * 7;
    bird.velocity = 0;
    bird.rotation = 0;
    bird.wingPhase += dt * 8;
    return;
  }

  if (status === 'playing') {
    // Apply gravity
    bird.velocity += bird.gravity * dt;
    if (bird.velocity > MAX_FALL_SPEED) {
      bird.velocity = MAX_FALL_SPEED;
    }

    bird.y += bird.velocity * dt;

    // Wing flapping animation: faster when ascending or hovering
    if (bird.velocity < 100) {
      bird.wingPhase += dt * 12;
    } else {
      bird.wingPhase += dt * 3;
    }

    // Dynamic rotation based on velocity
    if (bird.velocity < 0) {
      // Tilting up (-25 degrees max)
      const targetRotation = -0.45;
      bird.rotation = Math.max(targetRotation, bird.rotation - dt * 6);
    } else {
      // Tilting down towards ground (+75 degrees max)
      const targetRotation = 1.3;
      bird.rotation = Math.min(targetRotation, bird.rotation + dt * 4.5);
    }
    return;
  }

  if (status === 'gameOver') {
    // If not on ground, bird falls to the ground
    if (bird.y + bird.height < PLAYABLE_HEIGHT) {
      bird.velocity += bird.gravity * dt;
      if (bird.velocity > MAX_FALL_SPEED) {
        bird.velocity = MAX_FALL_SPEED;
      }
      bird.y += bird.velocity * dt;
      if (bird.y + bird.height > PLAYABLE_HEIGHT) {
        bird.y = PLAYABLE_HEIGHT - bird.height;
        bird.velocity = 0;
      }
    }
    // Point nose down quickly on death
    bird.rotation = Math.min(1.4, bird.rotation + dt * 8);
  }
}
