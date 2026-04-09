import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TextInput } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { SectionCard } from '../components/SectionCard';
import { SegmentButton, WordRow } from '../components/Common';
import { getWordStatus } from '../practice';

const libraryFilters = [
  { label: 'All', value: 'all' },
  { label: 'Due', value: 'due' },
  { label: 'Mastered', value: 'mastered' },
  { label: 'Learning', value: 'learning' },
];

export function LibraryScreen() {
  const { cards, setSelectedWordId } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('all');

  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      card.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.definition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (card.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    if (!matchesSearch) return false;

    if (libraryFilter === 'all') return true;
    if (libraryFilter === 'due') return new Date(card.dueAt) <= new Date();
    if (libraryFilter === 'mastered') return getWordStatus(card) === 'Mastered';
    if (libraryFilter === 'learning') return getWordStatus(card) === 'Learning';

    return true;
  });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionCard
        eyebrow="Word bank"
        tone="sky"
        title="Library"
        description="Search, filter, inspect, and clean up the vocabulary you are keeping."
      >
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Search words, definitions, topics"
            placeholderTextColor="#b39b93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.segmentWrap}>
            {libraryFilters.map((filter) => (
              <SegmentButton
                key={filter.value}
                label={filter.label}
                isActive={libraryFilter === filter.value}
                onPress={() => setLibraryFilter(filter.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.stack}>
          {filteredCards.length > 0 ? (
            filteredCards.map((card) => (
              <WordRow
                key={card.id}
                title={card.word}
                subtitle={card.definition}
                isFavorite={card.isFavorite}
                meta={`${card.topic ?? 'learning'} · ${card.difficulty ?? 'mixed'} · ${getWordStatus(card)}`}
                onPress={() => setSelectedWordId(card.id)}
              />
            ))
          ) : (
            <Text style={styles.sectionEmpty}>No words match that search or filter.</Text>
          )}
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
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stack: {
    gap: 10,
    marginTop: 8,
  },
  sectionEmpty: {
    color: '#9e8a82',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
