import type { BashOperations, ExtensionAPI, ToolResultEvent } from "@mariozechner/pi-coding-agent";
import {
  createBashTool,
  isFindToolResult,
  isGrepToolResult,
  isToolCallEventType,
} from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";
import { isAbsolute, resolve } from "node:path";

type FileSystemConfig = {
  denyRead: string[];
  allowWrite: string[];
  denyWrite: string[];
};

type NetworkConfig = {
  allowedDomains: string[];
  deniedDomains: string[];
};

type SandboxConfig = {
  filesystem: FileSystemConfig;
  network: NetworkConfig;
};

type SandboxState = {
  active: boolean;
  projectRoot: string;
  config: SandboxConfig;
  message?: string;
};

type Operation = "read" | "write";

const EMPTY_CONFIG: SandboxConfig = {
  filesystem: {
    denyRead: [],
    allowWrite: [],
    denyWrite: [],
  },
  network: {
    allowedDomains: [],
    deniedDomains: [],
  },
};

const DEFAULT_STATE: SandboxState = {
  active: false,
  projectRoot: process.cwd(),
  config: EMPTY_CONFIG,
  message: "Sandbox is not active.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      entries.push(entry);
    }
  }
  return entries;
}

function hasGlobSyntax(pattern: string): boolean {
  return pattern.includes("*") || pattern.includes("?") || pattern.includes("[") || pattern.includes("{");
}

function normalizeForPatternMatch(value: string): string {
  return value.replaceAll("\\", "/");
}

function expandHome(pathValue: string): string {
  const home = process.env["HOME"];
  if (!home) {
    return pathValue;
  }
  return pathValue.replace(/^~(?=$|\/|\\)/, home);
}

function normalizePath(pathValue: string, projectRoot: string): string {
  const expanded = expandHome(pathValue);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(projectRoot, expanded);
}

function resolveFilesystemConfig(filesystem: FileSystemConfig, projectRoot: string): FileSystemConfig {
  return {
    denyRead: filesystem.denyRead.map((entry) => normalizePath(entry, projectRoot)),
    allowWrite: filesystem.allowWrite.map((entry) => normalizePath(entry, projectRoot)),
    denyWrite: filesystem.denyWrite.map((entry) => normalizePath(entry, projectRoot)),
  };
}

function parseConfig(value: unknown): SandboxConfig | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const filesystemValue = value["filesystem"];
  const networkValue = value["network"];
  if (!isRecord(filesystemValue) || !isRecord(networkValue)) {
    return undefined;
  }

  return {
    filesystem: {
      denyRead: toStringArray(filesystemValue["denyRead"]),
      allowWrite: toStringArray(filesystemValue["allowWrite"]),
      denyWrite: toStringArray(filesystemValue["denyWrite"]),
    },
    network: {
      allowedDomains: toStringArray(networkValue["allowedDomains"]),
      deniedDomains: toStringArray(networkValue["deniedDomains"]),
    },
  };
}

function escapeRegexChar(char: string): string {
  return /[\\^$+?.()|{}]/.test(char) ? `\\${char}` : char;
}

function globToRegex(pattern: string): RegExp {
  let regexPattern = "^";
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index];
    if (char === undefined) {
      break;
    }

    if (char === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          regexPattern += "(?:.*/)?";
          index += 3;
          continue;
        }

        regexPattern += ".*";
        index += 2;
        continue;
      }

      regexPattern += "[^/]*";
      index += 1;
      continue;
    }

    if (char === "?") {
      regexPattern += "[^/]";
      index += 1;
      continue;
    }

    if (char === "[") {
      let classEnd = index + 1;
      while (classEnd < pattern.length && pattern[classEnd] !== "]") {
        classEnd += 1;
      }

      if (classEnd < pattern.length) {
        const classBody = pattern.slice(index + 1, classEnd).replaceAll("\\", "\\\\");
        regexPattern += `[${classBody}]`;
        index = classEnd + 1;
        continue;
      }
    }

    regexPattern += escapeRegexChar(char);
    index += 1;
  }

  regexPattern += "$";
  return new RegExp(regexPattern);
}

function matchesPathPattern(targetPath: string, patternPath: string): boolean {
  const normalizedTarget = normalizeForPatternMatch(targetPath);
  const normalizedPattern = normalizeForPatternMatch(patternPath);

  if (!hasGlobSyntax(normalizedPattern)) {
    if (normalizedTarget === normalizedPattern) {
      return true;
    }

    const directoryPattern = normalizedPattern.endsWith("/")
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

  if (operation === "write") {
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

function hostMatches(host: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === host) {
      return true;
    }

    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      if (host.endsWith(suffix)) {
        return true;
      }
    }
  }

  return false;
}

function extractGrepPath(line: string): string | undefined {
  const match = line.match(/^(.+?)(?::\d+:|-\d+- )/);
  if (!match) {
    return undefined;
  }
  const pathPart = match[1]?.trim();
  return pathPart && pathPart.length > 0 ? pathPart : undefined;
}

function isLikelyNoticeLine(line: string): boolean {
  return line.startsWith("[") && line.endsWith("]");
}

function filterTextParts(
  content: ToolResultEvent["content"],
  shouldKeepLine: (line: string) => boolean,
): ToolResultEvent["content"] {
  return content.map((part) => {
    if (part.type !== "text" || typeof part.text !== "string") {
      return part;
    }

    const lines = part.text.split("\n");
    const filteredLines: string[] = [];
    for (const line of lines) {
      if (line.length === 0 || shouldKeepLine(line)) {
        filteredLines.push(line);
      }
    }

    return {
      ...part,
      text: filteredLines.join("\n"),
    };
  });
}

function createBoxBashOperations(): BashOperations {
  return {
    async exec(command, cwd, { onData, signal, timeout, env }) {
      return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn("box", ["bash", "-lc", command], {
          cwd,
          env,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let timedOut = false;
        let timeoutHandle: NodeJS.Timeout | undefined;

        if (timeout !== undefined && timeout > 0) {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            if (child.pid) {
              try {
                process.kill(-child.pid, "SIGKILL");
              } catch {
                child.kill("SIGKILL");
              }
            }
          }, timeout * 1000);
        }

        child.stdout?.on("data", (chunk) => {
          if (Buffer.isBuffer(chunk)) {
            onData(chunk);
            return;
          }

          onData(Buffer.from(String(chunk)));
        });

        child.stderr?.on("data", (chunk) => {
          if (Buffer.isBuffer(chunk)) {
            onData(chunk);
            return;
          }

          onData(Buffer.from(String(chunk)));
        });

        const onAbort = () => {
          if (child.pid) {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch {
              child.kill("SIGKILL");
            }
          }
        };

        signal?.addEventListener("abort", onAbort, { once: true });

        child.on("error", (error) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          signal?.removeEventListener("abort", onAbort);
          rejectPromise(error);
        });

        child.on("close", (code) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          signal?.removeEventListener("abort", onAbort);

          if (signal?.aborted) {
            rejectPromise(new Error("aborted"));
            return;
          }

          if (timedOut) {
            rejectPromise(new Error(`timeout:${timeout}`));
            return;
          }

          resolvePromise({ exitCode: code });
        });
      });
    },
  };
}

async function loadSandboxState(pi: ExtensionAPI, projectRoot: string): Promise<SandboxState> {
  const shell = process.env["SHELL"];

  const commands: Array<{ cmd: string; args: string[] }> = [{ cmd: "box", args: ["print-config"] }];

  if (shell && shell.match(/opencode-shell$/)) {
    commands.push({ cmd: shell, args: ["print-config"] });
  }

  for (const command of commands) {
    try {
      const result = await pi.exec(command.cmd, command.args);
      if (result.code !== 0) {
        continue;
      }

      const parsed = parseConfig(JSON.parse(result.stdout));
      if (!parsed) {
        return {
          active: false,
          config: EMPTY_CONFIG,
          projectRoot,
          message: "box print-config returned invalid JSON schema.",
        };
      }

      return {
        active: true,
        projectRoot,
        config: {
          filesystem: resolveFilesystemConfig(parsed.filesystem, projectRoot),
          network: parsed.network,
        },
        message: "Sandbox active.",
      };
    } catch {
      // try next config source
    }
  }

  return {
    active: false,
    config: EMPTY_CONFIG,
    projectRoot,
    message: "Run pi from boxed shell (or install `box`) to enable sandboxing.",
  };
}

export default function boxedcodeSandboxExtension(pi: ExtensionAPI) {
  let state: SandboxState = DEFAULT_STATE;

  const localCwd = process.cwd();
  const localBash = createBashTool(localCwd);

  pi.registerTool({
    ...localBash,
    label: "bash (boxed)",
    async execute(id, params, signal, onUpdate) {
      if (!state.active) {
        return localBash.execute(id, params, signal, onUpdate);
      }

      const boxedBash = createBashTool(localCwd, {
        operations: createBoxBashOperations(),
      });
      return boxedBash.execute(id, params, signal, onUpdate);
    },
  });

  pi.on("user_bash", async () => {
    if (!state.active) {
      return;
    }

    return {
      operations: createBoxBashOperations(),
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    state = await loadSandboxState(pi, ctx.cwd);

    if (!ctx.hasUI) {
      return;
    }

    if (!state.active) {
      ctx.ui.notify(`[boxedcode-sandbox] ${state.message ?? "Sandbox disabled."}`, "warning");
      return;
    }

    const readRules = state.config.filesystem.denyRead.length;
    const writeRules = state.config.filesystem.allowWrite.length;
    const networkRules = state.config.network.allowedDomains.length;

    ctx.ui.setStatus(
      "boxedcode-sandbox",
      ctx.ui.theme.fg("accent", `🔒 sandbox: read(${readRules}) write(${writeRules}) net(${networkRules})`),
    );
    ctx.ui.notify("[boxedcode-sandbox] Sandbox activated.", "info");
  });

  pi.registerCommand("sandbox", {
    description: "Show boxed sandbox status",
    handler: async (_args, ctx) => {
      const lines = [
        `active: ${state.active ? "yes" : "no"}`,
        `projectRoot: ${state.projectRoot}`,
        `denyRead: ${state.config.filesystem.denyRead.length}`,
        `allowWrite: ${state.config.filesystem.allowWrite.length}`,
        `denyWrite: ${state.config.filesystem.denyWrite.length}`,
        `allowedDomains: ${state.config.network.allowedDomains.length}`,
        `deniedDomains: ${state.config.network.deniedDomains.length}`,
        state.message ? `message: ${state.message}` : "",
      ].filter((line) => line.length > 0);

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!state.active) {
      return;
    }

    if (event.toolName === "webfetch") {
      const urlValue = event.input["url"];
      if (typeof urlValue !== "string") {
        throw new Error("webfetch url is required");
      }

      const url = new URL(urlValue);
      const host = url.hostname;

      if (hostMatches(host, state.config.network.deniedDomains)) {
        throw new Error(`webfetch ${urlValue}: blocked by sandbox deniedDomains`);
      }

      if (
        state.config.network.allowedDomains.length > 0
        && !hostMatches(host, state.config.network.allowedDomains)
      ) {
        throw new Error(`webfetch ${urlValue}: blocked by sandbox allowedDomains`);
      }

      return;
    }

    let pathToCheck: string | undefined;
    let operation: Operation = "read";

    if (isToolCallEventType("read", event)) {
      pathToCheck = event.input.path;
      operation = "read";
    } else if (isToolCallEventType("edit", event)) {
      pathToCheck = event.input.path;
      operation = "write";
    } else if (isToolCallEventType("write", event)) {
      pathToCheck = event.input.path;
      operation = "write";
    } else if (isToolCallEventType("grep", event) || isToolCallEventType("find", event) || isToolCallEventType("ls", event)) {
      pathToCheck = event.input.path ?? ".";
      operation = "read";
    }

    if (!pathToCheck || pathToCheck === ".") {
      return;
    }

    const blocked = isPathBlocked(state.config.filesystem, pathToCheck, ctx.cwd, operation);

    if (blocked) {
      throw new Error(`${operation} ${pathToCheck}: blocked by sandbox`);
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (!state.active || event.isError) {
      return;
    }

    if (isFindToolResult(event)) {
      const basePath = typeof event.input["path"] === "string" ? event.input["path"] : ".";
      const baseAbsolute = normalizePath(basePath, ctx.cwd);

      return {
        content: filterTextParts(event.content, (line) => {
          if (isLikelyNoticeLine(line)) {
            return true;
          }

          const candidate = normalizePath(line.trim(), baseAbsolute);
          return !isPathBlocked(state.config.filesystem, candidate, state.projectRoot, "read");
        }),
      };
    }

    if (isGrepToolResult(event)) {
      const basePath = typeof event.input["path"] === "string" ? event.input["path"] : ".";
      const baseAbsolute = normalizePath(basePath, ctx.cwd);

      return {
        content: filterTextParts(event.content, (line) => {
          const grepPath = extractGrepPath(line);
          if (!grepPath) {
            return true;
          }

          const candidate = normalizePath(grepPath, baseAbsolute);
          return !isPathBlocked(state.config.filesystem, candidate, state.projectRoot, "read");
        }),
      };
    }
  });
}
