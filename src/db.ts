import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  scheduleNextReview,
  type ReviewRating,
  type ReviewSnapshot,
} from './reviewScheduler';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type SkillLevel = DifficultyLevel;
export type WordSource = 'manual' | 'imported' | 'curated' | 'starter';

export type VocabCard = ReviewSnapshot & {
  id: string;
  word: string;
  definition: string;
  example: string;
  createdAt: string;
  source: WordSource;
  topic: string | null;
  partOfSpeech: string | null;
  difficulty: DifficultyLevel | null;
  pronunciation: string | null;
  audioUrl: string | null;
  synonyms: string[];
  antonyms: string[];
  extraExamples: string[];
  lastReviewedAt: string | null;
  lastRating: ReviewRating | null;
};

export type ReviewLogEntry = {
  wordId: string;
  word: string;
  rating: ReviewRating;
  reviewedAt: string;
};

export type WordInput = {
  word: string;
  definition: string;
  example: string;
  source?: WordSource;
  topic?: string | null;
  partOfSpeech?: string | null;
  difficulty?: DifficultyLevel | null;
  pronunciation?: string | null;
  audioUrl?: string | null;
  synonyms?: string[];
  antonyms?: string[];
  extraExamples?: string[];
};

type StoredWordInput = {
  word: string;
  definition: string;
  example: string;
  source: WordSource;
  topic: string | null;
  partOfSpeech: string | null;
  difficulty: DifficultyLevel | null;
  pronunciation: string | null;
  audioUrl: string | null;
  synonyms: string[];
  antonyms: string[];
  extraExamples: string[];
};

export type ImportSummary = {
  addedCount: number;
  duplicateCount: number;
  addedWords: string[];
  duplicateWords: string[];
};

export type AiStudyKit = {
  wordId: string;
  simplifiedDefinition: string;
  memoryHook: string;
  memoryImageUri: string | null;
  memoryImagePrompt: string | null;
  quizQuestion: string;
  quizAnswer: string;
  usageTip: string;
  model: string;
  generatedAt: string;
};

export type AiStudyKitInput = Omit<AiStudyKit, 'wordId'>;

export type UserProfile = {
  skillLevel: SkillLevel | null;
  placementScore: number;
  recommendedTopic: string;
  dailyGoal: number;
  reminderEnabled: boolean;
  reminderHour: number;
  onboardingCompletedAt: string | null;
  favoriteTopic: string;
};

type PersistedReviewState = ReviewSnapshot & {
  lastReviewedAt: string | null;
  lastRating: ReviewRating | null;
};

export type AppSnapshot = {
  version: number;
  exportedAt: string;
  words: VocabCard[];
  reviewLog: ReviewLogEntry[];
  aiStudyKits: AiStudyKit[];
  userProfile: UserProfile;
};

export type SnapshotImportSummary = {
  addedCount: number;
  mergedCount: number;
  skippedCount: number;
};

const DATABASE_NAME = 'vocab-builder.db';

const starterWords: WordInput[] = [
  {
    word: 'Eloquent',
    definition: 'Fluent and persuasive in speaking or writing.',
    example: 'Her eloquent speech inspired the whole team.',
    source: 'starter',
    topic: 'learning',
    difficulty: 'intermediate',
  },
  {
    word: 'Meticulous',
    definition: 'Showing great attention to detail; very careful.',
    example: 'He keeps meticulous notes for each lesson.',
    source: 'starter',
    topic: 'learning',
    difficulty: 'intermediate',
  },
  {
    word: 'Resilient',
    definition: 'Able to recover quickly from difficulties.',
    example: 'A resilient learner keeps improving after mistakes.',
    source: 'starter',
    topic: 'learning',
    difficulty: 'beginner',
  },
];

const defaultUserProfile: UserProfile = {
  skillLevel: null,
  placementScore: 0,
  recommendedTopic: 'learning',
  dailyGoal: 10,
  reminderEnabled: false,
  reminderHour: 19,
  onboardingCompletedAt: null,
  favoriteTopic: 'learning',
};

export async function openAppDatabase() {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await initializeDatabase(db);
  return db;
}

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY NOT NULL,
      word TEXT NOT NULL,
      definition TEXT NOT NULL,
      example TEXT NOT NULL,
      created_at TEXT NOT NULL,
      source TEXT,
      topic TEXT,
      part_of_speech TEXT,
      difficulty TEXT,
      pronunciation TEXT,
      audio_url TEXT,
      synonyms_json TEXT,
      antonyms_json TEXT,
      extra_examples_json TEXT
    );

    CREATE TABLE IF NOT EXISTS review_state (
      word_id TEXT PRIMARY KEY NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      due_at TEXT NOT NULL,
      interval_days REAL NOT NULL,
      ease REAL NOT NULL,
      reps INTEGER NOT NULL,
      lapses INTEGER NOT NULL,
      last_reviewed_at TEXT,
      last_rating TEXT
    );

    CREATE TABLE IF NOT EXISTS review_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      rating TEXT NOT NULL,
      reviewed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_study_kits (
      word_id TEXT PRIMARY KEY NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      simplified_definition TEXT NOT NULL,
      memory_hook TEXT NOT NULL,
      memory_image_uri TEXT,
      memory_image_prompt TEXT,
      quiz_question TEXT NOT NULL,
      quiz_answer TEXT NOT NULL,
      usage_tip TEXT NOT NULL,
      model TEXT NOT NULL,
      generated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      skill_level TEXT,
      placement_score INTEGER NOT NULL DEFAULT 0,
      recommended_topic TEXT NOT NULL DEFAULT 'learning',
      daily_goal INTEGER NOT NULL DEFAULT 10,
      reminder_enabled INTEGER NOT NULL DEFAULT 0,
      reminder_hour INTEGER NOT NULL DEFAULT 19,
      onboarding_completed_at TEXT,
      favorite_topic TEXT NOT NULL DEFAULT 'learning'
    );

    CREATE INDEX IF NOT EXISTS idx_review_state_due_at ON review_state(due_at);
    CREATE INDEX IF NOT EXISTS idx_review_log_reviewed_at ON review_log(reviewed_at);
  `);

  await ensureWordColumns(db);
  await ensureAiStudyKitColumns(db);
  await seedUserProfile(db);
  await backfillExistingWords(db);

  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM words');

  if ((row?.count ?? 0) === 0) {
    await db.withTransactionAsync(async () => {
      for (const word of starterWords) {
        await insertWordRecord(db, sanitizeWordInput(word));
      }
    });
  }
}

export async function loadCards(db: SQLiteDatabase) {
  const cards = await db.getAllAsync<{
    id: string;
    word: string;
    definition: string;
    example: string;
    createdAt: string;
    source: string;
    topic: string | null;
    partOfSpeech: string | null;
    difficulty: DifficultyLevel | null;
    pronunciation: string | null;
    audioUrl: string | null;
    synonymsJson: string | null;
    antonymsJson: string | null;
    extraExamplesJson: string | null;
    dueAt: string;
    intervalDays: number;
    ease: number;
    reps: number;
    lapses: number;
    lastReviewedAt: string | null;
    lastRating: ReviewRating | null;
  }>(`
    SELECT
      w.id,
      w.word,
      w.definition,
      w.example,
      w.created_at AS createdAt,
      COALESCE(w.source, 'manual') AS source,
      w.topic AS topic,
      w.part_of_speech AS partOfSpeech,
      w.difficulty AS difficulty,
      w.pronunciation AS pronunciation,
      w.audio_url AS audioUrl,
      w.synonyms_json AS synonymsJson,
      w.antonyms_json AS antonymsJson,
      w.extra_examples_json AS extraExamplesJson,
      rs.due_at AS dueAt,
      rs.interval_days AS intervalDays,
      rs.ease,
      rs.reps,
      rs.lapses,
      rs.last_reviewed_at AS lastReviewedAt,
      rs.last_rating AS lastRating
    FROM words w
    INNER JOIN review_state rs ON rs.word_id = w.id
    ORDER BY datetime(rs.due_at) ASC, lower(w.word) ASC
  `);

  return cards.map((card) => ({
    ...card,
    source: normalizeSource(card.source),
    synonyms: parseJsonList(card.synonymsJson),
    antonyms: parseJsonList(card.antonymsJson),
    extraExamples: parseJsonList(card.extraExamplesJson),
  }));
}

export async function loadReviewLog(db: SQLiteDatabase) {
  return db.getAllAsync<ReviewLogEntry>(`
    SELECT
      rl.word_id AS wordId,
      w.word AS word,
      rl.rating AS rating,
      rl.reviewed_at AS reviewedAt
    FROM review_log rl
    INNER JOIN words w ON w.id = rl.word_id
    ORDER BY datetime(rl.reviewed_at) DESC
    LIMIT 365
  `);
}

export async function addWord(db: SQLiteDatabase, input: WordInput) {
  const sanitized = sanitizeWordInput(input);

  await db.withTransactionAsync(async () => {
    await insertWordRecord(db, sanitized);
  });
}

export async function importWords(db: SQLiteDatabase, inputs: WordInput[]): Promise<ImportSummary> {
  const normalizedRows = await db.getAllAsync<{ normalizedWord: string }>(
    'SELECT lower(trim(word)) AS normalizedWord FROM words',
  );
  const existingWords = new Set(normalizedRows.map((row) => row.normalizedWord));
  const additions: StoredWordInput[] = [];
  const duplicates: string[] = [];

  for (const input of inputs) {
    const sanitized = sanitizeWordInput(input);
    const normalizedWord = normalizeWord(sanitized.word);

    if (!normalizedWord) {
      continue;
    }

    if (existingWords.has(normalizedWord)) {
      duplicates.push(sanitized.word);
      continue;
    }

    existingWords.add(normalizedWord);
    additions.push(sanitized);
  }

  if (additions.length > 0) {
    await db.withTransactionAsync(async () => {
      for (const input of additions) {
        await insertWordRecord(db, input);
      }
    });
  }

  return {
    addedCount: additions.length,
    duplicateCount: duplicates.length,
    addedWords: additions.map((word) => word.word),
    duplicateWords: duplicates,
  };
}

export async function updateWord(db: SQLiteDatabase, wordId: string, input: WordInput) {
  const sanitized = sanitizeWordInput(input);

  await updateWordRecord(db, wordId, sanitized);
}

export async function exportAppSnapshot(db: SQLiteDatabase): Promise<AppSnapshot> {
  const [words, reviewLog, aiStudyKits, userProfile] = await Promise.all([
    loadCards(db),
    loadAllReviewLog(db),
    loadAllAiStudyKits(db),
    loadUserProfile(db),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    words,
    reviewLog,
    aiStudyKits,
    userProfile,
  };
}

export async function importAppSnapshot(
  db: SQLiteDatabase,
  snapshot: AppSnapshot,
): Promise<SnapshotImportSummary> {
  const existingRows = await db.getAllAsync<{
    id: string;
    normalizedWord: string;
    lastReviewedAt: string | null;
  }>(`
    SELECT
      w.id,
      lower(trim(w.word)) AS normalizedWord,
      rs.last_reviewed_at AS lastReviewedAt
    FROM words w
    INNER JOIN review_state rs ON rs.word_id = w.id
  `);
  const existingByWord = new Map(
    existingRows.map((row) => [row.normalizedWord, row] as const),
  );
  const logsByWordId = new Map<string, ReviewLogEntry[]>();
  const aiByWordId = new Map<string, AiStudyKit>();
  let addedCount = 0;
  let mergedCount = 0;
  let skippedCount = 0;

  for (const log of snapshot.reviewLog ?? []) {
    const bucket = logsByWordId.get(log.wordId) ?? [];
    bucket.push(log);
    logsByWordId.set(log.wordId, bucket);
  }

  for (const kit of snapshot.aiStudyKits ?? []) {
    aiByWordId.set(kit.wordId, kit);
  }

  await db.withTransactionAsync(async () => {
    for (const word of snapshot.words ?? []) {
      const sanitized = sanitizeWordInput(word);
      const normalizedWord = normalizeWord(sanitized.word);

      if (!normalizedWord) {
        skippedCount += 1;
        continue;
      }

      const current = existingByWord.get(normalizedWord);
      const reviewState = getReviewStateFromCard(word);
      const sourceLogs = logsByWordId.get(word.id) ?? [];
      const sourceAiKit = aiByWordId.get(word.id) ?? null;

      if (!current) {
        await insertWordRecord(db, sanitized, {
          id: word.id,
          createdAt: word.createdAt,
          reviewState,
        });
        await replaceReviewArtifacts(db, word.id, sourceLogs, sourceAiKit);
        existingByWord.set(normalizedWord, {
          id: word.id,
          normalizedWord,
          lastReviewedAt: word.lastReviewedAt,
        });
        addedCount += 1;
        continue;
      }

      if (!shouldMergeSnapshotWord(current.lastReviewedAt, word.lastReviewedAt)) {
        skippedCount += 1;
        continue;
      }

      await updateWordRecord(db, current.id, sanitized);
      await replaceReviewState(db, current.id, reviewState);
      await replaceReviewArtifacts(db, current.id, sourceLogs, sourceAiKit);
      existingByWord.set(normalizedWord, {
        ...current,
        lastReviewedAt: word.lastReviewedAt,
      });
      mergedCount += 1;
    }

    if (snapshot.userProfile) {
      await saveUserProfile(db, snapshot.userProfile);
    }
  });

  return {
    addedCount,
    mergedCount,
    skippedCount,
  };
}

async function updateWordRecord(db: SQLiteDatabase, wordId: string, sanitized: StoredWordInput) {
  await db.runAsync(
    `
      UPDATE words
      SET
        word = ?,
        definition = ?,
        example = ?,
        source = ?,
        topic = ?,
        part_of_speech = ?,
        difficulty = ?,
        pronunciation = ?,
        audio_url = ?,
        synonyms_json = ?,
        antonyms_json = ?,
        extra_examples_json = ?
      WHERE id = ?
    `,
    [
      sanitized.word,
      sanitized.definition,
      sanitized.example,
      sanitized.source,
      sanitized.topic,
      sanitized.partOfSpeech,
      sanitized.difficulty,
      sanitized.pronunciation,
      sanitized.audioUrl,
      stringifyJsonList(sanitized.synonyms),
      stringifyJsonList(sanitized.antonyms),
      stringifyJsonList(sanitized.extraExamples),
      wordId,
    ],
  );
}

export async function deleteWord(db: SQLiteDatabase, wordId: string) {
  await db.runAsync('DELETE FROM words WHERE id = ?', [wordId]);
}

export async function reviewWord(db: SQLiteDatabase, card: VocabCard, rating: ReviewRating) {
  const scheduled = scheduleNextReview(card, rating);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
        UPDATE review_state
        SET
          due_at = ?,
          interval_days = ?,
          ease = ?,
          reps = ?,
          lapses = ?,
          last_reviewed_at = ?,
          last_rating = ?
        WHERE word_id = ?
      `,
      [
        scheduled.dueAt,
        scheduled.intervalDays,
        scheduled.ease,
        scheduled.reps,
        scheduled.lapses,
        scheduled.lastReviewedAt,
        scheduled.lastRating,
        card.id,
      ],
    );

    await db.runAsync(
      `
        INSERT INTO review_log (word_id, rating, reviewed_at)
        VALUES (?, ?, ?)
      `,
      [card.id, rating, scheduled.lastReviewedAt],
    );
  });
}

export async function loadAiStudyKit(db: SQLiteDatabase, wordId: string) {
  return db.getFirstAsync<AiStudyKit>(
    `
      SELECT
        word_id AS wordId,
        simplified_definition AS simplifiedDefinition,
        memory_hook AS memoryHook,
        memory_image_uri AS memoryImageUri,
        memory_image_prompt AS memoryImagePrompt,
        quiz_question AS quizQuestion,
        quiz_answer AS quizAnswer,
        usage_tip AS usageTip,
        model,
        generated_at AS generatedAt
      FROM ai_study_kits
      WHERE word_id = ?
    `,
    [wordId],
  );
}

export async function saveAiStudyKit(db: SQLiteDatabase, wordId: string, input: AiStudyKitInput) {
  await db.runAsync(
    `
      INSERT OR REPLACE INTO ai_study_kits (
        word_id,
        simplified_definition,
        memory_hook,
        memory_image_uri,
        memory_image_prompt,
        quiz_question,
        quiz_answer,
        usage_tip,
        model,
        generated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      wordId,
      input.simplifiedDefinition.trim(),
      input.memoryHook.trim(),
      input.memoryImageUri?.trim() || null,
      input.memoryImagePrompt?.trim() || null,
      input.quizQuestion.trim(),
      input.quizAnswer.trim(),
      input.usageTip.trim(),
      input.model.trim(),
      input.generatedAt,
    ],
  );
}

export async function loadUserProfile(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{
    skillLevel: SkillLevel | null;
    placementScore: number;
    recommendedTopic: string;
    dailyGoal: number;
    reminderEnabled: number;
    reminderHour: number;
    onboardingCompletedAt: string | null;
    favoriteTopic: string;
  }>(`
    SELECT
      skill_level AS skillLevel,
      placement_score AS placementScore,
      recommended_topic AS recommendedTopic,
      daily_goal AS dailyGoal,
      reminder_enabled AS reminderEnabled,
      reminder_hour AS reminderHour,
      onboarding_completed_at AS onboardingCompletedAt,
      favorite_topic AS favoriteTopic
    FROM user_profile
    WHERE id = 1
  `);

  if (!row) {
    return defaultUserProfile;
  }

  return {
    skillLevel: row.skillLevel,
    placementScore: row.placementScore,
    recommendedTopic: row.recommendedTopic,
    dailyGoal: row.dailyGoal,
    reminderEnabled: row.reminderEnabled === 1,
    reminderHour: row.reminderHour,
    onboardingCompletedAt: row.onboardingCompletedAt,
    favoriteTopic: row.favoriteTopic,
  } satisfies UserProfile;
}

export async function saveUserProfile(
  db: SQLiteDatabase,
  profile: Partial<UserProfile>,
) {
  const current = await loadUserProfile(db);
  const nextProfile: UserProfile = {
    ...current,
    ...profile,
  };

  await db.runAsync(
    `
      INSERT OR REPLACE INTO user_profile (
        id,
        skill_level,
        placement_score,
        recommended_topic,
        daily_goal,
        reminder_enabled,
        reminder_hour,
        onboarding_completed_at,
        favorite_topic
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      1,
      nextProfile.skillLevel,
      nextProfile.placementScore,
      nextProfile.recommendedTopic,
      nextProfile.dailyGoal,
      nextProfile.reminderEnabled ? 1 : 0,
      nextProfile.reminderHour,
      nextProfile.onboardingCompletedAt,
      nextProfile.favoriteTopic,
    ],
  );
}

async function ensureWordColumns(db: SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(words)');
  const existing = new Set(columns.map((column) => column.name));

  if (!existing.has('source')) {
    await db.execAsync('ALTER TABLE words ADD COLUMN source TEXT');
  }

  if (!existing.has('topic')) {
    await db.execAsync('ALTER TABLE words ADD COLUMN topic TEXT');
  }

  if (!existing.has('part_of_speech')) {
    await db.execAsync('ALTER TABLE words ADD COLUMN part_of_speech TEXT');
  }

  if (!existing.has('difficulty')) {
    await db.execAsync('ALTER TABLE words ADD COLUMN difficulty TEXT');
  }

  if (!existing.has('pronunciation')) {
    await db.execAsync('ALTER TABLE words ADD COLUMN pronunciation TEXT');
  }

  if (!existing.has('audio_url')) {
    await db.execAsync('ALTER TABLE words ADD COLUMN audio_url TEXT');
  }

  if (!existing.has('synonyms_json')) {
    await db.execAsync('ALTER TABLE words ADD COLUMN synonyms_json TEXT');
  }

  if (!existing.has('antonyms_json')) {
    await db.execAsync('ALTER TABLE words ADD COLUMN antonyms_json TEXT');
  }

  if (!existing.has('extra_examples_json')) {
    await db.execAsync('ALTER TABLE words ADD COLUMN extra_examples_json TEXT');
  }
}

async function ensureAiStudyKitColumns(db: SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(ai_study_kits)');
  const existing = new Set(columns.map((column) => column.name));

  if (!existing.has('memory_image_uri')) {
    await db.execAsync('ALTER TABLE ai_study_kits ADD COLUMN memory_image_uri TEXT');
  }

  if (!existing.has('memory_image_prompt')) {
    await db.execAsync('ALTER TABLE ai_study_kits ADD COLUMN memory_image_prompt TEXT');
  }
}

async function seedUserProfile(db: SQLiteDatabase) {
  await db.runAsync(
    `
      INSERT OR IGNORE INTO user_profile (
        id,
        skill_level,
        placement_score,
        recommended_topic,
        daily_goal,
        reminder_enabled,
        reminder_hour,
        onboarding_completed_at,
        favorite_topic
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      1,
      defaultUserProfile.skillLevel,
      defaultUserProfile.placementScore,
      defaultUserProfile.recommendedTopic,
      defaultUserProfile.dailyGoal,
      defaultUserProfile.reminderEnabled ? 1 : 0,
      defaultUserProfile.reminderHour,
      defaultUserProfile.onboardingCompletedAt,
      defaultUserProfile.favoriteTopic,
    ],
  );
}

async function backfillExistingWords(db: SQLiteDatabase) {
  await db.execAsync(`
    UPDATE words SET source = 'manual' WHERE source IS NULL;
    UPDATE words SET difficulty = CASE
      WHEN length(word) <= 7 THEN 'beginner'
      WHEN length(word) <= 10 THEN 'intermediate'
      ELSE 'advanced'
    END
    WHERE difficulty IS NULL;
    UPDATE words SET topic = 'learning' WHERE topic IS NULL;
    UPDATE words SET synonyms_json = '[]' WHERE synonyms_json IS NULL;
    UPDATE words SET antonyms_json = '[]' WHERE antonyms_json IS NULL;
    UPDATE words SET extra_examples_json = '[]' WHERE extra_examples_json IS NULL;
  `);
}

async function insertWordRecord(
  db: SQLiteDatabase,
  input: StoredWordInput,
  options?: {
    id?: string;
    createdAt?: string;
    reviewState?: PersistedReviewState;
  },
) {
  const createdAt = options?.createdAt ?? new Date().toISOString();
  const id = options?.id ?? createId();
  const reviewState = options?.reviewState ?? {
    dueAt: createdAt,
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    lastRating: null,
  };

  await db.runAsync(
    `
      INSERT INTO words (
        id,
        word,
        definition,
        example,
        created_at,
        source,
        topic,
        part_of_speech,
        difficulty,
        pronunciation,
        audio_url,
        synonyms_json,
        antonyms_json,
        extra_examples_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.word,
      input.definition,
      input.example,
      createdAt,
      input.source,
      input.topic,
      input.partOfSpeech,
      input.difficulty,
      input.pronunciation,
      input.audioUrl,
      stringifyJsonList(input.synonyms),
      stringifyJsonList(input.antonyms),
      stringifyJsonList(input.extraExamples),
    ],
  );

  await db.runAsync(
    `
      INSERT INTO review_state (
        word_id,
        due_at,
        interval_days,
        ease,
        reps,
        lapses,
        last_reviewed_at,
        last_rating
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      reviewState.dueAt,
      reviewState.intervalDays,
      reviewState.ease,
      reviewState.reps,
      reviewState.lapses,
      reviewState.lastReviewedAt,
      reviewState.lastRating,
    ],
  );
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeWordInput(input: WordInput): StoredWordInput {
  const normalizedWord = input.word.trim();
  const difficulty = input.difficulty ?? inferDifficulty(normalizedWord);
  const extraExamples = normalizeList(input.extraExamples);
  const primaryExample = input.example.trim() || extraExamples[0] || 'No example yet.';

  return {
    word: normalizedWord,
    definition: input.definition.trim(),
    example: primaryExample,
    source: input.source ?? 'manual',
    topic: input.topic?.trim() || 'learning',
    partOfSpeech: input.partOfSpeech?.trim() || null,
    difficulty,
    pronunciation: input.pronunciation?.trim() || null,
    audioUrl: input.audioUrl?.trim() || null,
    synonyms: normalizeList(input.synonyms),
    antonyms: normalizeList(input.antonyms),
    extraExamples,
  };
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

function normalizeWord(word: string) {
  return word.trim().toLowerCase();
}

function normalizeSource(source: string): WordSource {
  if (
    source === 'imported' ||
    source === 'curated' ||
    source === 'starter'
  ) {
    return source;
  }

  return 'manual';
}

async function loadAllReviewLog(db: SQLiteDatabase) {
  return db.getAllAsync<ReviewLogEntry>(`
    SELECT
      rl.word_id AS wordId,
      w.word AS word,
      rl.rating AS rating,
      rl.reviewed_at AS reviewedAt
    FROM review_log rl
    INNER JOIN words w ON w.id = rl.word_id
    ORDER BY datetime(rl.reviewed_at) DESC
  `);
}

async function loadAllAiStudyKits(db: SQLiteDatabase) {
  return db.getAllAsync<AiStudyKit>(`
    SELECT
      word_id AS wordId,
      simplified_definition AS simplifiedDefinition,
      memory_hook AS memoryHook,
      memory_image_uri AS memoryImageUri,
      memory_image_prompt AS memoryImagePrompt,
      quiz_question AS quizQuestion,
      quiz_answer AS quizAnswer,
      usage_tip AS usageTip,
      model,
      generated_at AS generatedAt
    FROM ai_study_kits
  `);
}

function normalizeList(values?: string[] | null) {
  if (!values?.length) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function parseJsonList(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeList(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return [];
  }
}

function stringifyJsonList(values: string[]) {
  return JSON.stringify(normalizeList(values));
}

function getReviewStateFromCard(card: ReviewSnapshot & {
  lastReviewedAt: string | null;
  lastRating: ReviewRating | null;
}) {
  return {
    dueAt: card.dueAt,
    intervalDays: card.intervalDays,
    ease: card.ease,
    reps: card.reps,
    lapses: card.lapses,
    lastReviewedAt: card.lastReviewedAt,
    lastRating: card.lastRating,
  } satisfies PersistedReviewState;
}

function shouldMergeSnapshotWord(
  existingLastReviewedAt: string | null,
  incomingLastReviewedAt: string | null,
) {
  if (!existingLastReviewedAt) {
    return true;
  }

  if (!incomingLastReviewedAt) {
    return false;
  }

  return new Date(incomingLastReviewedAt).getTime() >= new Date(existingLastReviewedAt).getTime();
}

async function replaceReviewState(
  db: SQLiteDatabase,
  wordId: string,
  reviewState: PersistedReviewState,
) {
  await db.runAsync(
    `
      UPDATE review_state
      SET
        due_at = ?,
        interval_days = ?,
        ease = ?,
        reps = ?,
        lapses = ?,
        last_reviewed_at = ?,
        last_rating = ?
      WHERE word_id = ?
    `,
    [
      reviewState.dueAt,
      reviewState.intervalDays,
      reviewState.ease,
      reviewState.reps,
      reviewState.lapses,
      reviewState.lastReviewedAt,
      reviewState.lastRating,
      wordId,
    ],
  );
}

async function replaceReviewArtifacts(
  db: SQLiteDatabase,
  wordId: string,
  reviewLog: ReviewLogEntry[],
  aiStudyKit: AiStudyKit | null,
) {
  await db.runAsync('DELETE FROM review_log WHERE word_id = ?', [wordId]);

  for (const log of reviewLog) {
    await db.runAsync(
      `
        INSERT INTO review_log (word_id, rating, reviewed_at)
        VALUES (?, ?, ?)
      `,
      [wordId, log.rating, log.reviewedAt],
    );
  }

  if (aiStudyKit) {
    await saveAiStudyKit(db, wordId, {
      simplifiedDefinition: aiStudyKit.simplifiedDefinition,
      memoryHook: aiStudyKit.memoryHook,
      memoryImageUri: null,
      memoryImagePrompt: aiStudyKit.memoryImagePrompt,
      quizQuestion: aiStudyKit.quizQuestion,
      quizAnswer: aiStudyKit.quizAnswer,
      usageTip: aiStudyKit.usageTip,
      model: aiStudyKit.model,
      generatedAt: aiStudyKit.generatedAt,
    });
  }
}
