import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

export interface WorkspaceContext {
  workspacePath: string;
  projectName: string;
  branch: string;
  isGit: boolean;
}

export class WorkspaceDetector {
  public static async getActiveWorkspace(): Promise<WorkspaceContext> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return {
        workspacePath: process.cwd(),
        projectName: path.basename(process.cwd()),
        branch: 'main',
        isGit: false,
      };
    }

    const rootUri = folders[0].uri;
    const workspacePath = rootUri.fsPath;
    let projectName = path.basename(workspacePath);

    // Try reading package.json for project name
    const pkgPath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name) projectName = pkg.name;
      } catch {}
    }

    const branch = await this.getGitBranch(workspacePath);

    return {
      workspacePath,
      projectName,
      branch: branch || 'main',
      isGit: branch !== null,
    };
  }

  private static getGitBranch(cwd: string): Promise<string | null> {
    return new Promise((resolve) => {
      exec('git rev-parse --abbrev-ref HEAD', { cwd, timeout: 3000 }, (err, stdout) => {
        if (err || !stdout) {
          resolve(null);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
}
