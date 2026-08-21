---
name: wr
description: Finish the current task end-to-end with commit, push, draft PR
---
Wrap it.

Additional instructions: $ARGUMENTS

Only push work you did. Leave other changes in the working copy commit: `@`.

For large changes Use `jj-hunk` cli to split your changes into atomic commits.

Describe each commit with a single line message with conventional commit tag. Include ticket number if there is one.

Bookmark, push and create draft PR with the `rk` cli, eg:
`rk submit <bookmark-name> --revision <revision> --title "PR title" --body "PR description"`

<revision> is the last commit of the change, usually `@-`.

Example:

```bash
   rk submit my-change \
     --revision @- \
     --title "chore: short description #23" \
     --body "$(cat <<'EOF'
The intention/motivation for the change.
Make this useful for the reviewer and git archeaologists.

### Changes

Detailed summary of the change

### Validation

Steps taken to validate the quality of the change
EOF
   )"
```
