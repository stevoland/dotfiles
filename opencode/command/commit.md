---
description: Create git commits for session changes with clear, atomic messages
model: github-copilot/claude-haiku-4.5
---

# Commit Changes

You are tasked with creating git commits for the changes made during this session.

## Process:

1. **Think about what changed:**
   - Review the conversation history and understand what was accomplished
   - Run `git status` to see current changes
   - Run `git diff` to understand the modifications
   - Consider whether changes should be one commit or multiple logical commits

2. **Check if you need to create a branch first:**
   - `git rev-parse --abbrev-ref HEAD` to get the current branch name
   - Only if it is "master", "main", "dev" or another popular trunk branch name then:
     `git checkout -b <new-branch-name>` to create a branch

3. **Plan your commit(s):**
   - Identify which files belong together
   - Draft clear, descriptive commit messages
   - Use imperative mood in commit messages
   - Focus on why the changes were made, not just what

4. **Execute:**
   - Use `git add` with specific files (never use `-A` or `.`)
   - Never commit dummy files, test scripts, or other files which you created or which appear to have been created but which were not part of your changes or directly caused by them (e.g. generated code)
   - Create commits with your planned messages until all of your changes are committed with `git commit -m`

## Conventional commit types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `chore`: Misc change

## Rules:

1. Use lowercase for the type
2. No scope (e.g., use `feat:`)
3. Use imperative mood ("add" not "added")

## Remember:

- You have the full context of what was done in this session
- Group related changes together
- Keep commits focused and atomic when possible
- The user trusts your judgment - they asked you to commit
- **IMPORTANT**: - never stop and ask for feedback from the user.
- Use conventional commit messages with these scopes: `chore:`, `fix:`, `feat:`, `docs:`
