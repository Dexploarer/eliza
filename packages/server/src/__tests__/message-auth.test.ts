import { describe, it, expect, beforeEach, afterEach, mock, jest } from 'bun:test';
import { MessageBusService } from '../services/message';
import { createMockAgentRuntime } from './test-utils/mocks';
import type { IAgentRuntime, UUID, Content } from '@elizaos/core';

const mockFetch = jest.fn() as any;

mock.module('@elizaos/core', async () => {
  const actual = await import('@elizaos/core');
  return { ...actual, logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } };
});

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;
});

afterEach(() => {
  mock.restore();
  delete process.env.ELIZA_SERVER_AUTH_TOKEN;
  delete process.env.ELIZA_SERVER_AUTH_METHOD;
  delete process.env.ELIZA_SERVER_AUTH_HEADER;
});

describe('MessageBusService authentication', () => {
  it('uses bearer token when configured', async () => {
    process.env.ELIZA_SERVER_AUTH_TOKEN = 'testtoken';
    process.env.ELIZA_SERVER_AUTH_METHOD = 'bearer';

    const runtime = createMockAgentRuntime();
    runtime.getRoom = jest.fn().mockResolvedValue({ channelId: '111e1111-e111-4111-a111-111111111111' as UUID });
    runtime.getWorld = jest.fn().mockResolvedValue({ serverId: '222e2222-e222-4222-a222-222222222222' as UUID });

    const service = new MessageBusService(runtime as IAgentRuntime);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const content: Content = { text: 'hi' };
    await (service as any).sendAgentResponseToBus(
      'room-uuid' as UUID,
      'world-uuid' as UUID,
      content
    );

    const call = mockFetch.mock.calls.pop();
    expect(call[1].headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer testtoken' })
    );
  });

  it('uses api key header by default', async () => {
    process.env.ELIZA_SERVER_AUTH_TOKEN = 'secret';
    process.env.ELIZA_SERVER_AUTH_HEADER = 'X-API-KEY';

    const runtime = createMockAgentRuntime();
    runtime.getRoom = jest.fn().mockResolvedValue({ channelId: '111e1111-e111-4111-a111-111111111111' as UUID });
    runtime.getWorld = jest.fn().mockResolvedValue({ serverId: '222e2222-e222-4222-a222-222222222222' as UUID });

    const service = new MessageBusService(runtime as IAgentRuntime);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const content: Content = { text: 'hi' };
    await (service as any).sendAgentResponseToBus(
      'room-uuid' as UUID,
      'world-uuid' as UUID,
      content
    );

    const call = mockFetch.mock.calls.pop();
    expect(call[1].headers).toEqual(
      expect.objectContaining({ 'X-API-KEY': 'secret' })
    );
  });
});
