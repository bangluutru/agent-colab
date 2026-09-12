import { describe, it, expect } from 'vitest';
import {
  createBird,
  flapBird,
  updateBird,
} from '../src/game/entities/bird.js';
import {
  BIRD_INITIAL_X,
  BIRD_INITIAL_Y,
  FLAP_STRENGTH,
  MAX_FALL_SPEED,
  PLAYABLE_HEIGHT,
  BIRD_HEIGHT,
} from '../src/game/constants.js';

describe('Bird Entity', () => {
  it('creates bird with correct initial values', () => {
    const bird = createBird();
    expect(bird.x).toBe(BIRD_INITIAL_X);
    expect(bird.y).toBe(BIRD_INITIAL_Y);
    expect(bird.velocity).toBe(0);
    expect(bird.rotation).toBe(0);
  });

  it('flaps and sets upward velocity', () => {
    const bird = createBird();
    flapBird(bird);
    expect(bird.velocity).toBe(FLAP_STRENGTH);
  });

  it('updates position with idle bobbing when status is idle', () => {
    const bird = createBird();
    const initialY = bird.y;
    updateBird(bird, 0.1, 'idle');
    expect(bird.velocity).toBe(0);
    expect(bird.rotation).toBe(0);
    // Y changes according to sine wave bobbing
    expect(bird.y).not.toBe(initialY);
  });

  it('applies gravity and updates position when status is playing', () => {
    const bird = createBird();
    const initialY = bird.y;
    updateBird(bird, 0.1, 'playing');

    // Gravity should have increased velocity
    expect(bird.velocity).toBeGreaterThan(0);
    expect(bird.y).toBeGreaterThan(initialY);
  });

  it('clamps velocity to MAX_FALL_SPEED', () => {
    const bird = createBird();
    // Simulate long fall
    updateBird(bird, 1.0, 'playing');
    expect(bird.velocity).toBeLessThanOrEqual(MAX_FALL_SPEED);
  });

  it('tilts upward after flap and downward during fall', () => {
    const bird = createBird();
    flapBird(bird); // Negative velocity (moving up)
    updateBird(bird, 0.05, 'playing');
    expect(bird.rotation).toBeLessThan(0);

    // Fall downward
    bird.velocity = 300;
    updateBird(bird, 0.2, 'playing');
    expect(bird.rotation).toBeGreaterThan(0);
  });

  it('falls to ground in gameOver status and stops at playable bottom', () => {
    const bird = createBird(80, PLAYABLE_HEIGHT - 30);
    updateBird(bird, 0.5, 'gameOver');
    expect(bird.y + BIRD_HEIGHT).toBe(PLAYABLE_HEIGHT);
    expect(bird.velocity).toBe(0);
  });
});
