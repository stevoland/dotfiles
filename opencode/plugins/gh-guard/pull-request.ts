import type { Plugin } from "@opencode/plugin";

type Context = Parameters<Plugin.Plugin["setup"]>[0];

const GITHUB_API = "https://api.github.com";
/** The GitHub token integration registered by opencode-api-tools (derived from origin and scheme). */
const GITHUB_INTEGRATION_ID = "api-https_3a_2f_2fapi_2egithub_2ecom-token-bearer";
const GITHUB_INTEGRATION_NAME = "github token (api.github.com)";

/** opencode-api-tools permission resources that create or update pull requests. */
const PULL_REQUEST_WRITE_RESOURCES = new Set([
  "github POST /repos/{owner}/{repo}/pulls",
  "github PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
  "githubGraphql mutation createPullRequest",
  "githubGraphql mutation updatePullRequest",
]);
const PULL_REQUEST_WRITE_DENIED =
  "Creating or updating pull requests through the GitHub API tools is denied. Use the pr_create or pr_update tool instead.";

const FOOTER_PATTERN = /\s*<sub>ses[^<]*<\/sub>\s*$/;

interface FooterInput {
  sessionID: string;
  agent: string;
  model?: { id: string; variant?: string };
}

export function formatFooter(input: FooterInput): string {
  const model = input.model
    ? `${input.model.id}${input.model.variant ? `#${input.model.variant}` : ""}`
    : "unknown";
  return `<sub>${input.sessionID} | ${input.agent} | ${model}</sub>`;
}

/** Appends the footer, replacing any footer a previous pr_create/pr_update added. */
export function withFooter(body: string, footer: string): string {
  const content = body.replace(FOOTER_PATTERN, "");
  return content ? `${content}\n\n${footer}` : footer;
}

export function isPullRequestWrite(action: string, resources: ReadonlyArray<string>): boolean {
  return action === "api" && resources.some((resource) => PULL_REQUEST_WRITE_RESOURCES.has(resource));
}

interface PullRequest {
  number: number;
  html_url: string;
  state: string;
  draft?: boolean;
}

async function githubToken(context: Context): Promise<string> {
  const connection = await context.integration.connection.active(GITHUB_INTEGRATION_ID);
  const credential = connection && (await context.integration.connection.resolve(connection));
  if (credential?.type === "key") return credential.key;
  if (credential?.type === "oauth") return credential.access;
  throw new Error(`No GitHub credential is connected; connect one with /connect: ${GITHUB_INTEGRATION_NAME}`);
}

async function githubRequest(
  context: Context,
  method: "POST" | "PATCH",
  path: string,
  body: Record<string, unknown>,
): Promise<PullRequest> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${await githubToken(context)}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`GitHub ${method} ${path} failed (${response.status}): ${(await response.text()).slice(0, 1000)}`);
  }
  return (await response.json()) as PullRequest;
}

async function footer(context: Context, sessionID: string, agent: string): Promise<string> {
  const session = await context.session.get({ sessionID });
  return formatFooter({ sessionID, agent, model: (session as { model?: FooterInput["model"] }).model });
}

function summary(action: string, pr: PullRequest): string {
  return `${action} pull request #${pr.number} (${pr.draft ? "draft" : pr.state}): ${pr.html_url}`;
}

const repoProperties = {
  owner: { type: "string", description: "Repository owner, e.g. eeveebank" },
  repo: { type: "string", description: "Repository name" },
} as const;

export async function registerPullRequestTools(context: Context): Promise<void> {
  await context.permission.hook("evaluate", async (event) => {
    if (!isPullRequestWrite(event.action, event.resources)) return;
    event.effect = "deny";
    event.message = PULL_REQUEST_WRITE_DENIED;
  });

  await context.tool.transform((editor) => {
    editor.add({
      name: "pr_create",
      options: { codemode: false },
      description:
        "Create a draft GitHub pull request. Use this instead of the gh CLI or the GitHub API tools. A footer identifying this session is appended to the body.",
      input: {
        type: "object",
        properties: {
          ...repoProperties,
          title: { type: "string", description: "Pull request title" },
          head: { type: "string", description: "Branch containing the changes" },
          base: { type: "string", description: "Branch to merge into, e.g. master" },
          body: { type: "string", description: "Pull request description (Markdown)" },
        },
        required: ["owner", "repo", "title", "head", "base"],
        additionalProperties: false,
      },
      execute: async (input: any, toolContext) => {
        const { owner, repo, title, head, base, body = "" } = input;
        await context.permission.assert({
          sessionID: toolContext.sessionID,
          agent: toolContext.agent,
          action: "pr_create",
          resources: [`${owner}/${repo}`],
        });
        const pr = await githubRequest(context, "POST", `/repos/${owner}/${repo}/pulls`, {
          title,
          head,
          base,
          draft: true,
          body: withFooter(body, await footer(context, toolContext.sessionID, toolContext.agent)),
        });
        return { content: summary("Created", pr) };
      },
    });

    editor.add({
      name: "pr_update",
      options: { codemode: false },
      description:
        "Update a GitHub pull request's title, description, base or state. Use this instead of the gh CLI or the GitHub API tools. When body is given, a footer identifying this session is appended to it.",
      input: {
        type: "object",
        properties: {
          ...repoProperties,
          pull_number: { type: "integer", description: "Pull request number" },
          title: { type: "string", description: "New title" },
          body: { type: "string", description: "New description (Markdown), replacing the existing one" },
          base: { type: "string", description: "New base branch" },
          state: { type: "string", enum: ["open", "closed"], description: "Open or close the pull request" },
        },
        required: ["owner", "repo", "pull_number"],
        additionalProperties: false,
      },
      execute: async (input: any, toolContext) => {
        const { owner, repo, pull_number, title, body, base, state } = input;
        await context.permission.assert({
          sessionID: toolContext.sessionID,
          agent: toolContext.agent,
          action: "pr_update",
          resources: [`${owner}/${repo}#${pull_number}`],
        });
        const pr = await githubRequest(context, "PATCH", `/repos/${owner}/${repo}/pulls/${pull_number}`, {
          title,
          base,
          state,
          body:
            body === undefined
              ? undefined
              : withFooter(body, await footer(context, toolContext.sessionID, toolContext.agent)),
        });
        return { content: summary("Updated", pr) };
      },
    });
  });
}
