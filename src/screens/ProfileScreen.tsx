import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { SectionCard } from '../components/SectionCard';
import { AdjusterRow } from '../components/Common';

export function ProfileScreen() {
  const { profile, updateProfile, accountSession, deviceAuthState } = useAppStore();

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const formatAccountMeta = (session: any, authLabel: string) => {
    return `${session.provider} · ${authLabel} enabled`;
  };

  const accountTitle = accountSession?.displayName ?? 'Guest learner';
  const accountMeta = accountSession
    ? formatAccountMeta(accountSession, deviceAuthState.label)
    : 'Saved on this device only';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionCard
        eyebrow="Profile"
        tone="rose"
        title="Placement & Goals"
        description="Use the starter quiz to calibrate your pace, then tune your daily target as you improve."
      >
        <View style={styles.profileCard}>
          <Text style={styles.profileValue}>
            {profile.skillLevel ? capitalize(profile.skillLevel) : 'Not assessed yet'}
          </Text>
          <Text style={styles.profileCopy}>
            Placement score: {profile.placementScore}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && styles.secondaryActionPressed,
            ]}
            onPress={() => {}}
          >
            <Text style={styles.secondaryActionLabel}>Retake starter quiz</Text>
          </Pressable>
        </View>

        <AdjusterRow
          label="Daily goal"
          value={`${profile.dailyGoal} reviews`}
          onDecrease={() => void updateProfile({ dailyGoal: Math.max(4, profile.dailyGoal - 2) })}
          onIncrease={() => void updateProfile({ dailyGoal: Math.min(30, profile.dailyGoal + 2) })}
        />
      </SectionCard>

      <SectionCard
        eyebrow="Account"
        tone="mint"
        title={accountTitle}
        description={accountMeta}
      >
        <Pressable
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed && styles.secondaryActionPressed,
          ]}
          onPress={() => {}}
        >
          <Text style={styles.secondaryActionLabel}>Sign Out</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 132,
    gap: 18,
  },
  profileCard: {
    paddingVertical: 12,
    gap: 8,
  },
  profileValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#314057',
  },
  profileCopy: {
    fontSize: 15,
    color: '#6f7286',
    lineHeight: 22,
    marginBottom: 8,
  },
  secondaryAction: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#ff8b56',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionPressed: {
    backgroundColor: '#fff4ef',
  },
  secondaryActionLabel: {
    color: '#ff8b56',
    fontWeight: '800',
    fontSize: 15,
  },
});
