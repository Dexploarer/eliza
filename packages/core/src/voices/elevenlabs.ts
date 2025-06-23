export interface ElevenLabsVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  language: string;
  features: string[];
}

export const elevenLabsVoiceMetadata: ElevenLabsVoice[] = [
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Rachel (Default)',
    gender: 'female',
    language: 'en',
    features: ['natural', 'professional'],
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Adam',
    gender: 'male',
    language: 'en',
    features: ['natural', 'professional'],
  },
  {
    id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    gender: 'female',
    language: 'en',
    features: ['natural', 'friendly'],
  },
  {
    id: 'MF3mGyEYCl7XYWbV9V6O',
    name: 'Elli',
    gender: 'female',
    language: 'en',
    features: ['natural', 'friendly'],
  },
  {
    id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    gender: 'male',
    language: 'en',
    features: ['natural', 'professional'],
  },
];
