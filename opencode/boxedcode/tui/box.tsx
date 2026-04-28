/** @jsxImportSource @opentui/solid */
import { spawn } from 'node:child_process';
import { unwatchFile, watchFile } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Plugin } from '@opencode-ai/plugin/tui';

import {
  type SandboxBehaviour,
  type SandboxState,
  readSandboxState,
  sandboxBehaviours,
  sandboxStatePath,
  updateSandboxState,
} from '../state.ts';

type ControlState = SandboxState & { updating: SandboxBehaviour | undefined };
const settingsPath = join(homedir(), '.nwb', 'box', 'box.json');

function SandboxControls(props: {
  context: Plugin.Context;
  state: ControlState;
  toggle: (behaviour: SandboxBehaviour) => void;
  openSettings: () => void;
}) {
  const theme = () => props.context.theme;

  return (
    <box>
      <text fg={theme().text.default}>
        <b>Sandbox</b>
      </text>
      {sandboxBehaviours.map((behaviour) => (
        <text
          fg={props.state[behaviour] ? theme().text.default : theme().text.feedback.error.default}
          onMouseDown={() => props.toggle(behaviour)}
        >
          <span
            style={{
              fg: props.state[behaviour]
                ? theme().text.feedback.success.default
                : theme().text.feedback.error.default,
            }}
          >
            •
          </span>{' '}
          {behaviour.padEnd(10)}{' '}
          <span style={{ fg: theme().text.subdued }}>
            {props.state.updating === behaviour ? '…' : props.state[behaviour] ? 'on' : 'off'}
          </span>
        </text>
      ))}
      <text fg={theme().text.subdued} onMouseDown={props.openSettings}>
        ⚙ edit box.json
      </text>
    </box>
  );
}

async function openSettings(context: Plugin.Context) {
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (!editor) throw new Error('Set $VISUAL or $EDITOR to open settings');
  const [command, ...args] = editor.split(' ');
  if (!command) throw new Error('Set $VISUAL or $EDITOR to open settings');

  context.renderer.suspend();
  context.renderer.currentRenderBuffer.clear();
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, [...args, settingsPath], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });
      child.on('error', reject);
      child.on('exit', (code, signal) => {
        if (code === 0) resolve();
        else
          reject(new Error(`Editor exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
      });
    });
  } finally {
    context.renderer.currentRenderBuffer.clear();
    context.renderer.resume();
    context.renderer.requestRender();
  }
}

export default Plugin.define({
  id: 'boxedcode-sandbox',
  async setup(context) {
    let state: ControlState = { ...(await readSandboxState()), updating: undefined };
    let unregister: (() => void) | undefined;
    const render = () => {
      unregister?.();
      unregister = context.ui.slot('sidebar.content', () => (
        <SandboxControls
          context={context}
          state={state}
          toggle={(behaviour) => void toggle(behaviour)}
          openSettings={() =>
            void openSettings(context).catch((error) =>
              context.ui.toast.show({
                title: 'Sandbox settings',
                message: error instanceof Error ? error.message : String(error),
                variant: 'error',
              }),
            )
          }
        />
      ));
    };
    const refresh = async () => {
      state = { ...(await readSandboxState()), updating: state.updating };
      render();
    };
    const stateChanged = () => void refresh();
    const toggle = async (behaviour: SandboxBehaviour) => {
      if (state.updating) return;
      state = { ...state, updating: behaviour };
      render();
      try {
        const next = await updateSandboxState(behaviour, !state[behaviour]);
        state = { ...next, updating: behaviour };
      } catch (error) {
        context.ui.toast.show({
          title: 'Sandbox controls',
          message: error instanceof Error ? error.message : String(error),
          variant: 'error',
        });
      } finally {
        state = { ...state, updating: undefined };
        render();
      }
    };

    watchFile(sandboxStatePath, { interval: 500 }, stateChanged);
    render();
    return () => {
      unregister?.();
      unwatchFile(sandboxStatePath, stateChanged);
    };
  },
});
