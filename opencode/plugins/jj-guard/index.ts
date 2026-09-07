import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";

import type { Plugin } from '@opencode/plugin';
import type * as TreeSitter from "@vscode/tree-sitter-wasm";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const { Language, Parser } = require(
  "@vscode/tree-sitter-wasm",
) as typeof TreeSitter;
const TREE_SITTER_WASM_PATH = require.resolve(
  "@vscode/tree-sitter-wasm/wasm/tree-sitter.wasm",
);
const BASH_GRAMMAR_PATH = require.resolve(
  "@vscode/tree-sitter-wasm/wasm/tree-sitter-bash.wasm",
);
const HELP_FLAGS = new Set(["-h", "--help"]);

let bashLanguagePromise: Promise<TreeSitter.Language> | undefined;

const GIT_COMMANDS_PATTERN =
  /(^|&&|\|\||;|\|)\s*git\s+(commit|push|pull|checkout|branch|merge|rebase|status|diff|log|add|reset|stash|clone|init|fetch|tag|show|rm|mv|restore|switch|remote|config|clean|cherry-pick|revert|bisect|blame|grep|shortlog|describe|archive|bundle|submodule|worktree|reflog)/;

const JJ_PREFIX = /(^|&&|\|\||;|\|)\s*/;
const JJ_DIFFEDIT_PATTERN = new RegExp(
  JJ_PREFIX.source + /jj\s+diffedit(\s|$)/.source,
);
const JJ_SQUASH_PATTERN = new RegExp(
  JJ_PREFIX.source + /jj\s+squash(\s|$)/.source,
);
const JJ_SPLIT_PATTERN = new RegExp(
  JJ_PREFIX.source + /jj\s+split(\s|$)/.source,
);
const JJ_RESOLVE_PATTERN = new RegExp(
  JJ_PREFIX.source + /jj\s+resolve(\s|$)/.source,
);
const JJ_DESCRIBE_PATTERN = new RegExp(
  JJ_PREFIX.source + /jj\s+(describe|desc)(\s|$)/.source,
);
const JJ_COMMIT_PATTERN = new RegExp(
  JJ_PREFIX.source + /jj\s+(commit|ci)(\s|$)/.source,
);
const JJ_INTERACTIVE_PATTERN = new RegExp(
  JJ_PREFIX.source + /jj\s+(commit|ci|restore)\s/.source,
);

const HAS_MESSAGE_FLAG = /(-m\s|--message\s|-m"|--message=|-m'|--stdin)/;
const HAS_INTERACTIVE_FLAG =
  /(\s(-i|--interactive|--tool)\s|\s(-i|--interactive|--tool)$)/;
const HAS_LIST_FLAG = /(-l|--list)(\s|$)/;

function loadBashLanguage(): Promise<TreeSitter.Language> {
  bashLanguagePromise ??= (async () => {
    await Parser.init({ locateFile: () => TREE_SITTER_WASM_PATH });
    return Language.load(BASH_GRAMMAR_PATH);
  })();

  return bashLanguagePromise;
}

function literalShellWord(node: TreeSitter.Node): string | null {
  switch (node.type) {
    case "word":
      return node.text.replace(/\\(.)/gs, "$1");
    case "raw_string":
      return node.text.slice(1, -1);
    case "ansi_c_string": {
      const value = node.text.slice(2, -1);
      return value.includes("\\") ? null : value;
    }
    case "string": {
      const parts = node.namedChildren;
      if (
        parts.some(
          (part) => part === null || part.type !== "string_content",
        )
      ) {
        return null;
      }
      return parts.map((part) => part?.text ?? "").join("");
    }
    case "concatenation":
    case "command_name": {
      const parts = node.namedChildren.map((part) =>
        part === null ? null : literalShellWord(part),
      );
      if (parts.some((part) => part === null)) {
        return null;
      }
      return parts.join("");
    }
    default:
      return null;
  }
}

function checkGitCommand(command: string): string | null {
  if (GIT_COMMANDS_PATTERN.test(command)) {
    return "Git commands are disabled. Use jj instead. See: https://jj-vcs.github.io/jj/latest/git-comparison/";
  }
  return null;
}

function checkJJInteractiveCommand(command: string): string | null {
  if (JJ_DIFFEDIT_PATTERN.test(command)) {
    return "jj diffedit always opens a diff editor. Use jj restore for non-interactive alternatives.";
  }

  if (JJ_SQUASH_PATTERN.test(command) && !HAS_MESSAGE_FLAG.test(command)) {
    return 'jj squash without -m opens an editor. Use: jj squash -m "message"';
  }

  if (JJ_SPLIT_PATTERN.test(command)) {
    if (HAS_INTERACTIVE_FLAG.test(command)) {
      return "jj split -i opens a diff editor interactively.";
    }
    if (!HAS_MESSAGE_FLAG.test(command)) {
      return 'jj split without -m opens an editor. Use: jj split -m "message" <files>';
    }
    const remaining = command
      .replace(/^\s*jj\s+split\s*/, "")
      .replace(
        /(-r|--revision|-d|--destination|-A|--insert-after|-B|--insert-before|-m|--message)\s+("[^"]*"|'[^']*'|[^\s]+)\s*/g,
        "",
      )
      .replace(/(-p|--parallel)\s*/g, "")
      .trim();
    if (remaining.length === 0) {
      return 'jj split without filesets opens a diff editor. Provide filesets: jj split -m "message" <files>';
    }
  }

  if (JJ_RESOLVE_PATTERN.test(command) && !HAS_LIST_FLAG.test(command)) {
    return "jj resolve opens a merge tool. Use jj resolve --list to view conflicts, or resolve conflicts by editing conflict markers directly.";
  }

  if (JJ_DESCRIBE_PATTERN.test(command) && !HAS_MESSAGE_FLAG.test(command)) {
    return 'jj describe without -m opens an editor. Use: jj describe -m "message"';
  }

  if (JJ_COMMIT_PATTERN.test(command) && !HAS_MESSAGE_FLAG.test(command)) {
    return 'jj commit without -m opens an editor. Use: jj commit -m "message"';
  }

  if (
    JJ_INTERACTIVE_PATTERN.test(command) &&
    HAS_INTERACTIVE_FLAG.test(command)
  ) {
    return "Interactive jj command blocked (-i/--interactive/--tool opens a diff editor).";
  }

  return null;
}

/** Checks Bash-parsed jj commands, allowing commands with exact help flags. */
export async function checkJJInteractiveCommands(
  command: string,
): Promise<string | null> {
  const language = await loadBashLanguage();
  const parser = new Parser();

  try {
    parser.setLanguage(language);
    const tree = parser.parse(command);
    if (!tree) {
      return "Unable to parse shell command for interactive jj checks.";
    }

    try {
      const jjCommands = tree.rootNode
        .descendantsOfType("command")
        .filter((node): node is TreeSitter.Node => node !== null)
        .filter((node) => {
          const name = node.childForFieldName("name");
          return name !== null && literalShellWord(name) === "jj";
        });

      for (const jjCommand of jjCommands) {
        const args = jjCommand.childrenForFieldName("argument");
        let optionsEnded = false;
        const hasHelpFlag = args.some((argument) => {
          if (argument === null) {
            return false;
          }

          const value = literalShellWord(argument);
          if (value === "--") {
            optionsEnded = true;
            return false;
          }

          return !optionsEnded && value !== null && HELP_FLAGS.has(value);
        });
        if (hasHelpFlag) {
          continue;
        }

        const error = checkJJInteractiveCommand(jjCommand.text);
        if (error) {
          return error;
        }
      }
    } finally {
      tree.delete();
    }
  } finally {
    parser.delete();
  }

  return null;
}

async function isJjRepo(directory: string): Promise<boolean> {
  try {
    await execFileAsync("jj", ["root"], {
      cwd: directory,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

function transformSystemPrompt(prompt: string): string {
  return prompt.replace(
    /Is directory a git repo:.*/,
    `Is directory a jujutsu (jj) repo: yes

  Do not use git commands, use jj commands
`,
  );
}

const plugin: Plugin.Plugin = {
  id: "jj",
  setup: async (context) => {
    await context.session.hook("context", async (event) => {
      let directory: string;
      try {
        const session = await context.session.get({ sessionID: event.sessionID });
        directory = session.location.directory;
      } catch {
        return;
      }

      if (!(await isJjRepo(directory))) {
        return;
      }

      for (const [index, part] of event.system.entries()) {
        if (part.type !== "text") {
          continue;
        }
        event.system[index] = { ...part, text: transformSystemPrompt(part.text) };
      }
    });

    await context.tool.hook("execute.before", async (event) => {
      if (event.tool !== "shell") {
        return;
      }

      const input = event.input;
      if (input === null || typeof input !== "object") {
        return;
      }
      const command = (input as Record<string, unknown>).command;
      if (typeof command !== "string" || !command) return;

      let directory: string;
      try {
        const session = await context.session.get({ sessionID: event.sessionID });
        directory = session.location.directory;
      } catch {
        return;
      }

      if (!(await isJjRepo(directory))) {
        return;
      }

      const gitError = checkGitCommand(command);
      if (gitError) {
        throw new Error(gitError);
      }

      const jjError = await checkJJInteractiveCommands(command);
      if (jjError) {
        throw new Error(jjError);
      }
    });
  },
}

export default plugin
