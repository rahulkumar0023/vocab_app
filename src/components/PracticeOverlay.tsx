import React from 'react';
import { StyleSheet, View, Text, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { ReviewButton, reviewButtons, QuizChoiceButton } from './Review';
import { buildMultipleChoiceOptions, buildUsageOptions } from '../practice';

export function PracticeOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    cards,
    practiceMode,
    answerVisible,
    typingGuess,
    selectedChoice,
    setAnswerVisible,
    setTypingGuess,
    handleReview,
    handleChoiceSelect,
    handleUsageSelect,
    handleTypingSubmit,
    playPronunciation,
    generateAiStudyKit,
    isAiLoading,
    currentAiStudyKit,
  } = useAppStore();

  // For demo/simplicity, we just pick the first due card
  const currentCard = cards[0];

  if (!currentCard) return null;

  const choices = practiceMode === 'choices' ? buildMultipleChoiceOptions(currentCard, cards) : [];
  const usageChoices = practiceMode === 'usage' ? buildUsageOptions(currentCard, cards) : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>End Session</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{practiceMode.toUpperCase()}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.word}>{currentCard.word}</Text>
            {answerVisible && (
              <View style={styles.answerArea}>
                <Text style={styles.definition}>{currentCard.definition}</Text>
                <Text style={styles.example}>{currentCard.example}</Text>
              </View>
            )}
          </View>

          {practiceMode === 'flashcard' && !answerVisible && (
            <Pressable style={styles.showButton} onPress={() => setAnswerVisible(true)}>
              <Text style={styles.showButtonText}>Show Answer</Text>
            </Pressable>
          )}

          {practiceMode === 'choices' && !answerVisible && (
            <View style={styles.choicesGrid}>
              {choices.map((choice) => (
                <QuizChoiceButton
                  key={choice}
                  label={choice}
                  isSelected={selectedChoice === choice}
                  isCorrect={choice === currentCard.word}
                  disabled={answerVisible}
                  onPress={() => handleChoiceSelect(choice, currentCard)}
                />
              ))}
            </View>
          )}

          {practiceMode === 'typing' && !answerVisible && (
            <View style={styles.typingArea}>
              <TextInput
                style={styles.input}
                value={typingGuess}
                onChangeText={setTypingGuess}
                placeholder="Type the word..."
                autoFocus
                onSubmitEditing={() => handleTypingSubmit(currentCard)}
              />
            </View>
          )}

          {answerVisible && (
            <View style={styles.reviewActions}>
              {reviewButtons.map((btn) => (
                <ReviewButton
                  key={btn.rating}
                  label={btn.label}
                  hint={btn.hint}
                  tone={btn.tone}
                  disabled={false}
                  onPress={() => handleReview(btn.rating, currentCard)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeText: { color: '#ff8b56', fontWeight: '700' },
  headerTitle: { fontWeight: '800', fontSize: 16, color: '#314057' },
  content: { padding: 24, gap: 24 },
  card: {
    backgroundColor: '#fff8f2',
    borderRadius: 24,
    padding: 32,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ebd8c9',
  },
  word: { fontSize: 32, fontWeight: '800', color: '#314057' },
  answerArea: { marginTop: 20, alignItems: 'center', gap: 12 },
  definition: { fontSize: 18, color: '#6f7286', textAlign: 'center' },
  example: { fontSize: 16, color: '#9e8a82', fontStyle: 'italic', textAlign: 'center' },
  showButton: {
    backgroundColor: '#ff8b56',
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
  showButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  choicesGrid: { gap: 12 },
  typingArea: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ebd8c9',
    borderRadius: 16,
    padding: 16,
    fontSize: 18,
    backgroundColor: '#fff8f2',
  },
  reviewActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
