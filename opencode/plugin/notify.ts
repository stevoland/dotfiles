import type { Plugin } from "@opencode-ai/plugin";

const SOUNDS = {
  success: "/System/Library/Sounds/Glass.aiff",
  error: "/System/Library/Sounds/Basso.aiff",
  complete: "/System/Library/Sounds/Ping.aiff",
};

async function playSound(sound: keyof typeof SOUNDS): Promise<void> {
  try {
    Bun.spawn(["afplay", SOUNDS[sound]], {
      stdout: "ignore",
      stderr: "ignore",
    });
  } catch {}
}

import { homedir } from "os";
import { join } from "path";

export const NotifyPlugin: Plugin = async ({ $, client }) => {
  const soundPath = join(
    homedir(),
    ".config/opencode/sounds/gow_active_reload.mp3"
  );

  // Check if a session is a main (non-subagent) session
  const isMainSession = async (sessionID: string) => {
    try {
      const result = await client.session.get({ path: { id: sessionID } });
      const session = result.data ?? result;
      return !session.parentID;
    } catch {
      // If we can't fetch the session, assume it's main to avoid missing notifications
      return true;
    }
  };

  return {
    event: async ({ event }) => {
      // Only notify for main session events, not background subagents
      if (event.type === "session.idle") {
        const sessionID = event.properties.sessionID;
        if (await isMainSession(sessionID)) {
          await playSound("success");
        }
      }

      // Permission prompt created
      // if (event.type === "permission.replied") {
      //   await playSound("complete");
      // }
    },
  };
};
