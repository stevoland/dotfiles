import { describe, it, expect, beforeEach } from "bun:test";
import { BoxPlugin } from "../opencode-plugin-box";

// Minimal mock types
type MockExec = {
  stdout: Buffer;
  stderr: Buffer;
};

type MockClient = {
  tui: {
    showToast: () => Promise<void>;
  };
};

const createMockExec = (stdout: string, stderr = ""): MockExec => ({
  stdout: Buffer.from(stdout),
  stderr: Buffer.from(stderr),
});

const createMock$ = (execResult: MockExec) => {
  const chain = {
    nothrow: () => chain,
    quiet: () => Promise.resolve(execResult),
  };
  return () => chain;
};

const createMockClient = (): MockClient => ({
  tui: {
    showToast: async () => {},
  },
});

const makePatch = (files: string[]): string => {
  const lines = ["*** Begin Patch"];
  for (const f of files) {
    lines.push(`*** Add File: ${f}`);
    lines.push("content");
  }
  lines.push("*** End Patch");
  return lines.join("\n");
};

describe("BoxPlugin tool.execute.before apply_patch", () => {
  const projectRoot = "/project";

  beforeEach(() => {
    process.env.SHELL = "/path/to/opencode-shell";
  });

  it("allows patch when all touched paths are allowlisted", async () => {
    const config = {
      filesystem: {
        denyRead: [],
        allowWrite: ["/project/allowed"],
        denyWrite: [],
      },
      network: { allowedDomains: [], deniedDomains: [] },
    };

    const plugin = await BoxPlugin({
      client: createMockClient(),
      $: createMock$(createMockExec(JSON.stringify(config))),
      directory: projectRoot,
      worktree: projectRoot,
    });

    const hook = plugin["tool.execute.before"];
    expect(hook).toBeDefined();

    // Should not throw
    await hook!(
      { tool: "apply_patch" },
      { args: { patchText: makePatch(["allowed/a.txt"]) } },
    );
  });

  it("blocks patch when a touched path is not allowlisted", async () => {
    const config = {
      filesystem: {
        denyRead: [],
        allowWrite: ["/project/allowed"],
        denyWrite: [],
      },
      network: { allowedDomains: [], deniedDomains: [] },
    };

    const plugin = await BoxPlugin({
      client: createMockClient(),
      $: createMock$(createMockExec(JSON.stringify(config))),
      directory: projectRoot,
      worktree: projectRoot,
    });

    const hook = plugin["tool.execute.before"];
    expect(hook).toBeDefined();

    await expect(
      hook!(
        { tool: "apply_patch" },
        { args: { patchText: makePatch(["blocked/b.txt"]) } },
      ),
    ).rejects.toThrow("apply_patch: Write operation not permitted");

    await expect(
      hook!(
        { tool: "apply_patch" },
        { args: { patchText: makePatch(["blocked/b.txt"]) } },
      ),
    ).rejects.toThrow("blocked/b.txt");
  });

  it("denyWrite overrides allowWrite", async () => {
    const config = {
      filesystem: {
        denyRead: [],
        allowWrite: ["/project/allowed"],
        denyWrite: ["/project/allowed/secret"],
      },
      network: { allowedDomains: [], deniedDomains: [] },
    };

    const plugin = await BoxPlugin({
      client: createMockClient(),
      $: createMock$(createMockExec(JSON.stringify(config))),
      directory: projectRoot,
      worktree: projectRoot,
    });

    const hook = plugin["tool.execute.before"];
    expect(hook).toBeDefined();

    await expect(
      hook!(
        { tool: "apply_patch" },
        { args: { patchText: makePatch(["allowed/secret/s.txt"]) } },
      ),
    ).rejects.toThrow("allowed/secret/s.txt");
  });

  it("rejects missing patchText", async () => {
    const config = {
      filesystem: {
        denyRead: [],
        allowWrite: ["/project/allowed"],
        denyWrite: [],
      },
      network: { allowedDomains: [], deniedDomains: [] },
    };

    const plugin = await BoxPlugin({
      client: createMockClient(),
      $: createMock$(createMockExec(JSON.stringify(config))),
      directory: projectRoot,
      worktree: projectRoot,
    });

    const hook = plugin["tool.execute.before"];
    expect(hook).toBeDefined();

    await expect(hook!({ tool: "apply_patch" }, { args: {} })).rejects.toThrow(
      "patchText is required",
    );
  });
});
