import type { Plugin, Action, IAgentRuntime, Memory, State, HandlerCallback, Content } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { z } from 'zod';
import fetch from 'node-fetch';

const configSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  GITHUB_TOKEN: z.string().optional(),
});

export interface RepoInfo {
  name: string;
  description: string | null;
}

/**
 * Retrieves the public repositories for a specified GitHub user.
 *
 * @param user - The GitHub username whose repositories will be fetched.
 * @param token - Optional GitHub access token for authenticated requests.
 * @returns An array of repository information objects, each containing the repository name and description.
 *
 * @throws {Error} If the GitHub API request fails or returns a non-OK response.
 */
export async function fetchRepositories(user: string, token?: string): Promise<RepoInfo[]> {
  const url = `https://api.github.com/users/${user}/repos`;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch repos for ${user}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as any[];
  return data.map((repo) => ({ name: repo.name, description: repo.description }));
}

/**
 * Constructs a prompt for generating a four-panel comic strip summarizing a GitHub user's repositories.
 *
 * @param repos - The repositories to include in the summary.
 * @param user - The GitHub username whose repositories are being summarized.
 * @returns A formatted prompt string describing the comic strip to generate.
 */
export function createComicPrompt(repos: RepoInfo[], user: string): string {
  const top = repos.slice(0, 3).map((r) => `${r.name}: ${r.description ?? 'No description'}`).join('\n');
  return `Create a four panel comic strip summarizing GitHub user ${user}'s repositories.\n${top}`;
}

export interface ImageResult { url: string }

/**
 * Generates a comic strip image using OpenAI's image generation API with the provided prompt.
 *
 * @param prompt - The prompt describing the comic to generate.
 * @param apiKey - The OpenAI API key for authentication.
 * @returns An object containing the URL of the generated comic image.
 *
 * @throws {Error} If the OpenAI API response is not successful, including the status code and error message.
 */
export async function generateComicImage(prompt: string, apiKey: string): Promise<ImageResult> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'dall-e-3', prompt }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return { url: data.data[0].url };
}

const generateComicAction: Action = {
  name: 'GITHUB_COMICS',
  similes: ['REPO_COMICS'],
  description: 'Generate comic strip from GitHub repos',
  validate: async () => true,
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    options: any,
    callback: HandlerCallback,
  ) => {
    const user = options?.user || message.content.text?.trim();
    if (!user) throw new Error('GitHub user not specified');
    const { OPENAI_API_KEY, GITHUB_TOKEN } = config;
    const repos = await fetchRepositories(user, GITHUB_TOKEN);
    const prompt = createComicPrompt(repos, user);
    const image = await generateComicImage(prompt, OPENAI_API_KEY);
    const quip = `Wow ${user}, your code is... something else. Keep it up!`;
    const content: Content = {
      text: `${quip}\n${image.url}`,
    };
    await callback(content);
    return content;
  },
  examples: [],
};

let config: z.infer<typeof configSchema>;

export const githubComicsPlugin: Plugin = {
  name: 'plugin-github-comics',
  description: 'Turn GitHub repos into comic strips',
  config: {},
  async init(cfg: Record<string, string>) {
    config = await configSchema.parseAsync(cfg);
    Object.assign(process.env, config);
  },
  actions: [generateComicAction],
};

export default githubComicsPlugin;
