import assert from "node:assert/strict";
import test from "node:test";
import {
  isWithinSkillsDirectory,
  normalizeReadInputForSkillsPath,
} from "./index";

test("detects paths nested under a skills directory", () => {
  assert.equal(
    isWithinSkillsDirectory("/workspace", "agent/skills/build-skill/SKILL.md"),
    true,
  );
  assert.equal(
    isWithinSkillsDirectory("/workspace", "/workspace/.pi/skills/foo/SKILL.md"),
    true,
  );
});

test("does not match paths outside skills directories", () => {
  assert.equal(
    isWithinSkillsDirectory("/workspace", "agent/extensions/skill-helper.ts"),
    false,
  );
});

test("strips offset and limit for skills paths", () => {
  assert.deepEqual(
    normalizeReadInputForSkillsPath("/workspace", {
      path: "agent/skills/build-skill/SKILL.md",
      offset: 200,
      limit: 50,
    }),
    {
      path: "agent/skills/build-skill/SKILL.md",
    },
  );
});

test("preserves offset and limit outside skills paths", () => {
  assert.deepEqual(
    normalizeReadInputForSkillsPath("/workspace", {
      path: "agent/extensions/feedback.ts",
      offset: 20,
      limit: 10,
    }),
    {
      path: "agent/extensions/feedback.ts",
      offset: 20,
      limit: 10,
    },
  );
});
