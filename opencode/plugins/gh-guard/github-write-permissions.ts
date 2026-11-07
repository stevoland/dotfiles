import type { Plugin } from "@opencode/plugin";

type Context = Parameters<Plugin.Plugin["setup"]>[0];

const ALLOWED_OWNER = "eeveebank";

const repo = (method: string, path: string) => `github ${method} /repos/{owner}/{repo}${path}`;
const mutation = (field: string) => `githubGraphql mutation ${field}`;

/**
 * opencode-api-tools permission resources for GitHub writes that don't need repo admin and are easy
 * to undo. Allowed without asking when the call's `owner` is eeveebank.
 */
const EEVEEBANK_ALLOWED_RESOURCES = new Set([
  // Issues
  repo("POST", "/issues"),
  repo("PATCH", "/issues/{issue_number}"),
  repo("POST", "/issues/{issue_number}/comments"),
  repo("PATCH", "/issues/comments/{comment_id}"),
  repo("POST", "/issues/{issue_number}/assignees"),
  repo("DELETE", "/issues/{issue_number}/assignees"),
  repo("POST", "/issues/{issue_number}/labels"),
  repo("PUT", "/issues/{issue_number}/labels"),
  repo("DELETE", "/issues/{issue_number}/labels/{name}"),
  repo("DELETE", "/issues/{issue_number}/labels"),
  repo("POST", "/issues/{issue_number}/sub_issues"),
  repo("DELETE", "/issues/{issue_number}/sub_issue"),
  repo("PATCH", "/issues/{issue_number}/sub_issues/priority"),
  repo("POST", "/issues/{issue_number}/dependencies/blocked_by"),
  repo("DELETE", "/issues/{issue_number}/dependencies/blocked_by/{issue_id}"),
  repo("POST", "/issues/{issue_number}/relates_to"),
  repo("DELETE", "/issues/{issue_number}/relates_to/{issue_id}"),
  repo("POST", "/issues/{issue_number}/issue-field-values"),
  repo("PUT", "/issues/{issue_number}/issue-field-values"),
  repo("DELETE", "/issues/{issue_number}/issue-field-values/{issue_field_id}"),
  repo("PUT", "/issues/comments/{comment_id}/pin"),
  repo("DELETE", "/issues/comments/{comment_id}/pin"),
  repo("POST", "/labels"),
  repo("PATCH", "/labels/{name}"),
  repo("POST", "/milestones"),
  repo("PATCH", "/milestones/{milestone_number}"),
  repo("POST", "/issues/{issue_number}/artifacts"),
  repo("PATCH", "/issues/{issue_number}/artifacts/{artifact_number}"),
  // Pull request reviews
  repo("POST", "/pulls/{pull_number}/reviews"),
  repo("POST", "/pulls/{pull_number}/reviews/{review_id}/events"),
  repo("PUT", "/pulls/{pull_number}/reviews/{review_id}"),
  repo("DELETE", "/pulls/{pull_number}/reviews/{review_id}"),
  repo("POST", "/pulls/{pull_number}/comments"),
  repo("POST", "/pulls/{pull_number}/comments/{comment_id}/replies"),
  repo("PATCH", "/pulls/comments/{comment_id}"),
  repo("POST", "/pulls/{pull_number}/requested_reviewers"),
  repo("DELETE", "/pulls/{pull_number}/requested_reviewers"),
  repo("POST", "/pulls/{pull_number}/requested_reviewers/rerequest"),
  repo("POST", "/pulls/{pull_number}/copilot-code-review"),
  repo("PUT", "/pulls/{pull_number}/update-branch"),
  repo("POST", "/stacks"),
  repo("POST", "/stacks/{stack_number}/add"),
  repo("POST", "/stacks/{stack_number}/unstack"),
  // Reactions
  repo("POST", "/issues/{issue_number}/reactions"),
  repo("DELETE", "/issues/{issue_number}/reactions/{reaction_id}"),
  repo("POST", "/issues/comments/{comment_id}/reactions"),
  repo("DELETE", "/issues/comments/{comment_id}/reactions/{reaction_id}"),
  repo("POST", "/pulls/comments/{comment_id}/reactions"),
  repo("DELETE", "/pulls/comments/{comment_id}/reactions/{reaction_id}"),
  repo("POST", "/comments/{comment_id}/reactions"),
  repo("DELETE", "/comments/{comment_id}/reactions/{reaction_id}"),
  repo("POST", "/releases/{release_id}/reactions"),
  repo("DELETE", "/releases/{release_id}/reactions/{reaction_id}"),
  // Actions and CI
  repo("POST", "/actions/runs/{run_id}/rerun"),
  repo("POST", "/actions/runs/{run_id}/rerun-failed-jobs"),
  repo("POST", "/actions/jobs/{job_id}/rerun"),
  repo("POST", "/actions/runs/{run_id}/cancel"),
  repo("POST", "/actions/workflows/{workflow_id}/dispatches"),
  repo("POST", "/dispatches"),
  repo("POST", "/check-runs/{check_run_id}/rerequest"),
  repo("POST", "/check-suites/{check_suite_id}/rerequest"),
  repo("DELETE", "/actions/caches/{cache_id}"),
  repo("DELETE", "/actions/caches"),
  // Commits and releases
  repo("POST", "/commits/{commit_sha}/comments"),
  repo("PATCH", "/comments/{comment_id}"),
  repo("POST", "/releases/generate-notes"),
  // Notifications
  repo("PUT", "/notifications"),
  repo("PUT", "/subscription"),
  repo("DELETE", "/subscription"),
]);

/** GraphQL mutations take node IDs, not an owner, so these low-risk ones are allowed for any owner. */
const ANY_OWNER_ALLOWED_RESOURCES = new Set([
  mutation("addComment"),
  mutation("addReaction"),
  mutation("resolveReviewThread"),
  mutation("unresolveReviewThread"),
  mutation("addPullRequestReviewThreadReply"),
]);

/** Writes that duplicate local git commands. Denied for any owner. */
const GIT_DUPLICATE_RESOURCES = new Set([
  repo("POST", "/git/blobs"),
  repo("POST", "/git/trees"),
  repo("POST", "/git/commits"),
  repo("POST", "/git/tags"),
  repo("POST", "/git/refs"),
  repo("PATCH", "/git/refs/{ref}"),
  repo("DELETE", "/git/refs/{ref}"),
  repo("POST", "/merges"),
  repo("POST", "/merge-upstream"),
  repo("POST", "/branches/{branch}/rename"),
  repo("PUT", "/contents/{path}"),
  repo("DELETE", "/contents/{path}"),
  mutation("createCommitOnBranch"),
  mutation("createRef"),
  mutation("updateRef"),
  mutation("updateRefs"),
  mutation("deleteRef"),
  mutation("mergeBranch"),
]);

const GIT_DUPLICATE_DENIED =
  "Writing git objects, refs, branches or files through the GitHub API tools is denied. Use jj (or git) locally and push instead.";

interface WriteRequest {
  action: string;
  resources: ReadonlyArray<string>;
  /** opencode-api-tools passes the call's arguments as `args`. */
  metadata?: Record<string, unknown>;
}

type Decision = { effect: "allow" } | { effect: "deny"; message: string } | undefined;

function owner(metadata: Record<string, unknown> | undefined): unknown {
  const args = metadata?.args;
  return args !== null && typeof args === "object" ? (args as Record<string, unknown>).owner : undefined;
}

export function decideGithubWrite(request: WriteRequest): Decision {
  if (request.action !== "api" || request.resources.length === 0) return undefined;
  if (request.resources.some((resource) => GIT_DUPLICATE_RESOURCES.has(resource))) {
    return { effect: "deny", message: GIT_DUPLICATE_DENIED };
  }
  if (request.resources.every((resource) => ANY_OWNER_ALLOWED_RESOURCES.has(resource))) {
    return { effect: "allow" };
  }
  if (
    owner(request.metadata) === ALLOWED_OWNER &&
    request.resources.every((resource) => EEVEEBANK_ALLOWED_RESOURCES.has(resource))
  ) {
    return { effect: "allow" };
  }
  return undefined;
}

export async function registerGithubWritePermissions(context: Context): Promise<void> {
  await context.permission.hook("evaluate", async (event) => {
    if (event.effect === "deny") return;
    const decision = decideGithubWrite(event);
    if (decision === undefined) return;
    event.effect = decision.effect;
    if (decision.effect === "deny") event.message = decision.message;
  });
}
