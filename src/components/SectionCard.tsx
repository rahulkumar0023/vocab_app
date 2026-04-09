import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type SectionTone = 'default' | 'sun' | 'sky' | 'mint' | 'rose';

interface SectionCardProps {
  eyebrow?: string;
  tone?: SectionTone;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function SectionCard({
  eyebrow,
  tone = 'default',
  title,
  description,
  children,
}: SectionCardProps) {
  return (
    <View style={[styles.sectionCard, sectionToneStyles[tone]]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionEyebrowBadge, sectionEyebrowToneStyles[tone]]}>
          <Text style={styles.sectionEyebrowText}>{eyebrow ?? title}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionDescription}>{description}</Text>
      </View>
      {children}
    </View>
  );
}

const sectionToneStyles = StyleSheet.create({
  default: {
    borderColor: '#ead9cd',
  },
  sun: {
    borderColor: '#f5cfaa',
    backgroundColor: '#fffaf4',
  },
  sky: {
    borderColor: '#cfe4f6',
    backgroundColor: '#fbfdff',
  },
  mint: {
    borderColor: '#cfeadf',
    backgroundColor: '#fbfffd',
  },
  rose: {
    borderColor: '#f0d1d7',
    backgroundColor: '#fffafc',
  },
});

const sectionEyebrowToneStyles = StyleSheet.create({
  default: {
    backgroundColor: '#f7ece4',
  },
  sun: {
    backgroundColor: '#ffefe0',
  },
  sky: {
    backgroundColor: '#e8f4ff',
  },
  mint: {
    backgroundColor: '#e9fbf4',
  },
  rose: {
    backgroundColor: '#ffedf2',
  },
});

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: '#fffdfb',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#ead9cd',
    padding: 18,
    gap: 14,
    shadowColor: '#dcb197',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 3,
  },
  sectionHeader: {
    gap: 8,
  },
  sectionEyebrowBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sectionEyebrowText: {
    color: '#7b5b4f',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  sectionTitle: {
    color: '#25314c',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionDescription: {
    color: '#6f748f',
    fontSize: 14,
    lineHeight: 21,
  },
});
