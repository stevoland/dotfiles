---
name: review-amends
description: Only use when following babysit skill to triage and address PR review comments
metadata:
  opencode/slash: true
---

1. Find the relevant pull request. A link may be provided or find the pr associated with the bookmark at `@-`. If the current commit is not empty or the parent commit does not have a bookmark, inform the user and STOP.

2. Fetch the unresolved PR comments

   Use the GraphQL `pullRequest.reviewThreads` connection to find inline review comments and filter for `isResolved: false`. `gh pr view --json reviews,comments` does not include these threads. Keep the thread node ID (`PRRT...`) separate from the comment node ID (`PRRC...`).

   If `gh api graphql -f query=...` reports a parser error at `!` in an otherwise valid variable declaration such as `String!`, use literal owner, repository, and PR values in the query instead. This avoids the shell/form-field parsing problem encountered with inline GraphQL variable declarations.

   Reply with `addPullRequestReviewThreadReply` using `pullRequestReviewThreadId`, not `inReplyTo` or a comment ID:

   ```bash
   gh api graphql -f query='mutation { addPullRequestReviewThreadReply(input: { body: "...", pullRequestReviewThreadId: "PRRT..." }) { comment { url } } }'
   ```

3. **Triage the feedback:** Consider everything medium severity and beyond. Only consider low severity issue if they're a DRY violation or if there are other issues to fix already. Strictly skip suggestions/low severity issue if they're the only ones remaining, and they qualify under super minor (nit) or rare edge case.

4. If there are any comments to address, check if in the default jj workspace. If so, create a new jj workspace: `<bookmark_name>-amends` and do the work there.

5. Group comments into amends. Each independently actionable fix is one amend; comments describing the same root cause may share one amend. A review may require multiple amends and therefore multiple commits.

   For each amend:

   1. Verify the working-copy commit is empty and has no bookmark, and its parent carries the PR bookmark. Stop if this boundary is not present.
   2. Make only that amend, using your judgement rather than blindly applying the suggested change.
   3. Describe the commit, advance the PR bookmark to it, push it, and reply to every associated thread with what changed, why, and a link to that commit.
   4. Immediately run `jj new <bookmark>` and verify the new working-copy commit is empty and unbookmarked, its parent is the pushed amend commit, and its parent carries the PR bookmark.

   Repeat the full sequence for every amend. The final empty-child checkpoint is mandatory too. Never make a later amend by editing a pushed amend commit.

6. For each comment skipped, reply with a brief explanation of why it was skipped. Do not resolve the comment.

7. Assign the PR to me for manual review.

8. Write a summary of your work with links to your comments.
