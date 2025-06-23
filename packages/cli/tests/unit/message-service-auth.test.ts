import { describe, it, expect, beforeEach, afterEach, jest, mock } from 'bun:test';
import { MessageBusService } from '../../src/server/services/message';
import { createMockAgentRuntime } from '../../../server/src/__tests__/test-utils/mocks';
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

describe('MessageBusService auth headers', () => {
  it('adds configured auth header', async () => {
    process.env.ELIZA_SERVER_AUTH_TOKEN = 'abc123';
    process.env.ELIZA_SERVER_AUTH_METHOD = 'bearer';

    const runtime = createMockAgentRuntime();
    runtime.getRoom = jest.fn().mockResolvedValue({ channelId: '111e1111-e111-4111-a111-111111111111' as UUID });
    runtime.getWorld = jest.fn().mockResolvedValue({ serverId: '222e2222-e222-4222-a222-222222222222' as UUID });

    const service = new MessageBusService(runtime as IAgentRuntime);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const content: Content = { text: 'hello' };
    await (service as any).sendAgentResponseToBus(
      'room-uuid' as UUID,
      'world-uuid' as UUID,
      content
    );

    const call = mockFetch.mock.calls.pop();
    expect(call[1].headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer abc123' })
    );
  });
});
