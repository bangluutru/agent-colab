import * as fs from 'fs';
import * as path from 'path';
import { ProcessRunner } from './runner.js';

export interface VerificationResult {
  pass: boolean;
  testPass: boolean;
  buildPass: boolean;
  filesExist: boolean;
  testOutput: string;
  buildOutput: string;
  keyFiles: string[];
  errors: string[];
}

export class ProjectVerifier {
  /**
   * Run objective machine checks on the target workspace (Section 23)
   */
  public static async verify(workspacePath: string): Promise<VerificationResult> {
    const errors: string[] = [];
    const packageJsonPath = path.join(workspacePath, 'package.json');

    // 1. Check if workspace exists and has project files
    if (!fs.existsSync(workspacePath)) {
      return {
        pass: false,
        testPass: false,
        buildPass: false,
        filesExist: false,
        testOutput: '',
        buildOutput: '',
        keyFiles: [],
        errors: [`Workspace directory does not exist: ${workspacePath}`],
      };
    }

    const files = fs.readdirSync(workspacePath);
    const keyFiles = files.filter(f => !f.startsWith('.') && f !== 'node_modules');

    if (keyFiles.length === 0) {
      return {
        pass: false,
        testPass: false,
        buildPass: false,
        filesExist: false,
        testOutput: '',
        buildOutput: '',
        keyFiles: [],
        errors: ['No project files found in workspace'],
      };
    }

    // Check package.json
    let testPass = false;
    let buildPass = false;
    let testOutput = '';
    let buildOutput = '';

    if (!fs.existsSync(packageJsonPath)) {
      errors.push('package.json not found');
      return {
        pass: false,
        testPass: false,
        buildPass: false,
        filesExist: true,
        testOutput: '',
        buildOutput: '',
        keyFiles,
        errors,
      };
    }

    let pkg: any = {};
    try {
      pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (err: any) {
      errors.push(`Failed to parse package.json: ${err.message}`);
    }

    const scripts = pkg.scripts || {};

    // 2. Ensure node_modules exists or install dependencies if missing
    const nodeModulesPath = path.join(workspacePath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log(`[VERIFIER] Installing dependencies in ${workspacePath}...`);
      const installRes = await ProcessRunner.run('npm', ['install', '--prefer-offline'], workspacePath, 120000);
      if (installRes.code !== 0) {
        // Retry without prefer-offline
        await ProcessRunner.run('npm', ['install'], workspacePath, 180000);
      }
    }

    // 3. Run Automated Tests
    if (scripts.test) {
      console.log(`[VERIFIER] Running npm test in ${workspacePath}...`);
      const testRes = await ProcessRunner.run('npm', ['test', '--', '--run'], workspacePath, 60000);
      testOutput = `${testRes.stdout}\n${testRes.stderr}`.trim();
      testPass = testRes.code === 0;
      if (!testPass) {
        errors.push(`npm test exited with code ${testRes.code}`);
      }
    } else {
      // Try vitest directly
      const vitestRes = await ProcessRunner.run('npx', ['vitest', 'run'], workspacePath, 60000);
      testOutput = `${vitestRes.stdout}\n${vitestRes.stderr}`.trim();
      testPass = vitestRes.code === 0;
      if (!testPass) {
        errors.push('Tests failed or test script not configured');
      }
    }

    // 4. Run Automated Production Build
    if (scripts.build) {
      console.log(`[VERIFIER] Running npm run build in ${workspacePath}...`);
      const buildRes = await ProcessRunner.run('npm', ['run', 'build'], workspacePath, 90000);
      buildOutput = `${buildRes.stdout}\n${buildRes.stderr}`.trim();
      buildPass = buildRes.code === 0;
      if (!buildPass) {
        errors.push(`npm run build exited with code ${buildRes.code}`);
      }
    } else {
      errors.push('Build script not defined in package.json');
    }

    const overallPass = testPass && buildPass && keyFiles.length > 0;

    return {
      pass: overallPass,
      testPass,
      buildPass,
      filesExist: keyFiles.length > 0,
      testOutput,
      buildOutput,
      keyFiles,
      errors,
    };
  }

  /**
   * Reads key implementation source files to provide to Claude for deep review
   */
  public static readSourceFiles(workspacePath: string): Record<string, string> {
    const result: Record<string, string> = {};
    const srcDir = path.join(workspacePath, 'src');

    function walk(dir: string, prefix = '') {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = path.join(prefix, entry.name);
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
            walk(full, rel);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json'].includes(ext)) {
            try {
              result[rel] = fs.readFileSync(full, 'utf8');
            } catch {}
          }
        }
      }
    }

    if (fs.existsSync(srcDir)) {
      walk(srcDir, 'src');
    }
    const pkgPath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      result['package.json'] = fs.readFileSync(pkgPath, 'utf8');
    }

    return result;
  }
}
