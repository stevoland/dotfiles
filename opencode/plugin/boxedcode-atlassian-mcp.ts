// This plugin has been copied to ~/.config/opencode/plugin
// by https://github.com/eeveebank/nwb
// Temporary compatibility for Atlassian's non-compliant OAuth metadata issuer.
import type { Plugin } from '@opencode-ai/plugin';

const canonicalIssuer = 'https://mcp.atlassian.com/';
const allowedMetadataHosts = ['mcp.atlassian.com'] as const;
const allowedMetadataPaths = [
  '/.well-known/oauth-authorization-server',
  '/.well-known/openid-configuration',
] as const;
const allowedReturnedIssuers = ['https://cf.mcp.atlassian.com'] as const;
const patchedFetch = Symbol.for('boxedcode.atlassian-mcp.fetch');

type PatchedGlobal = typeof globalThis & {
  [patchedFetch]?: true;
};

export const BoxedCodeAtlassianMcpPlugin: Plugin = async () => {
  const global = globalThis as PatchedGlobal;
  if (global[patchedFetch]) return {};

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const response = await originalFetch(input, init);
    const requestUrl = new URL(input instanceof Request ? input.url : input.toString());

    if (
      requestUrl.protocol !== 'https:' ||
      !allowedMetadataHosts.includes(requestUrl.hostname as (typeof allowedMetadataHosts)[number]) ||
      !allowedMetadataPaths.includes(requestUrl.pathname as (typeof allowedMetadataPaths)[number]) ||
      !response.ok ||
      !response.headers.get('content-type')?.toLowerCase().includes('application/json')
    ) {
      return response;
    }

    const metadata = (await response
      .clone()
      .json()
      .catch(() => undefined)) as unknown;
    if (!isRecord(metadata) || typeof metadata['issuer'] !== 'string') return response;
    if (!allowedReturnedIssuers.includes(metadata['issuer'] as (typeof allowedReturnedIssuers)[number])) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');

    return new Response(JSON.stringify({ ...metadata, issuer: canonicalIssuer }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }) as typeof fetch;
  global[patchedFetch] = true;

  return {};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export default BoxedCodeAtlassianMcpPlugin;
