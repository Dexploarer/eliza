import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { createChannelsRouter } from '../api/messaging/channels';
import { createMockAgentRuntime } from './test-utils/mocks';
import express from 'express';

describe('channels router - list agents', () => {
  let router: express.Router;
  let mockServer: any;

  beforeEach(() => {
    mockServer = {
      getChannelParticipants: jest.fn(),
    } as any;
  });

  function getHandler(r: express.Router) {
    const layer = r.stack.find(
      (l: any) =>
        l.route &&
        l.route.path === '/central-channels/:channelId/agents' &&
        l.route.methods.get
    );
    return layer.route.stack[0].handle;
  }

  it('returns all participants when registry empty', async () => {
    const agents = new Map<string, any>();
    const participants = ['a', 'b'];
    mockServer.getChannelParticipants.mockResolvedValue(participants);
    router = createChannelsRouter(agents, mockServer);
    const handler = getHandler(router);

    const req = { params: { channelId: '123e4567-e89b-12d3-a456-426614174000' } } as express.Request;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;

    await handler(req, res);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: true,
      data: {
        channelId: '123e4567-e89b-12d3-a456-426614174000',
        participants,
        agents: participants,
      },
    });
  });

  it('filters participants when registry has agents', async () => {
    const runtime = createMockAgentRuntime();
    const agents = new Map<string, any>([[runtime.agentId, runtime]]);
    const participants = [runtime.agentId, 'user'];
    mockServer.getChannelParticipants.mockResolvedValue(participants);
    router = createChannelsRouter(agents, mockServer);
    const handler = getHandler(router);

    const req = { params: { channelId: '123e4567-e89b-12d3-a456-426614174000' } } as express.Request;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;

    await handler(req, res);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: true,
      data: {
        channelId: '123e4567-e89b-12d3-a456-426614174000',
        participants,
        agents: [runtime.agentId],
      },
    });
  });
});
