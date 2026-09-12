import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_HEIGHT,
  PLAYABLE_HEIGHT,
} from './constants.js';

/**
 * Procedural background clouds definition
 */
const CLOUDS = [
  { x: 40, y: 80, scale: 1.1 },
  { x: 180, y: 120, scale: 0.8 },
  { x: 300, y: 60, scale: 1.2 },
];

/**
 * Draws a fluffy cloud
 */
function drawCloud(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';

  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.arc(15, -6, 22, 0, Math.PI * 2);
  ctx.arc(32, 0, 16, 0, Math.PI * 2);
  ctx.arc(44, 4, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws distant city / hill silhouettes
 */
function drawCityScape(ctx) {
  const baseY = PLAYABLE_HEIGHT;
  ctx.fillStyle = '#c5ebed';

  // Soft distant silhouettes
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.lineTo(0, baseY - 45);
  ctx.lineTo(35, baseY - 45);
  ctx.lineTo(45, baseY - 70);
  ctx.lineTo(80, baseY - 70);
  ctx.lineTo(95, baseY - 50);
  ctx.lineTo(130, baseY - 50);
  ctx.lineTo(145, baseY - 85);
  ctx.lineTo(185, baseY - 85);
  ctx.lineTo(200, baseY - 40);
  ctx.lineTo(240, baseY - 40);
  ctx.lineTo(255, baseY - 65);
  ctx.lineTo(290, baseY - 65);
  ctx.lineTo(310, baseY - 45);
  ctx.lineTo(360, baseY - 45);
  ctx.lineTo(360, baseY);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws the scrolling ground with grass and dirt pattern
 */
function drawGround(ctx, groundOffset) {
  const groundY = PLAYABLE_HEIGHT;
  const groundHeight = GROUND_HEIGHT;

  // Dirt base
  ctx.fillStyle = '#ded895';
  ctx.fillRect(0, groundY, CANVAS_WIDTH, groundHeight);

  // Dark line separating grass from dirt
  ctx.fillStyle = '#cbb86b';
  ctx.fillRect(0, groundY + 14, CANVAS_WIDTH, 4);

  // Grass top band
  ctx.fillStyle = '#73bf2e';
  ctx.fillRect(0, groundY, CANVAS_WIDTH, 14);

  // Grass highlight top border
  ctx.fillStyle = '#9de64e';
  ctx.fillRect(0, groundY, CANVAS_WIDTH, 3);

  // Moving grass stripes for speed illusion
  ctx.fillStyle = '#5ba820';
  const stripeSpacing = 16;
  const startX = -((groundOffset % stripeSpacing) + stripeSpacing);

  for (let x = startX; x < CANVAS_WIDTH + stripeSpacing; x += stripeSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, groundY + 14);
    ctx.lineTo(x + 6, groundY);
    ctx.lineTo(x + 10, groundY);
    ctx.lineTo(x + 4, groundY + 14);
    ctx.closePath();
    ctx.fill();
  }

  // Ground border line
  ctx.strokeStyle = '#543847';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(CANVAS_WIDTH, groundY);
  ctx.stroke();
}

/**
 * Draws a single pipe pair (top and bottom with 3D-effect collars and highlight stripes)
 */
function drawPipePair(ctx, pipe) {
  const { x, width, topHeight, gap } = pipe;
  const collarHeight = 24;
  const collarLip = 3; // protruding on left & right

  const pipeGreen = '#73bf2e';
  const pipeHighlight = '#9de64e';
  const pipeShadow = '#558022';
  const pipeOutline = '#2b440f';

  // --- TOP PIPE ---
  // Pipe body
  ctx.fillStyle = pipeGreen;
  ctx.fillRect(x, 0, width, topHeight);

  // Highlight stripe (left)
  ctx.fillStyle = pipeHighlight;
  ctx.fillRect(x + 4, 0, 5, topHeight);

  // Shadow stripe (right)
  ctx.fillStyle = pipeShadow;
  ctx.fillRect(x + width - 9, 0, 7, topHeight);

  // Top pipe outline
  ctx.strokeStyle = pipeOutline;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, -2, width, topHeight + 2);

  // Top pipe collar (at the bottom of top pipe)
  const topCollarY = topHeight - collarHeight;
  ctx.fillStyle = pipeGreen;
  ctx.fillRect(x - collarLip, topCollarY, width + collarLip * 2, collarHeight);

  ctx.fillStyle = pipeHighlight;
  ctx.fillRect(x - collarLip + 4, topCollarY, 6, collarHeight);

  ctx.fillStyle = pipeShadow;
  ctx.fillRect(x + width + collarLip - 10, topCollarY, 8, collarHeight);

  ctx.strokeStyle = pipeOutline;
  ctx.strokeRect(x - collarLip, topCollarY, width + collarLip * 2, collarHeight);

  // --- BOTTOM PIPE ---
  const bottomPipeY = topHeight + gap;
  const bottomPipeHeight = Math.max(0, PLAYABLE_HEIGHT - bottomPipeY);

  // Bottom pipe body
  ctx.fillStyle = pipeGreen;
  ctx.fillRect(x, bottomPipeY, width, bottomPipeHeight);

  // Highlight stripe
  ctx.fillStyle = pipeHighlight;
  ctx.fillRect(x + 4, bottomPipeY, 5, bottomPipeHeight);

  // Shadow stripe
  ctx.fillStyle = pipeShadow;
  ctx.fillRect(x + width - 9, bottomPipeY, 7, bottomPipeHeight);

  // Outline
  ctx.strokeStyle = pipeOutline;
  ctx.strokeRect(x, bottomPipeY, width, bottomPipeHeight);

  // Bottom pipe collar (at the top of bottom pipe)
  ctx.fillStyle = pipeGreen;
  ctx.fillRect(x - collarLip, bottomPipeY, width + collarLip * 2, collarHeight);

  ctx.fillStyle = pipeHighlight;
  ctx.fillRect(x - collarLip + 4, bottomPipeY, 6, collarHeight);

  ctx.fillStyle = pipeShadow;
  ctx.fillRect(x + width + collarLip - 10, bottomPipeY, 8, collarHeight);

  ctx.strokeStyle = pipeOutline;
  ctx.strokeRect(x - collarLip, bottomPipeY, width + collarLip * 2, collarHeight);
}

/**
 * Draws the Flappy Bird with rotation, flapping wing, eye, and beak
 */
function drawBird(ctx, bird) {
  ctx.save();

  const centerX = bird.x + bird.width / 2;
  const centerY = bird.y + bird.height / 2;

  ctx.translate(centerX, centerY);
  ctx.rotate(bird.rotation);

  const bw = bird.width;
  const bh = bird.height;

  // Bird body (yellow-orange gradient oval)
  ctx.beginPath();
  ctx.ellipse(0, 0, bw / 2, bh / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f8d030';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#543847';
  ctx.stroke();

  // Belly highlight (lighter yellow)
  ctx.beginPath();
  ctx.ellipse(-2, 3, bw / 2 - 4, bh / 2 - 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fbe87b';
  ctx.fill();

  // Flapping Wing
  const wingFlapOffset = Math.sin(bird.wingPhase) * 6;
  ctx.beginPath();
  ctx.ellipse(-6, wingFlapOffset, 8, 5, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#f4bc1c';
  ctx.fill();
  ctx.strokeStyle = '#543847';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Eye (white circle)
  const eyeX = 6;
  const eyeY = -4;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#543847';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Pupil (black circle with white reflection)
  ctx.beginPath();
  ctx.arc(eyeX + 1.5, eyeY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(eyeX + 2, eyeY - 1, 1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Beak (orange-red)
  ctx.beginPath();
  ctx.moveTo(bw / 2 - 2, -1);
  ctx.lineTo(bw / 2 + 8, 2);
  ctx.lineTo(bw / 2 - 2, 5);
  ctx.closePath();
  ctx.fillStyle = '#f75c2f';
  ctx.fill();
  ctx.strokeStyle = '#543847';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Cheek blush
  ctx.beginPath();
  ctx.arc(2, 4, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(247, 92, 47, 0.4)';
  ctx.fill();

  ctx.restore();
}

/**
 * Draws the prominent score in arcade style during play
 */
function drawInGameScore(ctx, score) {
  const text = score.toString();
  ctx.save();
  ctx.font = '900 42px "Impact", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Outer shadow/stroke
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#000000';
  ctx.strokeText(text, CANVAS_WIDTH / 2, 45);

  // Inner fill
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, CANVAS_WIDTH / 2, 45);

  ctx.restore();
}

/**
 * Primary render function called on every frame
 */
export function renderGame(ctx, state) {
  if (!ctx) return;

  const { bird, pipeManager, score, status, groundOffset, cloudOffset = 0 } = state;

  // Clear canvas
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, PLAYABLE_HEIGHT);
  skyGrad.addColorStop(0, '#4ec0ca');
  skyGrad.addColorStop(0.75, '#76d6dd');
  skyGrad.addColorStop(1, '#a4e8ee');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, PLAYABLE_HEIGHT);

  // Background clouds with parallax
  CLOUDS.forEach((c) => {
    const cx = (c.x - cloudOffset * 0.2) % (CANVAS_WIDTH + 80);
    const wrappedX = cx < -50 ? cx + CANVAS_WIDTH + 100 : cx;
    drawCloud(ctx, wrappedX, c.y, c.scale);
  });

  // Distant city silhouette
  drawCityScape(ctx);

  // Draw active pipes
  if (pipeManager && pipeManager.pipes) {
    pipeManager.pipes.forEach((pipe) => drawPipePair(ctx, pipe));
  }

  // Draw scrolling ground
  drawGround(ctx, groundOffset || 0);

  // Draw bird
  if (bird) {
    drawBird(ctx, bird);
  }

  // Draw score overlay if playing
  if (status === 'playing') {
    drawInGameScore(ctx, score);
  }
}
