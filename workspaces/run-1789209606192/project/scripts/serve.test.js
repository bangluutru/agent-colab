import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveSafePath, createServer, defaultDistDir } from './serve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('resolveSafePath Containment and Traversal Validation', () => {
  it('resolves valid root and file paths correctly', () => {
    const resRoot = resolveSafePath(defaultDistDir, '/');
    expect(resRoot.status).toBe(200);
    expect(resRoot.filePath).toBe(path.join(defaultDistDir, 'index.html'));

    const resIndex = resolveSafePath(defaultDistDir, '/index.html');
    expect(resIndex.status).toBe(200);
    expect(resIndex.filePath).toBe(path.join(defaultDistDir, 'index.html'));

    const resAsset = resolveSafePath(defaultDistDir, '/assets/test.js');
    expect(resAsset.status).toBe(200);
    expect(resAsset.filePath).toBe(path.join(defaultDistDir, 'assets/test.js'));
  });

  it('rejects raw parent directory traversal (/../package.json) with 403', () => {
    const res = resolveSafePath(defaultDistDir, '/../package.json');
    expect(res.status).toBe(403);
    expect(res.error).toMatch(/Path traversal detected/i);
    expect(res.filePath).toBeUndefined();
  });

  it('rejects URL-encoded parent directory traversal (/%2e%2e/package.json) with 403', () => {
    const res = resolveSafePath(defaultDistDir, '/%2e%2e/package.json');
    expect(res.status).toBe(403);
    expect(res.error).toMatch(/Path traversal detected/i);
  });

  it('rejects mixed slashes and multi-level traversal with 403', () => {
    const res1 = resolveSafePath(defaultDistDir, '/..%2fpackage.json');
    expect(res1.status).toBe(403);

    const res2 = resolveSafePath(defaultDistDir, '/nested/../../package.json');
    expect(res2.status).toBe(403);

    const res3 = resolveSafePath(defaultDistDir, '/../../../../../../etc/passwd');
    expect(res3.status).toBe(403);
  });

  it('rejects null byte injection with 400', () => {
    const res = resolveSafePath(defaultDistDir, '/index.html%00.jpg');
    expect(res.status).toBe(400);
    expect(res.error).toMatch(/Null bytes/i);
  });

  it('rejects malformed URI components with 400', () => {
    const res = resolveSafePath(defaultDistDir, '/%E0%A4%A');
    expect(res.status).toBe(400);
    expect(res.error).toMatch(/Malformed URI/i);
  });
});

describe('HTTP Server Traversal Regression Test', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    // Ensure dist directory and index.html exist
    if (!fs.existsSync(defaultDistDir)) {
      fs.mkdirSync(defaultDistDir, { recursive: true });
    }
    const distIndex = path.join(defaultDistDir, 'index.html');
    if (!fs.existsSync(distIndex)) {
      fs.writeFileSync(distIndex, '<!DOCTYPE html><html><body>Test</body></html>');
    }

    server = createServer({ distDir: defaultDistDir });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  function makeRawRequest(rawPath, method = 'GET') {
    return new Promise((resolve, reject) => {
      const url = new URL(baseUrl);
      const req = http.request(
        {
          host: url.hostname,
          port: url.port,
          path: rawPath,
          method,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data,
            });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  it('serves dist/index.html on root request', async () => {
    const res = await makeRawRequest('/');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<!DOCTYPE html>');
  });

  it('rejects /../package.json with HTTP 403 Forbidden and DOES NOT leak package.json', async () => {
    const res = await makeRawRequest('/../package.json');
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatch(/Forbidden/i);
    expect(res.body).not.toContain('"name": "autonomous-app"');
  });

  it('rejects encoded /%2e%2e/package.json with HTTP 403 Forbidden', async () => {
    const res = await makeRawRequest('/%2e%2e/package.json');
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatch(/Forbidden/i);
    expect(res.body).not.toContain('"name": "autonomous-app"');
  });

  it('falls back to index.html for client-side routing within dist', async () => {
    const res = await makeRawRequest('/simulation-view');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<!DOCTYPE html>');
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const res = await makeRawRequest('/', 'POST');
    expect(res.statusCode).toBe(405);
  });
});
