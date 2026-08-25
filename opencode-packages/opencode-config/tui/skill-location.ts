/** The available skill list sort modes. */
export type SkillSortMode = "name" | "location"

type SortableSkillRow = {
  readonly skill: { readonly name: string }
  readonly normalizedLocation: string
}

/** Formats a skill location as its final two path components. */
export function formatSkillLocation(location: string): string {
  const skillDirectory = location.replace(/[/\\]skills[/\\][^/\\]+[/\\]SKILL\.md$/i, "")
  const components = skillDirectory.split(/[\\/]/).filter(Boolean)
  return components.slice(-2).join("/")
}

/** Sorts skills by name or normalized location, using name to make ties stable. */
export function sortSkillRows<T extends SortableSkillRow>(rows: readonly T[], mode: SkillSortMode): T[] {
  return rows.slice().sort((left, right) => {
    if (mode === "name") return left.skill.name.localeCompare(right.skill.name)
    return compareSortText(left.normalizedLocation, right.normalizedLocation) || left.skill.name.localeCompare(right.skill.name)
  })
}

function compareSortText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
