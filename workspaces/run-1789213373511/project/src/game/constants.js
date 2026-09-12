export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 600;
export const GROUND_HEIGHT = 80;
export const PLAYABLE_HEIGHT = CANVAS_HEIGHT - GROUND_HEIGHT; // 520

export const GRAVITY = 980; // px/s^2
export const FLAP_STRENGTH = -330; // px/s upward burst
export const MAX_FALL_SPEED = 500; // px/s terminal velocity

export const BIRD_WIDTH = 34;
export const BIRD_HEIGHT = 24;
export const BIRD_INITIAL_X = 80;
export const BIRD_INITIAL_Y = 250;

export const PIPE_WIDTH = 52;
export const PIPE_GAP = 135;
export const PIPE_SPEED = 140; // px/s
export const PIPE_SPAWN_INTERVAL = 1.75; // seconds
export const MIN_PIPE_HEIGHT = 60;
export const MAX_PIPE_HEIGHT = PLAYABLE_HEIGHT - PIPE_GAP - MIN_PIPE_HEIGHT; // 325

// Hitbox insets to ensure fair collision feel
export const BIRD_HITBOX_PADDING = {
  top: 3,
  bottom: 3,
  left: 4,
  right: 4,
};

export const STORAGE_KEY = 'flappy_bird_high_score';

export const GAME_STATUS = {
  IDLE: 'idle',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
};
