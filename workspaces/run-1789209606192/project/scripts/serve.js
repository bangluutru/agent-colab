import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const defaultDistDir = path.resolve(__dirname, '../dist');

export const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

/**
 * Resolves a request URL against the distDir with strict containment validation.
 * Rejects path traversal attacks (/../, %2e%2e, null bytes).
 *
 * @param {string} distDir - The root directory to serve
 * @param {string} rawUrl - The request URL
 * @returns {{ status: number, filePath?: string, error?: string }}
 */
export function resolveSafePath(distDir, rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { status: 400, error: 'Bad Request: Missing URL' };
  }

  const urlPath = rawUrl.split('?')[0];

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return { status: 400, error: 'Bad Request: Malformed URI' };
  }

  // Reject null bytes
  if (decodedPath.includes('\0')) {
    return { status: 400, error: 'Bad Request: Null bytes not permitted' };
  }

  // Reject explicit traversal patterns in decoded path
  const segments = decodedPath.split(/[/\\]+/);
  if (segments.includes('..')) {
    return { status: 403, error: 'Forbidden: Path traversal detected' };
  }

  // Normalize requested relative path
  let cleanRel = decodedPath.replace(/^[/\\]+/, '');
  if (cleanRel === '' || cleanRel.endsWith('/')) {
    cleanRel = path.join(cleanRel, 'index.html');
  }

  // Resolve target absolute path within distDir
  const resolvedTarget = path.resolve(distDir, cleanRel);

  // Strict containment validation
  const relativeFromDist = path.relative(distDir, resolvedTarget);
  const isContained =
    relativeFromDist === '' ||
    (!relativeFromDist.startsWith('..') && !path.isAbsolute(relativeFromDist));

  if (!isContained) {
    return { status: 403, error: 'Forbidden: Path traversal detected' };
  }

  return { status: 200, filePath: resolvedTarget };
}

/**
 * Creates the HTTP server with path traversal protection and SPA fallback.
 *
 * @param {{ distDir?: string }} options
 * @returns {http.Server}
 */
export function createServer({ distDir = defaultDistDir } = {}) {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    const { status, filePath, error } = resolveSafePath(distDir, req.url);

    if (status !== 200 || !filePath) {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error || 'Error');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      let finalPath = filePath;

      if (err || !stats.isFile()) {
        // Fall back to index.html for SPA client-side routing
        finalPath = path.join(distDir, 'index.html');
      }

      fs.stat(finalPath, (fallbackErr, finalStats) => {
        if (fallbackErr || !finalStats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }

        const ext = path.extname(finalPath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': finalStats.size,
          'X-Content-Type-Options': 'nosniff',
        });

        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        const stream = fs.createReadStream(finalPath);
        stream.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          }
          res.end('Internal Server Error');
        });
        stream.pipe(res);
      });
    });
  });
}

// Start standalone server when executed directly
if (process.argv[1] === __filename) {
  const port = Number(process.env.PORT) || 4173;
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`Fireworks server running at http://127.0.0.1:${port}/`);
  });
}
