import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createReadToolDefinition,
  type ReadToolInput,
} from "@earendil-works/pi-coding-agent";
import path from "node:path";

function pathSegments(filePath: string): string[] {
  return path
    .normalize(filePath)
    .split(path.sep)
    .filter((segment) => segment.length > 0);
}

export function isWithinSkillsDirectory(
  cwd: string,
  filePath: string,
): boolean {
  const absolutePath = path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(cwd, filePath);

  return pathSegments(absolutePath).includes("skills");
}

export function normalizeReadInputForSkillsPath(
  cwd: string,
  input: ReadToolInput,
): ReadToolInput {
  if (!isWithinSkillsDirectory(cwd, input.path)) {
    return input;
  }

  return {
    path: input.path,
  };
}

export default function readSkillsFullExtension(pi: ExtensionAPI) {
  const cwd = process.cwd();
  const originalRead = createReadToolDefinition(cwd);

  pi.registerTool({
    ...originalRead,
    async execute(toolCallId, params: ReadToolInput, signal, onUpdate, ctx) {
      return originalRead.execute(
        toolCallId,
        normalizeReadInputForSkillsPath(ctx?.cwd ?? cwd, params),
        signal,
        onUpdate,
        ctx,
      );
    },
  });
}
