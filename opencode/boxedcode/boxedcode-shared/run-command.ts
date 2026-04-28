import { spawn } from 'node:child_process';

export type ExecResult = {
  stdout: Buffer;
  stderr: Buffer;
  exitCode: number;
};

export type RunCommand = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => Promise<ExecResult>;

export const defaultRunCommand: RunCommand = (command, args, options) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (err) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.from(err instanceof Error ? err.message : String(err)),
        exitCode: 1,
      });
    });

    child.on('close', (code, signal) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks),
        exitCode: code ?? (signal ? 1 : 0),
      });
    });
  });

export const resolveCommandPath = async (command: string): Promise<string | undefined> => {
  const result = await defaultRunCommand('which', [command]);
  if (result.exitCode !== 0) {
    return undefined;
  }

  const candidate = result.stdout.toString().trim().split('\n')[0]?.trim();
  return candidate || undefined;
};
