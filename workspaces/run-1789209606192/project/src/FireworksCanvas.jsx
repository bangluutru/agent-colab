import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * FireworksCanvas
 * Coordinates the HTML5 Canvas, high-DPI scaling, render loop,
 * semi-transparent trailing effect, tap indicators, and pointer interactions.
 */
export function FireworksCanvas({
  simulation,
  onStatsUpdate,
  className = '',
}) {
  const canvasRef = useRef(null);
  const ripplesRef = useRef([]);
  const animFrameIdRef = useRef(null);
  const lastTimeRef = useRef(0);
  const isVisibleRef = useRef(true);
  const [contextError, setContextError] = useState(false);

  // Resize canvas to element dimensions with clamped devicePixelRatio (max 2)
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(10, Math.floor(rect.width));
    const height = Math.max(10, Math.floor(rect.height));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    } else {
      setContextError(true);
    }

    simulation.setSize(width, height);
  }, [simulation]);

  const lastPointerTimeRef = useRef(0);

  // Launch rocket towards client screen coordinates
  const launchAtClientPos = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const rocket = simulation.launch(x, y);

    if (rocket) {
      // Visual ripple feedback at target location
      ripplesRef.current.push({
        x: rocket.targetX,
        y: rocket.targetY,
        radius: 4,
        maxRadius: 28,
        alpha: 0.9,
        hue: rocket.hue,
      });
    }
  }, [simulation]);

  // Pointer event: Launch rocket towards tapped point
  const handlePointerDown = (e) => {
    // Only respond to primary button (left-click or touch)
    if (e.button !== undefined && e.button !== 0 && e.button !== -1) return;
    lastPointerTimeRef.current = Date.now();
    launchAtClientPos(e.clientX, e.clientY);
  };

  // Touch event: Direct touch support for environments that dispatch pure touch
  const handleTouchStart = (e) => {
    if (Date.now() - lastPointerTimeRef.current < 500) {
      return; // Already processed via pointerdown
    }
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      launchAtClientPos(touch.clientX, touch.clientY);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setContextError(true);
      return;
    }

    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisibleRef.current = false;
      } else {
        isVisibleRef.current = true;
        lastTimeRef.current = performance.now(); // reset timer to prevent massive delta-time jump
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial clear to night sky color
    ctx.save();
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, simulation.width, simulation.height);
    ctx.restore();

    lastTimeRef.current = performance.now();

    // Main 60fps render loop
    const renderLoop = (timestamp) => {
      animFrameIdRef.current = requestAnimationFrame(renderLoop);

      if (!isVisibleRef.current) return;

      const elapsedMs = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      // Clamp dt between 1ms and 80ms
      const dt = Math.max(0.001, Math.min(elapsedMs / 1000, 0.08));

      // 1. Advance simulation physics
      simulation.update(dt);

      if (onStatsUpdate) {
        onStatsUpdate(simulation.getStats());
      }

      // 2. Clear canvas with semi-transparent black to create light trail persistence
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(0, 0, simulation.width, simulation.height);
      ctx.restore();

      // 3. Render target ripples
      const remainingRipples = [];
      ctx.save();
      ctx.lineWidth = 1.5;
      for (let i = 0; i < ripplesRef.current.length; i++) {
        const r = ripplesRef.current[i];
        r.radius += dt * 45;
        r.alpha -= dt * 1.8;

        if (r.alpha > 0) {
          ctx.strokeStyle = `hsla(${r.hue}, 90%, 65%, ${Math.max(0, r.alpha)})`;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          ctx.stroke();
          remainingRipples.push(r);
        }
      }
      ctx.restore();
      ripplesRef.current = remainingRipples;

      // 4. Render Rockets
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < simulation.rockets.length; i++) {
        const rocket = simulation.rockets[i];

        // Draw rocket glowing tail trail
        if (rocket.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(rocket.trail[0].x, rocket.trail[0].y);
          for (let t = 1; t < rocket.trail.length; t++) {
            ctx.lineTo(rocket.trail[t].x, rocket.trail[t].y);
          }
          ctx.strokeStyle = `hsla(${rocket.hue}, 100%, 75%, 0.7)`;
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }

        // Draw rocket head
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${rocket.hue}, 100%, 65%, 0.9)`;
        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Render Particles
      for (let i = 0; i < simulation.particles.length; i++) {
        const p = simulation.particles[i];

        // Draw particle tail
        if (p.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha * 0.45})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Draw glowing particle spark
        ctx.fillStyle = `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, 2 * p.alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [simulation, handleResize, onStatsUpdate]);

  if (contextError) {
    return (
      <div className="canvas-error-fallback" role="alert">
        <h2>Trình duyệt không hỗ trợ Canvas 2D</h2>
        <p>Vui lòng nâng cấp trình duyệt hoặc bật tăng tốc đồ họa phần cứng để xem pháo hoa.</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`fireworks-canvas ${className}`}
      onPointerDown={handlePointerDown}
      onTouchStart={handleTouchStart}
      role="application"
      aria-label="Vùng trời bắn pháo hoa tương tác. Nhấp hoặc chạm để phóng pháo hoa."
      tabIndex={-1}
    />
  );
}
