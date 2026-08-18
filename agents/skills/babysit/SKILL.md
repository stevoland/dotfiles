---
name: babysit
description: 'Babysit a draft GitHub pull request until it is ready for human review by relentlessly polling status and only acting once copilot review has finished. Never opens or merges the PR.'
---

# Babysit PR

Your job is to babysit this PR until it is **ready for human review** - reviewed by Copilot, addressed, verified, and CI green. Keep it as a draft and assign it to the current user. The human decides when to open and merge it.

Create the PR as a draft (or pick up the one just created and ensure it is a draft), then capture its current head commit and request a review from copilot if that head has not already been reviewed (`gh pr edit <pr_url> --add-reviewer "@copilot"`).

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

## Amend commit boundaries

Each amend gets exactly one new commit. A Copilot review may require multiple amends and therefore multiple commits. Treat independently actionable fixes as separate amends; threads describing the same root cause may share one amend.

Before starting an amend, verify that the amend workspace has an empty working-copy commit whose parent carries the PR bookmark. Make only that amend in the empty commit, describe it, advance the bookmark to it, push it, and reply to its review thread with that commit's link.

Immediately after every successful amend push, run `jj new <bookmark>` in the amend workspace. Before starting another amend or polling again, verify that:

- the new working-copy commit is empty and has no bookmark;
- its parent is the pushed amend commit; and
- the parent carries the PR bookmark.

Repeat this commit, push, reply, and checkpoint sequence for every amend from the review. The checkpoint is mandatory after the final amend too. It prevents the next amend, whether from the same review or a later review, from rewriting the previous amend commit.

Once every amend from the review is pushed and the final empty child checkpoint exists, capture the new GitHub head commit, request another review from copilot, and repeat the bounded polling protocol. Never let a review of the previous head satisfy the new review cycle.

Repeat until there is no more work to be done.

## Finish state

Assign the PR to the current user with `gh pr edit <pr_url> --add-assignee "@me"`. Verify the final head has a completed Copilot review, CI is green, and `isDraft` is `true`. If the PR is not a draft, return it to draft with `gh pr ready <pr_url> --undo`. Never call `gh pr ready` without `--undo`.
