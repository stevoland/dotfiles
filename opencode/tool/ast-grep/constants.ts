import { existsSync } from "fs";

export function getSgCliPath(): string {
  return "/opt/homebrew/bin/sg";
}

// CLI supported languages (25 total)
export const CLI_LANGUAGES = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "elixir",
  "go",
  "haskell",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "lua",
  "nix",
  "php",
  "python",
  "ruby",
  "rust",
  "scala",
  "solidity",
  "swift",
  "typescript",
  "tsx",
  "yaml",
] as const;

// NAPI supported languages (5 total - native bindings)
export const NAPI_LANGUAGES = [
  "html",
  "javascript",
  "tsx",
  "css",
  "typescript",
] as const;

// Language to file extensions mapping
export const DEFAULT_TIMEOUT_MS = 300_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 1 * 1024 * 1024;
export const DEFAULT_MAX_MATCHES = 500;

export const LANG_EXTENSIONS: Record<string, string[]> = {
  bash: [".bash", ".sh", ".zsh", ".bats"],
  c: [".c", ".h"],
  cpp: [".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".h"],
  csharp: [".cs"],
  css: [".css"],
  elixir: [".ex", ".exs"],
  go: [".go"],
  haskell: [".hs", ".lhs"],
  html: [".html", ".htm"],
  java: [".java"],
  javascript: [".js", ".jsx", ".mjs", ".cjs"],
  json: [".json"],
  kotlin: [".kt", ".kts"],
  lua: [".lua"],
  nix: [".nix"],
  php: [".php"],
  python: [".py", ".pyi"],
  ruby: [".rb", ".rake"],
  rust: [".rs"],
  scala: [".scala", ".sc"],
  solidity: [".sol"],
  swift: [".swift"],
  typescript: [".ts", ".cts", ".mts"],
  tsx: [".tsx"],
  yaml: [".yml", ".yaml"],
};

export interface EnvironmentCheckResult {
  cli: {
    available: boolean;
    path: string;
    error?: string;
  };
  napi: {
    available: boolean;
    error?: string;
  };
}

/**
 * Check if ast-grep CLI and NAPI are available.
 * Call this at startup to provide early feedback about missing dependencies.
 */
export function checkEnvironment(): EnvironmentCheckResult {
  const cliPath = getSgCliPath();
  const result: EnvironmentCheckResult = {
    cli: {
      available: false,
      path: cliPath,
    },
    napi: {
      available: false,
    },
  };

  if (existsSync(cliPath)) {
    result.cli.available = true;
  } else if (cliPath === "sg") {
    try {
      const { spawnSync } = require("child_process");
      const whichResult = spawnSync(
        process.platform === "win32" ? "where" : "which",
        ["sg"],
        {
          encoding: "utf-8",
          timeout: 5000,
        },
      );
      result.cli.available =
        whichResult.status === 0 && !!whichResult.stdout?.trim();
      if (!result.cli.available) {
        result.cli.error = "sg binary not found in PATH";
      }
    } catch {
      result.cli.error = "Failed to check sg availability";
    }
  } else {
    result.cli.error = `Binary not found: ${cliPath}`;
  }

  // Check NAPI availability
  try {
    require("@ast-grep/napi");
    result.napi.available = true;
  } catch (e) {
    result.napi.available = false;
    result.napi.error = `@ast-grep/napi not installed: ${e instanceof Error ? e.message : String(e)}`;
  }

  return result;
}
