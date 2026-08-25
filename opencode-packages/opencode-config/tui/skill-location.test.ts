import { describe, expect, test } from "bun:test"
import { formatSkillLocation, sortSkillRows } from "./skill-location.js"

describe("formatSkillLocation", () => {
  test("keeps the project and skill directory while omitting the full path", () => {
    expect(
      formatSkillLocation("~/workspace/github.com/eeveebank/pring/.agents/skills/review/SKILL.md"),
    ).toBe("pring/.agents")
  })

  test("normalizes Windows separators", () => {
    expect(formatSkillLocation("C:\\workspace\\pring\\.agents\\skills\\review\\SKILL.md")).toBe(
      "pring/.agents",
    )
  })

  test("leaves short locations unchanged", () => {
    expect(formatSkillLocation(".agents/skills/review/SKILL.md")).toBe(".agents")
  })
})

describe("sortSkillRows", () => {
  const rows = [
    { skill: { name: "zulu" }, normalizedLocation: "pring/.agents" },
    { skill: { name: "alpha" }, normalizedLocation: "~/.agents" },
    { skill: { name: "bravo" }, normalizedLocation: "pring/.agents" },
  ]

  test("sorts by normalized location and uses skill name as a tie-breaker", () => {
    expect(sortSkillRows(rows, "location").map((row) => row.skill.name)).toEqual(["bravo", "zulu", "alpha"])
  })

  test("sorts by skill name", () => {
    expect(sortSkillRows(rows, "name").map((row) => row.skill.name)).toEqual(["alpha", "bravo", "zulu"])
  })
})
