export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export type ReviewSnapshot = {
  dueAt: string;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
};

export type ScheduledReview = {
  dueAt: string;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  lastReviewedAt: string;
  lastRating: ReviewRating;
};

const MIN_EASE = 1.3;
const AGAIN_DELAY_MINUTES = 10;

export function scheduleNextReview(
  snapshot: ReviewSnapshot,
  rating: ReviewRating,
  now = new Date(),
): ScheduledReview {
  let ease = snapshot.ease;
  let reps = snapshot.reps;
  let lapses = snapshot.lapses;
  let intervalDays = snapshot.intervalDays;
  let dueAt = now.toISOString();

  switch (rating) {
    case 'again':
      ease = clampEase(snapshot.ease - 0.2);
      reps = 0;
      lapses = snapshot.lapses + 1;
      intervalDays = roundDays(AGAIN_DELAY_MINUTES / (24 * 60));
      dueAt = addMinutes(now, AGAIN_DELAY_MINUTES).toISOString();
      break;
    case 'hard':
      ease = clampEase(snapshot.ease - 0.05);
      reps = snapshot.reps + 1;
      intervalDays = roundDays(snapshot.reps === 0 ? 1 : Math.max(1, snapshot.intervalDays * 1.2));
      dueAt = addDays(now, intervalDays).toISOString();
      break;
    case 'good':
      reps = snapshot.reps + 1;
      if (snapshot.reps === 0) {
        intervalDays = 1;
      } else if (snapshot.reps === 1) {
        intervalDays = 3;
      } else {
        intervalDays = roundDays(Math.max(2, snapshot.intervalDays * snapshot.ease));
      }
      dueAt = addDays(now, intervalDays).toISOString();
      break;
    case 'easy':
      ease = clampEase(snapshot.ease + 0.05);
      reps = snapshot.reps + 1;
      if (snapshot.reps === 0) {
        intervalDays = 3;
      } else if (snapshot.reps === 1) {
        intervalDays = 6;
      } else {
        intervalDays = roundDays(Math.max(4, snapshot.intervalDays * snapshot.ease * 1.35));
      }
      dueAt = addDays(now, intervalDays).toISOString();
      break;
  }

  return {
    dueAt,
    intervalDays,
    ease,
    reps,
    lapses,
    lastReviewedAt: now.toISOString(),
    lastRating: rating,
  };
}

export function isDue(dueAt: string, now = new Date()) {
  return new Date(dueAt).getTime() <= now.getTime();
}

function clampEase(value: number) {
  return Math.max(MIN_EASE, Number(value.toFixed(2)));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setTime(next.getTime() + days * 24 * 60 * 60 * 1000);
  return next;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setTime(next.getTime() + minutes * 60 * 1000);
  return next;
}

function roundDays(value: number) {
  return Number(value.toFixed(2));
}
