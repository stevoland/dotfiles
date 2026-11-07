import { expect, test } from "bun:test";

import { decideGithubWrite } from "./github-write-permissions";

const eeveebank = { args: { owner: "eeveebank", repo: "pring", issue_number: 190 } };
const allow = { effect: "allow" };

test("allows everyday eeveebank writes from the GitHub REST tools", () => {
  for (const resource of [
    "github POST /repos/{owner}/{repo}/issues",
    "github PATCH /repos/{owner}/{repo}/issues/{issue_number}",
    "github POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues",
    "github POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by",
    "github POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
    "github POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs",
  ]) {
    expect(decideGithubWrite({ action: "api", resources: [resource], metadata: eeveebank })).toEqual(allow);
  }
});

test("asks for allow-listed REST writes on other or missing owners", () => {
  const resources = ["github POST /repos/{owner}/{repo}/issues"];
  expect(decideGithubWrite({ action: "api", resources, metadata: { args: { owner: "someone-else" } } })).toBeUndefined();
  expect(decideGithubWrite({ action: "api", resources, metadata: { args: {} } })).toBeUndefined();
  expect(decideGithubWrite({ action: "api", resources })).toBeUndefined();
});

test("asks for writes that aren't allow-listed", () => {
  for (const resource of [
    "github PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
    "github DELETE /repos/{owner}/{repo}/labels/{name}",
    "github POST /repos/{owner}/{repo}/releases",
  ]) {
    expect(decideGithubWrite({ action: "api", resources: [resource], metadata: eeveebank })).toBeUndefined();
  }
  expect(decideGithubWrite({ action: "api", resources: [], metadata: eeveebank })).toBeUndefined();
  expect(
    decideGithubWrite({ action: "pr_create", resources: ["github POST /repos/{owner}/{repo}/issues"], metadata: eeveebank }),
  ).toBeUndefined();
});

test("allows low-risk GraphQL mutations for any owner", () => {
  expect(decideGithubWrite({ action: "api", resources: ["githubGraphql mutation resolveReviewThread"] })).toEqual(allow);
  expect(decideGithubWrite({ action: "api", resources: ["githubGraphql mutation closeIssue"] })).toBeUndefined();
});

test("denies writes that duplicate git commands, for any owner", () => {
  for (const resource of [
    "github POST /repos/{owner}/{repo}/git/commits",
    "github PATCH /repos/{owner}/{repo}/git/refs/{ref}",
    "github PUT /repos/{owner}/{repo}/contents/{path}",
    "github POST /repos/{owner}/{repo}/merges",
    "githubGraphql mutation createCommitOnBranch",
  ]) {
    expect(decideGithubWrite({ action: "api", resources: [resource], metadata: eeveebank })?.effect).toBe("deny");
    expect(decideGithubWrite({ action: "api", resources: [resource] })?.effect).toBe("deny");
  }
});
