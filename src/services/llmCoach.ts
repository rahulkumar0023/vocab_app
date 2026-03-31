import type { AiStudyKitInput, VocabCard } from '../db';
import { cacheAiMemoryImage } from './aiMemoryImage';
import {
  ensureFirebaseDeviceId,
  getFirebaseFunctionUrl,
  hasFirebaseGeminiConfig,
} from './firebase';

type ResponsesApiPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

type FirebaseStudyKitResponse = {
  studyKit?: Partial<AiStudyKitInput>;
  memoryImageBase64?: string | null;
  memoryImageMimeType?: string | null;
  imageError?: string | null;
  provider?: string;
  remainingToday?: number;
  dailyLimit?: number;
  error?: string;
};

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5-mini';
const SMART_COACH_MODEL = 'smart-coach-local';

const studyKitSchema = {
  type: 'object',
  properties: {
    simplifiedDefinition: {
      type: 'string',
      minLength: 1,
    },
    memoryHook: {
      type: 'string',
      minLength: 1,
    },
    memoryImagePrompt: {
      type: 'string',
      minLength: 1,
    },
    quizQuestion: {
      type: 'string',
      minLength: 1,
    },
    quizAnswer: {
      type: 'string',
      minLength: 1,
    },
    usageTip: {
      type: 'string',
      minLength: 1,
    },
  },
  required: [
    'simplifiedDefinition',
    'memoryHook',
    'memoryImagePrompt',
    'quizQuestion',
    'quizAnswer',
    'usageTip',
  ],
  additionalProperties: false,
} as const;

export type LlmMode = 'firebase-gemini' | 'direct-openai' | 'smart-coach';

export type AiProviderOption = {
  id: 'smart-coach' | 'firebase-gemini' | 'openai' | 'open-models';
  name: string;
  badge: string;
  description: string;
  isActive: boolean;
};

export type AiGenerationStatus = {
  provider: 'firebase-gemini' | 'openai' | 'smart-coach';
  providerLabel: string;
  dailyLimit?: number;
  remainingToday?: number;
  note?: string;
};

export type AiStudyKitResult = {
  studyKit: AiStudyKitInput;
  status: AiGenerationStatus;
};

export function getLlmMode(): LlmMode {
  if (hasFirebaseGeminiConfig()) {
    return 'firebase-gemini';
  }

  if (getPrototypeApiKey()) {
    return 'direct-openai';
  }

  return 'smart-coach';
}

export function getLlmModeLabel() {
  switch (getLlmMode()) {
    case 'firebase-gemini':
      return 'Gemini Cloud';
    case 'direct-openai':
      return 'OpenAI';
    default:
      return 'Smart Coach';
  }
}

export function getLlmConfigurationHelp() {
  if (getLlmMode() === 'firebase-gemini') {
    return 'This build is using your Firebase Gemini function with a daily quota and Smart Coach fallback.';
  }

  if (getLlmMode() === 'direct-openai') {
    return 'OpenAI is active in this build. For production, route requests through your backend instead of shipping a public key.';
  }

  return 'Smart Coach is active by default. It generates a free built-in study kit without asking the learner to connect anything.';
}

export function getAiProviderOptions(): AiProviderOption[] {
  const mode = getLlmMode();

  return [
    {
      id: 'smart-coach',
      name: 'Smart Coach',
      badge: mode === 'smart-coach' ? 'Active now' : 'Built in',
      description: 'Free built-in study hints that work with no sign-in or setup.',
      isActive: mode === 'smart-coach',
    },
    {
      id: 'firebase-gemini',
      name: 'Gemini via Firebase',
      badge: mode === 'firebase-gemini' ? 'Active now' : 'Cloud upgrade',
      description: 'Hosted Gemini responses with daily quota control and no provider setup for learners.',
      isActive: mode === 'firebase-gemini',
    },
    {
      id: 'openai',
      name: 'OpenAI / ChatGPT',
      badge: mode === 'direct-openai' ? 'Active now' : 'Premium option',
      description: 'Best fit if you want higher-quality coaching through the OpenAI API.',
      isActive: mode === 'direct-openai',
    },
    {
      id: 'open-models',
      name: 'Open models',
      badge: 'Free-tier path',
      description: 'Use an open-model backend like Hugging Face if you want a lower-cost route later.',
      isActive: false,
    },
  ];
}

export async function generateAiStudyKit(
  card: Pick<VocabCard, 'word' | 'definition' | 'example'>,
): Promise<AiStudyKitResult> {
  const mode = getLlmMode();

  if (mode === 'firebase-gemini') {
    return callFirebaseGemini(card);
  }

  if (mode === 'direct-openai') {
    return callOpenAi(card);
  }

  return {
    studyKit: buildSmartCoachStudyKit(card),
    status: {
      provider: 'smart-coach',
      providerLabel: 'Smart Coach',
    },
  };
}

async function callFirebaseGemini(
  card: Pick<VocabCard, 'word' | 'definition' | 'example'>,
): Promise<AiStudyKitResult> {
  const functionUrl = getFirebaseFunctionUrl('generateStudyKit');

  if (!functionUrl) {
    return buildSmartCoachFallback(card, 'Gemini is not wired yet in this build. Smart Coach stepped in.');
  }

  try {
    const deviceId = await ensureFirebaseDeviceId();
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vocab-device-id': deviceId,
      },
      body: JSON.stringify({
        word: card.word,
        definition: card.definition,
        example: card.example,
      }),
    });

    const payload = (await response.json()) as FirebaseStudyKitResponse;

    if (!response.ok) {
      if (response.status === 429) {
        return buildSmartCoachFallback(
          card,
          'Gemini daily limit reached. Smart Coach is filling in for the rest of today.',
          payload.dailyLimit,
          payload.remainingToday ?? 0,
        );
      }

      return buildSmartCoachFallback(
        card,
        payload.error?.trim() || 'Gemini is unavailable right now. Smart Coach stepped in.',
      );
    }

    const memoryImageUri = await cacheAiMemoryImage(
      card.word,
      payload.memoryImageBase64,
      payload.memoryImageMimeType,
    );

    return {
      studyKit: normalizeStudyKit(
        payload.studyKit ?? {},
        payload.studyKit?.model?.trim() || 'gemini-2.5-flash-lite',
        {
          memoryImageUri,
        },
      ),
      status: {
        provider: 'firebase-gemini',
        providerLabel: 'Gemini Cloud',
        dailyLimit: payload.dailyLimit,
        remainingToday: payload.remainingToday,
        note:
          !memoryImageUri && payload.imageError
            ? 'Gemini image generation is unavailable right now. Showing a visual scene card instead.'
            : undefined,
      },
    };
  } catch {
    return buildSmartCoachFallback(
      card,
      'Gemini is unavailable right now. Smart Coach stepped in.',
    );
  }
}

async function callOpenAi(
  card: Pick<VocabCard, 'word' | 'definition' | 'example'>,
): Promise<AiStudyKitResult> {
  const apiKey = getPrototypeApiKey();

  if (!apiKey) {
    throw new Error('Missing OpenAI API key.');
  }

  const model = getRequestedModel();
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions:
        'You are an expert vocabulary coach. Return a concise JSON study kit for one vocabulary word. Keep every field short, clear, and learner-friendly.',
      input: [
        `Word: ${card.word}`,
        `Definition: ${card.definition}`,
        `Example: ${card.example}`,
        'Return a simplified definition, a vivid memory hook, one playful image prompt for a mnemonic illustration, one quiz question, the quiz answer, and one usage tip.',
      ].join('\n'),
      text: {
        format: {
          type: 'json_schema',
          name: 'word_study_kit',
          strict: true,
          schema: studyKitSchema,
        },
      },
    }),
  });

  const payload = (await response.json()) as ResponsesApiPayload;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI request failed with ${response.status}.`);
  }

  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error('OpenAI returned no text output.');
  }

  const parsed = JSON.parse(outputText) as Partial<AiStudyKitInput>;
  return {
    studyKit: normalizeStudyKit(parsed, model),
    status: {
      provider: 'openai',
      providerLabel: 'OpenAI',
    },
  };
}

function buildSmartCoachFallback(
  card: Pick<VocabCard, 'word' | 'definition' | 'example'>,
  note: string,
  dailyLimit?: number,
  remainingToday?: number,
): AiStudyKitResult {
  return {
    studyKit: buildSmartCoachStudyKit(card),
    status: {
      provider: 'smart-coach',
      providerLabel: 'Smart Coach',
      dailyLimit,
      remainingToday,
      note,
    },
  };
}

function normalizeStudyKit(
  payload: Partial<AiStudyKitInput>,
  model: string,
  options?: {
    memoryImageUri?: string | null;
  },
): AiStudyKitInput {
  const generatedAt = new Date().toISOString();
  const simplifiedDefinition = payload.simplifiedDefinition?.trim();
  const memoryHook = payload.memoryHook?.trim();
  const memoryImagePrompt = payload.memoryImagePrompt?.trim();
  const quizQuestion = payload.quizQuestion?.trim();
  const quizAnswer = payload.quizAnswer?.trim();
  const usageTip = payload.usageTip?.trim();

  if (
    !simplifiedDefinition ||
    !memoryHook ||
    !memoryImagePrompt ||
    !quizQuestion ||
    !quizAnswer ||
    !usageTip
  ) {
    throw new Error('AI response was missing one or more study fields.');
  }

  return {
    simplifiedDefinition,
    memoryHook,
    memoryImageUri: options?.memoryImageUri?.trim() || payload.memoryImageUri?.trim() || null,
    memoryImagePrompt,
    quizQuestion,
    quizAnswer,
    usageTip,
    model,
    generatedAt,
  };
}

function extractOutputText(payload: ResponsesApiPayload) {
  if (typeof payload.output_text === 'string' && payload.output_text.length > 0) {
    return payload.output_text;
  }

  const chunks =
    payload.output?.flatMap((item) =>
      item.content?.flatMap((contentItem) =>
        contentItem.type === 'output_text' && typeof contentItem.text === 'string'
          ? [contentItem.text]
          : [],
      ) ?? [],
    ) ?? [];

  return chunks.join('').trim();
}

function getPrototypeApiKey() {
  return process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim() || '';
}

function getRequestedModel() {
  return process.env.EXPO_PUBLIC_OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

function buildSmartCoachStudyKit(card: Pick<VocabCard, 'word' | 'definition' | 'example'>) {
  const simplifiedDefinition = simplifyDefinition(card.definition);
  const exampleScene = cleanSentence(card.example);
  const meaningPhrase = toIdeaFragment(simplifiedDefinition);

  return normalizeStudyKit(
    {
      simplifiedDefinition,
      memoryHook: exampleScene
        ? `Picture this scene: ${exampleScene}. That image helps lock in "${card.word}".`
        : `Link "${card.word}" to the idea of ${meaningPhrase}.`,
      memoryImagePrompt: exampleScene
        ? `A cheerful editorial illustration of ${exampleScene.replace(/[.?!]+$/g, '')}, highlighting the idea of "${card.word}", with warm colors and no text.`
        : `A bright, playful illustration that represents "${card.word}" as ${meaningPhrase}, with one clear focal subject and no text.`,
      quizQuestion: `Which word matches this idea: ${meaningPhrase}?`,
      quizAnswer: card.word,
      usageTip: exampleScene
        ? `Reuse the example pattern in your own words: ${exampleScene}.`
        : `Use "${card.word}" when the idea is ${meaningPhrase}.`,
    },
    SMART_COACH_MODEL,
  );
}

function simplifyDefinition(definition: string) {
  const collapsed = definition.replace(/\s+/g, ' ').trim();
  const firstSentence = collapsed.split(/[.;]/)[0]?.trim() || collapsed;
  const firstClause = firstSentence.split(',')[0]?.trim() || firstSentence;
  const normalized = firstClause.length > 110 ? `${firstClause.slice(0, 107).trimEnd()}...` : firstClause;

  return normalized.endsWith('.') ? normalized : `${normalized}.`;
}

function cleanSentence(value: string) {
  const collapsed = value.replace(/\s+/g, ' ').trim();

  if (!collapsed) {
    return '';
  }

  return collapsed.endsWith('.') ? collapsed : `${collapsed}.`;
}

function toIdeaFragment(value: string) {
  const stripped = value.replace(/[.?!]+$/g, '').trim();

  if (!stripped) {
    return 'that meaning';
  }

  return `${stripped.slice(0, 1).toLowerCase()}${stripped.slice(1)}`;
}
