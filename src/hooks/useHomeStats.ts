import { useAppStore } from '../store/useAppStore';
import { isDue } from '../reviewScheduler';
import { getWordStatus } from '../practice';
import { calculateWeekProgress, buildWeeklyActivity, buildTopicRetention, buildHardestWords } from '../stats';

export function useHomeStats() {
  const { cards, logs, profile } = useAppStore();
  const now = new Date();
  const todayKey = new Date().toISOString().slice(0, 10);

  const dueCards = cards.filter((card) => isDue(card.dueAt, now));
  const reviewsToday = logs.filter((entry) => entry.reviewedAt.slice(0, 10) === todayKey).length;

  const todayMistakes = logs.filter(
    (entry) => entry.rating === 'again' && entry.reviewedAt.slice(0, 10) === todayKey,
  );

  const newCount = cards.filter((card) => card.reps === 0).length;
  const masteredCount = cards.filter((card) => getWordStatus(card) === 'Mastered').length;
  const troubleCount = cards.filter((card) => getWordStatus(card) === 'Trouble').length;

  const retention =
    logs.length === 0
      ? 0
      : Math.round((logs.filter((entry) => entry.rating !== 'again').length / logs.length) * 100);

  const streak = calculateStreak(logs, now);
  const progressRatio = Math.min(
    1,
    profile.dailyGoal > 0 ? reviewsToday / profile.dailyGoal : 0,
  );
  const progressPercent = Math.round(progressRatio * 100);
  const reviewsRemaining = Math.max(profile.dailyGoal - reviewsToday, 0);

  const goalCompleted = profile.dailyGoal > 0 && reviewsToday >= profile.dailyGoal;

  const weeklyActivity = buildWeeklyActivity(logs, now);
  const weekProgress = calculateWeekProgress(logs, profile.dailyGoal, now);

  return {
    dueCards,
    reviewsToday,
    todayMistakes,
    newCount,
    masteredCount,
    troubleCount,
    retention,
    streak,
    progressPercent,
    reviewsRemaining,
    goalCompleted,
    weeklyActivity,
    weekProgress,
  };
}

function calculateStreak(entries: any[], now: Date) {
  const getDateKey = (v: string | Date) => new Date(v).toISOString().slice(0, 10);
  const uniqueDays = new Set(entries.map((entry) => getDateKey(entry.reviewedAt)));
  let streak = 0;

  for (let offset = 0; offset < 365; offset += 1) {
    const probe = new Date(now);
    probe.setDate(probe.getDate() - offset);

    if (!uniqueDays.has(getDateKey(probe))) {
      break;
    }

    streak += 1;
  }

  return streak;
}
