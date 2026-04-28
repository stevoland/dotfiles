import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const sandboxBehaviours = ['write', 'read', 'webfetch', 'shell'] as const;

export type SandboxBehaviour = (typeof sandboxBehaviours)[number];
export type SandboxState = Record<SandboxBehaviour, boolean>;

export const defaultSandboxState: SandboxState = {
  read: true,
  write: true,
  webfetch: true,
  shell: true,
};

export const sandboxStatePath = join(homedir(), '.nwb', 'boxedcode', 'sandbox.json');

export async function readSandboxState(path = sandboxStatePath): Promise<SandboxState> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!isRecord(value)) return { ...defaultSandboxState };
    if (
      sandboxBehaviours.some(
        (behaviour) => value[behaviour] !== undefined && typeof value[behaviour] !== 'boolean',
      )
    ) {
      return { ...defaultSandboxState };
    }

    return Object.fromEntries(
      sandboxBehaviours.map((behaviour) => [
        behaviour,
        typeof value[behaviour] === 'boolean' ? value[behaviour] : true,
      ]),
    ) as SandboxState;
  } catch {
    return { ...defaultSandboxState };
  }
}

export async function updateSandboxState(
  behaviour: SandboxBehaviour,
  enabled: boolean,
  path = sandboxStatePath,
): Promise<SandboxState> {
  const state = { ...(await readSandboxState(path)), [behaviour]: enabled };
  const directory = dirname(path);
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;

  await mkdir(directory, { recursive: true });
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
