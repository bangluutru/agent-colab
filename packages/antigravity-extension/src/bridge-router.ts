import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceDetector } from './workspace.js';

export interface BridgeHandlerOptions {
  workspacePath: string;
  onExitUIMode: () => void;
  postMessage: (msg: any) => void;
}

export class BridgeRouter {
  private options: BridgeHandlerOptions;

  constructor(options: BridgeHandlerOptions) {
    this.options = options;
  }

  public async handleMessage(message: any): Promise<void> {
    if (!message || typeof message !== 'object') return;

    switch (message.type) {
      case 'OPEN_FILE': {
        const rawPath = message.path;
        if (!rawPath) return;
        const fullPath = path.isAbsolute(rawPath)
          ? rawPath
          : path.resolve(this.options.workspacePath, rawPath);

        if (fs.existsSync(fullPath)) {
          const doc = await vscode.workspace.openTextDocument(fullPath);
          const line = message.line ? Math.max(0, message.line - 1) : 0;
          await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Beside,
            selection: new vscode.Range(line, 0, line, 0),
          });
        } else {
          vscode.window.showWarningMessage(`Orchestrator: File not found: ${rawPath}`);
        }
        break;
      }

      case 'OPEN_DIFF': {
        const orig = message.originalPath
          ? (path.isAbsolute(message.originalPath) ? message.originalPath : path.resolve(this.options.workspacePath, message.originalPath))
          : null;
        const mod = message.modifiedPath
          ? (path.isAbsolute(message.modifiedPath) ? message.modifiedPath : path.resolve(this.options.workspacePath, message.modifiedPath))
          : null;

        if (mod && fs.existsSync(mod)) {
          const leftUri = orig && fs.existsSync(orig) ? vscode.Uri.file(orig) : vscode.Uri.file(mod);
          const rightUri = vscode.Uri.file(mod);
          const title = message.title || `${path.basename(mod)} (Diff)`;
          await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
            viewColumn: vscode.ViewColumn.Beside,
          });
        }
        break;
      }

      case 'OPEN_TERMINAL': {
        let terminal = vscode.window.terminals.find(t => t.name === 'Orchestrator');
        if (!terminal) {
          terminal = vscode.window.createTerminal({
            name: 'Orchestrator',
            cwd: this.options.workspacePath,
          });
        }
        terminal.show();
        if (message.command) {
          terminal.sendText(message.command);
        }
        break;
      }

      case 'BROWSER_VERIFY': {
        const targetUrl = message.url || 'http://127.0.0.1:3000/';
        try {
          await vscode.commands.executeCommand('simpleBrowser.show', targetUrl);
        } catch {
          await vscode.env.openExternal(vscode.Uri.parse(targetUrl));
        }
        break;
      }

      case 'EXIT_UI_MODE': {
        this.options.onExitUIMode();
        break;
      }

      case 'GET_WORKSPACE_INFO': {
        const info = await WorkspaceDetector.getActiveWorkspace();
        this.options.postMessage({
          type: 'WORKSPACE_INFO',
          ...info,
        });
        break;
      }

      default:
        // Other messages
        break;
    }
  }
}
