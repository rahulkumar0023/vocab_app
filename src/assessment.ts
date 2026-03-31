import type { SkillLevel, UserProfile } from './db';
import type { ImportDifficulty } from './services/wordFeed';

export type AssessmentQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
};

export const placementQuestions: AssessmentQuestion[] = [
  {
    id: 'q1',
    prompt: 'What does "reluctant" mean?',
    choices: ['eager and excited', 'unwilling or hesitant', 'very noisy', 'easy to understand'],
    answerIndex: 1,
  },
  {
    id: 'q2',
    prompt: 'What does "brief" mean?',
    choices: ['short in length or time', 'very expensive', 'extremely bright', 'hard to move'],
    answerIndex: 0,
  },
  {
    id: 'q3',
    prompt: 'What does "meticulous" mean?',
    choices: ['careless and rushed', 'full of energy', 'very precise and careful', 'easy to replace'],
    answerIndex: 2,
  },
  {
    id: 'q4',
    prompt: 'What does "scarce" mean?',
    choices: ['common and easy to find', 'limited in amount', 'pleasant to hear', 'old-fashioned'],
    answerIndex: 1,
  },
  {
    id: 'q5',
    prompt: 'What does "eloquent" mean?',
    choices: ['able to speak clearly and persuasively', 'difficult to see', 'quick to anger', 'slightly broken'],
    answerIndex: 0,
  },
];

export function getSkillLevelFromScore(score: number): SkillLevel {
  if (score <= 2) {
    return 'beginner';
  }

  if (score <= 4) {
    return 'intermediate';
  }

  return 'advanced';
}

export function getDailyGoalFromSkill(skillLevel: SkillLevel) {
  switch (skillLevel) {
    case 'beginner':
      return 8;
    case 'intermediate':
      return 12;
    case 'advanced':
      return 16;
  }
}

export function buildProfileFromAssessment(
  score: number,
  favoriteTopic: string,
): Partial<UserProfile> {
  const skillLevel = getSkillLevelFromScore(score);

  return {
    skillLevel,
    placementScore: score,
    dailyGoal: getDailyGoalFromSkill(skillLevel),
    recommendedTopic: favoriteTopic,
    favoriteTopic,
    onboardingCompletedAt: new Date().toISOString(),
  };
}

export function getStarterDeckSize(skillLevel: SkillLevel) {
  switch (skillLevel) {
    case 'beginner':
      return 4;
    case 'intermediate':
      return 6;
    case 'advanced':
      return 8;
  }
}

export function getRecommendedImportDifficulty(skillLevel: SkillLevel): ImportDifficulty {
  return skillLevel;
}
