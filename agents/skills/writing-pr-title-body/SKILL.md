---
name: writing-pr-title-body
description: Use when writing or editing a pull request title or body.
---

invoke the `show-me` skill
dont write essays, dont include that you ran tests. rather, write a concise body. focus on mermaid codeblock diagrams, code samples/snippets (this can be internals, or even sample usage).
layout mermaid flow charts vertically
wrap every mermaid node label in double quotes (`A["label"]`, `B{"label"}`) — GitHub parses `{}`, `()`, `[]`, `:`, `|` inside an unquoted label as shape syntax and refuses to render. write placeholders in words (`metric by slug`) rather than braces
use bullet points for the text you do write. validation/ran tests is not needed
for visual changes (either directly or indirectly) show a table of before and after with uploaded images/videos.
for benchmarks, always show tables of before/after (baseline from target branch), candidate from the PR)
dont add intermediate PR details - e.g. if we reduced PR size from +6k lines to +1k lines, dont even mention it. only the final aggregate squash merge commit is what matters
for commentary
for truly impressive, difficult, or high risk/wide scoped changes you might write the body like a technical blog (again with context, storytelling, code samples/before/after etc diagrams, images whatever.
feel free to use code refs
