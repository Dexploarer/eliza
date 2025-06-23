import { describe, it, expect, beforeAll, afterAll, jest } from 'bun:test';
import supertest from 'supertest';
import express from 'express';
import { createAudioProcessingRouter } from '../../api/audio/processing';
import { createMockAgentRuntime } from '../test-utils/mocks';
import type { AgentServer } from '../../index';
import { DEFAULT_SERVER_ID } from '../../index';

const wavBuffer = Buffer.from([0x52,0x49,0x46,0x46,0x00,0x00,0x00,0x00,0x57,0x41,0x56,0x45]);

describe('Audio message processing', () => {
  let app: express.Express;
  let server: any;
  let request: supertest.SuperTest<supertest.Test>;
  let runtime: any;
  let agentServer: AgentServer;

  beforeAll(async () => {
    agentServer = {
      findOrCreateDmChannel: jest.fn(() =>
        Promise.resolve({ id: 'dm-channel-id', messageServerId: DEFAULT_SERVER_ID })
      ),
      createMessage: jest.fn(() =>
        Promise.resolve({
          id: 'message-id',
          channelId: 'dm-channel-id',
          authorId: 'user',
          content: 'hello',
          rawMessage: 'hello',
          sourceType: 'api_audio',
          createdAt: new Date(),
          inReplyToRootMessageId: undefined,
          metadata: {},
          sourceId: undefined,
        })
      ),
    } as unknown as AgentServer;

    runtime = createMockAgentRuntime({
      useModel: jest.fn(() => Promise.resolve('hello world')),
    });

    const agents = new Map([[runtime.agentId, runtime]]);
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/', createAudioProcessingRouter(agents, agentServer));
    server = app.listen();
    request = supertest(server);
  });

  afterAll(() => {
    server.close();
  });

  it('transcribes audio and creates a message', async () => {
    const res = await request
      .post(`/${runtime.agentId}/audio-messages`)
      .attach('file', wavBuffer, 'sample.wav');

    expect(res.status).toBe(201);
    expect(agentServer.createMessage).toHaveBeenCalled();
  });
});
