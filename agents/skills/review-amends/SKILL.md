---
name: review-amends
description: Triage and address PR review comments
disable-model-invocation: true
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

4. For each comment which should be addressed - make necessary changes to address the comment - use your judgement. This might not be the change suggested. Commit, advance the jj bookmark, push and reply to the comment with what you did and why including a link to the commit.

5. For each comment skipped: reply with a brief explaination of your reasons to skip. Do not resolve the comment.

6. Assign the PR to me for manual review.

7. Write a summary of your work with links to your comments.
