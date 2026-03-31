import type { DifficultyLevel, WordInput } from '../db';

export type ImportDifficulty = DifficultyLevel | 'mixed';
export type FetchTopicWordsOptions = {
  max?: number;
  difficulty?: ImportDifficulty;
};

type DatamuseWord = {
  word: string;
};

type DictionaryEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings?: Array<{
    partOfSpeech?: string;
    synonyms?: string[];
    antonyms?: string[];
    definitions?: Array<{
      definition?: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
  }>;
};

const DATAMUSE_API_URL = 'https://api.datamuse.com/words';
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

const topicFallbacks: Record<string, WordInput[]> = {
  learning: [
    {
      word: 'Curious',
      definition: 'Eager to know or learn something.',
      example: 'A curious student keeps asking better questions.',
      source: 'curated',
      topic: 'learning',
      difficulty: 'beginner',
    },
    {
      word: 'Diligent',
      definition: 'Careful and steady in effort or work.',
      example: 'She was diligent about reviewing each card every evening.',
      source: 'curated',
      topic: 'learning',
      difficulty: 'intermediate',
    },
    {
      word: 'Insight',
      definition: 'A clear and deep understanding of a situation or idea.',
      example: 'The example sentence gave him insight into the new word.',
      source: 'curated',
      topic: 'learning',
      difficulty: 'intermediate',
    },
    {
      word: 'Retain',
      definition: 'To keep something in memory or continue to hold it.',
      example: 'Spaced repetition helps learners retain new vocabulary.',
      source: 'curated',
      topic: 'learning',
      difficulty: 'intermediate',
    },
    {
      word: 'Mnemonic',
      definition: 'A memory aid used to help remember information.',
      example: 'She created a mnemonic to remember the difficult term.',
      source: 'curated',
      topic: 'learning',
      difficulty: 'advanced',
    },
  ],
  science: [
    {
      word: 'Hypothesis',
      definition: 'A proposed explanation made as a starting point for investigation.',
      example: 'Their hypothesis predicted how the material would react under heat.',
      source: 'curated',
      topic: 'science',
      difficulty: 'advanced',
    },
    {
      word: 'Variable',
      definition: 'A factor or condition that can change in an experiment.',
      example: 'The researchers controlled every variable except temperature.',
      source: 'curated',
      topic: 'science',
      difficulty: 'intermediate',
    },
    {
      word: 'Molecule',
      definition: 'A group of atoms bonded together.',
      example: 'Each water molecule contains two hydrogen atoms and one oxygen atom.',
      source: 'curated',
      topic: 'science',
      difficulty: 'intermediate',
    },
    {
      word: 'Theory',
      definition: 'A well-supported explanation of natural events.',
      example: 'The class discussed why a theory is stronger than a simple guess.',
      source: 'curated',
      topic: 'science',
      difficulty: 'beginner',
    },
    {
      word: 'Observe',
      definition: 'To watch or notice something carefully.',
      example: 'Scientists observe patterns before drawing conclusions.',
      source: 'curated',
      topic: 'science',
      difficulty: 'beginner',
    },
  ],
  travel: [
    {
      word: 'Itinerary',
      definition: 'A planned route or schedule for a trip.',
      example: 'Their itinerary included three cities in five days.',
      source: 'curated',
      topic: 'travel',
      difficulty: 'advanced',
    },
    {
      word: 'Transit',
      definition: 'The act of passing through or being carried from one place to another.',
      example: 'They had only forty minutes in transit before the next flight.',
      source: 'curated',
      topic: 'travel',
      difficulty: 'intermediate',
    },
    {
      word: 'Customs',
      definition: 'The government checkpoint where luggage and goods are inspected.',
      example: 'They waited in line at customs after landing.',
      source: 'curated',
      topic: 'travel',
      difficulty: 'intermediate',
    },
    {
      word: 'Lodging',
      definition: 'A place where someone stays temporarily.',
      example: 'They booked simple lodging near the train station.',
      source: 'curated',
      topic: 'travel',
      difficulty: 'intermediate',
    },
    {
      word: 'Souvenir',
      definition: 'An item kept as a reminder of a place or event.',
      example: 'She bought a small souvenir from the museum gift shop.',
      source: 'curated',
      topic: 'travel',
      difficulty: 'intermediate',
    },
  ],
  art: [
    {
      word: 'Palette',
      definition: 'The range of colors used by an artist, or the board that holds those colors.',
      example: 'The painter chose a warm palette for the sunset scene.',
      source: 'curated',
      topic: 'art',
      difficulty: 'intermediate',
    },
    {
      word: 'Texture',
      definition: 'The feel, appearance, or consistency of a surface or artwork.',
      example: 'The thick brushstrokes added texture to the canvas.',
      source: 'curated',
      topic: 'art',
      difficulty: 'intermediate',
    },
    {
      word: 'Composition',
      definition: 'The arrangement of visual elements in a work of art.',
      example: 'The composition drew the eye toward the central figure.',
      source: 'curated',
      topic: 'art',
      difficulty: 'advanced',
    },
    {
      word: 'Contrast',
      definition: 'A strong difference between elements such as light and dark or rough and smooth.',
      example: 'The artist used contrast to make the subject stand out.',
      source: 'curated',
      topic: 'art',
      difficulty: 'intermediate',
    },
    {
      word: 'Sketch',
      definition: 'A quick, simple drawing that captures the main idea of something.',
      example: 'He started with a sketch before painting the final piece.',
      source: 'curated',
      topic: 'art',
      difficulty: 'beginner',
    },
  ],
  business: [
    {
      word: 'Strategy',
      definition: 'A plan designed to achieve a major goal.',
      example: 'Their marketing strategy focused on repeat customers.',
      source: 'curated',
      topic: 'business',
      difficulty: 'intermediate',
    },
    {
      word: 'Revenue',
      definition: 'Income produced by a business before expenses are removed.',
      example: 'The company increased revenue after launching the new product.',
      source: 'curated',
      topic: 'business',
      difficulty: 'intermediate',
    },
    {
      word: 'Margin',
      definition: 'The difference between cost and selling price, often shown as profit.',
      example: 'They raised prices to improve their profit margin.',
      source: 'curated',
      topic: 'business',
      difficulty: 'intermediate',
    },
    {
      word: 'Negotiate',
      definition: 'To discuss something in order to reach an agreement.',
      example: 'The manager had to negotiate a better contract.',
      source: 'curated',
      topic: 'business',
      difficulty: 'advanced',
    },
    {
      word: 'Forecast',
      definition: 'A prediction of future results based on current information.',
      example: 'The sales forecast helped the team set its quarterly goals.',
      source: 'curated',
      topic: 'business',
      difficulty: 'intermediate',
    },
  ],
};

export async function fetchTopicWords(
  topic: string,
  options: FetchTopicWordsOptions = {},
): Promise<WordInput[]> {
  const normalizedTopic = normalizeTopic(topic);
  const max = Math.max(3, Math.min(12, options.max ?? 5));
  const difficulty = options.difficulty ?? 'mixed';
  const fallbackWords = getFallbackWords(normalizedTopic);
  const candidates = await getCandidateWords(normalizedTopic, max);
  const discoveredWords = prioritizeByDifficulty(
    (await enrichCandidates(candidates, max * 3)).map((word) => ({
      ...word,
      topic: normalizedTopic,
    })),
    difficulty,
  );
  const filteredDiscoveredWords = discoveredWords.slice(0, max);
  const prioritizedFallbackWords = prioritizeByDifficulty(
    fallbackWords.map((word) => ({
      ...word,
      topic: normalizedTopic,
    })),
    difficulty,
  );

  if (filteredDiscoveredWords.length >= max) {
    return filteredDiscoveredWords.slice(0, max);
  }

  return appendFallbackWords(filteredDiscoveredWords, prioritizedFallbackWords, max);
}

export async function fetchWordDetails(
  word: string,
  options?: {
    topic?: string | null;
    source?: WordInput['source'];
  },
): Promise<WordInput | null> {
  const trimmedWord = word.trim();

  if (!trimmedWord) {
    return null;
  }

  const result = await fetchDictionaryEntry(trimmedWord);

  if (!result) {
    return null;
  }

  return {
    ...result,
    topic: options?.topic ?? result.topic ?? null,
    source: options?.source ?? result.source ?? 'manual',
  };
}

async function getCandidateWords(topic: string, max: number) {
  const queries = [
    `ml=${encodeURIComponent(topic)}`,
    `rel_trg=${encodeURIComponent(topic)}`,
    `topics=${encodeURIComponent(topic)}`,
  ];

  const seen = new Set<string>();
  const collected: string[] = [];

  for (const query of queries) {
    const response = await fetch(`${DATAMUSE_API_URL}?${query}&max=${Math.max(max * 6, 24)}`);

    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as DatamuseWord[];

    for (const word of collectCandidates(data)) {
      const normalized = word.toLowerCase();

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      collected.push(word);
    }
  }

  return collected;
}

async function enrichCandidates(candidates: string[], max: number) {
  const words: WordInput[] = [];

  for (const candidate of candidates) {
    const result = await fetchDictionaryEntry(candidate);

    if (!result) {
      continue;
    }

    words.push(result);

    if (words.length >= max) {
      break;
    }
  }

  return words;
}

function collectCandidates(feed: DatamuseWord[]) {
  const candidates: string[] = [];

  for (const item of feed) {
    const word = item.word.trim();

    if (!isImportableWord(word)) {
      continue;
    }

    candidates.push(word);
  }

  return candidates;
}

async function fetchDictionaryEntry(word: string): Promise<WordInput | null> {
  try {
    const response = await fetch(`${DICTIONARY_API_URL}/${encodeURIComponent(word)}`);

    if (!response.ok) {
      return null;
    }

    const entries = (await response.json()) as DictionaryEntry[];
    const entry = entries[0];

    if (!entry) {
      return null;
    }

    const firstMeaning = entry?.meanings?.[0];
    const firstDefinition = firstMeaning?.definitions?.[0];
    const pronunciation = entry?.phonetic?.trim() || entry?.phonetics?.[0]?.text?.trim() || null;
    const audioUrl =
      entry?.phonetics?.find((item) => item.audio?.trim())?.audio?.trim() || null;
    const examples = collectExamples(entry);
    const synonyms = collectTerms(entry, 'synonyms');
    const antonyms = collectTerms(entry, 'antonyms');

    if (!entry?.word || !firstDefinition?.definition) {
      return null;
    }

    return {
      word: entry.word,
      definition: firstDefinition.definition,
      example: examples[0] || `Try using "${entry.word}" in a sentence of your own.`,
      source: 'imported',
      topic: null,
      partOfSpeech: firstMeaning?.partOfSpeech?.trim() || null,
      difficulty: inferDifficulty(entry.word),
      pronunciation,
      audioUrl,
      synonyms,
      antonyms,
      extraExamples: examples.slice(1, 4),
    };
  } catch {
    return null;
  }
}

function appendFallbackWords(currentWords: WordInput[], fallbackWords: WordInput[], max: number) {
  const existing = new Set(currentWords.map((word) => word.word.toLowerCase()));
  const combined = [...currentWords];

  for (const word of fallbackWords) {
    const normalized = word.word.toLowerCase();

    if (existing.has(normalized)) {
      continue;
    }

    existing.add(normalized);
    combined.push(word);

    if (combined.length >= max) {
      break;
    }
  }

  return combined.slice(0, max);
}

function getFallbackWords(topic: string) {
  return topicFallbacks[topic] ?? topicFallbacks.learning ?? [];
}

function normalizeTopic(topic: string) {
  return topic.trim().toLowerCase() || 'learning';
}

function inferDifficulty(word: string): DifficultyLevel {
  if (word.length <= 7) {
    return 'beginner';
  }

  if (word.length <= 10) {
    return 'intermediate';
  }

  return 'advanced';
}

function prioritizeByDifficulty(words: WordInput[], difficulty: ImportDifficulty) {
  if (difficulty === 'mixed') {
    return words;
  }

  const scored = words.map((word, index) => ({
    word,
    index,
    score: getDifficultyPriority(resolveDifficulty(word), difficulty),
  }));

  return scored
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return left.index - right.index;
    })
    .map((item) => item.word);
}

function getDifficultyPriority(
  difficulty: DifficultyLevel,
  preferredDifficulty: DifficultyLevel,
) {
  if (difficulty === preferredDifficulty) {
    return 0;
  }

  if (preferredDifficulty === 'beginner') {
    return difficulty === 'intermediate' ? 1 : 2;
  }

  if (preferredDifficulty === 'intermediate') {
    return difficulty === 'beginner' ? 1 : 2;
  }

  return difficulty === 'intermediate' ? 1 : 2;
}

function collectExamples(entry: DictionaryEntry) {
  const examples: string[] = [];

  for (const meaning of entry.meanings ?? []) {
    for (const definition of meaning.definitions ?? []) {
      const example = definition.example?.trim();

      if (example) {
        examples.push(example);
      }
    }
  }

  return uniqueValues(examples);
}

function resolveDifficulty(word: WordInput): DifficultyLevel {
  if (
    word.difficulty === 'beginner' ||
    word.difficulty === 'intermediate' ||
    word.difficulty === 'advanced'
  ) {
    return word.difficulty;
  }

  return inferDifficulty(word.word);
}

function collectTerms(entry: DictionaryEntry, kind: 'synonyms' | 'antonyms') {
  const collected: string[] = [];

  for (const meaning of entry.meanings ?? []) {
    collected.push(...(meaning[kind] ?? []));

    for (const definition of meaning.definitions ?? []) {
      collected.push(...(definition[kind] ?? []));
    }
  }

  return uniqueValues(collected)
    .filter((term) => term.length <= 20)
    .slice(0, 6);
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();

    if (!trimmed || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(trimmed);
  }

  return unique;
}

function isImportableWord(word: string) {
  if (!word) {
    return false;
  }

  if (word.includes(' ')) {
    return false;
  }

  if (!/^[a-zA-Z-]+$/.test(word)) {
    return false;
  }

  if (word.length < 4 || word.length > 14) {
    return false;
  }

  return true;
}
