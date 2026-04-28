// This plugin has been copied to ~/.config/opencode/plugin
// by https://github.com/eeveebank/nwb
// Ideally it would be provided by an npm package but
// we would have to ensure every dev has jfrog auth setup correctly.
// So for now we just copy it into the opencode plugin dir during setup.
// This plugin enforces path/url restrictions for OpenCode tools excluding bash
// It reads the config from `box print-config`
import { homedir } from 'node:os';
import { isAbsolute, join } from 'path';

import type { Plugin } from '@opencode-ai/plugin';

import { type SandboxState, readSandboxState } from './state.ts';
import { type RunCommand, defaultRunCommand } from './boxedcode-shared/run-command.ts';

type FileSystemConfig = {
  denyRead: string[];
  allowWrite: string[];
  denyWrite: string[];
};

type NetworkConfig = {
  allowedDomains: string[];
  deniedDomains: string[];
};

type Config = {
  filesystem: FileSystemConfig;
  network: NetworkConfig;
};

async function resolveFilesystemConfig(
  filesystem: FileSystemConfig,
  projectRoot: string,
): Promise<FileSystemConfig> {
  const config: FileSystemConfig = {
    denyRead: [],
    allowWrite: [],
    denyWrite: [],
  };

  if (filesystem.denyRead && Array.isArray(filesystem.denyRead)) {
    config.denyRead = filesystem.denyRead.map((p: string) => normalizePath(p, projectRoot));
  }
  if (filesystem.allowWrite && Array.isArray(filesystem.allowWrite)) {
    config.allowWrite = filesystem.allowWrite.map((p: string) => normalizePath(p, projectRoot));
  }
  if (filesystem.denyWrite && Array.isArray(filesystem.denyWrite)) {
    config.denyWrite = filesystem.denyWrite.map((p: string) => normalizePath(p, projectRoot));
  }

  return config;
}

function normalizePath(targetPath: string, projectRoot: string): string {
  const expandedPath = targetPath.replace(/^~(?=$|\/|\\)/, homedir());

  const absolutePath = isAbsolute(expandedPath) ? expandedPath : join(projectRoot, expandedPath);

  return absolutePath;
}

function normalizeForPatternMatch(pathValue: string): string {
  return pathValue.replaceAll('\\', '/');
}

function hasGlobSyntax(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[');
}

function escapeRegexChar(char: string): string {
  return /[\\^$+?.()|{}]/.test(char) ? `\\${char}` : char;
}

function globToRegex(pattern: string): RegExp {
  let regexPattern = '^';
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index];
    if (char === undefined) {
      break;
    }

    if (char === '*') {
      if (pattern[index + 1] === '*') {
        if (pattern[index + 2] === '/') {
          regexPattern += '(?:.*/)?';
          index += 3;
          continue;
        }

        regexPattern += '.*';
        index += 2;
        continue;
      }

      regexPattern += '[^/]*';
      index++;
      continue;
    }

    if (char === '?') {
      regexPattern += '[^/]';
      index++;
      continue;
    }

    if (char === '[') {
      let classEnd = index + 1;
      while (classEnd < pattern.length && pattern[classEnd] !== ']') {
        classEnd++;
      }

      if (classEnd < pattern.length) {
        const classBody = pattern.slice(index + 1, classEnd).replaceAll('\\', '\\\\');
        regexPattern += `[${classBody}]`;
        index = classEnd + 1;
        continue;
      }
    }

    regexPattern += escapeRegexChar(char);
    index++;
  }

  regexPattern += '$';
  return new RegExp(regexPattern);
}

function matchesPathPattern(targetPath: string, patternPath: string): boolean {
  const normalizedTarget = normalizeForPatternMatch(targetPath);
  const normalizedPattern = normalizeForPatternMatch(patternPath);

  if (!hasGlobSyntax(normalizedPattern)) {
    if (normalizedTarget === normalizedPattern) {
      return true;
    }

    const directoryPattern = normalizedPattern.endsWith('/')
      ? normalizedPattern
      : `${normalizedPattern}/`;
    return normalizedTarget.startsWith(directoryPattern);
  }

  return globToRegex(normalizedPattern).test(normalizedTarget);
}

function isPathBlocked(
  config: FileSystemConfig,
  targetPath: string,
  projectRoot: string,
  operation: Operation,
): boolean {
  const normalizedPath = normalizePath(targetPath, projectRoot);

  if (operation === 'write') {
    for (const denyPath of config.denyWrite) {
      if (matchesPathPattern(normalizedPath, denyPath)) {
        return true;
      }
    }

    for (const allowPath of config.allowWrite) {
      if (matchesPathPattern(normalizedPath, allowPath)) {
        return false;
      }
    }

    return true;
  }

  for (const denyPath of config.denyRead) {
    if (matchesPathPattern(normalizedPath, denyPath)) {
      return true;
    }
  }

  return false;
}

type Operation = 'read' | 'write';

interface PathInfo {
  path: string;
  isDirectory: boolean;
  operation: Operation;
}

const writeToolNames = ['edit', 'multiedit', 'write'];
const sandboxableToolNames = new Set([
  'apply_patch',
  'patch',
  'read',
  ...writeToolNames,
  'glob',
  'grep',
  'list',
  'webfetch',
]);

function extractPathFromTool(tool: string, args: Record<string, unknown>): PathInfo | null {
  // File operations - operate on individual files
  if (tool === 'read') {
    const filePath = args['path'] ?? args['filePath'];
    return typeof filePath === 'string'
      ? {
          path: filePath,
          isDirectory: false,
          operation: 'read',
        }
      : null;
  }

  if (writeToolNames.includes(tool)) {
    const filePath = args['path'] ?? args['filePath'];
    return typeof filePath === 'string'
      ? {
          path: filePath,
          isDirectory: false,
          operation: 'write',
        }
      : null;
  }

  // Directory operations - search/list within directories
  // Default to "." (project root) if path not specified
  if (tool === 'glob')
    return {
      path: (args['path'] as string) || '.',
      isDirectory: true,
      operation: 'read',
    };
  if (tool === 'grep')
    return {
      path: (args['path'] as string) || '.',
      isDirectory: true,
      operation: 'read',
    };
  if (tool === 'list')
    return {
      path: (args['path'] as string) || '.',
      isDirectory: true,
      operation: 'read',
    };
  // Unknown tool - no path checking needed
  return null;
}

const hostMatches = (host: string, patterns: string[]): boolean => {
  for (const pattern of patterns) {
    if (pattern === host) return true;
    // Simple wildcard matching for patterns like *.example.com
    if (pattern.startsWith('*.')) {
      const domain = pattern.slice(1);
      if (host.endsWith(domain)) return true;
    }
  }
  return false;
};

const checkWebfetch = async (networkConfig: NetworkConfig, args: any) => {
  const url: string = args.url;

  const urlObj = new URL(url);
  const host = urlObj.hostname;

  if (hostMatches(host, networkConfig.deniedDomains)) {
    throw new Error(`WebFetch ${url}: Connection blocked by network allowlist`);
  }

  if (!hostMatches(host, networkConfig.allowedDomains)) {
    throw new Error(`WebFetch ${url}: Connection blocked by network allowlist`);
  }
};

type GetConfigOk = {
  ok: true;
  config: Config;
};

type GetConfigError = {
  ok: false;
  error: string;
};

type GetConfigResult = GetConfigOk | GetConfigError;

const getConfig = async (runCommand: RunCommand, projectRoot: string): Promise<GetConfigResult> => {
  const { stderr, stdout } = await runCommand('/opt/homebrew/bin/box', ['print-config'], {
    cwd: '/opt/homebrew/bin',
  });

  const error = stderr.toString().trim();

  if (error) {
    return {
      ok: false,
      error: `Config error:

${error}

See https://github.com/eeveebank/box for configuration help.`,
    };
  }

  const configString = stdout.toString();
  let config: Config;
  try {
    config = JSON.parse(configString);
    config.filesystem = await resolveFilesystemConfig(config.filesystem, projectRoot);
  } catch (e) {
    return {
      ok: false,
      error: `Config error:

${e}

See https://github.com/eeveebank/box for configuration help.`,
    };
  }

  return { ok: true, config };
};

// Allowlist of safe-ish bash commands for use when no sandbox detected
// and for default builtin plan/explore
// Some technically unsafe but trying to strike a balance with usability
const defaultSafeishBashPermission = {
  '*': 'ask',
  'ast-grep *': 'allow',
  'awk *': 'allow',
  'base64 *': 'allow',
  'basename *': 'allow',
  'cat *': 'allow',
  'cut *': 'allow',
  'date *': 'allow',
  'diff *': 'allow',
  'dirname *': 'allow',
  'dot *': 'allow',
  'du *': 'allow',
  'echo *': 'allow',
  'fd *': 'allow',
  'file *': 'allow',
  'find *': 'allow',
  'fzf *': 'allow',
  'grep *': 'allow',
  'gsed *': 'allow',
  'head *': 'allow',
  hostname: 'allow',
  id: 'allow',
  'jq *': 'allow',
  'ls *': 'allow',
  'make *': 'allow',
  'mkdir *': 'allow',
  'more *': 'allow',
  'npx skills *': 'allow',
  'nwb *': 'allow',
  'open *': 'allow',
  'printf *': 'allow',
  pwd: 'allow',
  'readlink *': 'allow',
  'realpath *': 'allow',
  'rg *': 'allow',
  'sed *': 'allow',
  'sg *': 'allow',
  'sleep *': 'allow',
  'sort *': 'allow',
  'stat *': 'allow',
  'tail *': 'allow',
  'tee *': 'allow',
  'time *': 'allow',
  'tr *': 'allow',
  'tree *': 'allow',
  true: 'allow',
  'uname *': 'allow',
  'uniq *': 'allow',
  'wc *': 'allow',
  'which *': 'allow',
  whoami: 'allow',
  'xargs *': 'allow',
} as const;

// Allowlist of theoretically safe commands when run in the sandboxed shell.
// Goal is to provide safe defaults whilst allowing the user to loosen explicitly.
// This list should grow naturally with discussion.
// Allow prompts are security theatre.
// The sandbox should prevent real damage.
const defaultSandboxBashPermission = {
  '*': 'ask',
  './gradlew*': 'allow',
  'ast-grep *': 'allow',
  'awk *': 'allow',
  'base64 *': 'allow',
  'basename *': 'allow',
  'biome *': 'allow',
  'bun *': 'allow',
  'cargo *': 'allow',
  'cat *': 'allow',
  'cloc *': 'allow',
  'cp *': 'allow',
  'curl *': 'allow',
  'cut *': 'allow',
  'date *': 'allow',
  'diff *': 'allow',
  'dirname *': 'allow',
  'docker *': 'allow',
  'dot *': 'allow',
  'du *': 'allow',
  'echo *': 'allow',
  'fd *': 'allow',
  'file *': 'allow',
  'find *': 'allow',
  'fnm *': 'allow',
  'fzf *': 'allow',
  'gh checkout *': 'allow',
  'gh co *': 'allow',
  'gh pr *': 'allow',
  'gh search *': 'allow',
  'git *': 'allow',
  'git push *': 'ask',
  'go *': 'allow',
  'grep *': 'allow',
  'groovy *': 'allow',
  'gsed *': 'allow',
  'gunzip *': 'allow',
  'gzip *': 'allow',
  'head *': 'allow',
  hostname: 'allow',
  id: 'allow',
  'java *': 'allow',
  'jj *': 'allow',
  'jj git push *': 'ask',
  'jj push *': 'ask',
  'jq *': 'allow',
  'kill *': 'allow',
  'ls *': 'allow',
  'lsof *': 'allow',
  'make *': 'allow',
  'mkdir *': 'allow',
  'more *': 'allow',
  'mv *': 'allow',
  'npm *': 'allow',
  'npx skills *': 'allow',
  'nwb *': 'allow',
  'open *': 'allow',
  'pkill *': 'allow',
  pbcopy: 'allow',
  pbpaste: 'allow',
  'pnpm *': 'allow',
  'prettier *': 'allow',
  'printf *': 'allow',
  'ps *': 'allow',
  pwd: 'allow',
  'python *': 'allow',
  'python3 *': 'allow',
  'readlink *': 'allow',
  'realpath *': 'allow',
  'rg *': 'allow',
  'sdk *': 'allow',
  'sed *': 'allow',
  'sg *': 'allow',
  'sh *': 'allow',
  'shellcheck *': 'allow',
  'sleep *': 'allow',
  'sort *': 'allow',
  'stat *': 'allow',
  'tail *': 'allow',
  'tar *': 'allow',
  'tee *': 'allow',
  'time *': 'allow',
  'timeout *': 'allow',
  'touch *': 'allow',
  'tr *': 'allow',
  'tree *': 'allow',
  true: 'allow',
  'tsc *': 'allow',
  'turbo *': 'allow',
  'uname *': 'allow',
  'uniq *': 'allow',
  'unzip *': 'allow',
  'uv *': 'allow',
  'vite *': 'allow',
  'vitest *': 'allow',
  'wc *': 'allow',
  'wget *': 'allow',
  'which *': 'allow',
  whoami: 'allow',
  'xargs *': 'allow',
  'yarn *': 'allow',
  'zip *': 'allow',
} as const;

const checkHasJest = async (runCommand: RunCommand, projectRoot: string) => {
  const { exitCode } = await runCommand('rg', ['jest', join(projectRoot, 'package.json')], {
    cwd: projectRoot,
  });
  return exitCode === 0;
};

let activeRunCommand: RunCommand = defaultRunCommand;
let activeReadSandboxState: () => Promise<SandboxState> = readSandboxState;

/**
 * Test-only hooks. Wrapped in a plain object because opencode's plugin loader
 * iterates every named export from files in `~/.config/opencode/plugin/` and
 * treats each function-valued export as a Plugin factory.
 */
const testHooks = {
  setRunCommand: (runCommand?: RunCommand): void => {
    activeRunCommand = runCommand ?? defaultRunCommand;
  },
  setReadSandboxState: (readState?: () => Promise<SandboxState>): void => {
    activeReadSandboxState = readState ?? readSandboxState;
  },
};

export const BoxPlugin: Plugin.Plugin = {
  id: 'boxedcode-box',
  setup: async (context) => {
    const runCommand = activeRunCommand;
    const readState = activeReadSandboxState;
    const projectRoot = (await context.agent.list()).location.project.directory;

    const result: GetConfigResult = await getConfig(runCommand, projectRoot);
    const hasJest = result.ok && (await checkHasJest(runCommand, projectRoot));
    const registrations: Array<{ dispose: () => Promise<void> }> = [];

    registrations.push(
      await context.agent.transform((agents) => {
        for (const agent of agents.list()) {
          const agentId = String(agent.id);
          if (agentId === 'compaction') continue;
          const defaults =
            agentId === 'plan' || agentId === 'explore'
              ? defaultSafeishBashPermission
              : result.ok
                ? defaultSandboxBashPermission
                : defaultSafeishBashPermission;
          const permissions = Object.entries(defaults).map(([resource, effect]) => ({
            action: 'bash',
            resource,
            effect,
          }));
          agents.update(agentId, (current) => {
            const configuredBash = current.permissions.filter(
              (rule) =>
                rule.action === 'bash' && !(rule.resource === '*' && rule.effect === 'allow'),
            );
            const configuredOther = current.permissions.filter((rule) => rule.action !== 'bash');
            current.permissions = [
              ...configuredOther,
              ...permissions,
              ...configuredBash,
              ...(result.ok
                ? [{ action: 'external_directory', resource: '*', effect: 'allow' as const }]
                : []),
            ];
          });
        }
      }),
    );

    registrations.push(
      await context.session.hook('context', (event) => {
        // Very important branding excercise
        for (let i = 0; i < event.system.length; i++) {
          const prompt = event.system[i];
          if (!prompt) continue;
          event.system[i] = { ...prompt, text: prompt.text.replace(/\bOpenCode\b/g, 'BoxedCode') };
        }

        if (result.ok === false) return;

        event.system.push({
          type: 'text',
          text: `Your environment is sandboxed - file system and network access are restricted.
  If an operation is not permitted, inform the user they can configure overrides in ~/.nwb/box/box.json.
  `,
        });

        if (hasJest) {
          event.system.push({
            type: 'text',
            text: `Always run \`jest\` commands with \`--no-watchman\` flag to avoid "Operation not permitted" errors.`,
          });
        }
      }),
    );

    registrations.push(
      await context.shell.hook('create.before', async (event) => {
        // if ((await readState()).shell) {
        //   event.shell = '/opt/homebrew/bin/opencode-shell';
        //   return
        // }

        event.shell = process.env['SHELL'] || '/bin/zsh'
      }),
    );

    registrations.push(
      await context.tool.hook('execute.before', async (event) => {
        if (!sandboxableToolNames.has(event.tool)) {
          return;
        }

        if (!isRecord(event.input)) return;
        const args = event.input;
        const pathInfo = extractPathFromTool(event.tool, args);

        const sandboxState = await readState();
        const behaviour =
          event.tool === 'webfetch'
            ? 'webfetch'
            : event.tool === 'apply_patch' || event.tool === 'patch'
              ? 'write'
              : pathInfo?.operation;
        if (behaviour && !sandboxState[behaviour]) return;

        if (!['apply_patch', 'patch', 'webfetch'].includes(event.tool) && !pathInfo) {
          return;
        }

        // Reload for every sandboxed tool invocation so policy and state changes
        // take effect without restarting BoxedCode.
        const currentConfig = await getConfig(runCommand, projectRoot);
        if (currentConfig.ok === false) {
          throw new Error(currentConfig.error);
        }

        if (event.tool === 'webfetch') {
          await checkWebfetch(currentConfig.config.network, args);
          return;
        }

        if (event.tool === 'apply_patch' || event.tool === 'patch') {
          const patchText = args['patchText'];

          if (!patchText || typeof patchText !== 'string') {
            throw new Error('patchText is required');
          }

          handleApplyPatch(patchText, currentConfig.config.filesystem, projectRoot);
          return;
        }

        // Skip tools that don't operate on paths
        if (!pathInfo) return;

        // Always allow project root to prevent blocking entire project
        if (pathInfo.path === '.') return;

        const isBlocked = isPathBlocked(
          currentConfig.config.filesystem,
          pathInfo.path,
          projectRoot,
          pathInfo.operation,
        );

        if (isBlocked) {
          throw new Error(`${pathInfo.operation} ${pathInfo.path}: Operation not permitted`);
        }
      }),
    );

    registrations.push(
      await context.tool.hook('execute.after', async (event) => {
        if (event.tool !== 'glob' && event.tool !== 'grep') return;
        if (event.status !== 'completed') return;
        if (!(await readState()).read) return;

        // This is deliberately reloaded separately from execute.before: result
        // filtering is another sandbox enforcement point and must use the latest
        // policy too.
        const currentConfig = await getConfig(runCommand, projectRoot);
        if (currentConfig.ok === false) return;

        const structured = filterV2Results(
          event.result.output,
          event.tool,
          currentConfig.config.filesystem,
          projectRoot,
        );
        const text = formatV2Results(structured, event.tool);
        event.result = { ...event.result, output: structured, content: text };
      }),
    );

    return async () => {
      await Promise.all(registrations.map((registration) => registration.dispose()));
    };
  },
};
(BoxPlugin as typeof BoxPlugin & { __test: typeof testHooks }).__test = testHooks;

export default BoxPlugin;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function filterV2Results(
  value: unknown,
  tool: string,
  config: FileSystemConfig,
  projectRoot: string,
): unknown {
  if (!Array.isArray(value)) return value;
  return value.filter((item) => {
    if (!isRecord(item)) return true;
    const path =
      tool === 'glob' ? item['path'] : isRecord(item['entry']) ? item['entry']['path'] : undefined;
    if (typeof path !== 'string') return true;
    return !isPathBlocked(config, path, projectRoot, 'read');
  });
}

function formatV2Results(value: unknown, tool: string): string {
  if (!Array.isArray(value)) return String(value);
  if (tool === 'glob') {
    const paths = value.flatMap((item) =>
      isRecord(item) && typeof item['path'] === 'string' ? [item['path'] as string] : [],
    );
    return paths.length === 0 ? 'No files found' : paths.join('\n');
  }

  if (value.length === 0) return 'No files found';
  const lines = [`Found ${value.length} matches`];
  let current = '';
  for (const item of value) {
    if (!isRecord(item) || !isRecord(item['entry']) || typeof item['entry']['path'] !== 'string')
      continue;
    const path = item['entry']['path'];
    if (current !== path) {
      if (current) lines.push('');
      current = path;
      lines.push(`${current}:`);
    }
    if (typeof item['line'] === 'number' && typeof item['text'] === 'string') {
      lines.push(`  Line ${item['line']}: ${item['text']}`);
    }
  }
  return lines.join('\n');
}

const handleApplyPatch = (patchText: string, config: FileSystemConfig, projectRoot: string) => {
  const paths = parseFilePaths(patchText);

  const restrictedPaths = paths
    .filter((path) => isPathBlocked(config, path, projectRoot, 'write'))
    .map((path) => `  - ${path}`);

  if (restrictedPaths.length > 0) {
    throw new Error(`apply_patch: Write operation not permitted for paths:

${restrictedPaths.join('\n')}`);
  }
};

// Minimal required patch parsing extracted from:
// https://github.com/anomalyco/opencode/blob/407f34fed5140c4eb3b378c606a422de7e313d9a/packages/opencode/src/patch/index.ts
function parsePatchHeader(
  lines: string[],
  startIdx: number,
): {
  filePath: string;
  movePath?: string | undefined;
  nextIdx: number;
} | null {
  const line = lines[startIdx];

  if (!line) {
    return null;
  }

  if (line.startsWith('*** Add File:')) {
    const filePath = line.split(':', 2)[1]?.trim();
    return filePath ? { filePath, nextIdx: startIdx + 1 } : null;
  }

  if (line.startsWith('*** Delete File:')) {
    const filePath = line.split(':', 2)[1]?.trim();
    return filePath ? { filePath, nextIdx: startIdx + 1 } : null;
  }

  if (line.startsWith('*** Update File:')) {
    const filePath = line.split(':', 2)[1]?.trim();
    let movePath: string | undefined;
    let nextIdx = startIdx + 1;

    // Check for move directive
    if (nextIdx < lines.length && lines[nextIdx]?.startsWith('*** Move to:')) {
      movePath = lines[nextIdx]?.split(':', 2)[1]?.trim();
      nextIdx++;
    }

    return filePath ? { filePath, movePath, nextIdx } : null;
  }

  return null;
}

function parseUpdateFileChunks(lines: string[], startIdx: number): { nextIdx: number } {
  let i = startIdx;

  while (i < lines.length && !lines[i]?.startsWith('***')) {
    if (lines[i]?.startsWith('@@')) {
      i++;

      // Parse change lines
      while (i < lines.length && !lines[i]?.startsWith('@@') && !lines[i]?.startsWith('***')) {
        const changeLine = lines[i];

        if (changeLine === '*** End of File') {
          i++;
          break;
        }

        i++;
      }
    } else {
      i++;
    }
  }

  return { nextIdx: i };
}

function parseAddFileContent(lines: string[], startIdx: number): { nextIdx: number } {
  let content = '';
  let i = startIdx;

  while (i < lines.length && !lines[i]?.startsWith('***')) {
    i++;
  }

  // Remove trailing newline
  if (content.endsWith('\n')) {
    content = content.slice(0, -1);
  }

  return { nextIdx: i };
}

function stripHeredoc(input: string): string {
  // Match heredoc patterns like: cat <<'EOF'\n...\nEOF or <<EOF\n...\nEOF
  const heredocMatch = input.match(/^(?:cat\s+)?<<['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*$/);
  if (heredocMatch && heredocMatch[2]) {
    return heredocMatch[2];
  }
  return input;
}

function parseFilePaths(patchText: string): string[] {
  const cleaned = stripHeredoc(patchText.trim());
  const lines = cleaned.split('\n');
  const paths: string[] = [];
  let i = 0;

  const beginMarker = '*** Begin Patch';
  const endMarker = '*** End Patch';

  const beginIdx = lines.findIndex((line) => line.trim() === beginMarker);
  const endIdx = lines.findIndex((line) => line.trim() === endMarker);

  if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) {
    throw new Error('Invalid patch format: missing Begin/End markers');
  }

  i = beginIdx + 1;

  while (i < endIdx) {
    const header = parsePatchHeader(lines, i);
    const line = lines[i];
    if (!header || !line) {
      i++;
      continue;
    }

    if (line.startsWith('*** Add File:')) {
      const { nextIdx } = parseAddFileContent(lines, header.nextIdx);
      paths.push(header.filePath);
      i = nextIdx;
    } else if (line.startsWith('*** Delete File:')) {
      paths.push(header.filePath);
      i = header.nextIdx;
    } else if (line.startsWith('*** Update File:')) {
      const { nextIdx } = parseUpdateFileChunks(lines, header.nextIdx);
      paths.push(header.filePath);
      if (header.movePath) {
        paths.push(header.movePath);
      }
      i = nextIdx;
    } else {
      i++;
    }
  }

  return paths;
}
