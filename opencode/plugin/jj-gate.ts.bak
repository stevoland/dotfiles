import type { Plugin, PluginInput } from "@opencode-ai/plugin";

const MODIFYING_TOOLS = new Set([
  "write",
  "edit",
  "lsp_rename",
  "lsp_code_action_resolve",
  "ast_grep_replace",
  "apply_patch",
  "multiedit",
]);

// Session state: track if gate was opened (edits were allowed) this session
const sessionState = new Map<string, { gateOpened: boolean }>();

async function getCurrentDescription($: PluginInput["$"]): Promise<string> {
  try {
    return (await $`jj log -r @ --no-graph -T description`.text()).trim();
  } catch {
    return "";
  }
}

async function isJJRepo($: PluginInput["$"]): Promise<boolean> {
  try {
    await $`jj root`.text();
    return true;
  } catch {
    return false;
  }
}

async function isSubagent(
  client: PluginInput["client"],
  sessionID: string,
): Promise<boolean> {
  try {
    const session = await client.session.get({ path: { id: sessionID } });
    return !!session.data?.parentID;
  } catch {
    return false;
  }
}

const plugin: Plugin = async ({ $, client }) => {
  const enable = await isJJRepo($);
  if (!enable) {
    return {};
  }

  return {
    "tool.execute.before": async ({ tool: toolName, sessionID }) => {
      if (!MODIFYING_TOOLS.has(toolName)) return;
      if (!(await isJJRepo($))) return;

      const description = await getCurrentDescription($);
      if (description.length > 0) {
        const state = sessionState.get(sessionID) || { gateOpened: false };
        state.gateOpened = true;
        sessionState.set(sessionID, state);
        return;
      }

      const subagent = await isSubagent(client, sessionID);

      if (subagent) {
        throw new Error(
          `BLOCKED: JJ gate is closed.\n\n` +
            `You are a subagent. Return to the parent agent with this message:\n\n` +
            `"Cannot edit files - no JJ change description set. ` +
            `Parent must run: jj describe -m \\"description\\" before delegating file edits."`,
        );
      }

      throw new Error(
        `Describe your intent before editing:\n\n` +
          `    jj describe -m "scope: what you're about to do"\n\n` +
          `Use conventional commit scopes (chore, feat, fix, docs, refactor)\n\n` +
          `When done, run \`jj new\` to commit and start fresh.`,
      );
    },

    event: async ({ event }) => {
      const props = event.properties as Record<string, unknown> | undefined;

      if (event.type === "session.deleted") {
        const sessionID = props?.sessionID as string | undefined;
        if (sessionID) sessionState.delete(sessionID);
        return;
      }

      if (event.type === "session.idle") {
        const sessionID = props?.sessionID as string | undefined;
        if (!sessionID) return;

        if (await isSubagent(client, sessionID)) return;

        const state = sessionState.get(sessionID);
        if (!state?.gateOpened) return;

        if (!(await isJJRepo($))) return;

        const stats = (await $`jj diff --stat`.text()).trim();
        if (!stats || stats.includes("0 files changed")) return;

        const description = await getCurrentDescription($);
        if (!description) return;

        try {
          await $`jj new`.quiet();
          sessionState.set(sessionID, { gateOpened: false });
        } catch {
          // Silent fail - user will see uncommitted work next session
        }
      }
    },
  };
};

export default plugin;
