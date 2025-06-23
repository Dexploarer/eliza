import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { useElevenLabsVoices } from '../use-elevenlabs-voices';
import { elevenLabsVoiceModels } from '@/config/voice-models';

(global as any).performance ??= { now: () => Date.now() };

const localStorageMock = {
  getItem: mock(),
  setItem: mock(),
  removeItem: mock(),
  clear: mock(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function wrapper() {
  const client = new QueryClient();
  return ({ children }: { children: any }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useElevenLabsVoices', () => {
  beforeEach(() => {
    mock.restore();
    localStorageMock.getItem.mockReturnValue(null);
    // Reset fetch mock
    (global as any).fetch = undefined;
  });

  it('returns default voices when no API key', async () => {
    const { result, waitFor } = renderHook(() => useElevenLabsVoices(), {
      wrapper: wrapper(),
    });
    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual(elevenLabsVoiceModels);
  });

  it('fetches voices when API key is provided', async () => {
    localStorageMock.getItem.mockReturnValue('test-key');
    const apiResponse = {
      voices: [
        {
          voice_id: 'id1',
          name: 'Alice',
          category: 'cloned',
          labels: { gender: 'female', description: 'friendly' },
        },
      ],
    };

    (global as any).fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(apiResponse) })
    );

    const { result, waitFor } = renderHook(() => useElevenLabsVoices(), {
      wrapper: wrapper(),
    });
    await waitFor(() => result.current.isSuccess);

    expect(global.fetch).toHaveBeenCalledWith('https://api.elevenlabs.io/v2/voices', {
      method: 'GET',
      headers: { 'xi-api-key': 'test-key' },
    });
    expect(result.current.data).toEqual([
      {
        value: 'id1',
        label: 'ElevenLabs - Alice',
        provider: 'elevenlabs',
        gender: 'female',
        language: 'en',
        features: ['cloned', 'friendly'],
      },
    ]);
  });
});
