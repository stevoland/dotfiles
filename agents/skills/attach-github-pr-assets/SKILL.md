---
name: attach-github-pr-assets
description: Upload images, videos, and other files to GitHub and embed or link them in a pull request description or comment. Use whenever you need to upload, host, embed, or link an asset in a PR body or comment.
---

# Attach GitHub PR assets

GitHub has no API for attachment uploads. The upload surface is the comment box on
`https://github.com/stevoland/dotfiles/pull/1`, driven through a signed-in browser. Each upload
yields a `https://github.com/user-attachments/assets/<id>` URL that anyone who can see the target PR
can view. The comment box is scratch space only: the comment is never posted.

Use OpenCode's desktop browser tools (`tools.browser.*`) when they are in the Code Mode catalog;
otherwise `tools["agent-browser"].*`. The steps below use agent-browser.

## 1. Open a signed-in session

Open the upload PR in session `gh-upload` with the saved GitHub login:

```js
const b = tools["agent-browser"]; const session = "gh-upload";
await b.agent_browser_open({ session, url: "https://github.com/stevoland/dotfiles/pull/1",
  restore: "github-stevoland", restoreSave: "always" });
```

Snapshot with `extraArgs: ["-i"]`. Signed in means a `textbox "Comment"` and an
`Attach files` button; `Sign in to comment` means the login is missing or expired.

When signed out, open `https://github.com/login?return_to=%2Fstevoland%2Fdotfiles%2Fpull%2F1` with
`headed: true`, the same `restore` key and `restoreSave: "always"`, then ask the user to sign in as
`stevoland` in that window and wait for their confirmation. Re-open the PR and re-check.

The local Chrome profile (`--profile "Profile 1"` via `extraArgs`) is ignored because the daemon is
reused; the `restore` key is the working path to a persistent login.

**Done when:** the snapshot shows the `Comment` textbox.

## 2. Upload every asset at once

```js
await b.agent_browser_upload({ session, selector: "input[type=file]", files: [/* absolute paths */] });
```

GitHub writes `![Uploading <name>…]()` placeholders, then swaps each for
`<img ... src="https://github.com/user-attachments/assets/<id>">` (or a bare URL for video). Poll the
textarea values with `agent_browser_eval`, waiting ~1s between reads via
`agent_browser_wait({ extraArgs: ["1000"] })`:

```js
[...document.querySelectorAll('textarea')].map(t => t.value).join('\n')
```

**Done when:** the text has one `user-attachments/assets` URL per file and no `Uploading`.

## 3. Clear the scratch box and close

Empty every textarea (set `value = ''`, dispatch a bubbling `input` event) so no draft lingers, then
`agent_browser_close({ session })`. Never click `Comment`.

## 4. Embed in the target PR

- Images: `![description](URL)` with alt text describing what the image proves.
- Before/after or related images: a Markdown table, one image per cell.
- Videos: the bare URL on its own line; GitHub renders a player.
- Other files: `[description](URL)`.

Edit the body through a file: write it under the session temp dir, then
`gh pr edit <number> --body-file <path>` (eeveebank repos are reachable only through `gh`).

**Done when:** `gh pr view <number> --json body -q .body` contains every uploaded URL.
