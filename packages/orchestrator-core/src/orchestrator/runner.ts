import { spawn } from 'child_process';

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
  durationMs: number;
}

export class ProcessRunner {
  public static run(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number = 60000,
    extraEnv: Record<string, string> = {}
  ): Promise<CommandResult> {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      // Clean environment: CRITICAL CONSTRAINT: ZERO API KEYS
      const env = { ...process.env, ...extraEnv };
      delete env.OPENAI_API_KEY;
      delete env.ANTHROPIC_API_KEY;
      delete env.GOOGLE_API_KEY;

      const child = spawn(command, args, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | null = null;

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command '${command} ${args.join(' ')}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      child.stdout.on('data', chunk => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });

      child.on('close', code => {
        if (timer) clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          code: code ?? 0,
          durationMs: Date.now() - startTime,
        });
      });

      child.on('error', err => {
        if (timer) clearTimeout(timer);
        reject(err);
      });
    });
  }
}
