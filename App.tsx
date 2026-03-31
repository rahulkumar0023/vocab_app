import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type VocabWord = {
  id: string;
  word: string;
  definition: string;
  example: string;
  known: boolean;
};

const starterWords: VocabWord[] = [
  {
    id: '1',
    word: 'Eloquent',
    definition: 'Fluent and persuasive in speaking or writing.',
    example: 'Her eloquent speech inspired the whole team.',
    known: false,
  },
  {
    id: '2',
    word: 'Meticulous',
    definition: 'Showing great attention to detail; very careful.',
    example: 'He keeps meticulous notes for each lesson.',
    known: false,
  },
  {
    id: '3',
    word: 'Resilient',
    definition: 'Able to recover quickly from difficulties.',
    example: 'A resilient learner keeps improving after mistakes.',
    known: true,
  },
];

export default function App() {
  const [words, setWords] = useState<VocabWord[]>(starterWords);
  const [activeCard, setActiveCard] = useState(0);
  const [newWord, setNewWord] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [newExample, setNewExample] = useState('');

  const knownCount = useMemo(() => words.filter((word) => word.known).length, [words]);
  const learningCount = words.length - knownCount;

  const challengeWords = useMemo(
    () => [...words].sort((a, b) => Number(a.known) - Number(b.known)).slice(0, 5),
    [words],
  );

  const selectedCard = words[activeCard] ?? words[0];

  const onToggleKnown = (id: string) => {
    setWords((currentWords) =>
      currentWords.map((word) =>
        word.id === id
          ? {
              ...word,
              known: !word.known,
            }
          : word,
      ),
    );
  };

  const onAddWord = () => {
    if (!newWord.trim() || !newDefinition.trim()) {
      return;
    }

    const nextWord: VocabWord = {
      id: `${Date.now()}`,
      word: newWord.trim(),
      definition: newDefinition.trim(),
      example: newExample.trim() || 'No example yet.',
      known: false,
    };

    setWords((currentWords) => [nextWord, ...currentWords]);
    setActiveCard(0);
    setNewWord('');
    setNewDefinition('');
    setNewExample('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Vocab Builder</Text>
        <Text style={styles.subtitle}>Build daily vocabulary in short learning bursts.</Text>

        <View style={styles.metricsRow}>
          <MetricCard label="Total" value={String(words.length)} />
          <MetricCard label="Learning" value={String(learningCount)} />
          <MetricCard label="Known" value={String(knownCount)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Flashcard</Text>
          {selectedCard ? (
            <View style={styles.card}>
              <Text style={styles.word}>{selectedCard.word}</Text>
              <Text style={styles.definition}>{selectedCard.definition}</Text>
              <Text style={styles.example}>{selectedCard.example}</Text>
              <View style={styles.row}>
                <Pressable
                  style={[styles.button, selectedCard.known && styles.buttonSuccess]}
                  onPress={() => onToggleKnown(selectedCard.id)}
                >
                  <Text style={styles.buttonLabel}>
                    {selectedCard.known ? 'Mark Learning' : 'Mark Known'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.buttonGhost}
                  onPress={() =>
                    setActiveCard((current) => (words.length > 0 ? (current + 1) % words.length : 0))
                  }
                >
                  <Text style={styles.buttonGhostLabel}>Next</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text>No words yet — add your first one below.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Word</Text>
          <TextInput
            style={styles.input}
            placeholder="Word"
            value={newWord}
            onChangeText={setNewWord}
          />
          <TextInput
            style={styles.input}
            placeholder="Definition"
            value={newDefinition}
            onChangeText={setNewDefinition}
          />
          <TextInput
            style={[styles.input, styles.inputTall]}
            placeholder="Example sentence (optional)"
            value={newExample}
            onChangeText={setNewExample}
            multiline
          />
          <Pressable style={styles.button} onPress={onAddWord}>
            <Text style={styles.buttonLabel}>Save Word</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Challenge</Text>
          {challengeWords.map((word, index) => (
            <View key={word.id} style={styles.challengeItem}>
              <Text style={styles.challengeTitle}>
                {index + 1}. {word.word}
              </Text>
              <Text style={styles.challengeSubtitle}>{word.definition}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7ff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1d2d66',
  },
  subtitle: {
    color: '#4a5888',
    fontSize: 15,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e7ff',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#23377b',
  },
  metricLabel: {
    color: '#6a77a3',
    fontSize: 13,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e7ff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2b3b7a',
  },
  card: {
    gap: 10,
  },
  word: {
    fontSize: 28,
    fontWeight: '700',
    color: '#16255e',
  },
  definition: {
    fontSize: 16,
    color: '#33457f',
  },
  example: {
    color: '#5c6b96',
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  button: {
    backgroundColor: '#3f63ff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  buttonSuccess: {
    backgroundColor: '#228b55',
  },
  buttonGhost: {
    borderColor: '#3f63ff',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  buttonGhostLabel: {
    color: '#3f63ff',
    fontWeight: '600',
  },
  input: {
    borderColor: '#cfd8ff',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9faff',
  },
  inputTall: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  challengeItem: {
    borderRadius: 10,
    backgroundColor: '#f6f8ff',
    padding: 12,
    gap: 4,
  },
  challengeTitle: {
    fontWeight: '600',
    color: '#243774',
  },
  challengeSubtitle: {
    color: '#5a6892',
  },
});
