import { describe, it, expect, vi } from 'vitest';
import { Rocket, Particle, FireworksSimulation } from './fireworks';

describe('Rocket', () => {
  it('initializes properly with coordinates and angle calculation', () => {
    const rocket = new Rocket({
      id: 1,
      startX: 100,
      startY: 500,
      targetX: 100,
      targetY: 100,
      speed: 400,
      hue: 120,
    });

    expect(rocket.id).toBe(1);
    expect(rocket.x).toBe(100);
    expect(rocket.y).toBe(500);
    expect(rocket.distance).toBe(400);
    expect(rocket.distanceTraveled).toBe(0);
    expect(rocket.trail).toEqual([]);
  });

  it('updates distance and position towards target until reached', () => {
    const rocket = new Rocket({
      id: 2,
      startX: 0,
      startY: 100,
      targetX: 100,
      targetY: 100,
      speed: 200,
      hue: 60,
    });

    // Advance 0.25s (travels 50px)
    const reached1 = rocket.update(0.25);
    expect(reached1).toBe(false);
    expect(rocket.distanceTraveled).toBeCloseTo(50, 1);
    expect(rocket.x).toBeCloseTo(50, 1);
    expect(rocket.trail.length).toBe(1);

    // Advance another 0.3s (travels 60px -> total 110px >= 100px)
    const reached2 = rocket.update(0.3);
    expect(reached2).toBe(true);
    expect(rocket.distanceTraveled).toBeGreaterThanOrEqual(rocket.distance);
  });

  it('handles edge case: zero distance between start and target', () => {
    const rocket = new Rocket({
      id: 3,
      startX: 50,
      startY: 50,
      targetX: 50,
      targetY: 50,
      speed: 300,
      hue: 0,
    });

    expect(rocket.distance).toBe(0);
    const reached = rocket.update(0.01);
    expect(reached).toBe(true);
  });
});

describe('Particle', () => {
  it('updates velocity with gravity and friction, decrements alpha', () => {
    const particle = new Particle({
      id: 10,
      x: 100,
      y: 100,
      vx: 50,
      vy: -50,
      hue: 200,
      decay: 0.5,
      gravity: 100,
      friction: 0.95,
    });

    const isAlive = particle.update(0.2);
    expect(isAlive).toBe(true);
    expect(particle.alpha).toBeCloseTo(0.9, 2);
    expect(particle.trail.length).toBe(1);
    // Gravity pulled downward on vy
    expect(particle.vy).toBeGreaterThan(-50);
  });

  it('returns false and expires when alpha reaches zero or below', () => {
    const particle = new Particle({
      id: 11,
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      hue: 200,
      decay: 2.0,
    });

    // 0.6s with decay 2.0 -> alpha drops by 1.2, resulting in alpha <= 0
    const isAlive = particle.update(0.6);
    expect(isAlive).toBe(false);
    expect(particle.alpha).toBeLessThanOrEqual(0);
  });
});

describe('FireworksSimulation', () => {
  it('clamps target coordinates within safe sky boundaries', () => {
    const sim = new FireworksSimulation({ width: 800, height: 600 });

    // Click way beyond left edge and above top
    const normalized1 = sim.normalizeTarget(-100, -50);
    expect(normalized1.x).toBe(20);
    expect(normalized1.y).toBe(60); // 10% of 600

    // Click way below bottom and beyond right edge
    const normalized2 = sim.normalizeTarget(1000, 900);
    expect(normalized2.x).toBe(780); // 800 - 20
    expect(normalized2.y).toBe(492); // 82% of 600
  });

  it('respects maxRockets capacity constraint', () => {
    const sim = new FireworksSimulation({ maxRockets: 2, autoFire: false });

    const r1 = sim.launch(200, 200);
    const r2 = sim.launch(300, 200);
    const r3 = sim.launch(400, 200);

    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r3).toBeNull(); // Rejected due to capacity
    expect(sim.rockets.length).toBe(2);
  });

  it('respects maxParticles capacity constraint during explosion', () => {
    const sim = new FireworksSimulation({ maxParticles: 30, autoFire: false });

    // Explode first time with requested 20 particles
    const created1 = sim.explode(200, 200, 180, { count: 20 });
    expect(created1).toBe(20);
    expect(sim.particles.length).toBe(20);

    // Explode second time with requested 20 particles; only 10 available slots left
    const created2 = sim.explode(300, 200, 180, { count: 20 });
    expect(created2).toBe(10);
    expect(sim.particles.length).toBe(30);

    // Explode third time; 0 available slots left
    const created3 = sim.explode(400, 200, 180, { count: 20 });
    expect(created3).toBe(0);
    expect(sim.particles.length).toBe(30);
  });

  it('transitions rockets into explosions upon arrival and scavenges dead particles', () => {
    // Deterministic RNG
    const fakeRng = vi.fn().mockReturnValue(0.5);
    const sim = new FireworksSimulation({
      width: 400,
      height: 400,
      rng: fakeRng,
      autoFire: false,
    });

    const onLaunch = vi.fn();
    const onExplode = vi.fn();
    sim.onLaunch = onLaunch;
    sim.onExplode = onExplode;

    const rocket = sim.launch(200, 200);
    expect(rocket).not.toBeNull();
    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(sim.rockets.length).toBe(1);

    // Force rocket to arrive by updating multiple frames
    for (let step = 0; step < 20; step++) {
      sim.update(0.08);
      if (sim.rockets.length === 0) break;
    }

    // Rocket exploded and created particles
    expect(sim.rockets.length).toBe(0);
    expect(onExplode).toHaveBeenCalledTimes(1);
    expect(sim.particles.length).toBeGreaterThan(0);

    // Now advance time so all particles decay and expire
    for (let step = 0; step < 50; step++) {
      sim.update(0.1);
    }

    // After particles expire, particle count drops back to 0
    expect(sim.particles.length).toBe(0);
  });

  it('handles autoFire periodic launching and toggling', () => {
    let callCount = 0;
    const fakeRng = () => {
      callCount++;
      return (callCount % 10) / 10;
    };

    const sim = new FireworksSimulation({
      width: 500,
      height: 500,
      autoFire: true,
      autoFireInterval: 1.0,
      rng: fakeRng,
    });

    expect(sim.isAutoFire).toBe(true);

    // Advance 0.5s via steps (0.05s * 10 = 0.5s, timer not reached yet)
    for (let i = 0; i < 10; i++) {
      sim.update(0.05);
    }
    expect(sim.rockets.length).toBe(0);

    // Advance another 0.6s (0.05s * 12 = 0.6s, total 1.1s > 1.0s -> triggers launch)
    for (let i = 0; i < 12; i++) {
      sim.update(0.05);
    }
    expect(sim.rockets.length).toBe(1);

    // Toggle off autoFire
    sim.toggleAutoFire();
    expect(sim.isAutoFire).toBe(false);

    // Advance 5.0s, no new rockets should launch
    sim.clear();
    sim.update(0.1);
    sim.update(0.1);
    expect(sim.rockets.length).toBe(0);
  });

  it('clamps large delta time (dt) to prevent sudden burst after long pauses', () => {
    const sim = new FireworksSimulation({
      autoFire: true,
      autoFireInterval: 1.0,
    });

    // Simulating coming back from a background tab after 30 seconds
    sim.update(30.0);

    // Clamped dt (0.1 max) means timer only advanced 0.1s, NOT 30s!
    expect(sim.autoFireTimer).toBeCloseTo(0.1, 2);
  });

  it('prefersReducedMotion disables autoFire on initialization', () => {
    const sim = new FireworksSimulation({
      prefersReducedMotion: true,
    });
    expect(sim.isAutoFire).toBe(false);
  });

  it('clear() immediately resets all active rockets and particles', () => {
    const sim = new FireworksSimulation();
    sim.launch(200, 200);
    sim.explode(200, 200, 60);

    expect(sim.rockets.length).toBe(1);
    expect(sim.particles.length).toBeGreaterThan(0);

    sim.clear();

    expect(sim.rockets.length).toBe(0);
    expect(sim.particles.length).toBe(0);
  });
});
