import * as fs from 'fs';
import * as path from 'path';
import { ProcessRunner } from './runner.js';

export class ProjectBootstrapper {
  /**
   * Initializes an isolated workspace for a new collaboration run (Section 19 & 22)
   */
  public static async initWorkspace(workspacePath: string, projectName: string = 'autonomous-app'): Promise<void> {
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    const packageJsonPath = path.join(workspacePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      const packageJson = {
        name: projectName.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          test: 'vitest run',
        },
        dependencies: {
          react: '^18.3.1',
          'react-dom': '^18.3.1',
        },
        devDependencies: {
          '@testing-library/jest-dom': '^6.4.8',
          '@testing-library/react': '^16.0.0',
          '@testing-library/user-event': '^14.5.2',
          '@vitejs/plugin-react': '^4.3.1',
          jsdom: '^25.0.0',
          vite: '^5.4.2',
          vitest: '^2.0.5',
        },
      };

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

      // Add vite.config.js
      const viteConfigPath = path.join(workspacePath, 'vite.config.js');
      if (!fs.existsSync(viteConfigPath)) {
        const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
`;
        fs.writeFileSync(viteConfigPath, viteConfig, 'utf8');
      }

      // Add index.html
      const indexHtmlPath = path.join(workspacePath, 'index.html');
      if (!fs.existsSync(indexHtmlPath)) {
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
        fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
      }

      // Link node_modules from local root or test-workspace to save download time
      const targetNodeModules = path.join(workspacePath, 'node_modules');
      const sourceNodeModules1 = path.resolve(process.cwd(), 'test-workspace', 'node_modules');
      const sourceNodeModules2 = path.resolve(process.cwd(), 'node_modules');

      if (!fs.existsSync(targetNodeModules)) {
        if (fs.existsSync(sourceNodeModules1)) {
          try {
            fs.symlinkSync(sourceNodeModules1, targetNodeModules, 'junction');
          } catch {
            await ProcessRunner.run('npm', ['install', '--prefer-offline'], workspacePath, 60000);
          }
        } else if (fs.existsSync(sourceNodeModules2)) {
          try {
            fs.symlinkSync(sourceNodeModules2, targetNodeModules, 'junction');
          } catch {
            await ProcessRunner.run('npm', ['install', '--prefer-offline'], workspacePath, 60000);
          }
        }
      }
    }

    // Initialize git repository for diff tracking
    const gitDir = path.join(workspacePath, '.git');
    if (!fs.existsSync(gitDir)) {
      await ProcessRunner.run('git', ['init'], workspacePath);
      await ProcessRunner.run('git', ['config', 'user.name', 'Antigravity Agent'], workspacePath);
      await ProcessRunner.run('git', ['config', 'user.email', 'agent@antigravity.local'], workspacePath);
      await ProcessRunner.run('git', ['add', '.'], workspacePath);
      await ProcessRunner.run('git', ['commit', '-m', 'chore: initial scaffold', '--allow-empty'], workspacePath);
    }
  }

  /**
   * Get git diff of current workspace
   */
  public static async getGitDiff(workspacePath: string): Promise<string> {
    // Stage all untracked and modified files to capture full diff
    await ProcessRunner.run('git', ['add', '-A'], workspacePath, 15000);
    const diffRes = await ProcessRunner.run('git', ['diff', '--cached', 'HEAD'], workspacePath, 15000);
    if (diffRes.stdout && diffRes.stdout.trim().length > 0) {
      return diffRes.stdout.trim();
    }
    const statusRes = await ProcessRunner.run('git', ['status', '--short'], workspacePath, 15000);
    return statusRes.stdout.trim() || 'No modifications detected.';
  }
}
