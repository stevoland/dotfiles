// This plugin has been copied to ~/.config/opencode/plugin
// by https://github.com/eeveebank/nwb

// Ideally it would be provided by an npm package but bun doesn't
// seem to be reading the global ~/.npmrc which is required for jfrog auth.
// And anyway would have to ensure every dev has jfrog auth setup correctly.
// So for now we just copy it into the opencode plugin dir during setup.

// This plugin enforces path/url restrictions for OpenCode tools excluding bash
// It reads the config from `box print-config`

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { join, isAbsolute } from "path";

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
  projectRoot: string
): Promise<FileSystemConfig> {
  const config: FileSystemConfig = {
    denyRead: [],
    allowWrite: [],
    denyWrite: [],
  };

  if (filesystem.denyRead && Array.isArray(filesystem.denyRead)) {
    config.denyRead = filesystem.denyRead.map((p: string) =>
      normalizePath(p, projectRoot)
    );
  }
  if (filesystem.allowWrite && Array.isArray(filesystem.allowWrite)) {
    config.allowWrite = filesystem.allowWrite.map((p: string) =>
      normalizePath(p, projectRoot)
    );
  }
  if (filesystem.denyWrite && Array.isArray(filesystem.denyWrite)) {
    config.denyWrite = filesystem.denyWrite.map((p: string) =>
      normalizePath(p, projectRoot)
    );
  }

  return config;
}

function normalizePath(targetPath: string, projectRoot: string): string {
  const expandedPath = targetPath.replace(/^~(?=$|\/|\\)/, Bun.env.HOME || "~");

  const absolutePath = isAbsolute(expandedPath)
    ? expandedPath
    : join(projectRoot, expandedPath);

  return absolutePath;
}

async function isPathBlocked(
  config: FileSystemConfig,
  targetPath: string,
  projectRoot: string,
  operation: Operation
): Promise<boolean> {
  const normalizedPath = normalizePath(targetPath, projectRoot);

  if (operation === "write") {
    for (const denyPath of config.denyWrite) {
      if (normalizedPath.startsWith(denyPath)) {
        return true;
      }
    }

    for (const allowPath of config.allowWrite) {
      if (normalizedPath.startsWith(allowPath)) {
        return false;
      }
    }

    return true;
  }

  for (const denyPath of config.denyRead) {
    if (normalizedPath.startsWith(denyPath)) {
      return true;
    }
  }

  return false;
}

function filterGlobResults(
  result: any,
  config: FileSystemConfig,
  projectRoot: string
) {
  if (!result?.files || !Array.isArray(result.files)) return result;

  const filteredFiles = result.files.filter((filePath: string) => {
    try {
      const normalized = normalizePath(filePath, projectRoot);
      return !isPathBlocked(config, normalized, projectRoot, "read");
    } catch {
      // If normalization fails, filter out the file (safer approach)
      return false;
    }
  });

  return { ...result, files: filteredFiles };
}

function filterGrepResults(
  result: any,
  config: FileSystemConfig,
  projectRoot: string
) {
  if (!result?.matches || !Array.isArray(result.matches)) return result;

  const filteredMatches = result.matches.filter((match: any) => {
    if (!match?.file) return true; // Keep matches without file info

    try {
      const normalized = normalizePath(match.file, projectRoot);
      return !isPathBlocked(config, normalized, projectRoot, "read");
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
  projectRoot: string
): Promise<any> {
  if (tool !== "glob" && tool !== "grep") return result;

  if (tool === "glob") {
    return filterGlobResults(result, config, projectRoot);
  }

  if (tool === "grep") {
    return filterGrepResults(result, config, projectRoot);
  }

  return result;
}

type Operation = "read" | "write";

interface PathInfo {
  path: string;
  isDirectory: boolean;
  operation: Operation;
}

function extractPathFromTool(
  tool: string,
  args: Record<string, unknown>
): PathInfo | null {
  // File operations - operate on individual files
  if (tool === "read")
    return args.filePath
      ? { path: args.filePath as string, isDirectory: false, operation: "read" }
      : null;
  if (tool === "write")
    return args.filePath
      ? {
          path: args.filePath as string,
          isDirectory: false,
          operation: "write",
        }
      : null;
  if (tool === "edit")
    return args.filePath
      ? {
          path: args.filePath as string,
          isDirectory: false,
          operation: "write",
        }
      : null;

  // Directory operations - search/list within directories
  // Default to "." (project root) if path not specified
  if (tool === "glob")
    return {
      path: (args.path as string) || ".",
      isDirectory: true,
      operation: "read",
    };
  if (tool === "grep")
    return {
      path: (args.path as string) || ".",
      isDirectory: true,
      operation: "read",
    };
  if (tool === "list")
    return {
      path: (args.path as string) || ".",
      isDirectory: true,
      operation: "read",
    };
  // Unknown tool - no path checking needed
  return null;
}

const hostMatches = (host: string, patterns: string[]): boolean => {
  for (const pattern of patterns) {
    if (pattern === host) return true;
    // Simple wildcard matching for patterns like *.example.com
    if (pattern.startsWith("*.")) {
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

const getConfig = async (
  $: PluginInput["$"],
  projectRoot: string
): Promise<GetConfigResult> => {
  const { SHELL } = process.env;
  if (!SHELL || !SHELL.match(/opencode-shell$/)) {
    return {
      ok: false,
      error: "Run `boxedcode` to get filesystem and network sandboxing.",
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
    config.filesystem = await resolveFilesystemConfig(
      config.filesystem,
      projectRoot
    );
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

export const BoxPlugin: Plugin = async ({ client, $, directory, worktree }) => {
  // Prefer worktree (git root) over directory for multi-worktree repos
  const projectRoot = worktree || directory;

  const result = await getConfig($, projectRoot);

  let configToastShown = false;

  return {
    "chat.message": async () => {
      // Seems to be the earliest hook we can use to show a toast
      if (configToastShown) {
        return;
      }
      configToastShown = true;

      if (result.ok === false) {
        await client.tui.showToast({
          body: {
            title: "No sandbox detected",
            message: result.error,
            variant: "warning",
          },
        });
        return;
      }

      await client.tui.showToast({
        body: {
          title: "Sandbox activated",
          message: `Configure: ~/.nwb/box/box.json`,
          variant: "success",
        },
      });
    },
    /**
     * Hook that runs before any tool execution
     */
    "tool.execute.before": async ({ tool }, { args }) => {
      if (result.ok === false) {
        return;
      }

      if (tool === "webfetch") {
        await checkWebfetch(result.config.network, args);
        return;
      }

      const pathInfo = extractPathFromTool(tool, args);

      // Skip tools that don't operate on paths
      if (!pathInfo) return;

      // Always allow project root to prevent blocking entire project
      if (pathInfo.path === ".") return;

      const isBlocked = await isPathBlocked(
        result.config.filesystem,
        pathInfo.path,
        projectRoot,
        pathInfo.operation
      );

      if (isBlocked) {
        throw new Error(
          `${pathInfo.operation} ${pathInfo.path}: Operation not permitted`
        );
      }
    },

    /**
     * Hook that runs after tool execution
     * Filters glob/grep results to remove blocked files
     */
    "tool.execute.after": async ({ tool }, context) => {
      if (result.ok === false) {
        return;
      }

      // Only process glob and grep tools
      if (tool !== "glob" && tool !== "grep") return context.output;

      // Filter results to remove blocked files
      return await filterResults(
        result.config.filesystem,
        tool,
        context.output,
        projectRoot
      );
    },
  };
};
