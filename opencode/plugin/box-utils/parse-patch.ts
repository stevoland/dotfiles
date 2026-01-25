export namespace Patch {
  function parsePatchHeader(
    lines: string[],
    startIdx: number,
  ): { filePath: string; movePath?: string; nextIdx: number } | null {
    const line = lines[startIdx];

    if (!line) {
      return null;
    }

    if (line.startsWith("*** Add File:")) {
      const filePath = line.split(":", 2)[1]?.trim();
      return filePath ? { filePath, nextIdx: startIdx + 1 } : null;
    }

    if (line.startsWith("*** Delete File:")) {
      const filePath = line.split(":", 2)[1]?.trim();
      return filePath ? { filePath, nextIdx: startIdx + 1 } : null;
    }

    if (line.startsWith("*** Update File:")) {
      const filePath = line.split(":", 2)[1]?.trim();
      let movePath: string | undefined;
      let nextIdx = startIdx + 1;

      // Check for move directive
      if (
        nextIdx < lines.length &&
        lines[nextIdx]?.startsWith("*** Move to:")
      ) {
        movePath = lines[nextIdx]?.split(":", 2)[1]?.trim();
        nextIdx++;
      }

      return filePath ? { filePath, movePath, nextIdx } : null;
    }

    return null;
  }

  function parseUpdateFileChunks(
    lines: string[],
    startIdx: number,
  ): { nextIdx: number } {
    let i = startIdx;

    while (i < lines.length && !lines[i]?.startsWith("***")) {
      if (lines[i]?.startsWith("@@")) {
        i++;

        // Parse change lines
        while (
          i < lines.length &&
          !lines[i]?.startsWith("@@") &&
          !lines[i]?.startsWith("***")
        ) {
          const changeLine = lines[i];

          if (changeLine === "*** End of File") {
            i++;
            break;
          }

          i++;
        }
      } else {
        i++;
      }
    }

    return { nextIdx: i };
  }

  function parseAddFileContent(
    lines: string[],
    startIdx: number,
  ): { nextIdx: number } {
    let content = "";
    let i = startIdx;

    while (i < lines.length && !lines[i]?.startsWith("***")) {
      i++;
    }

    // Remove trailing newline
    if (content.endsWith("\n")) {
      content = content.slice(0, -1);
    }

    return { nextIdx: i };
  }

  function stripHeredoc(input: string): string {
    // Match heredoc patterns like: cat <<'EOF'\n...\nEOF or <<EOF\n...\nEOF
    const heredocMatch = input.match(
      /^(?:cat\s+)?<<['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*$/,
    );
    if (heredocMatch && heredocMatch[2]) {
      return heredocMatch[2];
    }
    return input;
  }

  export function parseFilePaths(patchText: string): string[] {
    const cleaned = stripHeredoc(patchText.trim());
    const lines = cleaned.split("\n");
    const paths: string[] = [];
    let i = 0;

    const beginMarker = "*** Begin Patch";
    const endMarker = "*** End Patch";

    const beginIdx = lines.findIndex((line) => line.trim() === beginMarker);
    const endIdx = lines.findIndex((line) => line.trim() === endMarker);

    if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) {
      throw new Error("Invalid patch format: missing Begin/End markers");
    }

    i = beginIdx + 1;

    while (i < endIdx) {
      const header = parsePatchHeader(lines, i);
      const line = lines[i];
      if (!header || !line) {
        i++;
        continue;
      }

      if (line.startsWith("*** Add File:")) {
        const { nextIdx } = parseAddFileContent(lines, header.nextIdx);
        paths.push(header.filePath);
        i = nextIdx;
      } else if (line.startsWith("*** Delete File:")) {
        paths.push(header.filePath);
        i = header.nextIdx;
      } else if (line.startsWith("*** Update File:")) {
        const { nextIdx } = parseUpdateFileChunks(lines, header.nextIdx);
        paths.push(header.filePath);
        if (header.movePath) {
          paths.push(header.movePath);
        }
        i = nextIdx;
      } else {
        i++;
      }
    }

    return paths;
  }
}
