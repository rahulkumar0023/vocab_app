import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type ReviewRating } from '../reviewScheduler';

export const reviewButtons: Array<{
  label: string;
  rating: ReviewRating;
  tone: 'danger' | 'steady' | 'good' | 'easy';
  hint: string;
}> = [
  { label: 'Again', rating: 'again', tone: 'danger', hint: 'reset' },
  { label: 'Hard', rating: 'hard', tone: 'steady', hint: 'slower' },
  { label: 'Good', rating: 'good', tone: 'good', hint: 'on track' },
  { label: 'Easy', rating: 'easy', tone: 'easy', hint: 'bigger jump' },
];

interface ReviewButtonProps {
  label: string;
  hint: string;
  tone: 'danger' | 'steady' | 'good' | 'easy';
  disabled: boolean;
  onPress: () => void;
}

export function ReviewButton({
  label,
  hint,
  tone,
  disabled,
  onPress,
}: ReviewButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.reviewButton,
        reviewToneStyles[tone],
        pressed && styles.reviewButtonPressed,
        disabled && styles.actionDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.reviewButtonLabel}>{label}</Text>
      <Text style={styles.reviewButtonHint}>{hint}</Text>
    </Pressable>
  );
}

export function QuizChoiceButton({
  label,
  disabled,
  isSelected,
  isCorrect,
  onPress,
}: {
  label: string;
  disabled: boolean;
  isSelected: boolean;
  isCorrect: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.choiceButton,
        isSelected && styles.choiceButtonSelected,
        isCorrect && styles.choiceButtonCorrect,
        pressed && styles.choiceButtonPressed,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.choiceButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const reviewToneStyles = StyleSheet.create({
  danger: {
    backgroundColor: '#ffe0da',
    borderColor: '#f49a8e',
  },
  steady: {
    backgroundColor: '#fff1d3',
    borderColor: '#efc16d',
  },
  good: {
    backgroundColor: '#dff7ec',
    borderColor: '#91d7b7',
  },
  easy: {
    backgroundColor: '#dff0ff',
    borderColor: '#90c6f0',
  },
});

const styles = StyleSheet.create({
  reviewButton: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  reviewButtonPressed: {
    opacity: 0.8,
  },
  reviewButtonLabel: {
    color: '#2c3248',
    fontWeight: '800',
    fontSize: 15,
  },
  reviewButtonHint: {
    color: '#6f7286',
    fontSize: 12,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  choiceButton: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ebd8c9',
    backgroundColor: '#fff8f2',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  choiceButtonSelected: {
    borderColor: '#f4b183',
    backgroundColor: '#ffe8da',
  },
  choiceButtonCorrect: {
    borderColor: '#96d8b8',
    backgroundColor: '#e7fbf0',
  },
  choiceButtonPressed: {
    opacity: 0.8,
  },
  choiceButtonLabel: {
    color: '#314057',
    fontSize: 15,
    fontWeight: '700',
  },
});
