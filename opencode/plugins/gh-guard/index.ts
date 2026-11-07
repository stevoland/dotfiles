import { createRequire } from "node:module";
import { basename } from "node:path";

import type { Plugin } from "@opencode/plugin";
import type * as TreeSitter from "@vscode/tree-sitter-wasm";

import { registerGithubWritePermissions } from "./github-write-permissions";
import { registerPullRequestTools } from "./pull-request";

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

const GH_BLOCKED_MESSAGE =
  "The gh CLI is disabled. Use the GitHub API tools inside the `execute` tool instead: " +
  "`tools.github.*` (REST) and `tools.githubGraphql.*` (GraphQL). " +
  'Find the exact tool with `search({ query: "...", namespace: "github" })` ' +
  'or `search({ query: "...", namespace: "githubGraphql" })`. ' +
  "To create or update pull requests, use the pr_create and pr_update tools.";

const GITHUB_TOOLS =
  "the GitHub API tools via `execute` (`tools.github.*` REST, `tools.githubGraphql.*` GraphQL)";

const GH_INSTRUCTION_PATTERN = /\b(use|using|with)\s+(the\s+)?`?gh`?\s+cli(\s+commands)?/gi;
const GH_COMMAND_MENTION_PATTERN = /(^|[\s`$(])gh\s+[a-z]/m;

const SKILL_GH_NOTE = `> NOTE: The \`gh\` CLI is blocked in this environment. Wherever this skill uses \`gh\`, do the equivalent with ${GITHUB_TOOLS}. Find the exact tool with \`search({ query, namespace: "github" })\` or \`namespace: "githubGraphql"\`. To create or update pull requests, use the \`pr_create\` and \`pr_update\` tools.`;

/** Rewrites "use gh cli" instructions to point at the GitHub API tools. */
export function rewriteGhInstructions(text: string): string {
  return text.replace(
    GH_INSTRUCTION_PATTERN,
    (_match, verb: string) => `${verb} ${GITHUB_TOOLS}`,
  );
}

/** Prepends a gh-is-blocked note to skill content that runs gh commands. */
export function annotateSkillContent(content: string): string {
  if (!GH_COMMAND_MENTION_PATTERN.test(content) || content.includes(SKILL_GH_NOTE)) {
    return content;
  }
  return `${SKILL_GH_NOTE}\n\n${content}`;
}

let bashLanguagePromise: Promise<TreeSitter.Language> | undefined;

function loadBashLanguage(): Promise<TreeSitter.Language> {
  bashLanguagePromise ??= (async () => {
    await Parser.init({ locateFile: () => TREE_SITTER_WASM_PATH });
    return Language.load(BASH_GRAMMAR_PATH);
  })();

  return bashLanguagePromise;
}

/** Returns an error message if the shell command invokes the gh CLI. */
export async function checkGhCommand(command: string): Promise<string | null> {
  if (!/\bgh\b/.test(command)) {
    return null;
  }

  const language = await loadBashLanguage();
  const parser = new Parser();

  try {
    parser.setLanguage(language);
    const tree = parser.parse(command);
    if (!tree) {
      return null;
    }

    try {
      const invokesGh = tree.rootNode
        .descendantsOfType("command")
        .some((node) => {
          const name = node?.childForFieldName("name");
          return name != null && basename(name.text.replace(/['"]/g, "")) === "gh";
        });
      return invokesGh ? GH_BLOCKED_MESSAGE : null;
    } finally {
      tree.delete();
    }
  } finally {
    parser.delete();
  }
}

const plugin: Plugin.Plugin = {
  id: "stevo.gh-guard",
  setup: async (context) => {
    await registerPullRequestTools(context);
    await registerGithubWritePermissions(context);

    await context.skill.transform((editor) => {
      for (const skill of editor.list()) {
        const content = annotateSkillContent(skill.content);
        if (content !== skill.content) {
          editor.update(skill.id, (draft) => {
            draft.content = content;
          });
        }
      }
    });

    await context.session.hook("context", async (event) => {
      for (const [index, part] of event.system.entries()) {
        if (part.type !== "text") {
          continue;
        }
        event.system[index] = { ...part, text: rewriteGhInstructions(part.text) };
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

      const error = await checkGhCommand(command);
      if (error) {
        throw new Error(error);
      }
    });
  },
};

export default plugin;
