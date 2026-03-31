import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';

initializeApp();

const db = getFirestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');

const DAILY_LIMIT = 5;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const REGION = 'us-central1';

const studyKitSchema = {
  type: 'object',
  properties: {
    simplifiedDefinition: {
      type: 'string',
      description: 'A short, simpler version of the word definition.',
    },
    memoryHook: {
      type: 'string',
      description: 'A vivid memory hook for the learner.',
    },
    memoryImagePrompt: {
      type: 'string',
      description:
        'A short visual prompt for a fun mnemonic illustration. No text overlays or labels.',
    },
    quizQuestion: {
      type: 'string',
      description: 'A short recall question for the word.',
    },
    quizAnswer: {
      type: 'string',
      description: 'The answer to the quiz question.',
    },
    usageTip: {
      type: 'string',
      description: 'A concise note about how to use the word naturally.',
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
};

export const generateStudyKit = onRequest(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '256MiB',
    cors: true,
    secrets: [geminiApiKey],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    const deviceId = parseDeviceId(request.get('x-vocab-device-id'));

    if (!deviceId) {
      response.status(400).json({ error: 'Missing device identifier.' });
      return;
    }

    let card;

    try {
      card = parseCardInput(request.body);
    } catch (error) {
      response.status(400).json({ error: error.message });
      return;
    }

    const dateKey = new Date().toISOString().slice(0, 10);

    try {
      await assertBelowDailyLimit(deviceId, dateKey);
    } catch (error) {
      response.status(429).json({
        error: error.message,
        provider: 'gemini',
        dailyLimit: DAILY_LIMIT,
        remainingToday: 0,
      });
      return;
    }

    try {
      const studyKit = await generateGeminiStudyKit(card, geminiApiKey.value());
      let memoryImage = null;
      let imageError = null;

      try {
        memoryImage = await generateGeminiMemoryImage(
          studyKit.memoryImagePrompt,
          geminiApiKey.value(),
        );
      } catch (error) {
        imageError = error.message || 'Gemini could not generate a memory image.';
      }

      const remainingToday = await incrementDailyUsage(deviceId, dateKey);

      response.json({
        studyKit: {
          ...studyKit,
          model: GEMINI_MODEL,
          generatedAt: new Date().toISOString(),
        },
        memoryImageBase64: memoryImage?.base64 ?? null,
        memoryImageMimeType: memoryImage?.mimeType ?? null,
        imageError,
        provider: 'gemini',
        dailyLimit: DAILY_LIMIT,
        remainingToday,
      });
    } catch (error) {
      response.status(500).json({
        error: error.message || 'Gemini generation failed.',
        provider: 'gemini',
        dailyLimit: DAILY_LIMIT,
      });
    }
  },
);

function parseCardInput(data) {
  const word = asRequiredString(data?.word, 'word');
  const definition = asRequiredString(data?.definition, 'definition');
  const example = asRequiredString(data?.example, 'example');

  return {
    word,
    definition,
    example,
  };
}

function asRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing or invalid ${fieldName}.`);
  }

  return value.trim();
}

function parseDeviceId(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();
  return normalized.length > 4 ? normalized.slice(0, 120) : '';
}

async function assertBelowDailyLimit(deviceId, dateKey) {
  const snapshot = await getUsageRef(deviceId, dateKey).get();
  const count = snapshot.get('count') ?? 0;

  if (count >= DAILY_LIMIT) {
    throw new Error(
      'Daily Gemini study-kit limit reached. Smart Coach fallback should be used instead.',
    );
  }
}

async function incrementDailyUsage(deviceId, dateKey) {
  const usageRef = getUsageRef(deviceId, dateKey);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const nextCount = (snapshot.get('count') ?? 0) + 1;

    if (nextCount > DAILY_LIMIT) {
      throw new Error(
        'Daily Gemini study-kit limit reached. Smart Coach fallback should be used instead.',
      );
    }

    transaction.set(
      usageRef,
      {
        deviceId,
        dateKey,
        count: nextCount,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: snapshot.exists
          ? snapshot.get('createdAt') ?? FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return DAILY_LIMIT - nextCount;
  });
}

function getUsageRef(deviceId, dateKey) {
  return db.collection('aiUsage').doc(`${deviceId}_${dateKey}`);
}

async function generateGeminiStudyKit(card, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(card),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 250,
          responseMimeType: 'application/json',
          responseJsonSchema: studyKitSchema,
        },
      }),
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Gemini request failed with ${response.status}.`);
  }

  const outputText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof outputText !== 'string' || outputText.trim().length === 0) {
    throw new Error('Gemini returned no structured study kit.');
  }

  let parsed;

  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error('Gemini returned invalid JSON.');
  }

  validateStudyKit(parsed);
  return parsed;
}

function validateStudyKit(payload) {
  const requiredFields = [
    'simplifiedDefinition',
    'memoryHook',
    'memoryImagePrompt',
    'quizQuestion',
    'quizAnswer',
    'usageTip',
  ];

  for (const field of requiredFields) {
    if (typeof payload?.[field] !== 'string' || payload[field].trim().length === 0) {
      throw new Error(`Gemini response was missing ${field}.`);
    }
  }
}

async function generateGeminiMemoryImage(imagePrompt, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildImagePrompt(imagePrompt),
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['Image'],
          imageConfig: {
            aspectRatio: '4:3',
            imageSize: '1K',
          },
        },
      }),
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Gemini image request failed with ${response.status}.`);
  }

  const parts = payload?.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    const inlineData = part?.inlineData ?? part?.inline_data;
    const data = inlineData?.data;
    const mimeType = inlineData?.mimeType ?? inlineData?.mime_type;

    if (typeof data === 'string' && data.length > 0) {
      return {
        base64: data,
        mimeType: typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/png',
      };
    }
  }

  throw new Error('Gemini returned no mnemonic image.');
}

function buildPrompt(card) {
  return [
    'You are an expert vocabulary coach for a mobile learner app.',
    'Return a compact JSON study kit for exactly one word.',
    'Keep every field short, concrete, and beginner-friendly.',
    `Word: ${card.word}`,
    `Definition: ${card.definition}`,
    `Example: ${card.example}`,
    'Return these fields only: simplifiedDefinition, memoryHook, memoryImagePrompt, quizQuestion, quizAnswer, usageTip.',
    'memoryImagePrompt should describe one playful visual scene that helps the learner remember the word. Do not mention text, captions, or labels inside the image.',
  ].join('\n');
}

function buildImagePrompt(memoryImagePrompt) {
  return [
    'Create a warm, playful mnemonic illustration for a vocabulary learning app.',
    memoryImagePrompt,
    'Style: bright editorial illustration, expressive characters, clean composition, optimistic mood.',
    'Important: no words, letters, captions, or text overlays anywhere in the image.',
  ].join('\n');
}
