/**
 * Core Fireworks Simulation Engine
 * Manages rockets, particles, physics, capacity limits, and auto-fire lifecycle.
 * Completely decoupled from Canvas/DOM for deterministic testing.
 */

export class Rocket {
  constructor({ id, startX, startY, targetX, targetY, speed = 400, hue = 0 }) {
    this.id = id;
    this.x = startX;
    this.y = startY;
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.speed = speed;
    this.hue = hue;

    const dx = targetX - startX;
    const dy = targetY - startY;
    this.distance = Math.hypot(dx, dy);
    this.angle = Math.atan2(dy, dx);
    this.distanceTraveled = 0;
    this.trail = [];
    this.maxTrail = 6;
  }

  update(dt) {
    // Record current position for glowing rocket tail
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) {
      this.trail.pop();
    }

    const step = this.speed * dt;
    this.distanceTraveled += step;

    this.x = this.startX + Math.cos(this.angle) * this.distanceTraveled;
    this.y = this.startY + Math.sin(this.angle) * this.distanceTraveled;

    // Has reached or surpassed target distance
    return this.distanceTraveled >= this.distance;
  }
}

export class Particle {
  constructor({
    id,
    x,
    y,
    vx,
    vy,
    hue,
    saturation = 95,
    lightness = 60,
    alpha = 1.0,
    decay = 0.8,
    gravity = 140,
    friction = 0.96,
  }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.hue = hue;
    this.saturation = saturation;
    this.lightness = lightness;
    this.alpha = alpha;
    this.decay = decay; // alpha loss per second
    this.gravity = gravity; // px/s²
    this.friction = friction; // damping per frame (scaled by dt)
    this.trail = [];
    this.maxTrail = 4;
  }

  update(dt) {
    this.trail.unshift({ x: this.x, y: this.y, alpha: this.alpha });
    if (this.trail.length > this.maxTrail) {
      this.trail.pop();
    }

    // Apply friction with dt exponential decay
    const damping = Math.pow(this.friction, dt * 60);
    this.vx *= damping;
    this.vy *= damping;

    // Apply gravity
    this.vy += this.gravity * dt;

    // Update position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Fade out
    this.alpha -= this.decay * dt;

    // Alive while alpha > 0
    return this.alpha > 0;
  }
}

export class FireworksSimulation {
  constructor(options = {}) {
    this.width = options.width || 800;
    this.height = options.height || 600;
    this.maxRockets = options.maxRockets ?? 8;
    this.maxParticles = options.maxParticles ?? 600;
    this.autoFireInterval = options.autoFireInterval ?? 1.2; // seconds
    this.rng = options.rng || Math.random;
    this.prefersReducedMotion = Boolean(options.prefersReducedMotion);

    this.rockets = [];
    this.particles = [];
    this.isAutoFire = options.autoFire !== undefined ? options.autoFire : !this.prefersReducedMotion;
    this.autoFireTimer = 0;
    this.nextId = 1;

    // Callback on explosion for audio or effects
    this.onExplode = options.onExplode || null;
    this.onLaunch = options.onLaunch || null;
  }

  setSize(width, height) {
    this.width = Math.max(10, width);
    this.height = Math.max(10, height);
  }

  setAutoFire(enabled) {
    this.isAutoFire = Boolean(enabled);
    if (!this.isAutoFire) {
      this.autoFireTimer = 0;
    }
  }

  toggleAutoFire() {
    this.setAutoFire(!this.isAutoFire);
    return this.isAutoFire;
  }

  /**
   * Clamps user target to ensure safe, visible sky trajectory
   */
  normalizeTarget(targetX, targetY) {
    const marginX = 20;
    const clampedX = Math.max(marginX, Math.min(this.width - marginX, targetX));
    
    // Target should stay within top 10% to 80% of canvas height
    const minY = this.height * 0.1;
    const maxY = this.height * 0.82;
    const clampedY = Math.max(minY, Math.min(maxY, targetY));

    return { x: Math.round(clampedX), y: Math.round(clampedY) };
  }

  /**
   * Launch a rocket towards (targetX, targetY)
   */
  launch(rawX, rawY, customOptions = {}) {
    // Guard capacity
    if (this.rockets.length >= this.maxRockets) {
      return null;
    }

    const { x: targetX, y: targetY } = this.normalizeTarget(rawX, rawY);

    // Rocket launch origin: bottom of screen with slight natural spread
    const spreadRange = Math.min(this.width * 0.5, 300);
    const centerBias = this.width * 0.5;
    const randomOffset = (this.rng() - 0.5) * spreadRange;
    const startX = Math.max(20, Math.min(this.width - 20, centerBias + randomOffset));
    const startY = this.height + 10;

    // Color: randomized vibrant hue or user provided
    const hue = customOptions.hue !== undefined 
      ? customOptions.hue 
      : Math.floor(this.rng() * 360);

    // Speed: scaled slightly by travel distance for natural timing (0.8s - 1.2s flight)
    const dist = Math.hypot(targetX - startX, targetY - startY);
    const speed = Math.max(350, Math.min(650, dist / 0.95));

    const rocket = new Rocket({
      id: this.nextId++,
      startX,
      startY,
      targetX,
      targetY,
      speed,
      hue,
    });

    this.rockets.push(rocket);

    if (this.onLaunch) {
      this.onLaunch(rocket);
    }

    return rocket;
  }

  /**
   * Explodes at (x, y) with hue and particle spread
   */
  explode(x, y, hue, options = {}) {
    // Particle count: reduce if prefersReducedMotion
    const baseCount = this.prefersReducedMotion ? 24 : (options.count || 48);
    
    // Enforce maxParticles capacity limit
    const availableSlot = this.maxParticles - this.particles.length;
    if (availableSlot <= 0) {
      return 0;
    }
    const particleCount = Math.min(baseCount, availableSlot);

    const burstType = options.type || (this.rng() > 0.4 ? 'sphere' : 'ring');
    const createdParticles = [];

    for (let i = 0; i < particleCount; i++) {
      let speed;
      let angle;

      if (burstType === 'ring') {
        angle = (i / particleCount) * Math.PI * 2 + (this.rng() - 0.5) * 0.15;
        speed = 120 + this.rng() * 40;
      } else {
        angle = this.rng() * Math.PI * 2;
        // Natural distribution (faster center, scattered perimeter)
        speed = 30 + Math.pow(this.rng(), 0.6) * 160;
      }

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      // Color variation around the explosion's main hue
      const particleHue = (hue + (this.rng() - 0.5) * 40 + 360) % 360;
      const decay = 0.45 + this.rng() * 0.45; // 1.1s to 2.2s lifetime

      const particle = new Particle({
        id: this.nextId++,
        x,
        y,
        vx,
        vy,
        hue: particleHue,
        decay,
        gravity: 90 + this.rng() * 40,
        friction: 0.965,
      });

      this.particles.push(particle);
      createdParticles.push(particle);
    }

    if (this.onExplode) {
      this.onExplode({ x, y, hue, count: createdParticles.length });
    }

    return createdParticles.length;
  }

  /**
   * Update the simulation physics by delta time dt (in seconds)
   */
  update(dt) {
    // Clamp dt to avoid huge jumps on lag spikes or tab focus resumption
    const clampedDt = Math.max(0.0001, Math.min(dt, 0.1));

    // 1. Update Rockets
    const remainingRockets = [];
    for (let i = 0; i < this.rockets.length; i++) {
      const rocket = this.rockets[i];
      const reached = rocket.update(clampedDt);
      if (reached) {
        this.explode(rocket.targetX, rocket.targetY, rocket.hue);
      } else {
        remainingRockets.push(rocket);
      }
    }
    this.rockets = remainingRockets;

    // 2. Update Particles and scavenge dead ones (alpha <= 0)
    const remainingParticles = [];
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const isAlive = particle.update(clampedDt);
      if (isAlive) {
        remainingParticles.push(particle);
      }
    }
    this.particles = remainingParticles;

    // 3. Auto-fire cycle
    if (this.isAutoFire) {
      this.autoFireTimer += clampedDt;
      if (this.autoFireTimer >= this.autoFireInterval) {
        this.autoFireTimer = 0;
        // Random sky target: X within 15% to 85%, Y within 15% to 60%
        const randX = this.width * (0.15 + this.rng() * 0.7);
        const randY = this.height * (0.15 + this.rng() * 0.45);
        this.launch(randX, randY);
      }
    }
  }

  /**
   * Clears all active rockets and particles
   */
  clear() {
    this.rockets = [];
    this.particles = [];
  }

  /**
   * Retrieve current status counters
   */
  getStats() {
    return {
      rockets: this.rockets.length,
      particles: this.particles.length,
      isAutoFire: this.isAutoFire,
    };
  }
}
