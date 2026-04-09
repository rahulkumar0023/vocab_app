import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { placementQuestions, buildProfileFromAssessment } from '../assessment';
import { QuizChoiceButton } from './Review';

export function AssessmentOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { updateProfile } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = placementQuestions[currentIndex];

  const handleSelect = (idx: number) => {
    if (selectedIdx !== null) return;
    setSelectedIdx(idx);
    if (idx === currentQuestion.answerIndex) {
      setScore(s => s + 1);
    }

    setTimeout(() => {
      if (currentIndex < placementQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedIdx(null);
      } else {
        setIsFinished(true);
      }
    }, 1000);
  };

  const handleFinish = async () => {
    const updates = buildProfileFromAssessment(score, 'learning');
    await updateProfile(updates);
    onClose();
    // Reset state for next time
    setCurrentIndex(0);
    setScore(0);
    setSelectedIdx(null);
    setIsFinished(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Starter Quiz</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {!isFinished ? (
            <>
              <Text style={styles.progress}>Question {currentIndex + 1} of {placementQuestions.length}</Text>
              <View style={styles.card}>
                <Text style={styles.prompt}>{currentQuestion.prompt}</Text>
              </View>
              <View style={styles.choices}>
                {currentQuestion.choices.map((choice, idx) => (
                  <QuizChoiceButton
                    key={choice}
                    label={choice}
                    isSelected={selectedIdx === idx}
                    isCorrect={idx === currentQuestion.answerIndex && selectedIdx !== null}
                    disabled={selectedIdx !== null}
                    onPress={() => handleSelect(idx)}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.resultArea}>
              <Text style={styles.resultTitle}>Quiz Complete!</Text>
              <Text style={styles.resultScore}>You got {score} out of {placementQuestions.length} correct.</Text>
              <Pressable style={styles.finishButton} onPress={handleFinish}>
                <Text style={styles.finishButtonText}>Update My Profile</Text>
              </Pressable>
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
  headerTitle: { fontWeight: '800', fontSize: 16, color: '#314057' },
  closeText: { color: '#6f7286', fontWeight: '600' },
  content: { padding: 24, gap: 24 },
  progress: { color: '#9e8a82', fontWeight: '700', fontSize: 13, textTransform: 'uppercase' },
  card: {
    backgroundColor: '#fff8f2',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: '#ebd8c9',
    alignItems: 'center',
  },
  prompt: { fontSize: 24, fontWeight: '800', color: '#314057', textAlign: 'center' },
  choices: { gap: 12 },
  resultArea: { alignItems: 'center', gap: 16, marginTop: 40 },
  resultTitle: { fontSize: 28, fontWeight: '800', color: '#314057' },
  resultScore: { fontSize: 18, color: '#6f7286' },
  finishButton: {
    backgroundColor: '#ff8b56',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginTop: 20,
  },
  finishButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
