import type { IAgentRuntime, UUID } from '@elizaos/core';
import express from 'express';
import { createAudioProcessingRouter } from './processing';
import { createSynthesisRouter } from './synthesis';
import { createConversationRouter } from './conversation';
import type { AgentServer } from '../index';

/**
 * Creates the audio router for speech and audio processing
 */
export function audioRouter(
  agents: Map<UUID, IAgentRuntime>,
  serverInstance: AgentServer
): express.Router {
  const router = express.Router();

  // Mount audio processing (upload, transcription)
  router.use('/', createAudioProcessingRouter(agents, serverInstance));

  // Mount text-to-speech synthesis
  router.use('/', createSynthesisRouter(agents));

  // Mount speech conversation functionality
  router.use('/', createConversationRouter(agents));

  return router;
}
