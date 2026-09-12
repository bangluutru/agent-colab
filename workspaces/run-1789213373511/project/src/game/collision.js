import {
  PLAYABLE_HEIGHT,
  BIRD_HITBOX_PADDING,
} from './constants.js';

/**
 * Computes the effective collision hitbox for the bird with safety insets
 */
export function getBirdHitbox(bird) {
  const padding = BIRD_HITBOX_PADDING;
  return {
    x: bird.x + padding.left,
    y: bird.y + padding.top,
    width: Math.max(1, bird.width - (padding.left + padding.right)),
    height: Math.max(1, bird.height - (padding.top + padding.bottom)),
  };
}

/**
 * Checks whether two 2D axis-aligned bounding boxes intersect
 */
export function rectsIntersect(r1, r2) {
  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  );
}

/**
 * Checks if the bird has collided with the ground (bottom boundary of playable area)
 */
export function checkGroundCollision(bird) {
  const hitbox = getBirdHitbox(bird);
  return hitbox.y + hitbox.height >= PLAYABLE_HEIGHT;
}

/**
 * Checks if the bird has collided with the ceiling (top boundary of canvas)
 */
export function checkCeilingCollision(bird) {
  const hitbox = getBirdHitbox(bird);
  return hitbox.y <= 0;
}

/**
 * Checks if the bird collides with a single pipe pair (top pipe or bottom pipe)
 */
export function checkPipeCollision(bird, pipe) {
  const birdBox = getBirdHitbox(bird);

  // Top pipe rectangle: from y = 0 to y = pipe.topHeight
  const topPipeRect = {
    x: pipe.x,
    y: 0,
    width: pipe.width,
    height: pipe.topHeight,
  };

  if (rectsIntersect(birdBox, topPipeRect)) {
    return true;
  }

  // Bottom pipe rectangle: from y = pipe.topHeight + pipe.gap to PLAYABLE_HEIGHT
  const bottomPipeY = pipe.topHeight + pipe.gap;
  const bottomPipeRect = {
    x: pipe.x,
    y: bottomPipeY,
    width: pipe.width,
    height: Math.max(0, PLAYABLE_HEIGHT - bottomPipeY),
  };

  return rectsIntersect(birdBox, bottomPipeRect);
}

/**
 * Checks if bird collides with ceiling, ground, or any active pipes.
 * Returns an object with collision status and details.
 */
export function checkAnyCollision(bird, pipes = []) {
  if (checkGroundCollision(bird)) {
    return { collided: true, reason: 'ground' };
  }

  if (checkCeilingCollision(bird)) {
    return { collided: true, reason: 'ceiling' };
  }

  for (const pipe of pipes) {
    if (checkPipeCollision(bird, pipe)) {
      return { collided: true, reason: 'pipe', pipeId: pipe.id };
    }
  }

  return { collided: false, reason: null };
}
