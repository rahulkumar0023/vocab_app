import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function GhostButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ghostButton,
        pressed && styles.ghostButtonPressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.ghostButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function SegmentButton({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.segmentButton,
        isActive && styles.segmentButtonActive,
        pressed && styles.segmentButtonPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.segmentButtonLabel, isActive && styles.segmentButtonLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillValue}>{value}</Text>
      <Text style={styles.metaPillLabel}>{label}</Text>
    </View>
  );
}

export function ChallengeItem({ label, status }: { label: string; status: string }) {
  return (
    <View style={styles.challengeItem}>
      <Text style={styles.challengeLabel}>{label}</Text>
      <Text style={styles.challengeStatus}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ghostButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#efdbc9',
    backgroundColor: '#fff4eb',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  ghostButtonPressed: {
    opacity: 0.8,
  },
  ghostButtonLabel: {
    color: '#7c5544',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
  segmentButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ead7c8',
    backgroundColor: '#fff7f2',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  segmentButtonActive: {
    backgroundColor: '#ff8f60',
    borderColor: '#ffb487',
  },
  segmentButtonPressed: {
    opacity: 0.78,
  },
  segmentButtonLabel: {
    color: '#72595a',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  segmentButtonLabelActive: {
    color: '#fffaf4',
  },
  metaPill: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: '#fff7f2',
    borderWidth: 1,
    borderColor: '#f0d8ca',
    padding: 12,
    gap: 4,
  },
  metaPillValue: {
    color: '#25314c',
    fontSize: 18,
    fontWeight: '800',
  },
  metaPillLabel: {
    color: '#887f87',
    fontSize: 12,
  },
  challengeItem: {
    borderRadius: 20,
    backgroundColor: '#fff7f2',
    borderWidth: 1,
    borderColor: '#f0dbc9',
    padding: 14,
    gap: 4,
  },
  challengeLabel: {
    color: '#8c7881',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  challengeStatus: {
    color: '#25314c',
    fontSize: 18,
    fontWeight: '800',
  },
});
