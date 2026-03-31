import type { ReviewLogEntry, VocabCard } from './db';

export type PracticeMode = 'flashcard' | 'choices' | 'typing' | 'context' | 'usage';
export type QueueMode = 'due' | 'mistakes' | 'all';
export type LibraryFilter = 'all' | 'favorites' | 'new' | 'learning' | 'mastered' | 'trouble';

export function buildMultipleChoiceOptions(currentCard: VocabCard, cards: VocabCard[]) {
  const distractors = cards
    .filter((card) => card.id !== currentCard.id)
    .sort((left, right) => {
      const topicBoost =
        Number(right.topic === currentCard.topic) - Number(left.topic === currentCard.topic);

      if (topicBoost !== 0) {
        return topicBoost;
      }

      const difficultyGap =
        getDifficultyWeight(left.difficulty) - getDifficultyWeight(right.difficulty);

      if (difficultyGap !== 0) {
        return difficultyGap;
      }

      return Math.abs(left.word.length - currentCard.word.length) - Math.abs(right.word.length - currentCard.word.length);
    })
    .slice(0, 12)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((card) => card.word);

  const options = [...distractors, currentCard.word];
  return shuffle(options);
}

export function buildUsageOptions(currentCard: VocabCard, cards: VocabCard[]) {
  const distractors = cards
    .filter((card) => card.id !== currentCard.id)
    .map((card) => card.example)
    .filter((example) => example && example !== currentCard.example)
    .slice(0, 12)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return shuffle([currentCard.example, ...distractors]);
}

export function buildContextPrompt(currentCard: VocabCard) {
  const directPattern = new RegExp(`\\b${escapeRegExp(currentCard.word)}\\b`, 'i');
  const blankedExample = currentCard.example.replace(directPattern, '_____');

  if (blankedExample !== currentCard.example) {
    return blankedExample;
  }

  return `Fill the blank with the best word: _____ ${currentCard.example}`;
}

export function isTypingAnswerCorrect(answer: string, currentCard: VocabCard) {
  return normalizeAnswer(answer) === normalizeAnswer(currentCard.word);
}

export function getSessionCards(
  queueMode: QueueMode,
  cards: VocabCard[],
  dueCards: VocabCard[],
  logs: ReviewLogEntry[],
  now = new Date(),
) {
  if (queueMode === 'all') {
    return sortSessionCards(cards);
  }

  if (queueMode === 'mistakes') {
    const today = getDateKey(now);
    const mistakenIds = new Set(
      logs
        .filter((entry) => entry.rating === 'again' && getDateKey(entry.reviewedAt) === today)
        .map((entry) => entry.wordId),
    );

    return sortSessionCards(cards.filter((card) => mistakenIds.has(card.id)));
  }

  return sortSessionCards(dueCards);
}

export function getWordStatus(card: VocabCard) {
  if (card.reps === 0) {
    return 'New';
  }

  if (card.lapses >= 2) {
    return 'Trouble';
  }

  if (card.reps >= 4 && card.intervalDays >= 7) {
    return 'Mastered';
  }

  return 'Learning';
}

export function getWhyNow(card: VocabCard, now = new Date()) {
  const dueInMs = new Date(card.dueAt).getTime() - now.getTime();

  if (card.lapses >= 2) {
    return 'This word came back because you have missed it a few times recently.';
  }

  if (dueInMs <= 0) {
    return 'This word is due now based on your review spacing schedule.';
  }

  if (card.reps === 0) {
    return 'This is a new word that has not been reviewed yet.';
  }

  return 'This word is returning at its next scheduled review point.';
}

function getDifficultyWeight(difficulty: VocabCard['difficulty']) {
  switch (difficulty) {
    case 'beginner':
      return 1;
    case 'intermediate':
      return 2;
    case 'advanced':
      return 3;
    default:
      return 2;
  }
}

function sortSessionCards(cards: VocabCard[]) {
  return [...cards].sort((left, right) => {
    const favoriteBoost = Number(right.isFavorite) - Number(left.isFavorite);

    if (favoriteBoost !== 0) {
      return favoriteBoost;
    }

    const dueGap = new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();

    if (dueGap !== 0) {
      return dueGap;
    }

    if (left.lapses !== right.lapses) {
      return right.lapses - left.lapses;
    }

    return left.word.localeCompare(right.word);
  });
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z-]/g, '');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[nextIndex] as T;
    copy[nextIndex] = current as T;
  }

  return copy;
}
