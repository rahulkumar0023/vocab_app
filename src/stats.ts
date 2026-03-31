import type { ReviewLogEntry, VocabCard } from './db';

export type WeeklyActivityPoint = {
  label: string;
  count: number;
  isToday: boolean;
};

export type TopicRetention = {
  topic: string;
  retention: number;
  total: number;
};

export type HardWordInsight = {
  wordId: string;
  word: string;
  troubleScore: number;
  lapses: number;
  misses: number;
  topic: string | null;
};

export function buildWeeklyActivity(logs: ReviewLogEntry[], now = new Date()) {
  const countsByDay = new Map<string, number>();

  for (const entry of logs) {
    const key = getDateKey(entry.reviewedAt);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const points: WeeklyActivityPoint[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    const key = getDateKey(day);

    points.push({
      label: day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3),
      count: countsByDay.get(key) ?? 0,
      isToday: offset === 0,
    });
  }

  return points;
}

export function buildTopicRetention(cards: VocabCard[], logs: ReviewLogEntry[]) {
  const topicByWordId = new Map(cards.map((card) => [card.id, card.topic ?? 'general'] as const));
  const totals = new Map<string, { correct: number; total: number }>();

  for (const entry of logs) {
    const topic = topicByWordId.get(entry.wordId) ?? 'general';
    const bucket = totals.get(topic) ?? { correct: 0, total: 0 };
    bucket.total += 1;

    if (entry.rating !== 'again') {
      bucket.correct += 1;
    }

    totals.set(topic, bucket);
  }

  return [...totals.entries()]
    .map(([topic, value]) => ({
      topic,
      total: value.total,
      retention: value.total === 0 ? 0 : Math.round((value.correct / value.total) * 100),
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 4) satisfies TopicRetention[];
}

export function buildHardestWords(cards: VocabCard[], logs: ReviewLogEntry[]) {
  const missesByWordId = new Map<string, number>();

  for (const entry of logs) {
    if (entry.rating !== 'again') {
      continue;
    }

    missesByWordId.set(entry.wordId, (missesByWordId.get(entry.wordId) ?? 0) + 1);
  }

  return cards
    .map((card) => {
      const misses = missesByWordId.get(card.id) ?? 0;
      const troubleScore = card.lapses * 2 + misses + (card.reps === 0 ? 0 : 1);

      return {
        wordId: card.id,
        word: card.word,
        topic: card.topic,
        troubleScore,
        lapses: card.lapses,
        misses,
      };
    })
    .filter((card) => card.troubleScore > 0)
    .sort((left, right) => right.troubleScore - left.troubleScore)
    .slice(0, 5) satisfies HardWordInsight[];
}

export function calculateWeekProgress(
  logs: ReviewLogEntry[],
  dailyGoal: number,
  now = new Date(),
) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 6);
  const reviews = logs.filter((entry) => new Date(entry.reviewedAt) >= cutoff).length;
  const target = dailyGoal * 7;
  const ratio = target === 0 ? 0 : Math.min(1, reviews / target);

  return {
    reviews,
    target,
    ratio,
  };
}

function getDateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}
