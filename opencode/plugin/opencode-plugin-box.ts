// This plugin has been copied to ~/.config/opencode/plugin
// by https://github.com/eeveebank/nwb
// Ideally it would be provided by an npm package but
// we would have to ensure every dev has jfrog auth setup correctly.
// So for now we just copy it into the opencode plugin dir during setup.
// This plugin enforces path/url restrictions for OpenCode tools excluding bash
// It reads the config from `box print-config`
/* eslint-disable @typescript-eslint/no-explicit-any */
import { isAbsolute, join } from 'path';

import type { Plugin, PluginInput } from '@opencode-ai/plugin';

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
  const expandedPath = targetPath.replace(/^~(?=$|\/|\\)/, Bun.env['HOME'] || '~');

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

function filterGlobResults(result: any, config: FileSystemConfig, projectRoot: string) {
  if (!result?.files || !Array.isArray(result.files)) return result;

  const filteredFiles = result.files.filter((filePath: string) => {
    try {
      const normalized = normalizePath(filePath, projectRoot);
      return !isPathBlocked(config, normalized, projectRoot, 'read');
    } catch {
      // If normalization fails, filter out the file (safer approach)
      return false;
    }
  });

  return { ...result, files: filteredFiles };
}

function filterGrepResults(result: any, config: FileSystemConfig, projectRoot: string) {
  if (!result?.matches || !Array.isArray(result.matches)) return result;

  const filteredMatches = result.matches.filter((match: any) => {
    if (!match?.file) return true; // Keep matches without file info

    try {
      const normalized = normalizePath(match.file, projectRoot);
      return !isPathBlocked(config, normalized, projectRoot, 'read');
    } catch {
      // If normalization fails, filter out the match (safer approach)
      return false;
    }
  });

  return { ...result, matches: filteredMatches };
}

async function filterResults(
  config: FileSystemConfig,
  tool: string,
  result: any,
  projectRoot: string,
): Promise<any> {
  if (tool !== 'glob' && tool !== 'grep') return result;

  if (tool === 'glob') {
    return filterGlobResults(result, config, projectRoot);
  }

  if (tool === 'grep') {
    return filterGrepResults(result, config, projectRoot);
  }

  return result;
}

type Operation = 'read' | 'write';

interface PathInfo {
  path: string;
  isDirectory: boolean;
  operation: Operation;
}

const writeToolNames = ['edit', 'multiedit', 'write'];

function extractPathFromTool(tool: string, args: Record<string, unknown>): PathInfo | null {
  // File operations - operate on individual files
  if (tool === 'read')
    return args['filePath']
      ? { path: args['filePath'] as string, isDirectory: false, operation: 'read' }
      : null;

  if (writeToolNames.includes(tool))
    return args['filePath']
      ? {
          path: args['filePath'] as string,
          isDirectory: false,
          operation: 'write',
        }
      : null;

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

const getConfig = async ($: PluginInput['$'], projectRoot: string): Promise<GetConfigResult> => {
  const { SHELL } = process.env;
  if (!SHELL || !SHELL.match(/opencode-shell$/)) {
    return {
      ok: false,
      error: 'Run `boxedcode` to get filesystem and network sandboxing.',
    };
  }

  const { stderr, stdout } = await $`${SHELL} print-config`.nothrow().quiet();

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

// Allowlist of theoretically safe commands when run in the sandboxed shell.
// Goal is to provide safe defaults whilst allowing the user to loosen explicitly.
// This list should grow naturally with discussion.
// Allow prompts are security theatre.
// The sandbox should prevent real damage.
const defaultBashPermission = {
  '*': 'ask',
  './gradlew*': 'allow',
  'awk*': 'allow',
  'bun*': 'allow',
  'cat*': 'allow',
  'cut*': 'allow',
  'diff*': 'allow',
  'du*': 'allow',
  'echo*': 'allow',
  'file*': 'allow',
  'find*': 'allow',
  'gh co*': 'allow',
  'gh pr*': 'allow',
  'gh search*': 'allow',
  'git*': 'allow',
  'go*': 'allow',
  'grep*': 'allow',
  'gsed*': 'allow',
  'head*': 'allow',
  'jj*': 'allow',
  'jj git*': 'ask',
  'less*': 'allow',
  'ls*': 'allow',
  'make*': 'allow',
  'mkdir*': 'allow',
  'more*': 'allow',
  'npm add*': 'ask',
  'npm*': 'allow',
  'npx skills*': 'allow',
  'pwd*': 'allow',
  'rg*': 'allow',
  'sed*': 'allow',
  'sort*': 'allow',
  'stat*': 'allow',
  'tail*': 'allow',
  'tree*': 'allow',
  'uniq*': 'allow',
  'wc*': 'allow',
  'whereis*': 'allow',
  'which*': 'allow',
  'xargs*': 'allow',
} as const;

const checkHasJest = async ($: PluginInput['$']) => {
  const { exitCode } = await $`rg jest package.json`.nothrow().quiet();
  return exitCode === 0;
};

export const BoxPlugin: Plugin = async ({ client, $, directory, worktree }) => {
  // Prefer worktree (git root) over directory for multi-worktree repos
  const projectRoot = worktree || directory;

  const result = await getConfig($, projectRoot);
  const hasSandbox = result.ok;

  let configToastShown = false;

  const hasJest = result.ok && (await checkHasJest($));

  return {
    config: async (config) => {
      // Allow external_directory if sandbox detected
      if (hasSandbox && !config.permission?.external_directory) {
        config.permission = {
          ...config.permission,
          external_directory: 'allow',
        };
      }

      const agents = config.agent;
      for (const agentName in agents) {
        const agent = agents[agentName];
        if (!agent) continue;

        // These inbuilt agents have bash deny so ignore
        if (agentName === 'compaction') {
          continue;
        }

        if (!agent.permission) {
          agent.permission = {
            bash: {
              ...defaultBashPermission,
            },
          };
          continue;
        }

        // Agents with bash.* "allow", make safe but allow overrides
        if (typeof agent.permission.bash === 'object') {
          const userBashPermission = agent.permission.bash;
          if (userBashPermission['*'] === 'allow') {
            delete userBashPermission['*'];
          }

          agent.permission.bash = {
            ...defaultBashPermission,
            ...userBashPermission,
          };

          continue;
        }

        // Agents with bash: allow or unset, make safe
        if (agent.permission.bash !== 'deny' && agent.permission.bash !== 'ask') {
          agent.permission.bash = {
            ...defaultBashPermission,
          };
          continue;
        }
      }
    },

    'experimental.chat.system.transform': async (
      _input: { sessionID?: string },
      output: { system: string[] },
    ) => {
      // Very important branding excercise
      for (let i = 0; i < output.system.length; i++) {
        const prompt = output.system[i];
        if (typeof prompt !== 'string') {
          continue;
        }
        output.system[i] = prompt.replace(/\bOpenCode\b/g, 'BoxedCode');
      }

      if (result.ok === false) {
        return;
      }

      output.system.push(
        `Your environment is sandboxed - file system and network access are restricted.
  If an operation is not permitted, inform the user they can configure overrides in ~/.nwb/box/box.json. and restart with \`boxedcode --continue\`
  `,
      );

      if (hasJest) {
        output.system.push(
          `Always run \`jest\` commands with \`--no-watchman\` flag to avoid "Operation not permitted" errors.`,
        );
      }
    },

    'chat.message': async () => {
      // Seems to be the earliest hook we can use to show a toast
      if (configToastShown) {
        return;
      }
      configToastShown = true;

      if (result.ok === false) {
        await client.tui.showToast({
          body: {
            title: 'No sandbox detected',
            message: result.error,
            variant: 'warning',
          },
        });
        return;
      }

      await client.tui.showToast({
        body: {
          title: 'Sandbox activated',
          message: `Configure: ~/.nwb/box/box.json`,
          variant: 'success',
        },
      });
    },

    /**
     * Hook that runs before any tool execution
     */
    'tool.execute.before': async ({ tool }, { args }) => {
      if (result.ok === false) {
        return;
      }

      if (tool === 'webfetch') {
        await checkWebfetch(result.config.network, args);
        return;
      }

      if (tool === 'apply_patch') {
        const patchText = args.patchText;

        if (!patchText || typeof patchText !== 'string') {
          throw new Error('patchText is required');
        }

        handleApplyPatch(patchText, result.config.filesystem, projectRoot);
        return;
      }

      const pathInfo = extractPathFromTool(tool, args);

      // Skip tools that don't operate on paths
      if (!pathInfo) return;

      // Always allow project root to prevent blocking entire project
      if (pathInfo.path === '.') return;

      const isBlocked = isPathBlocked(
        result.config.filesystem,
        pathInfo.path,
        projectRoot,
        pathInfo.operation,
      );

      if (isBlocked) {
        throw new Error(`${pathInfo.operation} ${pathInfo.path}: Operation not permitted`);
      }
    },

    /**
     * Hook that runs after tool execution
     * Filters glob/grep results to remove blocked files
     */
    'tool.execute.after': async ({ tool }, context) => {
      if (result.ok === false) {
        return;
      }

      // Only process glob and grep tools
      if (tool !== 'glob' && tool !== 'grep') return context.output;

      // Filter results to remove blocked files
      return await filterResults(result.config.filesystem, tool, context.output, projectRoot);
    },
  };
};

const handleApplyPatch = (patchText: string, config: FileSystemConfig, projectRoot: string) => {
  const paths = Patch.parseFilePaths(patchText);

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
namespace Patch {
  function parsePatchHeader(
    lines: string[],
    startIdx: number,
  ): { filePath: string; movePath?: string | undefined; nextIdx: number } | null {
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

  export function parseFilePaths(patchText: string): string[] {
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
}
