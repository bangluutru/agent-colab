import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WorkflowController } from './orchestrator/workflow.js';
import { ModelSelectionConfig, WorkflowEvent } from './protocol/types.js';

const PORT = 3000;
const PUBLIC_DIR = path.resolve(process.cwd(), 'web');
const RUNS_DIR = path.resolve(process.cwd(), 'runs');
const WORKSPACES_DIR = path.resolve(process.cwd(), 'workspaces');

if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });
if (!fs.existsSync(WORKSPACES_DIR)) fs.mkdirSync(WORKSPACES_DIR, { recursive: true });

function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'mvp.config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {
    defaultModels: {
      codex: 'gpt-6-astra',
      claude: 'opus',
      gemini: 'gemini-3.8-flash',
    },
    availableModels: {
      codex: [{ id: 'gpt-6-astra', name: 'GPT-6 Astra', group: 'Default (Recommended)', description: 'Default' }],
      claude: [{ id: 'opus', name: 'Opus 5', group: 'Primary Models', description: 'Default' }],
      gemini: [{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', group: 'Gemini Series', description: 'Default' }],
    },
  };
}

// Global active controllers and SSE subscriber registries
const activeControllers = new Map<string, WorkflowController>();
const sseSubscribers = new Map<string, Set<http.ServerResponse>>();

function broadcastEvent(runId: string, event: WorkflowEvent) {
  const clients = sseSubscribers.get(runId);
  if (clients && clients.size > 0) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) {
      try {
        client.write(data);
      } catch (err) {
        clients.delete(client);
      }
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. GET /api/models
  if (pathname === '/api/models' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadConfig()));
    return;
  }

  // 2. GET /api/status - Live cluster readiness
  if (pathname === '/api/status' && req.method === 'GET') {
    const config = loadConfig();
    const probeWorkflow = new WorkflowController({
      userRequest: 'status-probe',
      workspacePath: path.resolve(process.cwd(), 'test-workspace'),
      models: {
        codexModel: config.defaultModels.codex,
        claudeModel: config.defaultModels.claude,
        geminiModel: config.defaultModels.gemini,
      },
    });

    const [codexStatus, claudeStatus, geminiStatus] = await Promise.all([
      probeWorkflow.getCodexAdapter().getStatus(),
      probeWorkflow.getClaudeAdapter().getStatus(),
      probeWorkflow.getGeminiAdapter().getStatus(),
    ]);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        codex: codexStatus,
        claude: claudeStatus,
        gemini: geminiStatus,
        activeRunsCount: activeControllers.size,
      })
    );
    return;
  }

  // 3. GET /api/runs - List all runs with metadata
  if (pathname === '/api/runs' && req.method === 'GET') {
    if (!fs.existsSync(RUNS_DIR)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }

    const runs = fs.readdirSync(RUNS_DIR)
      .filter(f => fs.statSync(path.join(RUNS_DIR, f)).isDirectory() && !f.startsWith('.'))
      .map(id => {
        const runFolder = path.join(RUNS_DIR, id);
        const runJsonPath = path.join(runFolder, 'run.json');
        let meta: any = { id };

        if (fs.existsSync(runJsonPath)) {
          try {
            meta = { ...meta, ...JSON.parse(fs.readFileSync(runJsonPath, 'utf8')) };
          } catch {}
        }

        // Active controller status override if running
        const controller = activeControllers.get(id);
        if (controller) {
          meta.status = controller.getStateMachine().getState();
          meta.isActive = true;
        }

        const eventsPath = path.join(runFolder, 'events.jsonl');
        meta.hasEvents = fs.existsSync(eventsPath);
        meta.hasPlan = fs.existsSync(path.join(runFolder, 'plan.json'));
        meta.hasVerification = fs.existsSync(path.join(runFolder, 'verification.json'));
        const wsPath = path.resolve(WORKSPACES_DIR, id, 'project');
        const distIndex = path.join(wsPath, 'dist', 'index.html');
        meta.hasWorkspace = fs.existsSync(wsPath);
        meta.hasDist = fs.existsSync(distIndex);
        if (meta.hasDist) meta.previewUrl = `/preview/${id}/`;

        if (!meta.status) {
          if (meta.hasBlocked) meta.status = 'BLOCKED';
          else if (meta.hasVerification) meta.status = 'COMPLETED';
        }
        return meta;
      })
      .sort((a, b) => ((b.mtime || 0) - (a.mtime || 0)));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(runs));
    return;
  }

  // 4. SSE Stream: GET /api/runs/:id/stream (Section 15 & 16)
  const streamMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)\/stream$/);
  if (streamMatch && req.method === 'GET') {
    const runId = streamMatch[1];
    const runPath = path.join(RUNS_DIR, runId);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    });

    if (!sseSubscribers.has(runId)) {
      sseSubscribers.set(runId, new Set());
    }
    sseSubscribers.get(runId)!.add(res);

    // Send initial catch-up events
    const eventsPath = path.join(runPath, 'events.jsonl');
    if (fs.existsSync(eventsPath)) {
      const lines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        res.write(`data: ${line}\n\n`);
      }
    }

    // Keepalive ping
    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      const set = sseSubscribers.get(runId);
      if (set) {
        set.delete(res);
        if (set.size === 0) sseSubscribers.delete(runId);
      }
    });
    return;
  }

  // 5. GET /api/runs/:id - Details and artifacts
  const runDetailMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)$/);
  if (runDetailMatch && req.method === 'GET') {
    const runId = runDetailMatch[1];
    const runPath = path.join(RUNS_DIR, runId);

    if (!fs.existsSync(runPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }

    const files = fs.readdirSync(runPath);
    const data: Record<string, any> = { id: runId, files: {} };

    for (const file of files) {
      const filePath = path.join(runPath, file);
      if (fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (file.endsWith('.json')) {
          try {
            data.files[file] = JSON.parse(content);
          } catch {
            data.files[file] = content;
          }
        } else if (file.endsWith('.jsonl')) {
          data.files[file] = content.trim().split('\n').map(line => {
            try { return JSON.parse(line); } catch { return line; }
          });
        } else {
          data.files[file] = content;
        }
      }
    }

    const controller = activeControllers.get(runId);
    if (controller) {
      data.currentState = controller.getStateMachine().getState();
      data.isActive = true;
    } else {
      if (data.files['run.json']?.status) {
        data.currentState = data.files['run.json'].status;
      } else if (data.files['blocked.json']) {
        data.currentState = 'BLOCKED';
      } else if (data.files['verification.json']) {
        data.currentState = 'COMPLETED';
      } else if (Array.isArray(data.files['events.jsonl']) && data.files['events.jsonl'].length > 0) {
        const events = data.files['events.jsonl'];
        const lastEvt = events[events.length - 1];
        if (lastEvt?.type === 'WORKFLOW_BLOCKED') data.currentState = 'BLOCKED';
        else if (lastEvt?.type === 'WORKFLOW_FAILED') {
          data.currentState = (lastEvt?.data?.error?.includes('Not logged in') || lastEvt?.data?.error?.includes('AUTH_REQUIRED')) ? 'BLOCKED' : 'FAILED';
        }
        else if (lastEvt?.type === 'WORKFLOW_COMPLETED') data.currentState = 'COMPLETED';
        else if (lastEvt?.type === 'WORKFLOW_INTERRUPTED') data.currentState = 'CANCELLED';
        else if (lastEvt?.type === 'PHASE_TRANSITION') data.currentState = lastEvt.data?.state || lastEvt.data?.to;
        else if (lastEvt?.type === 'REVIEW_REQUESTED') data.currentState = 'REVIEWING';
        else if (lastEvt?.type === 'IMPLEMENTATION_STARTED') data.currentState = 'IMPLEMENTING';
        else if (lastEvt?.type === 'PLAN_REQUESTED') data.currentState = 'PLANNING';
        else data.currentState = 'REQUEST_RECEIVED';
      } else {
        data.currentState = 'REQUEST_RECEIVED';
      }
    }

    const workspacePath = path.resolve(WORKSPACES_DIR, runId, 'project');
    const distPath = path.resolve(workspacePath, 'dist');
    const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

    data.workspace = {
      workspacePath,
      distPath,
      hasWorkspace: fs.existsSync(workspacePath),
      hasDist,
      previewUrl: `/preview/${runId}/`,
      runCommands: {
        preview: `cd "${workspacePath}" && npm run preview`,
        dev: `cd "${workspacePath}" && npm run dev`,
        test: `cd "${workspacePath}" && npm test`,
        build: `cd "${workspacePath}" && npm run build`,
        openFinder: `open "${workspacePath}"`,
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // 5b. POST /api/runs/:id/open-folder - Open workspace in macOS Finder
  const openFolderMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)\/open-folder$/);
  if (openFolderMatch && req.method === 'POST') {
    const runId = openFolderMatch[1];
    const workspacePath = path.resolve(WORKSPACES_DIR, runId, 'project');
    if (!fs.existsSync(workspacePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workspace directory not found' }));
      return;
    }
    try {
      const { exec } = await import('child_process');
      exec(`open "${workspacePath}"`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, workspacePath }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5c. GET /api/runs/:id/files - List files in project workspace
  const filesListMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)\/files$/);
  if (filesListMatch && req.method === 'GET') {
    const runId = filesListMatch[1];
    const workspacePath = path.resolve(WORKSPACES_DIR, runId, 'project');
    if (!fs.existsSync(workspacePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workspace not found', files: [] }));
      return;
    }

    function scanDir(dir: string, base: string = ''): Array<{ path: string; name: string; size: number; isDir: boolean }> {
      const results: Array<{ path: string; name: string; size: number; isDir: boolean }> = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const relPath = base ? `${base}/${entry.name}` : entry.name;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push({ path: relPath, name: entry.name, size: 0, isDir: true });
            results.push(...scanDir(fullPath, relPath));
          } else {
            const stat = fs.statSync(fullPath);
            results.push({ path: relPath, name: entry.name, size: stat.size, isDir: false });
          }
        }
      } catch {}
      return results;
    }

    const files = scanDir(workspacePath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ workspacePath, files }));
    return;
  }

  // 5d. GET /api/runs/:id/file-content - View text of a file in workspace
  const fileContentMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)\/file-content$/);
  if (fileContentMatch && req.method === 'GET') {
    const runId = fileContentMatch[1];
    const filePathQuery = url.searchParams.get('path');
    if (!filePathQuery) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing path parameter' }));
      return;
    }

    const workspacePath = path.resolve(WORKSPACES_DIR, runId, 'project');
    const safePath = path.resolve(workspacePath, filePathQuery.replace(/^(\.\.[\/\\])+/, ''));
    if (!safePath.startsWith(workspacePath) || !fs.existsSync(safePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }

    try {
      const stat = fs.statSync(safePath);
      if (stat.size > 2 * 1024 * 1024) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File too large to preview (>2MB)' }));
        return;
      }
      const content = fs.readFileSync(safePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: filePathQuery, size: stat.size, content }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5e. GET /preview/:id/* - Serve Live App Preview from project dist/
  const previewMatch = pathname.match(/^\/preview\/([a-zA-Z0-9_-]+)(\/.*)?$/);
  if (previewMatch && req.method === 'GET') {
    const runId = previewMatch[1];
    const subPath = previewMatch[2] || '/';
    const workspacePath = path.resolve(WORKSPACES_DIR, runId, 'project');
    const distPath = path.resolve(workspacePath, 'dist');

    if (!fs.existsSync(distPath) || !fs.existsSync(path.join(distPath, 'index.html'))) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Application Preview</title>
  <style>
    body { background: #0a0d14; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { text-align: center; background: #111622; padding: 2.5rem; border-radius: 12px; border: 1px solid #1e293b; max-width: 480px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h2 { color: #f8fafc; margin-bottom: 0.75rem; font-size: 1.25rem; }
    p { font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem; }
    code { background: #161d2d; padding: 0.25rem 0.5rem; border-radius: 6px; color: #06b6d4; font-size: 0.85rem; font-family: monospace; }
  </style>
</head>
<body>
  <div class="box">
    <h2>⏳ Bản dựng chưa hoàn tất</h2>
    <p>Chưa tìm thấy thư mục <code>dist/index.html</code> cho phiên chạy <strong>${runId}</strong>.<br>Khi quy trình hoàn thành bước build, ứng dụng sẽ tự động hiển thị ở đây.</p>
  </div>
</body>
</html>`);
      return;
    }

    let reqFile = subPath === '/' ? 'index.html' : subPath.replace(/^\//, '');
    let targetFile = path.resolve(distPath, reqFile);

    // Fallback to index.html for client-side routing
    if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
      targetFile = path.join(distPath, 'index.html');
      reqFile = 'index.html';
    }

    if (!targetFile.startsWith(distPath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access Denied');
      return;
    }

    const ext = path.extname(targetFile).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
    };

    const contentType = mimeMap[ext] || 'application/octet-stream';

    if (ext === '.html') {
      try {
        let html = fs.readFileSync(targetFile, 'utf8');
        // Rewrite root-relative asset URLs so they resolve through /preview/:runId/
        html = html.replace(/(src|href)=["']\/assets\//g, `$1="/preview/${runId}/assets/`);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(html);
        return;
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.message);
        return;
      }
    }

    fs.readFile(targetFile, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      }
    });
    return;
  }

  // 5f. Direct /assets/* fallback if referer contains /preview/:runId
  if (pathname.startsWith('/assets/')) {
    const referer = req.headers.referer || '';
    const refMatch = referer.match(/\/preview\/([a-zA-Z0-9_-]+)/);
    if (refMatch) {
      const runId = refMatch[1];
      const assetFile = path.resolve(WORKSPACES_DIR, runId, 'project', 'dist', pathname.replace(/^\//, ''));
      if (fs.existsSync(assetFile)) {
        const ext = path.extname(assetFile).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.ico': 'image/x-icon',
        };
        res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
        fs.createReadStream(assetFile).pipe(res);
        return;
      }
    }
  }

  // 6. POST /api/runs/:id/cancel
  const cancelMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)\/cancel$/);
  if (cancelMatch && req.method === 'POST') {
    const runId = cancelMatch[1];
    const controller = activeControllers.get(runId);
    if (controller) {
      controller.cancel();
      activeControllers.delete(runId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, runId, status: 'CANCELLED' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active controller found for this run' }));
    }
    return;
  }

  // 6b. GET /api/runs/:id/events (Section 16)
  const eventsMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)\/events$/);
  if (eventsMatch && req.method === 'GET') {
    const runId = eventsMatch[1];
    const eventsPath = path.join(RUNS_DIR, runId, 'events.jsonl');
    if (fs.existsSync(eventsPath)) {
      const content = fs.readFileSync(eventsPath, 'utf8');
      const events = content.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return { raw: line }; }
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(events));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No events found for run' }));
    }
    return;
  }

  // 6c. POST /api/runs/:id/retry or /api/runs/:id/resume (Section 16 & 32)
  const retryMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)\/(retry|resume)$/);
  if (retryMatch && req.method === 'POST') {
    const runId = retryMatch[1];
    const runPath = path.join(RUNS_DIR, runId);
    if (!fs.existsSync(runPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }

    const runWorkspace = path.join(WORKSPACES_DIR, runId, 'project');
    const reqPath = path.join(runPath, 'request.md');
    let prompt = 'Build a simple Todo web app.';
    if (fs.existsSync(reqPath)) {
      prompt = fs.readFileSync(reqPath, 'utf8').replace(/^# USER REQUEST\s*/, '').trim();
    }

    let models: ModelSelectionConfig | undefined;
    const runJsonPath = path.join(runPath, 'run.json');
    if (fs.existsSync(runJsonPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(runJsonPath, 'utf8'));
        models = meta.models;
      } catch {}
    }
    models = { ...models, reviewerFallback: true };

    const workflow = new WorkflowController({
      userRequest: prompt,
      workspacePath: runWorkspace,
      runId,
      models,
      resume: true,
    });

    activeControllers.set(runId, workflow);
    workflow.getEventLogger().onEvent(event => {
      broadcastEvent(runId, event);
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      run_id: runId,
      status: 'RESUMING',
      message: `Resuming run ${runId} from last completed phase`,
    }));

    (async () => {
      try {
        console.log(`\n🔄 [ORCHESTRATOR] Resuming run: ${runId}`);
        const result = await workflow.runFullWorkflow({ resume: true });
        console.log(`🏁 [ORCHESTRATOR] Resumed run ${runId} concluded with status: ${result.status}`);
      } catch (err) {
        console.error(`❌ [ORCHESTRATOR] Error in resumed run ${runId}:`, err);
      } finally {
        activeControllers.delete(runId);
      }
    })();
    return;
  }

  // 7. POST /api/runs (and POST /api/run) - Start Autonomous Run (Section 16 & 18)
  if ((pathname === '/api/runs' || pathname === '/api/run') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prompt = (payload.prompt || 'Build a simple Todo web app.').trim();
        const codexModel = payload.codexModel || 'gpt-6-astra';
        const claudeModel = payload.claudeModel || 'opus';
        const geminiModel = payload.geminiModel || 'gemini-3.8-flash';
        const reasoningEffort = payload.reasoningEffort || 'low';

        // Check for already running controller to prevent duplicate processes (Section 18)
        if (activeControllers.size > 0) {
          const [existingId, existingCtrl] = activeControllers.entries().next().value;
          const existingState = existingCtrl.getStateMachine().getState();
          if (!['COMPLETED', 'BLOCKED', 'FAILED', 'CANCELLED'].includes(existingState)) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: `Run ${existingId} is currently active in stage ${existingState}. Please wait or cancel it before starting another.`,
              run_id: existingId,
            }));
            return;
          }
        }

        const runId = `run-${Date.now()}`;
        // Workspace per run (Section 19)
        const runWorkspace = path.join(WORKSPACES_DIR, runId, 'project');
        fs.mkdirSync(runWorkspace, { recursive: true });

        const models: ModelSelectionConfig = {
          codexModel,
          claudeModel,
          geminiModel,
          reasoningEffort,
          reviewerFallback: payload.reviewerFallback !== false,
        };

        const workflow = new WorkflowController({
          userRequest: prompt,
          workspacePath: runWorkspace,
          runId,
          models,
        });

        // Register controller
        activeControllers.set(runId, workflow);

        // Forward events to SSE clients
        workflow.getEventLogger().onEvent(event => {
          broadcastEvent(runId, event);
        });

        // Return immediately with HTTP 200 (Section 16)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          run_id: runId,
          status: 'REQUEST_RECEIVED',
          workspace: runWorkspace,
        }));

        // Execute full autonomous workflow in background (No demo shortcuts!)
        (async () => {
          try {
            console.log(`\n🚀 [ORCHESTRATOR] Autonomous Run started: ${runId}`);
            console.log(`Prompt: "${prompt}"`);
            console.log(`Workspace: ${runWorkspace}`);

            const result = await workflow.runFullWorkflow();
            console.log(`🏁 [ORCHESTRATOR] Run ${runId} concluded with status: ${result.status}`);
          } catch (err) {
            console.error(`❌ [ORCHESTRATOR] Uncaught error in run ${runId}:`, err);
          } finally {
            activeControllers.delete(runId);
          }
        })();

      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 8. Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 [AI AGENT STUDIO] Orchestrator Web UI running at: http://127.0.0.1:${PORT}/`);
  console.log(`📡 Endpoints: POST /api/runs | GET /api/runs/:id | SSE /api/runs/:id/stream\n`);
});
