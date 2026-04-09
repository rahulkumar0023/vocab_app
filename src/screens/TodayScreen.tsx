import React from 'react';
import { ScrollView, StyleSheet, Text, View, Animated, Pressable, TextInput } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { SectionCard } from '../components/SectionCard';
import { MetaPill, ChallengeItem, GhostButton } from '../components/Common';
import { useHomeStats } from '../hooks/useHomeStats';
import { getWordStatus, getWhyNow, buildContextPrompt } from '../practice';
import { reviewButtons, ReviewButton, QuizChoiceButton } from '../components/Review';
import { formatDueLabel } from '../utils/dateUtils'; // We'll need to create this

export function TodayScreen() {
  const {
    profile,
    cards,
    practiceMode,
    setPracticeMode,
    queueMode,
    setQueueMode,
    // ... many other states needed here from store
  } = useAppStore();

  const stats = useHomeStats();

  // This is a partial migration, many handlers like handleReview, handleToggleFavorite
  // will need to be moved to store or a dedicated hook.

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionCard
        eyebrow="Daily pulse"
        tone="sun"
        title="Today Goal"
        description={`You have completed ${stats.reviewsToday} of ${profile.dailyGoal} planned reviews today.`}
      >
        <View style={styles.goalProgressTrack}>
          <View style={[styles.goalProgressFill, { width: `${stats.progressPercent}%` }]} />
        </View>
        <View style={styles.goalMetaRow}>
          <MetaPill label="Mistakes today" value={String(stats.todayMistakes.length)} />
          <MetaPill label="Trouble words" value={String(stats.troubleCount)} />
          <MetaPill label="Favorites" value={String(cards.filter(c => c.isFavorite).length)} />
          <MetaPill label="Practice" value={practiceMode} />
        </View>
      </SectionCard>

      {/* Other sections... */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 132,
    gap: 18,
  },
  goalProgressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#f4dfd1',
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#ff8b56',
  },
  goalMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
