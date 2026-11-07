import { expect, test } from "bun:test";

import { annotateSkillContent, checkGhCommand, rewriteGhInstructions } from "./index";

test("rewrites gh cli instructions to the GitHub API tools", () => {
  const text =
    "You will not be able to fetch eeveebank github urls - Use `gh` cli commands to interact with eeveebank github.";
  const rewritten = rewriteGhInstructions(text);
  expect(rewritten).not.toContain("`gh` cli");
  expect(rewritten).toContain(
    "Use the GitHub API tools via `execute` (`tools.github.*` REST, `tools.githubGraphql.*` GraphQL) to interact",
  );
  expect(rewriteGhInstructions("prefer the gh CLI here")).toBe("prefer the gh CLI here");
});

test("annotates skills that run gh commands, once", () => {
  const content = "Run `gh pr view --json url` to get the link.";
  const annotated = annotateSkillContent(content);
  expect(annotated).toStartWith("> NOTE: The `gh` CLI is blocked");
  expect(annotated).toEndWith(content);
  expect(annotateSkillContent(annotated)).toBe(annotated);
  expect(annotateSkillContent("no github here, see ~/.config/gh")).toBe(
    "no github here, see ~/.config/gh",
  );
});

test("blocks gh invocations", async () => {
  for (const command of [
    "gh pr view 123",
    "gh api repos/eeveebank/foo",
    "/opt/homebrew/bin/gh pr list",
    "cd repo && gh pr create --fill",
    "echo $(gh pr view --json url)",
    "'gh' auth status",
  ]) {
    expect(await checkGhCommand(command)).toContain("gh CLI is disabled");
  }
});

test("allows commands that only mention gh", async () => {
  for (const command of [
    'echo "gh pr view"',
    "grep -r gh src",
    "ls ~/.config/gh",
    "ghq list",
    "jj log",
  ]) {
    expect(await checkGhCommand(command)).toBeNull();
  }
});
