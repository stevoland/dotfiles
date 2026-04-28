// This plugin has been copied to ~/.config/opencode/plugin
// by https://github.com/eeveebank/nwb
// Ideally it would be provided by an npm package but
// we would have to ensure every dev has jfrog auth setup correctly.
// So for now we just copy it into the opencode plugin dir during setup.
import type { Plugin } from '@opencode-ai/plugin';

const fallbackTaskDescription = 'Placeholder description';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const getPromptFirstSentence = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const prompt = value.trim();
  if (prompt.length === 0) {
    return undefined;
  }

  const firstLine = prompt.split(/\r?\n/, 1)[0]?.trim();
  if (!firstLine) {
    return undefined;
  }

  const sentenceMatch = firstLine.match(/^(.+?[.!?])(?:\s|$)/);
  return (sentenceMatch?.[1] ?? firstLine).trim() || undefined;
};

export const BoxedCodeTaskPlugin: Plugin = async () => ({
  'tool.execute.before': async ({ tool }, output) => {
    if (tool !== 'task') {
      return;
    }

    if (!isPlainObject(output.args)) {
      return;
    }

    const description = output.args['description'];
    if (typeof description === 'string' && description.trim().length > 0) {
      return;
    }

    output.args['description'] = getPromptFirstSentence(output.args['prompt']) ?? fallbackTaskDescription;
  },
});

export default BoxedCodeTaskPlugin;
