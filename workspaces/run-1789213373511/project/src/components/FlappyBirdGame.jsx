import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_STATUS } from '../game/constants.js';
import { GameEngine } from '../game/game-engine.js';
import '../styles/flappy-bird.css';

export function FlappyBirdGame({ onEngineReady } = {}) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const stageRef = useRef(null);

  const [gameState, setGameState] = useState({
    status: GAME_STATUS.IDLE,
    score: 0,
    highScore: 0,
    isNewHighScore: false,
  });

  const [announcement, setAnnouncement] = useState('');

  // Handle game state changes from engine
  const handleStateChange = useCallback((state) => {
    setGameState((prev) => ({
      ...prev,
      ...state,
    }));
  }, []);

  const handleScore = useCallback((newScore) => {
    // Score update
  }, []);

  const handleGameOver = useCallback((finalScore, bestScore, isNew) => {
    if (isNew) {
      setAnnouncement(
        `Kỷ lục mới! Bạn đạt ${finalScore} điểm. Điểm cao nhất hiện tại: ${bestScore}.`
      );
    } else {
      setAnnouncement(
        `Trò chơi kết thúc! Bạn đạt ${finalScore} điểm. Điểm cao nhất: ${bestScore}.`
      );
    }
  }, []);

  // Initialize engine on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, {
      onStateChange: handleStateChange,
      onScore: handleScore,
      onGameOver: handleGameOver,
    });

    engineRef.current = engine;
    if (typeof onEngineReady === 'function') {
      onEngineReady(engine);
    }
    engine.startLoop();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [handleStateChange, handleScore, handleGameOver]);

  // Unified flap action
  const triggerFlap = useCallback(() => {
    if (!engineRef.current) return;
    const currentStatus = engineRef.current.status;

    if (currentStatus === GAME_STATUS.IDLE) {
      setAnnouncement('Trò chơi bắt đầu. Chúc bạn bay may mắn!');
      engineRef.current.start();
    } else if (currentStatus === GAME_STATUS.PLAYING) {
      engineRef.current.flap();
    }
  }, []);

  // Keyboard handler for Spacebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Space key triggers flap
      if (e.code === 'Space' || e.key === ' ') {
        // Prevent continuous flapping on key hold
        if (e.repeat) return;

        // Prevent page scrolling on Space
        e.preventDefault();

        // If game over, pressing Space restarts cleanly
        if (engineRef.current && engineRef.current.status === GAME_STATUS.GAME_OVER) {
          handleRestart();
        } else {
          triggerFlap();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerFlap]);

  // Interaction deduplication tracker
  const lastInteractionRef = useRef({
    type: null,
    time: 0,
  });

  // Handle stage interaction (pointerdown, touchstart, mousedown, click)
  const handleStageInteraction = (type, e) => {
    // Only flap if interaction was on the stage, not an interactive button
    if (e.target && e.target.tagName === 'BUTTON') return;

    // Ignore secondary pointers in multi-touch pointer events
    if (type === 'pointer' && e.isPrimary === false) return;

    // Ignore multi-finger gestures in touch events
    if (type === 'touch' && e.touches && e.touches.length > 1) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const timeSinceLast = now - lastInteractionRef.current.time;
    const lastType = lastInteractionRef.current.type;

    // Deduplication rules:
    // 1. If pointerdown already handled this gesture, ignore trailing touch/mouse/click within 400ms
    if (lastType === 'pointer' && (type === 'touch' || type === 'mouse' || type === 'click')) {
      if (timeSinceLast < 400) {
        return;
      }
    }

    // 2. If touchstart already handled this gesture, ignore trailing mouse/click within 400ms
    if (lastType === 'touch' && (type === 'mouse' || type === 'click')) {
      if (timeSinceLast < 400) {
        return;
      }
    }

    // 3. If mousedown already handled this gesture, ignore trailing click within 400ms
    if (lastType === 'mouse' && type === 'click') {
      if (timeSinceLast < 400) {
        return;
      }
    }

    lastInteractionRef.current = {
      type,
      time: now,
    };

    if (e.cancelable && type !== 'click') {
      e.preventDefault();
    }

    triggerFlap();
  };

  // Handle Restart
  const handleRestart = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (engineRef.current) {
      engineRef.current.restart();
      setAnnouncement('Đã khởi động lại trò chơi.');
    }
  };

  // Handle Start from Button
  const handleStartButton = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    triggerFlap();
  };

  return (
    <div className="flappy-game-wrapper">
      {/* Screen Reader Live Region for Accessibility */}
      <div
        className="flappy-screen-reader-announcer"
        aria-live="polite"
        role="status"
      >
        {announcement}
      </div>

      {/* Main Game Stage */}
      <div
        ref={stageRef}
        className="flappy-game-stage"
        onPointerDown={(e) => handleStageInteraction('pointer', e)}
        onTouchStart={(e) => handleStageInteraction('touch', e)}
        onMouseDown={(e) => handleStageInteraction('mouse', e)}
        onClick={(e) => handleStageInteraction('click', e)}
        role="region"
        aria-label="Khu vực chơi game Flappy Bird"
        tabIndex={0}
      >
        <canvas
          ref={canvasRef}
          className="flappy-canvas"
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          aria-hidden="true"
        />

        {/* Start / Idle Screen Overlay */}
        {gameState.status === GAME_STATUS.IDLE && (
          <div className="flappy-overlay" data-testid="start-screen">
            <h1 className="flappy-title-main">FLAPPY BIRD</h1>

            <div className="flappy-card">
              <p className="flappy-instruction-text">
                Điều khiển chú chim bay qua khoảng trống giữa các cặp ống. Mỗi cặp ống vượt qua nhận 1 điểm!
              </p>

              <div className="flappy-controls-badge">
                <span className="flappy-key-chip">Phím Space</span>
                <span className="flappy-key-chip">Click</span>
                <span className="flappy-key-chip">Chạm màn hình</span>
              </div>

              <div className="flappy-score-row">
                <span>Điểm cao nhất:</span>
                <span className="flappy-score-value" data-testid="idle-highscore">
                  {gameState.highScore}
                </span>
              </div>
            </div>

            <button
              className="flappy-btn"
              onClick={handleStartButton}
              aria-label="Bắt đầu chơi Flappy Bird"
              data-testid="start-button"
              type="button"
            >
              Bắt đầu chơi
            </button>

            <div className="flappy-tap-hint">
              Hoặc nhấn <strong>Space</strong> / <strong>Chạm màn hình</strong> để bay ngay
            </div>
          </div>
        )}

        {/* Game Over Screen Overlay */}
        {gameState.status === GAME_STATUS.GAME_OVER && (
          <div className="flappy-overlay" data-testid="game-over-screen">
            <h2 className="flappy-title-gameover">GAME OVER</h2>

            <div className="flappy-card">
              <div className="flappy-score-row">
                <span>Điểm của bạn:</span>
                <span className="flappy-score-value" data-testid="final-score">
                  {gameState.score}
                </span>
              </div>

              <div className="flappy-score-row">
                <span>Điểm cao nhất:</span>
                <span className="flappy-score-value" data-testid="best-score">
                  {gameState.highScore}
                </span>
              </div>

              {gameState.isNewHighScore && (
                <div>
                  <span className="flappy-new-record" data-testid="new-record-badge">
                    ★ KỶ LỤC MỚI! ★
                  </span>
                </div>
              )}
            </div>

            <button
              className="flappy-btn"
              onClick={handleRestart}
              aria-label="Chơi lại ván mới"
              data-testid="restart-button"
              type="button"
              autoFocus
            >
              Chơi lại
            </button>

            <div className="flappy-tap-hint">
              Hoặc nhấn <strong>Space</strong> để chơi lại
            </div>
          </div>
        )}
      </div>

      <div className="flappy-footer-info">
        Flappy Bird Web Edition • Sử dụng Space, Chuột hoặc Màn hình cảm ứng
      </div>
    </div>
  );
}
export default FlappyBirdGame;
