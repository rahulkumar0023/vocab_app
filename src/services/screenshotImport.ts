import type { DifficultyLevel, WordInput } from '../db';
import {
  ensureFirebaseDeviceId,
  getFirebaseFunctionUrl,
  hasFirebaseGeminiConfig,
} from './firebase';

type ScreenshotImportPayload = {
  words?: ScreenshotWordCandidate[];
  error?: string;
};

type ScreenshotWordCandidate = {
  word?: string;
  definition?: string;
  example?: string;
  difficulty?: DifficultyLevel | null;
};

type ScreenshotImportInput = {
  imageBase64: string;
  mimeType?: string | null;
  fileName?: string | null;
  maxWords?: number;
};

export async function extractWordsFromScreenshot(
  input: ScreenshotImportInput,
): Promise<WordInput[]> {
  if (!hasFirebaseGeminiConfig()) {
    throw new Error('Screenshot import requires Firebase Gemini to be configured.');
  }

  const imageBase64 = input.imageBase64.trim();

  if (!imageBase64) {
    throw new Error('Could not read the screenshot image.');
  }

  const functionUrl = getFirebaseFunctionUrl('extractWordsFromScreenshot');

  if (!functionUrl) {
    throw new Error('Screenshot import function is not configured.');
  }

  const deviceId = await ensureFirebaseDeviceId();
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vocab-device-id': deviceId,
    },
    body: JSON.stringify({
      imageBase64,
      mimeType: normalizeMimeType(input.mimeType),
      fileName: input.fileName?.trim() || null,
      maxWords: input.maxWords ?? 10,
    }),
  });

  const payload = (await response.json()) as ScreenshotImportPayload;

  if (!response.ok) {
    throw new Error(payload.error?.trim() || 'Screenshot import failed.');
  }

  const words = (payload.words ?? []).map((entry) => normalizeWord(entry)).filter(isWordInput);

  if (words.length === 0) {
    throw new Error('No clear vocabulary words were detected. Try a sharper screenshot.');
  }

  return words;
}

function normalizeWord(entry: ScreenshotWordCandidate): WordInput | null {
  const word = entry?.word?.trim();
  const definition = entry?.definition?.trim();
  const example = entry?.example?.trim();

  if (!word || !definition || !example) {
    return null;
  }

  return {
    word,
    definition,
    example,
    difficulty: normalizeDifficulty(entry?.difficulty),
    source: 'imported',
    topic: 'reading',
  };
}

function isWordInput(value: WordInput | null): value is WordInput {
  return value !== null;
}

function normalizeDifficulty(value?: DifficultyLevel | null): DifficultyLevel | null {
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
    return value;
  }

  return null;
}

function normalizeMimeType(value?: string | null) {
  const normalized = value?.trim().toLowerCase() || '';

  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return 'image/jpeg';
  }

  if (normalized === 'image/webp') {
    return 'image/webp';
  }

  return 'image/png';
}
