---
name: babysit
description: 'Use when asked to babysit, monitor, or shepherd a draft GitHub pull request. Request Copilot review first, then poll until the current head has a completed Copilot review, all feedback is addressed, and CI is green. Never opens or merges the PR.'
metadata:
  opencode/slash: true
---

# Babysit PR

Your job is to babysit this PR until it is **ready for human review** - reviewed by Copilot, addressed, verified, and CI green. Keep it as a draft and assign it to the current user. The human decides when to open and merge it.

## Mandatory first action

The first PR mutation is the Copilot review request. Do this before checking CI, reporting status, or waiting:

1. Resolve the PR URL and repository, and capture `headRefOid`.
2. Ensure the PR is a draft and assigned to the current user.
3. Inspect `reviewRequests` and `reviews` for that head. If there is no completed Copilot review for the current `headRefOid`, request one immediately with `gh pr edit <pr_url> --add-reviewer "@copilot"`.
4. Run a fresh PR lookup and verify that Copilot is either requested or has already submitted a review for the captured head.

The invocation is incomplete until this gate has passed. A CI-only status check is not a babysit completion.

## Polling protocol

Relentlessly poll until copilot has submitted a review for the current head commit, but keep every tool call bounded:

1. Run one status lookup per tool call. Never start an unbounded shell loop or background poller.
2. Fail the command immediately if the `gh` lookup fails; a failed lookup is not a pending review.
3. Inspect a fresh `gh pr view --json headRefOid,reviewRequests,reviews` response on every lookup. Scan all reviews; response order is not significant. Compare each copilot review's `commit.oid` with `headRefOid`. A review of an earlier head is stale.
4. If the current head is still pending, use a bounded wait of at most 30 seconds before the next lookup. Each tool call must return after that lookup.
5. Copilot is complete only when a review authored by `copilot-pull-request-reviewer` has a non-null `submittedAt` and its `commit.oid` equals the current head commit.
6. Treat user interruptions and GitHub review links as new status evidence, not as reasons to reuse the previous polling result. Query a supplied review URL or ID, then run a fresh PR lookup. If no current-head review appears, wait up to 10 seconds and look up the PR once more before reporting that the review is missing or stale; GitHub may publish the review between polls or expose it with brief eventual consistency.

After completion, fetch unresolved inline threads through `pullRequest.reviewThreads`; the review summary alone is not the feedback.

`jj workspace add` workspaces may not contain `.git`, so `gh` cannot infer the repository there. Capture `OWNER/REPO` before creating or entering an amends workspace, and pass `--repo OWNER/REPO` to every repository-dependent `gh` command.

Follow the "review-amends" skill.

Once "review-amends" completes, capture the new GitHub head commit, request another review from copilot as the mandatory first action for the new head, and repeat the bounded polling protocol. Never let a review of the previous head satisfy the new review cycle.

Repeat until there is no more work to be done.

## Finish state

Assign the PR to the current user with `gh pr edit <pr_url> --add-assignee "@me"`. Verify the final head has a completed Copilot review, CI is green, and `isDraft` is `true`. If the PR is not a draft, return it to draft with `gh pr ready <pr_url> --undo`. Never call `gh pr ready` without `--undo`.
