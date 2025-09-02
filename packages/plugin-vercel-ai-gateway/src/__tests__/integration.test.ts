import { describe, it, expect } from 'bun:test';
import { IAgentRuntime, ModelType, TextGenerationParams } from '@elizaos/core';
import VercelAIGatewayPlugin from '../index';

describe('Vercel AI Gateway Plugin - Integration', () => {
  it('should throw an error when using an invalid API key', async () => {
    const mockRuntime = {
      getSetting: (key: string) => {
        if (key === 'AI_GATEWAY_API_KEY') return 'invalid-test-key';
        return null;
      },
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        fatal: () => {},
        trace: () => {},
      },
    } as unknown as IAgentRuntime;

    const params: TextGenerationParams = {
      runtime: mockRuntime,
      prompt: 'Hello, world!',
    };

    const handler = VercelAIGatewayPlugin.models[ModelType.TEXT_LARGE];
    if (typeof handler !== 'function') {
      throw new Error('Handler is not a function');
    }

    // We expect this to throw because the API key is invalid and the real SDK will be used.
    // The `openai` library will throw an authentication error.
    // We wrap the async call in a function for `toThrow` to work correctly.
    const testFunction = async () => await handler(mockRuntime, params);
    await expect(testFunction()).rejects.toThrow();
  });
});
