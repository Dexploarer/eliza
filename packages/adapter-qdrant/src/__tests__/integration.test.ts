import { qdrantDatabaseAdapter } from '../client';
import { v4 } from 'uuid';
import { describe, it, expect } from 'bun:test';

const runtime: any = {
  getSetting(key: string) {
    switch (key) {
      case 'QDRANT_URL':
        return 'http://localhost';
      case 'QDRANT_KEY':
        return 'test';
      case 'QDRANT_PORT':
        return '6333';
      case 'QDRANT_VECTOR_SIZE':
        return '3';
      default:
        return undefined;
    }
  },
};

const adapter = qdrantDatabaseAdapter.init(runtime) as any;

describe('memory and participant features', () => {
  it('creates and retrieves memory', async () => {
    const mem = {
      id: v4(),
      agentId: 'a',
      roomId: 'r',
      entityId: 'e',
      content: { text: 'hello' },
      createdAt: Date.now(),
      unique: false,
    } as any;
    await adapter.createMemory(mem, 'message');
    const found = await adapter.getMemories({
      roomId: 'r',
      tableName: 'message',
      agentId: 'a',
    });
    expect(found.length).toBe(1);
    await adapter.removeMemory(mem.id, 'message');
    const count = await adapter.countMemories('r');
    expect(count).toBe(0);
  });

  it('tracks participants', async () => {
    const added = await adapter.addParticipant('u1', 'room1');
    expect(added).toBe(true);
    await adapter.setParticipantUserState('room1', 'u1', 'FOLLOWED');
    const state = await adapter.getParticipantUserState('room1', 'u1');
    expect(state).toBe('FOLLOWED');
    const list = await adapter.getParticipantsForRoom('room1');
    expect(list).toContain('u1');
    const removed = await adapter.removeParticipant('u1', 'room1');
    expect(removed).toBe(true);
  });
});
