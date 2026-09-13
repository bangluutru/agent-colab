import * as vscode from 'vscode';
import { OrchestratorPanel } from './orchestrator-panel.js';

class OrchestratorActivityBarProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<vscode.TreeItem[]> {
    const launchItem = new vscode.TreeItem('Open Orchestrator UI Mode', vscode.TreeItemCollapsibleState.None);
    launchItem.command = {
      command: 'orchestrator.enter',
      title: 'Enter Orchestrator UI Mode',
    };
    launchItem.tooltip = 'Launch the Multi-Agent Cockpit (Cmd/Ctrl+Shift+O)';
    launchItem.iconPath = new vscode.ThemeIcon('hubot');

    const docsItem = new vscode.TreeItem('View Documentation', vscode.TreeItemCollapsibleState.None);
    docsItem.command = {
      command: 'simpleBrowser.show',
      title: 'View Documentation',
      arguments: ['http://127.0.0.1:3000/docs'],
    };
    docsItem.iconPath = new vscode.ThemeIcon('book');

    return Promise.resolve([launchItem, docsItem]);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('[ORCHESTRATOR] Antigravity Orchestrator extension activated.');

  // 1. Command: Enter UI Mode
  const enterCmd = vscode.commands.registerCommand('orchestrator.enter', async () => {
    await OrchestratorPanel.createOrShow(context.extensionUri);
  });

  // 2. Command: Exit UI Mode
  const exitCmd = vscode.commands.registerCommand('orchestrator.exit', async () => {
    if (OrchestratorPanel.currentPanel) {
      await OrchestratorPanel.currentPanel.exitUIMode();
    }
  });

  // 3. Activity Bar Tree View
  const treeProvider = new OrchestratorActivityBarProvider();
  vscode.window.registerTreeDataProvider('orchestratorDashboardView', treeProvider);

  context.subscriptions.push(enterCmd, exitCmd);
}

export function deactivate() {
  if (OrchestratorPanel.currentPanel) {
    OrchestratorPanel.currentPanel.dispose();
  }
}
