import { expect, test } from "bun:test";

import { checkJJInteractiveCommands } from "./index";

test("allows help flags on guarded jj commands", async () => {
  for (const command of [
    "jj diffedit -h",
    "jj squash --help",
    "jj split --help",
    "jj resolve -h",
    "jj describe --help",
    "jj commit -h",
    "jj diffedit '--help'",
    "jj diffedit $'-h'",
  ]) {
    expect(await checkJJInteractiveCommands(command)).toBeNull();
  }
});

test("keeps blocking interactive jj commands without help flags", async () => {
  expect(await checkJJInteractiveCommands("jj diffedit")).toContain(
    "always opens a diff editor",
  );
  expect(await checkJJInteractiveCommands("jj describe")).toContain(
    "without -m opens an editor",
  );
});

test("scopes help flags to their parsed jj command", async () => {
  expect(
    await checkJJInteractiveCommands("jj status --help && jj diffedit"),
  ).toContain("always opens a diff editor");
  expect(
    await checkJJInteractiveCommands("jj diffedit --message='--help'"),
  ).toContain("always opens a diff editor");
  expect(
    await checkJJInteractiveCommands("jj diffedit -- --help"),
  ).toContain("always opens a diff editor");
});

test("finds jj commands inside shell substitutions, not quoted text", async () => {
  expect(await checkJJInteractiveCommands('echo "jj diffedit --help"')).toBe(
    null,
  );
  expect(await checkJJInteractiveCommands("echo $(jj diffedit)")).toContain(
    "always opens a diff editor",
  );
});
