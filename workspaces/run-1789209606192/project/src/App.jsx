import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FireworksSimulation } from './fireworks';
import { FireworksCanvas } from './FireworksCanvas';
import { soundFx } from './audio';

export function App() {
  const [stats, setStats] = useState({ rockets: 0, particles: 0, isAutoFire: true });
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, []);

  // Initialize simulation engine
  const simulation = useMemo(() => {
    return new FireworksSimulation({
      width: 800,
      height: 600,
      maxRockets: 8,
      maxParticles: 600,
      autoFireInterval: 1.2,
      prefersReducedMotion,
      onLaunch: () => soundFx.playLaunch(),
      onExplode: () => soundFx.playExplosion(),
    });
  }, [prefersReducedMotion]);

  // Sync auto-fire state from simulation
  const [isAutoFire, setIsAutoFire] = useState(() => simulation.isAutoFire);

  // Manual launch button handler (launches towards upper central sky)
  const handleManualLaunch = useCallback(() => {
    const targetX = simulation.width * (0.25 + Math.random() * 0.5);
    const targetY = simulation.height * (0.15 + Math.random() * 0.4);
    simulation.launch(targetX, targetY);
  }, [simulation]);

  // Toggle auto fire
  const handleToggleAutoFire = useCallback(() => {
    const nextState = simulation.toggleAutoFire();
    setIsAutoFire(nextState);
  }, [simulation]);

  // Toggle sound
  const handleToggleSound = useCallback(() => {
    const nextState = soundFx.toggle();
    setSoundEnabled(nextState);
  }, []);

  // Clear all current fireworks
  const handleClear = useCallback(() => {
    simulation.clear();
    setStats(simulation.getStats());
  }, [simulation]);

  // Global keyboard shortcuts (Space / Enter to launch)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is actively typing in an input or focused on a button
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.key === 'Enter') {
        // If focus is not on an interactive button, prevent page scroll and launch
        if (activeTag !== 'button') {
          e.preventDefault();
          handleManualLaunch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualLaunch]);

  return (
    <div className="fireworks-app">
      {/* Background Interactive Canvas */}
      <FireworksCanvas
        simulation={simulation}
        onStatsUpdate={setStats}
      />

      {/* Top Header & HUD */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon" aria-hidden="true">🎆</span>
          <h1 className="brand-title">Pháo Hoa Đêm Hội</h1>
        </div>

        <div className="header-stats" aria-label="Thống kê hiệu ứng hiện tại">
          <div className="stat-chip">
            <span>🚀 Pháo:</span>
            <span className="stat-value" data-testid="stat-rockets">{stats.rockets}</span>
          </div>
          <div className="stat-chip">
            <span>✨ Hạt:</span>
            <span className="stat-value" data-testid="stat-particles">{stats.particles}</span>
          </div>
        </div>
      </header>

      {/* Instruction Banner */}
      <div className="instruction-banner" role="status">
        💡 Nhấp hoặc chạm bất kỳ đâu trên màn hình để bắn pháo hoa. Nhấn phím <kbd>Space</kbd> hoặc nút bên dưới.
      </div>

      {/* Bottom Control Dock */}
      <div className="control-dock-container">
        <div className="control-dock" role="toolbar" aria-label="Thanh điều khiển pháo hoa">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleManualLaunch}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                handleManualLaunch();
              }
            }}
            aria-label="Bắn một quả pháo hoa lên bầu trời"
          >
            <span aria-hidden="true">🚀</span> Bắn pháo hoa
          </button>

          <button
            type="button"
            className={`btn btn-secondary btn-toggle ${isAutoFire ? 'active' : ''}`}
            onClick={handleToggleAutoFire}
            aria-pressed={isAutoFire}
            aria-label={`Chế độ bắn tự động đang ${isAutoFire ? 'bật' : 'tắt'}`}
          >
            <span aria-hidden="true">{isAutoFire ? '✨' : '⏸️'}</span>
            <span>Tự động: {isAutoFire ? 'BẬT' : 'TẮT'}</span>
          </button>

          <button
            type="button"
            className={`btn btn-secondary btn-icon-only ${soundEnabled ? 'active' : ''}`}
            onClick={handleToggleSound}
            aria-label={soundEnabled ? 'Tắt âm thanh pháo hoa' : 'Bật âm thanh pháo hoa'}
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-icon-only"
            onClick={handleClear}
            aria-label="Xóa tất cả pháo hoa đang bay"
            title="Dọn sạch màn hình"
          >
            <span aria-hidden="true">🧹</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
