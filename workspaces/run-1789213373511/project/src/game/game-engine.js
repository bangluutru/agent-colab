import {
  PIPE_SPEED,
  GAME_STATUS,
} from './constants.js';
import { createBird, flapBird, updateBird } from './entities/bird.js';
import {
  createPipeManager,
  updatePipes,
  resetPipes,
} from './entities/pipe-manager.js';
import { checkAnyCollision } from './collision.js';
import { renderGame } from './renderer.js';
import { getHighScore, saveHighScore } from './storage.js';

export class GameEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;

    this.onStateChange = callbacks.onStateChange || (() => {});
    this.onScore = callbacks.onScore || (() => {});
    this.onGameOver = callbacks.onGameOver || (() => {});

    this.animationFrameId = null;
    this.lastTime = null;
    this.isRunning = false;

    this.highScore = getHighScore();
    this.isNewHighScore = false;
    this.init();
  }

  init() {
    this.status = GAME_STATUS.IDLE;
    this.score = 0;
    this.isNewHighScore = false;
    this.bird = createBird();
    this.pipeManager = createPipeManager();
    this.groundOffset = 0;
    this.cloudOffset = 0;
    this.notifyState();
  }

  notifyState() {
    this.onStateChange({
      status: this.status,
      score: this.score,
      highScore: this.highScore,
      isNewHighScore: this.isNewHighScore,
    });
  }

  start() {
    if (this.status === GAME_STATUS.IDLE) {
      this.status = GAME_STATUS.PLAYING;
      flapBird(this.bird);
      if (!this.isRunning) {
        this.startLoop();
      }
      this.notifyState();
    }
  }

  flap() {
    if (this.status === GAME_STATUS.IDLE) {
      this.start();
    } else if (this.status === GAME_STATUS.PLAYING) {
      flapBird(this.bird);
    }
    // If gameOver, flap is disabled until restart() is called
  }

  restart() {
    this.init();
    this.startLoop();
    this.render();
  }

  update(dt) {
    // Cap dt to 0.1s to prevent position teleports when switching tabs
    const clampedDt = Math.min(Math.max(0, dt), 0.1);

    if (this.status === GAME_STATUS.IDLE) {
      updateBird(this.bird, clampedDt, GAME_STATUS.IDLE);
      this.groundOffset += PIPE_SPEED * clampedDt * 0.7;
      this.cloudOffset += 15 * clampedDt;
      return;
    }

    if (this.status === GAME_STATUS.PLAYING) {
      // 1. Update bird
      updateBird(this.bird, clampedDt, GAME_STATUS.PLAYING);

      // 2. Update pipes and check scoring
      const { pointsAwarded } = updatePipes(
        this.pipeManager,
        clampedDt,
        this.bird.x
      );

      if (pointsAwarded > 0) {
        this.score += pointsAwarded;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          this.isNewHighScore = true;
          saveHighScore(this.highScore);
        }
        this.onScore(this.score);
        this.notifyState();
      }

      // 3. Move backgrounds
      this.groundOffset += PIPE_SPEED * clampedDt;
      this.cloudOffset += 20 * clampedDt;

      // 4. Check collisions
      const collision = checkAnyCollision(this.bird, this.pipeManager.pipes);
      if (collision.collided) {
        this.handleGameOver();
      }
      return;
    }

    if (this.status === GAME_STATUS.GAME_OVER) {
      updateBird(this.bird, clampedDt, GAME_STATUS.GAME_OVER);
    }
  }

  handleGameOver() {
    this.status = GAME_STATUS.GAME_OVER;
    const previousBest = this.highScore;
    if (this.score > previousBest) {
      this.isNewHighScore = true;
    }
    const currentBest = saveHighScore(this.score);
    this.highScore = currentBest;
    this.stopLoop();
    this.render();
    this.notifyState();
    this.onGameOver(this.score, this.highScore, this.isNewHighScore);
  }

  render() {
    if (!this.ctx) return;
    renderGame(this.ctx, {
      bird: this.bird,
      pipeManager: this.pipeManager,
      score: this.score,
      status: this.status,
      groundOffset: this.groundOffset,
      cloudOffset: this.cloudOffset,
    });
  }

  loop(currentTime) {
    if (!this.isRunning) return;

    if (this.lastTime === null) {
      this.lastTime = currentTime;
    }

    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(dt);
    if (!this.isRunning) return;

    this.render();

    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  startLoop() {
    this.stopLoop();
    this.isRunning = true;
    this.lastTime = null;
    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  stopLoop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastTime = null;
  }

  destroy() {
    this.stopLoop();
    this.canvas = null;
    this.ctx = null;
  }
}
