import { describe, it, expect, vi, beforeAll, afterAll, type Mock } from 'vitest';
import * as plugin from '../src/index';
import { createMockRuntime, setupLoggerSpies, setupTest } from './test-utils';
import fetch from 'node-fetch';

vi.mock('node-fetch');

const mockedFetch = fetch as unknown as Mock;

beforeAll(() => {
  setupLoggerSpies();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('Integration: githubComicsPlugin', () => {
  it('initializes with config and executes action', async () => {
    const mockRuntime = createMockRuntime();
    if (plugin.githubComicsPlugin.init) {
      await plugin.githubComicsPlugin.init({ OPENAI_API_KEY: 'key' });
    }

    const { mockMessage, mockState, callbackFn } = setupTest();

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ name: 'repo', description: 'desc' }],
    } as any);

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ url: 'http://image' }] }),
    } as any);

    const action = plugin.githubComicsPlugin.actions?.[0];
    if (!action) throw new Error('action missing');
    await action.handler!(mockRuntime as any, mockMessage as any, mockState as any, { user: 'octocat' }, callbackFn, []);
    expect(callbackFn).toHaveBeenCalled();
  });
});
