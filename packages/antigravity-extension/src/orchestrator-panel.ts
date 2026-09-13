import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BridgeRouter } from './bridge-router.js';
import { WorkspaceDetector } from './workspace.js';

export class OrchestratorPanel {
  public static currentPanel: OrchestratorPanel | undefined;
  public static readonly viewType = 'antigravity.orchestrator';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly uiRootUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private previousActiveEditor: { uri: vscode.Uri; line: number } | null = null;
  private bridgeRouter: BridgeRouter;

  public static async createOrShow(extensionUri: vscode.Uri): Promise<OrchestratorPanel> {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Track previous active editor
    let previousEditor: { uri: vscode.Uri; line: number } | null = null;
    if (vscode.window.activeTextEditor) {
      previousEditor = {
        uri: vscode.window.activeTextEditor.document.uri,
        line: vscode.window.activeTextEditor.selection.active.line,
      };
    }

    if (OrchestratorPanel.currentPanel) {
      OrchestratorPanel.currentPanel.panel.reveal(column || vscode.ViewColumn.One);
      return OrchestratorPanel.currentPanel;
    }

    // Look for web UI directory (either ./web or ../orchestrator-ui/src or ./ui)
    let uiDir = path.join(extensionUri.fsPath, 'ui');
    if (!fs.existsSync(uiDir)) {
      uiDir = path.join(extensionUri.fsPath, 'web');
    }
    if (!fs.existsSync(uiDir)) {
      uiDir = path.resolve(extensionUri.fsPath, '..', 'orchestrator-ui', 'src');
    }
    if (!fs.existsSync(uiDir)) {
      uiDir = path.resolve(process.cwd(), 'web');
    }

    const uiRootUri = vscode.Uri.file(uiDir);

    const panel = vscode.window.createWebviewPanel(
      OrchestratorPanel.viewType,
      'Orchestrator',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri, uiRootUri],
      }
    );

    OrchestratorPanel.currentPanel = new OrchestratorPanel(panel, extensionUri, uiRootUri, previousEditor);
    return OrchestratorPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    uiRootUri: vscode.Uri,
    previousEditor: { uri: vscode.Uri; line: number } | null
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.uiRootUri = uiRootUri;
    this.previousActiveEditor = previousEditor;

    // Set icon
    const iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'orchestrator-icon.svg');
    if (fs.existsSync(iconPath.fsPath)) {
      this.panel.iconPath = iconPath;
    }

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

    this.bridgeRouter = new BridgeRouter({
      workspacePath,
      onExitUIMode: () => this.exitUIMode(),
      postMessage: (msg) => this.panel.webview.postMessage(msg),
    });

    this.update();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message) => this.bridgeRouter.handleMessage(message),
      null,
      this.disposables
    );
  }

  public async exitUIMode(): Promise<void> {
    const prev = this.previousActiveEditor;
    this.dispose();

    if (prev && fs.existsSync(prev.uri.fsPath)) {
      try {
        const doc = await vscode.workspace.openTextDocument(prev.uri);
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          selection: new vscode.Range(prev.line, 0, prev.line, 0),
        });
      } catch (err) {
        console.warn('[ORCHESTRATOR] Could not restore previous editor:', err);
      }
    }
  }

  private update(): void {
    const webview = this.panel.webview;
    this.panel.webview.html = this.getHtmlForWebview(webview);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const indexPath = path.join(this.uiRootUri.fsPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return `<!DOCTYPE html><html><body><h3>Orchestrator UI not found at ${indexPath}</h3></body></html>`;
    }

    let html = fs.readFileSync(indexPath, 'utf8');

    // Convert relative assets to webview URIs
    const toWebviewUri = (file: string) => {
      const filePath = vscode.Uri.file(path.join(this.uiRootUri.fsPath, file));
      return webview.asWebviewUri(filePath).toString();
    };

    html = html.replace(/href="style\.css"/g, `href="${toWebviewUri('style.css')}"`);
    html = html.replace(/src="bridge\.js"/g, `src="${toWebviewUri('bridge.js')}"`);
    html = html.replace(/src="app\.js"/g, `src="${toWebviewUri('app.js')}"`);

    return html;
  }

  public dispose(): void {
    OrchestratorPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) x.dispose();
    }
  }
}
