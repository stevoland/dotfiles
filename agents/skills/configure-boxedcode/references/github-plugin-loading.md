# Loading BoxedCode plugins from GitHub

Verified with OpenCode V2 `2.0.25` on 2026-10-08. Check current V2 docs when versions change.

## Package without Git preparation

Export source directly: ignored `dist/` files are absent from a Git checkout.

```json
{
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "files": ["src/**/*.ts", "!src/**/*.test.ts", "README.md"],
  "scripts": { "compile": "tsc -p tsconfig.build.json" }
}
```

For source-only packages, omit scripts named `build`, `prepare`, `prepack`, `preinstall`, `install`, and `postinstall`. Pacote checks these names to decide whether to prepare Git dependencies, including `build` even though it is not a lifecycle hook. Use `compile` for optional compilation instead.

OpenCode's `ignoreScripts: true` does not prevent that Git preparation subprocess. Installation failed with `git dep preparation failed` until the triggering script names were removed; the CLI did not expose the underlying subprocess failure.

## Load and verify

Push the branch first. Private repositories require existing GitHub/Git access.

```sh
opencode plugin add 'github:stevoland/grounding#stevo/grounding-plugin'
opencode plugin list
opencode api plugin.list
```

The global `plugins` entry is `github:stevoland/grounding#stevo/grounding-plugin`. Replace the previous local entry while preserving unrelated configuration. Verify exactly one matching plugin with `state.status: active`, `source.type: package`, the GitHub target and expected commit revision.

Branch references do not automatically install new revisions. Run `opencode plugin update '<GitHub target>'` to update, or use a full commit SHA after `#` to pin a revision.

Sources: [V2 plugin installation](https://opencode.ai/v2/docs/plugins), [source package exports](https://opencode.ai/v2/docs/build/plugins), and [Pacote 21.5.1 `GitFetcher.#prepareDir`](https://github.com/npm/pacote/blob/v21.5.1/lib/git.js).
