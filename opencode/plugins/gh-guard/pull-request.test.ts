import { expect, test } from "bun:test";

import { formatFooter, isPullRequestWrite, withFooter } from "./pull-request";

test("formats the footer with session, agent and model#variant", () => {
  expect(
    formatFooter({ sessionID: "ses_1", agent: "build", model: { id: "claude-opus-5.5", variant: "high" } }),
  ).toBe("<sub>ses_1 | build | claude-opus-5.5#high</sub>");
  expect(formatFooter({ sessionID: "ses_1", agent: "build", model: { id: "gpt-5" } })).toBe(
    "<sub>ses_1 | build | gpt-5</sub>",
  );
});

test("appends the footer, replacing a previous one", () => {
  const footer = "<sub>ses_2 | build | gpt-5#low</sub>";
  expect(withFooter("Fixes the thing", footer)).toBe(`Fixes the thing\n\n${footer}`);
  expect(withFooter("Fixes the thing\n\n<sub>ses_1 | plan | gpt-5</sub>\n", footer)).toBe(
    `Fixes the thing\n\n${footer}`,
  );
  expect(withFooter("", footer)).toBe(footer);
  expect(withFooter("Uses <sub>small text</sub> inline", footer)).toBe(
    `Uses <sub>small text</sub> inline\n\n${footer}`,
  );
});

test("matches pull request writes from the GitHub API tools only", () => {
  expect(isPullRequestWrite("api", ["github POST /repos/{owner}/{repo}/pulls"])).toBe(true);
  expect(isPullRequestWrite("api", ["github PATCH /repos/{owner}/{repo}/pulls/{pull_number}"])).toBe(true);
  expect(isPullRequestWrite("api", ["githubGraphql mutation createPullRequest"])).toBe(true);
  expect(isPullRequestWrite("api", ["githubGraphql mutation updatePullRequest"])).toBe(true);
  expect(isPullRequestWrite("api", ["github POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews"])).toBe(false);
  expect(isPullRequestWrite("pr_create", ["eeveebank/foo"])).toBe(false);
});
