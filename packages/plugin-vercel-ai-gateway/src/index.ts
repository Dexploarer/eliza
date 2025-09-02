import {
  IAgentRuntime,
  IPlugin,
  ModelType,
  TextGenerationParams,
  TextEmbeddingParams,
  ImageGenerationParams,
  TranscriptionParams,
  TextToSpeechParams,
  ModelResultMap,
} from '@elizaos/core';
import OpenAI from 'openai';

// Helper to get the OpenAI client
const getClient = (runtime: IAgentRuntime) => {
  const apiKey = runtime.getSetting('AI_GATEWAY_API_KEY');
  const baseURL = runtime.getSetting('AI_GATEWAY_BASE_URL') || 'https://gateway.ai.cloudflare.com/v1/ACCOUNT_ID/GATEWAY/openai';

  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY not set');
  }

  return new OpenAI({
    apiKey,
    baseURL,
  });
};

// Text generation handler
const handleTextGeneration = async (runtime: IAgentRuntime, params: TextGenerationParams): Promise<string> => {
  const openai = getClient(runtime);
  const response = await openai.chat.completions.create({
    model: 'gpt-4', // The Vercel AI Gateway uses the model in the path, so this can be a placeholder
    messages: [{ role: 'user', content: params.prompt }],
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    stop: params.stopSequences,
    frequency_penalty: params.frequencyPenalty,
    presence_penalty: params.presencePenalty,
  });
  return response.choices[0].message.content || '';
};

// Text embedding handler
const handleTextEmbedding = async (runtime: IAgentRuntime, params: TextEmbeddingParams): Promise<ModelResultMap[ModelType.TEXT_EMBEDDING]> => {
  const openai = getClient(runtime);
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002', // Placeholder
    input: params.text,
  });
  return response.data[0].embedding;
};

// Image generation handler
const handleImageGeneration = async (runtime: IAgentRuntime, params: ImageGenerationParams): Promise<ModelResultMap[ModelType.IMAGE]> => {
  const openai = getClient(runtime);
  const response = await openai.images.generate({
    model: 'dall-e-3', // Placeholder
    prompt: params.prompt,
    n: params.count,
    size: params.size as any,
  });
  return response.data.map((image) => ({ url: image.url || '' }));
};

// Transcription handler
const handleTranscription = async (runtime: IAgentRuntime, params: TranscriptionParams): Promise<ModelResultMap[ModelType.TRANSCRIPTION]> => {
  const openai = getClient(runtime);
  const response = await fetch(params.audioUrl);
  const audioFile = await OpenAI.toFile(response);
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1', // Placeholder
    prompt: params.prompt,
  });
  return transcription.text;
};

// Text-to-speech handler
const handleTextToSpeech = async (runtime: IAgentRuntime, params: TextToSpeechParams): Promise<ModelResultMap[ModelType.TEXT_TO_SPEECH]> => {
  const openai = getClient(runtime);
  const response = await openai.audio.speech.create({
    model: 'tts-1', // Placeholder
    input: params.text,
    voice: params.voice as any,
    speed: params.speed,
  });
  return Buffer.from(await response.arrayBuffer());
};


const VercelAIGatewayPlugin: IPlugin = {
  name: 'vercel-ai-gateway',
  priority: 10,
  models: {
    [ModelType.TEXT_LARGE]: handleTextGeneration,
    [ModelType.TEXT_SMALL]: handleTextGeneration,
    [ModelType.TEXT_EMBEDDING]: handleTextEmbedding,
    [ModelType.IMAGE]: handleImageGeneration,
    [ModelType.TRANSCRIPTION]: handleTranscription,
    [ModelType.TEXT_TO_SPEECH]: handleTextToSpeech,
  },
  init: (config, runtime: IAgentRuntime) => {
    runtime.log.info('Vercel AI Gateway Plugin Initialized (using openai library)');
    return Promise.resolve();
  },
};

export default VercelAIGatewayPlugin;
