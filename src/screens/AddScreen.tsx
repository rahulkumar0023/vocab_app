import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { SectionCard } from '../components/SectionCard';
import { SegmentButton } from '../components/Common';

const topicPresets = ['science', 'travel', 'art', 'business', 'nature', 'technology'];
const importDifficultyOptions = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
  { label: 'Mixed', value: 'mixed' },
];
const importBatchOptions = [5, 10, 20];

export function AddScreen() {
  const { isActionBusy, isImporting } = useAppStore();

  const [importTopic, setImportTopic] = useState('learning');
  const [importDifficulty, setImportDifficulty] = useState('mixed');
  const [importBatchSize, setImportBatchSize] = useState(10);

  const [newWord, setNewWord] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [newExample, setNewExample] = useState('');

  const handleImportWords = () => {
    // Logic to be moved to store/actions
  };

  const handleAddWord = () => {
    // Logic to be moved to store/actions
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionCard
        eyebrow="Discover"
        tone="sun"
        title="Import Fresh Words"
        description="Use live APIs first and fall back to curated topic packs when the web is sparse."
      >
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Topic like science, travel, art"
            placeholderTextColor="#b39b93"
            value={importTopic}
            onChangeText={setImportTopic}
          />
          <View style={styles.segmentWrap}>
            {topicPresets.map((preset) => (
              <SegmentButton
                key={preset}
                label={preset}
                isActive={importTopic.trim().toLowerCase() === preset}
                onPress={() => setImportTopic(preset)}
              />
            ))}
          </View>
          <Text style={styles.controlLabel}>Difficulty</Text>
          <View style={styles.segmentWrap}>
            {importDifficultyOptions.map((option) => (
              <SegmentButton
                key={option.value}
                label={option.label}
                isActive={importDifficulty === option.value}
                onPress={() => setImportDifficulty(option.value)}
              />
            ))}
          </View>
          <Text style={styles.controlLabel}>Deck size</Text>
          <View style={styles.segmentWrap}>
            {importBatchOptions.map((count) => (
              <SegmentButton
                key={count}
                label={`${count} words`}
                isActive={importBatchSize === count}
                onPress={() => setImportBatchSize(count)}
              />
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && styles.secondaryActionPressed,
              isActionBusy && styles.actionDisabled,
            ]}
            disabled={isActionBusy}
            onPress={handleImportWords}
          >
            <Text style={styles.secondaryActionLabel}>
              {isImporting ? 'Importing words...' : `Import ${importBatchSize} new words`}
            </Text>
          </Pressable>
        </View>
      </SectionCard>

      <SectionCard
        eyebrow="Make it yours"
        tone="mint"
        title="Add Your Own Word"
        description="Type a word, fetch its details from the web, then save it into your queue."
      >
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Word"
            placeholderTextColor="#b39b93"
            value={newWord}
            onChangeText={setNewWord}
          />
          <TextInput
            style={styles.input}
            placeholder="Definition (optional if fetched)"
            placeholderTextColor="#b39b93"
            value={newDefinition}
            onChangeText={setNewDefinition}
          />
          <TextInput
            style={[styles.input, styles.inputTall]}
            placeholder="Example sentence (optional if fetched)"
            placeholderTextColor="#b39b93"
            value={newExample}
            onChangeText={setNewExample}
            multiline
          />
          <Pressable
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.primaryActionPressed,
              isActionBusy && styles.actionDisabled,
            ]}
            disabled={isActionBusy}
            onPress={handleAddWord}
          >
            <Text style={styles.primaryActionLabel}>Save word</Text>
          </Pressable>
        </View>
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
  form: {
    gap: 14,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ebd8c9',
    backgroundColor: '#fff8f2',
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#314057',
    fontSize: 15,
  },
  inputTall: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  controlLabel: {
    color: '#6f7286',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  primaryAction: {
    borderRadius: 20,
    backgroundColor: '#ff8b56',
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#ff8b56',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  primaryActionPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryActionLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
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
  actionDisabled: {
    opacity: 0.5,
  },
});
