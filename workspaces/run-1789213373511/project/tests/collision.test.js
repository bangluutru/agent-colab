import { describe, it, expect } from 'vitest';
import {
  getBirdHitbox,
  rectsIntersect,
  checkGroundCollision,
  checkCeilingCollision,
  checkPipeCollision,
  checkAnyCollision,
} from '../src/game/collision.js';
import {
  BIRD_WIDTH,
  BIRD_HEIGHT,
  PLAYABLE_HEIGHT,
  PIPE_WIDTH,
  PIPE_GAP,
} from '../src/game/constants.js';

describe('Collision System', () => {
  it('calculates bird hitbox with correct padding', () => {
    const bird = { x: 50, y: 100, width: BIRD_WIDTH, height: BIRD_HEIGHT };
    const hitbox = getBirdHitbox(bird);

    expect(hitbox.x).toBeGreaterThan(bird.x);
    expect(hitbox.y).toBeGreaterThan(bird.y);
    expect(hitbox.width).toBeLessThan(bird.width);
    expect(hitbox.height).toBeLessThan(bird.height);
  });

  it('correctly checks AABB intersection', () => {
    const r1 = { x: 10, y: 10, width: 20, height: 20 };
    const r2 = { x: 20, y: 20, width: 20, height: 20 };
    const r3 = { x: 50, y: 50, width: 20, height: 20 };

    expect(rectsIntersect(r1, r2)).toBe(true);
    expect(rectsIntersect(r1, r3)).toBe(false);
  });

  it('detects ground collision when bird reaches PLAYABLE_HEIGHT', () => {
    const safeBird = { x: 80, y: 200, width: BIRD_WIDTH, height: BIRD_HEIGHT };
    expect(checkGroundCollision(safeBird)).toBe(false);

    const groundBird = {
      x: 80,
      y: PLAYABLE_HEIGHT - BIRD_HEIGHT + 5,
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
    };
    expect(checkGroundCollision(groundBird)).toBe(true);
  });

  it('detects ceiling collision when bird hits top of screen', () => {
    const safeBird = { x: 80, y: 200, width: BIRD_WIDTH, height: BIRD_HEIGHT };
    expect(checkCeilingCollision(safeBird)).toBe(false);

    const ceilingBird = {
      x: 80,
      y: -5,
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
    };
    expect(checkCeilingCollision(ceilingBird)).toBe(true);
  });

  it('detects pipe collision correctly with top and bottom pipes', () => {
    const pipe = {
      id: 1,
      x: 80,
      width: PIPE_WIDTH, // 52
      topHeight: 150,
      gap: PIPE_GAP, // 135 -> gap is between 150 and 285
    };

    // Case 1: Bird right inside the gap -> SAFE
    const safeBird = {
      x: 85,
      y: 200, // Gap is [150, 285], bird height 24 fits comfortably [203, 227]
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
    };
    expect(checkPipeCollision(safeBird, pipe)).toBe(false);

    // Case 2: Bird hitting top pipe
    const hitTopBird = {
      x: 85,
      y: 100, // Inside top pipe [0, 150]
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
    };
    expect(checkPipeCollision(hitTopBird, pipe)).toBe(true);

    // Case 3: Bird hitting bottom pipe
    const hitBottomBird = {
      x: 85,
      y: 320, // Below gap start 285
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
    };
    expect(checkPipeCollision(hitBottomBird, pipe)).toBe(true);
  });

  it('checkAnyCollision returns accurate reason for collision', () => {
    const pipes = [
      { id: 42, x: 80, width: PIPE_WIDTH, topHeight: 150, gap: PIPE_GAP },
    ];

    // Safe
    const safeBird = { x: 85, y: 200, width: BIRD_WIDTH, height: BIRD_HEIGHT };
    expect(checkAnyCollision(safeBird, pipes).collided).toBe(false);

    // Ground
    const groundBird = { x: 85, y: PLAYABLE_HEIGHT, width: BIRD_WIDTH, height: BIRD_HEIGHT };
    const groundRes = checkAnyCollision(groundBird, pipes);
    expect(groundRes.collided).toBe(true);
    expect(groundRes.reason).toBe('ground');

    // Pipe
    const pipeBird = { x: 85, y: 50, width: BIRD_WIDTH, height: BIRD_HEIGHT };
    const pipeRes = checkAnyCollision(pipeBird, pipes);
    expect(pipeRes.collided).toBe(true);
    expect(pipeRes.reason).toBe('pipe');
    expect(pipeRes.pipeId).toBe(42);
  });
});
