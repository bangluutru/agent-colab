// Universal Orchestrator Bridge
// Seamlessly operates in both Antigravity Extension Webview and Standalone Browser

(function () {
  let vscode = null;
  if (typeof acquireVsCodeApi === 'function') {
    try {
      vscode = acquireVsCodeApi();
    } catch (e) {
      // acquireVsCodeApi may have already been called
    }
  }

  const isVsCode = vscode !== null;
  const messageListeners = [];

  if (isVsCode) {
    window.addEventListener('message', (event) => {
      const message = event.data;
      messageListeners.forEach((listener) => {
        try {
          listener(message);
        } catch (err) {
          console.error('[BRIDGE] Error in message listener:', err);
        }
      });
    });
  }

  const OrchestratorBridge = {
    isVsCode,

    postMessage(msg) {
      if (isVsCode && vscode) {
        vscode.postMessage(msg);
      } else {
        console.log('[BRIDGE: Standalone fallback] postMessage:', msg);
      }
    },

    onMessage(fn) {
      messageListeners.push(fn);
      return () => {
        const idx = messageListeners.indexOf(fn);
        if (idx !== -1) messageListeners.splice(idx, 1);
      };
    },

    openFile(filePath, line) {
      if (isVsCode && vscode) {
        vscode.postMessage({ type: 'OPEN_FILE', path: filePath, line });
      } else {
        console.log(`[BRIDGE] Open file requested: ${filePath}`);
        window.open(`/api/runs/${window.currentRunId || ''}/file-content?path=${encodeURIComponent(filePath)}`, '_blank');
      }
    },

    openDiff(originalPath, modifiedPath, title) {
      if (isVsCode && vscode) {
        vscode.postMessage({ type: 'OPEN_DIFF', originalPath, modifiedPath, title });
      } else {
        console.log(`[BRIDGE] Open diff requested: ${originalPath} <-> ${modifiedPath}`);
      }
    },

    openTerminal(command) {
      if (isVsCode && vscode) {
        vscode.postMessage({ type: 'OPEN_TERMINAL', command });
      } else {
        console.log(`[BRIDGE] Open terminal requested: ${command || ''}`);
      }
    },

    exitUIMode() {
      if (isVsCode && vscode) {
        vscode.postMessage({ type: 'EXIT_UI_MODE' });
      } else {
        console.log('[BRIDGE] Exit UI mode requested');
        alert('You are running in Standalone Browser mode. Native editor switching is active when running inside Antigravity.');
      }
    },

    getWorkspaceInfo() {
      if (isVsCode && vscode) {
        vscode.postMessage({ type: 'GET_WORKSPACE_INFO' });
      }
    },

    getState() {
      if (isVsCode && vscode) {
        return vscode.getState() || {};
      }
      try {
        return JSON.parse(localStorage.getItem('orchestrator_state') || '{}');
      } catch {
        return {};
      }
    },

    setState(state) {
      if (isVsCode && vscode) {
        vscode.setState(state);
      } else {
        try {
          localStorage.setItem('orchestrator_state', JSON.stringify(state));
        } catch {}
      }
    }
  };

  window.OrchestratorBridge = OrchestratorBridge;
})();
