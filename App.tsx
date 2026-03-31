import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { type SQLiteDatabase } from 'expo-sqlite';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  buildProfileFromAssessment,
  getRecommendedImportDifficulty,
  getSkillLevelFromScore,
  getStarterDeckSize,
  placementQuestions,
} from './src/assessment';
import {
  addWord,
  deleteWord,
  exportAppSnapshot,
  importAppSnapshot,
  importWords,
  loadAiStudyKit,
  loadCards,
  loadReviewLog,
  loadUserProfile,
  openAppDatabase,
  reviewWord,
  saveAiStudyKit,
  saveUserProfile,
  toggleWordFavorite,
  updateWord,
  type AiStudyKit,
  type ReviewLogEntry,
  type SnapshotImportSummary,
  type UserProfile,
  type VocabCard,
  type WordInput,
} from './src/db';
import {
  buildContextPrompt,
  buildMultipleChoiceOptions,
  buildUsageOptions,
  getSessionCards,
  getWhyNow,
  getWordStatus,
  isTypingAnswerCorrect,
  type LibraryFilter,
  type PracticeMode,
  type QueueMode,
} from './src/practice';
import { isDue, type ReviewRating } from './src/reviewScheduler';
import {
  disableDailyReminder,
  enableDailyReminder,
} from './src/services/reminders';
import {
  generateAiStudyKit,
  type AiGenerationStatus,
  type AiProviderOption,
} from './src/services/llmCoach';
import {
  triggerErrorHaptic,
  triggerReviewHaptic,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
} from './src/services/feedback';
import {
  deleteAiMemoryImage,
} from './src/services/aiMemoryImage';
import {
  pickAppSnapshot,
  shareAppSnapshot,
} from './src/services/backup';
import {
  fetchWordDetails,
  fetchTopicWords,
  type ImportDifficulty,
} from './src/services/wordFeed';
import {
  buildHardestWords,
  buildTopicRetention,
  buildWeeklyActivity,
  calculateWeekProgress,
} from './src/stats';

type ScreenTab = 'today' | 'library' | 'add' | 'profile';

const reviewButtons: Array<{
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

const practiceModes: Array<{ label: string; value: PracticeMode }> = [
  { label: 'Flashcard', value: 'flashcard' },
  { label: 'Choices', value: 'choices' },
  { label: 'Typing', value: 'typing' },
  { label: 'Context', value: 'context' },
  { label: 'Usage', value: 'usage' },
];

const queueModes: Array<{ label: string; value: QueueMode }> = [
  { label: 'Due', value: 'due' },
  { label: 'Mistakes', value: 'mistakes' },
  { label: 'All', value: 'all' },
];

const libraryFilters: Array<{ label: string; value: LibraryFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'New', value: 'new' },
  { label: 'Learning', value: 'learning' },
  { label: 'Mastered', value: 'mastered' },
  { label: 'Trouble', value: 'trouble' },
];

const topicPresets = ['learning', 'science', 'travel', 'art', 'business'];
const importDifficultyOptions: Array<{ label: string; value: ImportDifficulty }> = [
  { label: 'Mixed', value: 'mixed' },
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
];
const importBatchOptions = [4, 6, 8];

const defaultProfile: UserProfile = {
  skillLevel: null,
  placementScore: 0,
  recommendedTopic: 'learning',
  dailyGoal: 10,
  reminderEnabled: false,
  reminderHour: 19,
  onboardingCompletedAt: null,
  favoriteTopic: 'learning',
};

export default function App() {
  const [database, setDatabase] = useState<SQLiteDatabase | null>(null);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [logs, setLogs] = useState<ReviewLogEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const cardTransition = useRef(new Animated.Value(1)).current;
  const completionPulse = useRef(new Animated.Value(0)).current;
  const pronunciationSoundRef = useRef<Audio.Sound | null>(null);

  const [activeTab, setActiveTab] = useState<ScreenTab>('today');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('flashcard');
  const [queueMode, setQueueMode] = useState<QueueMode>('due');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [importDifficulty, setImportDifficulty] = useState<ImportDifficulty>('mixed');
  const [importBatchSize, setImportBatchSize] = useState<number>(6);

  const [isBooting, setIsBooting] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isWordLookupLoading, setIsWordLookupLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isBackupBusy, setIsBackupBusy] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const [answerVisible, setAnswerVisible] = useState(false);
  const [choiceOptions, setChoiceOptions] = useState<string[]>([]);
  const [usageOptions, setUsageOptions] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [typingGuess, setTypingGuess] = useState('');
  const [practiceFeedback, setPracticeFeedback] = useState<string | null>(null);

  const [newWord, setNewWord] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [newExample, setNewExample] = useState('');
  const [lookedUpWord, setLookedUpWord] = useState<WordInput | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [importTopic, setImportTopic] = useState('learning');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [isEditingWord, setIsEditingWord] = useState(false);
  const [editWord, setEditWord] = useState('');
  const [editDefinition, setEditDefinition] = useState('');
  const [editExample, setEditExample] = useState('');

  const [currentAiStudyKit, setCurrentAiStudyKit] = useState<AiStudyKit | null>(null);
  const [selectedAiStudyKit, setSelectedAiStudyKit] = useState<AiStudyKit | null>(null);
  const [favoriteStudyKits, setFavoriteStudyKits] = useState<Record<string, AiStudyKit>>({});
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiMessageTone, setAiMessageTone] = useState<'error' | 'success'>('success');
  const [aiGenerationStatus, setAiGenerationStatus] = useState<AiGenerationStatus | null>(null);

  const [isAssessmentVisible, setIsAssessmentVisible] = useState(false);
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState<number[]>([]);
  const [assessmentTopic, setAssessmentTopic] = useState('learning');

  useEffect(() => {
    let isCancelled = false;
    let openedDatabase: SQLiteDatabase | null = null;

    async function boot() {
      try {
        const db = await openAppDatabase();
        const [nextProfile] = await Promise.all([loadUserProfile(db), refreshData(db)]);

        openedDatabase = db;

        if (isCancelled) {
          await db.closeAsync();
          return;
        }

        setDatabase(db);
        setProfile(nextProfile);
        setImportTopic(nextProfile.favoriteTopic);
        setAssessmentTopic(nextProfile.favoriteTopic);
        if (nextProfile.skillLevel) {
          setImportDifficulty(getRecommendedImportDifficulty(nextProfile.skillLevel));
          setImportBatchSize(getStarterDeckSize(nextProfile.skillLevel));
        }
        setIsAssessmentVisible(!nextProfile.onboardingCompletedAt);
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!isCancelled) {
          setIsBooting(false);
        }
      }
    }

    void boot();

    return () => {
      isCancelled = true;
      if (openedDatabase) {
        void openedDatabase.closeAsync();
      }
    };
  }, []);

  const now = new Date();
  const todayKey = getDateKey(now);
  const isActionBusy =
    isMutating ||
    isImporting ||
    isWordLookupLoading ||
    isAiLoading ||
    isProfileSaving ||
    isBackupBusy;

  const dueCards = cards.filter((card) => isDue(card.dueAt, now));
  const sessionCards = getSessionCards(queueMode, cards, dueCards, logs, now);
  const currentCard = sessionCards[0] ?? null;
  const selectedWord = cards.find((card) => card.id === selectedWordId) ?? null;
  const favoriteCards = [...cards]
    .filter((card) => card.isFavorite)
    .sort((left, right) => {
      const dueBoost = Number(isDue(right.dueAt, now)) - Number(isDue(left.dueAt, now));

      if (dueBoost !== 0) {
        return dueBoost;
      }

      if (left.lapses !== right.lapses) {
        return right.lapses - left.lapses;
      }

      return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
    });
  const favoriteShowcaseCards = favoriteCards.slice(0, 3);
  const favoriteShowcaseKey = favoriteShowcaseCards.map((card) => card.id).join('|');

  const reviewsToday = logs.filter((entry) => getDateKey(entry.reviewedAt) === todayKey).length;
  const todayMistakes = logs.filter(
    (entry) => entry.rating === 'again' && getDateKey(entry.reviewedAt) === todayKey,
  );
  const newCount = cards.filter((card) => card.reps === 0).length;
  const masteredCount = cards.filter((card) => getWordStatus(card) === 'Mastered').length;
  const troubleCount = cards.filter((card) => getWordStatus(card) === 'Trouble').length;
  const retention =
    logs.length === 0
      ? 0
      : Math.round((logs.filter((entry) => entry.rating !== 'again').length / logs.length) * 100);
  const streak = calculateStreak(logs, now);
  const progressRatio = Math.min(
    1,
    profile.dailyGoal > 0 ? reviewsToday / profile.dailyGoal : 0,
  );
  const progressPercent = Math.round(progressRatio * 100);
  const reviewsRemaining = Math.max(profile.dailyGoal - reviewsToday, 0);
  const nextUpcoming =
    cards.find((card) => !isDue(card.dueAt, now) && card.isFavorite) ??
    cards.find((card) => !isDue(card.dueAt, now)) ??
    null;
  const heroMomentumLabel =
    reviewsRemaining === 0
      ? 'Goal complete'
      : `${reviewsRemaining} reviews left today`;
  const heroSupportCopy = currentCard
    ? `${currentCard.word} is ready for the next round.`
    : dueCards.length > 0
      ? `${dueCards.length} words are waiting for a quick win.`
      : 'Import a fresh pack and turn this into a live study deck.';
  const todaysWord = currentCard ?? favoriteCards[0] ?? dueCards[0] ?? nextUpcoming ?? cards[0] ?? null;
  const heroTitleText = todaysWord?.word ?? 'Vocab Builder';
  const heroEyebrowText = todaysWord ? "Today's word" : 'Bright, steady learning';
  const heroSubtitleText = todaysWord
    ? `${todaysWord.definition}${todaysWord.pronunciation ? `  ${todaysWord.pronunciation}` : ''}`
    : 'A warmer study space for daily wins, stronger recall, and smarter word growth.';
  const focusTopicLabel = capitalize(profile.favoriteTopic);
  const levelLabel = profile.skillLevel ? capitalize(profile.skillLevel) : 'Starter';
  const goalCompleted = profile.dailyGoal > 0 && reviewsToday >= profile.dailyGoal;
  const weekProgress = calculateWeekProgress(logs, profile.dailyGoal, now);
  const weeklyActivity = buildWeeklyActivity(logs, now);
  const weeklyActivityPeak = Math.max(1, ...weeklyActivity.map((point) => point.count));
  const todayActivityPoint =
    weeklyActivity.find((point) => point.isToday) ?? weeklyActivity[weeklyActivity.length - 1];
  const strongestActivityPoint = weeklyActivity.reduce(
    (best, point) => (point.count > best.count ? point : best),
    weeklyActivity[0] ?? { label: '-', count: 0, isToday: false },
  );
  const activeDaysCount = weeklyActivity.filter((point) => point.count > 0).length;
  const topicRetention = buildTopicRetention(cards, logs);
  const hardestWords = buildHardestWords(cards, logs);
  const challengeItems = [
    {
      label: 'Review goal',
      status: goalCompleted ? 'Done' : `${reviewsToday}/${profile.dailyGoal}`,
    },
    {
      label: 'Clear misses',
      status: todayMistakes.length === 0 ? 'Clear' : `${todayMistakes.length} left`,
    },
    {
      label: 'Fresh words',
      status: newCount > 0 ? `${newCount} ready` : 'Import a pack',
    },
  ];
  const completionCopy = goalCompleted
    ? 'Daily goal complete. You can stop here or keep your momentum going with extra reviews.'
    : 'Keep stacking small wins. One more focused session will move the goal bar forward.';
  const cardAnimatedStyle = {
    opacity: cardTransition,
    transform: [
      {
        translateY: cardTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: cardTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1],
        }),
      },
    ],
  };
  const completionPulseStyle = {
    opacity: completionPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.18, 0.42],
    }),
    transform: [
      {
        scale: completionPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.08],
        }),
      },
    ],
  };
  const completionPillStyle = {
    transform: [
      {
        scale: completionPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.03],
        }),
      },
    ],
  };

  const focusCards = [...cards]
    .sort((left, right) => {
      const favoriteBoost = Number(right.isFavorite) - Number(left.isFavorite);

      if (favoriteBoost !== 0) {
        return favoriteBoost;
      }

      if (left.lapses !== right.lapses) {
        return right.lapses - left.lapses;
      }

      return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
    })
    .slice(0, 5);

  const filteredCards = cards.filter((card) => {
    const matchesFilter =
      libraryFilter === 'all'
        ? true
        : libraryFilter === 'favorites'
          ? card.isFavorite
        : libraryFilter === 'new'
          ? card.reps === 0
          : libraryFilter === 'learning'
            ? getWordStatus(card) === 'Learning'
            : libraryFilter === 'mastered'
              ? getWordStatus(card) === 'Mastered'
              : getWordStatus(card) === 'Trouble';

    if (!matchesFilter) {
      return false;
    }

    const needle = searchQuery.trim().toLowerCase();

    if (!needle) {
      return true;
    }

    return (
      card.word.toLowerCase().includes(needle) ||
      card.definition.toLowerCase().includes(needle) ||
      card.example.toLowerCase().includes(needle) ||
      (card.topic?.toLowerCase().includes(needle) ?? false)
    );
  });

  useEffect(() => {
    setAnswerVisible(false);
    setSelectedChoice(null);
    setTypingGuess('');
    setPracticeFeedback(null);
    setChoiceOptions(currentCard ? buildMultipleChoiceOptions(currentCard, cards) : []);
    setUsageOptions(currentCard ? buildUsageOptions(currentCard, cards) : []);
    cardTransition.setValue(0);
    Animated.spring(cardTransition, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();
  }, [currentCard?.id, practiceMode, cards.length]);

  useEffect(() => {
    return () => {
      if (pronunciationSoundRef.current) {
        void pronunciationSoundRef.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    setAiMessage(null);

    let isCancelled = false;

    async function hydrateCurrentAiStudyKit() {
      if (!database || !currentCard) {
        setCurrentAiStudyKit(null);
        return;
      }

      try {
        const nextStudyKit = await loadAiStudyKit(database, currentCard.id);

        if (!isCancelled) {
          setAiMessage(null);
          setCurrentAiStudyKit(nextStudyKit);
        }
      } catch (error) {
        if (!isCancelled) {
          setAiMessageTone('error');
          setAiMessage(getErrorMessage(error));
          setCurrentAiStudyKit(null);
        }
      }
    }

    void hydrateCurrentAiStudyKit();

    return () => {
      isCancelled = true;
    };
  }, [currentCard?.id, database]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (goalCompleted) {
      completionPulse.setValue(0);
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(completionPulse, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(completionPulse, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    } else {
      completionPulse.stopAnimation();
      completionPulse.setValue(0);
    }

    return () => {
      animation?.stop();
    };
  }, [completionPulse, goalCompleted]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateSelectedAiStudyKit() {
      if (!database || !selectedWord) {
        setSelectedAiStudyKit(null);
        return;
      }

      try {
        const nextStudyKit = await loadAiStudyKit(database, selectedWord.id);

        if (!isCancelled) {
          setSelectedAiStudyKit(nextStudyKit);
        }
      } catch {
        if (!isCancelled) {
          setSelectedAiStudyKit(null);
        }
      }
    }

    void hydrateSelectedAiStudyKit();

    return () => {
      isCancelled = true;
    };
  }, [selectedWord?.id, database]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateFavoriteStudyKits() {
      if (!database || favoriteShowcaseCards.length === 0) {
        setFavoriteStudyKits({});
        return;
      }

      try {
        const entries = await Promise.all(
          favoriteShowcaseCards.map(async (card) => {
            const studyKit = await loadAiStudyKit(database, card.id);
            return [card.id, studyKit] as const;
          }),
        );

        if (isCancelled) {
          return;
        }

        const nextFavoriteStudyKits = entries.reduce<Record<string, AiStudyKit>>((accumulator, entry) => {
          const [wordId, studyKit] = entry;

          if (studyKit) {
            accumulator[wordId] = studyKit;
          }

          return accumulator;
        }, {});

        setFavoriteStudyKits(nextFavoriteStudyKits);
      } catch {
        if (!isCancelled) {
          setFavoriteStudyKits({});
        }
      }
    }

    void hydrateFavoriteStudyKits();

    return () => {
      isCancelled = true;
    };
  }, [database, favoriteShowcaseKey]);

  useEffect(() => {
    if (!selectedWord) {
      setIsEditingWord(false);
      setEditWord('');
      setEditDefinition('');
      setEditExample('');
      return;
    }

    setIsEditingWord(false);
    setEditWord(selectedWord.word);
    setEditDefinition(selectedWord.definition);
    setEditExample(selectedWord.example);
  }, [selectedWord?.id]);

  async function refreshData(dbOverride?: SQLiteDatabase) {
    const activeDatabase = dbOverride ?? database;

    if (!activeDatabase) {
      return;
    }

    setIsRefreshing(true);

    try {
      const [nextCards, nextLogs] = await Promise.all([
        loadCards(activeDatabase),
        loadReviewLog(activeDatabase),
      ]);

      setCards(nextCards);
      setLogs(nextLogs);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function persistProfile(nextPatch: Partial<UserProfile>) {
    if (!database) {
      return;
    }

    setIsProfileSaving(true);

    try {
      const nextProfile = {
        ...profile,
        ...nextPatch,
      };

      await saveUserProfile(database, nextProfile);
      setProfile(nextProfile);

      if (nextPatch.favoriteTopic) {
        setImportTopic(nextPatch.favoriteTopic);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function handleAddWord() {
    if (!database || isActionBusy) {
      return;
    }

    if (!newWord.trim()) {
      setErrorMessage('Type a word before saving.');
      return;
    }

    setIsMutating(true);

    try {
      const resolvedWord = newWord.trim();
      let resolvedDefinition = newDefinition.trim();
      let resolvedExample = newExample.trim();
      let resolvedDetails = lookedUpWord;

      if (!resolvedDefinition) {
        resolvedDetails = await lookupWordDetails({
          word: resolvedWord,
          announceSuccess: false,
        });

        if (!resolvedDetails?.definition) {
          throw new Error(`I couldn't find details for "${resolvedWord}". Try a different spelling.`);
        }

        resolvedDefinition = resolvedDetails.definition.trim();
        resolvedExample = resolvedExample || resolvedDetails.example.trim();
      }

      await addWord(database, {
        word: resolvedWord,
        definition: resolvedDefinition,
        example: resolvedExample,
        source: 'manual',
        topic: profile.favoriteTopic,
        partOfSpeech: resolvedDetails?.partOfSpeech ?? null,
        difficulty: resolvedDetails?.difficulty ?? null,
        pronunciation: resolvedDetails?.pronunciation ?? null,
        audioUrl: resolvedDetails?.audioUrl ?? null,
        synonyms: resolvedDetails?.synonyms ?? [],
        antonyms: resolvedDetails?.antonyms ?? [],
        extraExamples: resolvedDetails?.extraExamples ?? [],
      });
      setNewWord('');
      setNewDefinition('');
      setNewExample('');
      setLookedUpWord(null);
      setLookupMessage(null);
      setActiveTab('today');
      await refreshData(database);
      await triggerSuccessHaptic();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    } finally {
      setIsMutating(false);
    }
  }

  async function lookupWordDetails(options?: {
    word?: string;
    announceSuccess?: boolean;
  }) {
    const wordToLookup = (options?.word ?? newWord).trim();

    if (!wordToLookup) {
      throw new Error('Type a word first, then fetch its details.');
    }

    setIsWordLookupLoading(true);
    setErrorMessage(null);

    try {
      const details = await fetchWordDetails(wordToLookup, {
        topic: profile.favoriteTopic,
        source: 'manual',
      });

      if (!details) {
        throw new Error(`No dictionary result found for "${wordToLookup}".`);
      }

      setNewWord(details.word);
      setNewDefinition(details.definition);
      setNewExample(details.example);
      setLookedUpWord({
        ...details,
        source: 'manual',
        topic: profile.favoriteTopic,
      });
      setLookupMessage(
        `Filled details for "${details.word}" from the web${details.pronunciation ? ` · ${details.pronunciation}` : ''}.`,
      );

      if (options?.announceSuccess !== false) {
        await triggerSuccessHaptic();
      }

      return details;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
      return null;
    } finally {
      setIsWordLookupLoading(false);
    }
  }

  async function runTopicImport(options?: {
    topic?: string;
    difficulty?: ImportDifficulty;
    batchSize?: number;
  }) {
    if (!database) {
      throw new Error('Database is not ready yet.');
    }

    const topic = options?.topic ?? importTopic;
    const difficulty = options?.difficulty ?? importDifficulty;
    const batchSize = options?.batchSize ?? importBatchSize;
    const importedWords = await fetchTopicWords(topic, {
      max: batchSize,
      difficulty,
    });
    const summary = await importWords(database, importedWords);

    await refreshData(database);

    return {
      ...summary,
      topic,
      difficulty,
      batchSize,
    };
  }

  async function handleImportWords() {
    if (!database || isActionBusy) {
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    setImportSummary(null);

    try {
      const summary = await runTopicImport();
      setImportSummary(
        formatImportSummary(
          summary.addedCount,
          summary.duplicateCount,
          summary.topic,
          summary.batchSize,
          summary.difficulty,
        ),
      );
      setActiveTab('today');
      await triggerSuccessHaptic();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    } finally {
      setIsImporting(false);
    }
  }

  async function handleReview(rating: ReviewRating) {
    if (!database || !currentCard || isActionBusy) {
      return;
    }

    setIsMutating(true);

    try {
      await reviewWord(database, currentCard, rating);
      await triggerReviewHaptic(rating);
      setAnswerVisible(false);
      setSelectedChoice(null);
      setTypingGuess('');
      setPracticeFeedback(null);
      await refreshData(database);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    } finally {
      setIsMutating(false);
    }
  }

  async function handleGenerateAiStudyKit(card: VocabCard, target: 'current' | 'selected') {
    if (!database || isActionBusy) {
      return;
    }

    setIsAiLoading(true);
    setAiMessage(null);

    try {
      const result = await generateAiStudyKit(card);
      const generated = result.studyKit;
      const previousStudyKit = target === 'current' ? currentAiStudyKit : selectedAiStudyKit;

      if (
        previousStudyKit?.memoryImageUri &&
        previousStudyKit.memoryImageUri !== generated.memoryImageUri
      ) {
        await deleteAiMemoryImage(previousStudyKit.memoryImageUri);
      }

      await saveAiStudyKit(database, card.id, generated);

      const nextStudyKit: AiStudyKit = {
        wordId: card.id,
        ...generated,
      };

      if (target === 'current') {
        setCurrentAiStudyKit(nextStudyKit);
        if (selectedWord?.id === card.id) {
          setSelectedAiStudyKit(nextStudyKit);
        }
      } else {
        setSelectedAiStudyKit(nextStudyKit);
        if (currentCard?.id === card.id) {
          setCurrentAiStudyKit(nextStudyKit);
        }
      }

      setAiGenerationStatus(result.status);
      setAiMessageTone('success');
      setAiMessage(null);
      await triggerSuccessHaptic();
    } catch (error) {
      setAiMessageTone('error');
      setAiMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    } finally {
      setIsAiLoading(false);
    }
  }

  async function handleToggleFavorite(card: VocabCard) {
    if (!database || isActionBusy) {
      return;
    }

    const nextFavoriteState = !card.isFavorite;
    setIsMutating(true);

    try {
      await toggleWordFavorite(database, card.id, nextFavoriteState);
      await refreshData(database);
      setImportSummary(
        nextFavoriteState
          ? `"${card.word}" is in favorites and will stay closer to the top of your study flow.`
          : `"${card.word}" was removed from favorites.`,
      );
      await triggerSuccessHaptic();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSaveEditedWord() {
    if (!database || !selectedWord || isActionBusy) {
      return;
    }

    if (!editWord.trim() || !editDefinition.trim()) {
      setErrorMessage('Word and definition are required.');
      return;
    }

    setIsMutating(true);

    try {
      await updateWord(database, selectedWord.id, {
        word: editWord,
        definition: editDefinition,
        example: editExample,
        isFavorite: selectedWord.isFavorite,
        source: selectedWord.source,
        topic: selectedWord.topic,
        partOfSpeech: selectedWord.partOfSpeech,
        difficulty: selectedWord.difficulty,
        pronunciation: selectedWord.pronunciation,
        audioUrl: selectedWord.audioUrl,
        synonyms: selectedWord.synonyms,
        antonyms: selectedWord.antonyms,
        extraExamples: selectedWord.extraExamples,
      });
      setIsEditingWord(false);
      await refreshData(database);
      await triggerSuccessHaptic();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    } finally {
      setIsMutating(false);
    }
  }

  function handleDeleteWord() {
    if (!selectedWord || !database || isActionBusy) {
      return;
    }

    Alert.alert('Delete word?', `Remove "${selectedWord.word}" and its review history?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsMutating(true);

            try {
              if (selectedAiStudyKit?.memoryImageUri) {
                await deleteAiMemoryImage(selectedAiStudyKit.memoryImageUri);
              }

              await deleteWord(database, selectedWord.id);
              setSelectedWordId(null);
              await refreshData(database);
              await triggerSuccessHaptic();
            } catch (error) {
              setErrorMessage(getErrorMessage(error));
              await triggerErrorHaptic();
            } finally {
              setIsMutating(false);
            }
          })();
        },
      },
    ]);
  }

  function handleChoiceSelect(choice: string) {
    if (!currentCard || answerVisible) {
      return;
    }

    const isCorrect = choice === currentCard.word;
    setSelectedChoice(choice);
    setPracticeFeedback(isCorrect ? 'Correct. Now rate how solid that recall felt.' : `Correct answer: ${currentCard.word}`);
    setAnswerVisible(true);
    void (isCorrect ? triggerSuccessHaptic() : triggerSelectionHaptic());
  }

  function handleUsageSelect(option: string) {
    if (!currentCard || answerVisible) {
      return;
    }

    const isCorrect = option === currentCard.example;
    setSelectedChoice(option);
    setPracticeFeedback(
      isCorrect
        ? 'Correct. You recognised the strongest usage.'
        : 'That sentence belongs to another word. Review the correct usage below.',
    );
    setAnswerVisible(true);
    void (isCorrect ? triggerSuccessHaptic() : triggerSelectionHaptic());
  }

  function handleTypingSubmit() {
    if (!currentCard || answerVisible) {
      return;
    }

    const isCorrect = isTypingAnswerCorrect(typingGuess, currentCard);
    setPracticeFeedback(
      isCorrect
        ? 'Correct. Nice recall.'
        : `Not quite. The correct word is ${currentCard.word}.`,
    );
    setAnswerVisible(true);
    void (isCorrect ? triggerSuccessHaptic() : triggerSelectionHaptic());
  }

  async function handlePlayPronunciation(card: VocabCard) {
    try {
      if (card.audioUrl) {
        if (pronunciationSoundRef.current) {
          await pronunciationSoundRef.current.unloadAsync();
          pronunciationSoundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: card.audioUrl },
          { shouldPlay: true },
        );

        pronunciationSoundRef.current = sound;
        await triggerSelectionHaptic();
        return;
      }
    } catch {
      // Fall back to text-to-speech below.
    }

    Speech.speak(card.word, {
      language: 'en-US',
      rate: 0.95,
      pitch: 1,
    });
    await triggerSelectionHaptic();
  }

  async function handleReminderToggle(enabled: boolean) {
    const nextProfile = {
      ...profile,
      reminderEnabled: enabled,
    };

    try {
      if (enabled) {
        await enableDailyReminder(profile.reminderHour);
      } else {
        await disableDailyReminder();
      }

      await persistProfile(nextProfile);
      await triggerSuccessHaptic();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    }
  }

  async function handleReminderHourChange(nextHour: number) {
    const boundedHour = Math.max(7, Math.min(22, nextHour));
    const nextProfile = {
      ...profile,
      reminderHour: boundedHour,
    };

    try {
      if (profile.reminderEnabled) {
        await enableDailyReminder(boundedHour);
      }

      await persistProfile(nextProfile);
      await triggerSuccessHaptic();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    }
  }

  function startAssessment() {
    setAssessmentAnswers([]);
    setAssessmentStep(0);
    setAssessmentTopic(profile.favoriteTopic);
    setIsAssessmentVisible(true);
  }

  function handleNewWordChange(value: string) {
    setNewWord(value);

    if (normalizeLookupKey(value) !== normalizeLookupKey(lookedUpWord?.word ?? '')) {
      setLookedUpWord(null);
      setLookupMessage(null);
    }
  }

  function handleAssessmentAnswer(answerIndex: number) {
    void triggerSelectionHaptic();
    const nextAnswers = [...assessmentAnswers, answerIndex];
    setAssessmentAnswers(nextAnswers);

    if (assessmentStep < placementQuestions.length - 1) {
      setAssessmentStep((current) => current + 1);
      return;
    }

    setAssessmentStep(placementQuestions.length);
  }

  async function handleCompleteAssessment() {
    if (!database) {
      return;
    }

    const score = assessmentAnswers.reduce((total, answer, index) => {
      return total + (placementQuestions[index]?.answerIndex === answer ? 1 : 0);
    }, 0);

    const nextProfilePatch = buildProfileFromAssessment(score, assessmentTopic);
    const skillLevel = getSkillLevelFromScore(score);
    const batchSize = getStarterDeckSize(skillLevel);
    const difficulty = getRecommendedImportDifficulty(skillLevel);

    await persistProfile(nextProfilePatch);
    setImportTopic(assessmentTopic);
    setImportDifficulty(difficulty);
    setImportBatchSize(batchSize);

    let importMessage = '';

    try {
      const importResult = await runTopicImport({
        topic: assessmentTopic,
        difficulty,
        batchSize,
      });
      importMessage = ` Imported ${importResult.addedCount} starter words for ${assessmentTopic}.`;
    } catch {
      importMessage = ' Your level is saved, but the starter import did not finish.';
    }

    setImportSummary(
      `Assessment complete. You placed at ${capitalize(skillLevel)} level and your daily goal is now ${buildProfileFromAssessment(score, assessmentTopic).dailyGoal}.${importMessage}`,
    );
    setIsAssessmentVisible(false);
    setActiveTab('today');
    await triggerSuccessHaptic();
  }

  async function handleSkipAssessment() {
    await persistProfile({
      onboardingCompletedAt: new Date().toISOString(),
    });
    setIsAssessmentVisible(false);
    setImportSummary('Starter quiz skipped. You can take it later from the Profile tab.');
    await triggerSelectionHaptic();
  }

  async function handleExportBackup() {
    if (!database || isActionBusy) {
      return;
    }

    setIsBackupBusy(true);
    setErrorMessage(null);

    try {
      const snapshot = await exportAppSnapshot(database);
      const result = await shareAppSnapshot(snapshot);
      setImportSummary(
        result.shared
          ? 'Backup exported. Share or save the JSON file somewhere safe.'
          : `Backup saved locally at ${result.fileUri}.`,
      );
      await triggerSuccessHaptic();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    } finally {
      setIsBackupBusy(false);
    }
  }

  async function handleImportBackup() {
    if (!database || isActionBusy) {
      return;
    }

    setIsBackupBusy(true);
    setErrorMessage(null);

    try {
      const snapshot = await pickAppSnapshot();

      if (!snapshot) {
        return;
      }

      const summary = await importAppSnapshot(database, snapshot);
      const nextProfile = await loadUserProfile(database);
      setProfile(nextProfile);
      setImportTopic(nextProfile.favoriteTopic);
      setAssessmentTopic(nextProfile.favoriteTopic);
      if (nextProfile.skillLevel) {
        setImportDifficulty(getRecommendedImportDifficulty(nextProfile.skillLevel));
        setImportBatchSize(getStarterDeckSize(nextProfile.skillLevel));
      }
      await refreshData(database);
      setImportSummary(formatSnapshotSummary(summary));
      setActiveTab('today');
      await triggerSuccessHaptic();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      await triggerErrorHaptic();
    } finally {
      setIsBackupBusy(false);
    }
  }

  if (isBooting) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color="#f97316" size="large" />
        <Text style={styles.loadingTitle}>Building your study space</Text>
        <Text style={styles.loadingCopy}>Loading words, goals, reminders, and your local progress.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.backgroundGlowPrimary} />
      <View style={styles.backgroundGlowSecondary} />
      <View style={styles.backgroundGlowTertiary} />

      <View style={styles.appBody}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            disabled={!todaysWord}
            accessibilityRole={todaysWord ? 'button' : undefined}
            accessibilityLabel={
              todaysWord
                ? `Today's word ${todaysWord.word}. Open full word details.`
                : undefined
            }
            style={({ pressed }) => [
              styles.hero,
              todaysWord && styles.heroInteractive,
              pressed && todaysWord && styles.heroPressed,
            ]}
            onPress={() => todaysWord && setSelectedWordId(todaysWord.id)}
          >
            <View style={styles.heroGlowWarm} />
            <View style={styles.heroGlowCool} />
            <View style={styles.heroGlowSoft} />
            <View style={styles.heroContent}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText}>{focusTopicLabel} focus</Text>
                </View>
                <View style={styles.heroChipSecondary}>
                  <Text style={styles.heroChipSecondaryText}>{levelLabel} pace</Text>
                </View>
              </View>

              <View style={styles.heroMainRow}>
                <View style={styles.heroCopyColumn}>
                  <Text style={styles.heroEyebrow}>{heroEyebrowText}</Text>
                  <Text style={styles.heroTitle}>{heroTitleText}</Text>
                  <Text style={styles.heroSubtitle}>{heroSubtitleText}</Text>
                  {todaysWord ? (
                    <View style={styles.heroTapHint}>
                      <Text style={styles.heroTapHintText}>Tap to open word details</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.heroOrbWrap}>
                  {goalCompleted ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.heroOrbPulseRing, completionPulseStyle]}
                    />
                  ) : null}
                  <View style={[styles.heroOrb, goalCompleted && styles.heroOrbCompleted]}>
                  <Text style={styles.heroOrbValue}>{progressPercent}%</Text>
                  <Text style={styles.heroOrbLabel}>goal hit</Text>
                </View>
                </View>
              </View>

              <View style={styles.heroHighlightRow}>
                <View style={styles.heroHighlightCard}>
                  <Text style={styles.heroHighlightLabel}>Today</Text>
                  <Text style={styles.heroHighlightValue}>{heroMomentumLabel}</Text>
                </View>
                <View style={styles.heroHighlightCard}>
                  <Text style={styles.heroHighlightLabel}>Momentum</Text>
                  <Text style={styles.heroHighlightValue}>{heroSupportCopy}</Text>
                </View>
              </View>

              <View style={styles.heroMetrics}>
                <MetricCard label="Due Now" value={String(dueCards.length)} accent="warm" />
                <MetricCard label="Streak" value={`${streak}d`} accent="cool" />
                <MetricCard label="Retention" value={`${retention}%`} accent="mint" />
                <MetricCard label="Mastered" value={String(masteredCount)} accent="sand" />
              </View>
            </View>
          </Pressable>

          {errorMessage ? (
            <BannerCard
              tone="error"
              title="Something needs attention"
              copy={errorMessage}
              actionLabel={
                activeTab === 'add' && newWord.trim()
                  ? isWordLookupLoading
                    ? 'Trying...'
                    : 'Try lookup again'
                  : isRefreshing
                    ? 'Refreshing...'
                    : 'Try again'
              }
              actionDisabled={isRefreshing || isWordLookupLoading || isActionBusy}
              onAction={
                activeTab === 'add' && newWord.trim()
                  ? () => void lookupWordDetails({ announceSuccess: true })
                  : () => void refreshData()
              }
            />
          ) : null}

          {importSummary ? (
            <BannerCard tone="success" title="Update" copy={importSummary} />
          ) : null}

          {activeTab === 'today' ? (
            <>
              <SectionCard
                eyebrow="Daily pulse"
                tone="sun"
                title="Today Goal"
                description={`You have completed ${reviewsToday} of ${profile.dailyGoal} planned reviews today.`}
              >
                <View style={styles.goalProgressTrack}>
                  <View style={[styles.goalProgressFill, { width: `${progressRatio * 100}%` }]} />
                </View>
                <View style={styles.goalMetaRow}>
                  <MetaPill label="Mistakes today" value={String(todayMistakes.length)} />
                  <MetaPill label="Trouble words" value={String(troubleCount)} />
                  <MetaPill label="Favorites" value={String(favoriteCards.length)} />
                  <MetaPill label="Practice" value={practiceMode} />
                </View>
              </SectionCard>

              <SectionCard
                eyebrow="Daily challenge"
                tone="rose"
                title={goalCompleted ? 'Challenge complete' : 'Daily Challenge'}
                description={completionCopy}
              >
                <View style={styles.challengeGrid}>
                  {challengeItems.map((item) => (
                    <ChallengeItem key={item.label} label={item.label} status={item.status} />
                  ))}
                </View>

                {goalCompleted ? (
                  <View style={styles.completionCard}>
                    <Animated.View style={[styles.completionCelebratePill, completionPillStyle]}>
                      <View style={styles.completionCelebrateDot} />
                      <Text style={styles.completionCelebrateLabel}>Goal reached</Text>
                    </Animated.View>
                    <Text style={styles.completionTitle}>Nice work. You hit today&apos;s target.</Text>
                    <Text style={styles.completionCopy}>
                      {nextUpcoming
                        ? `${nextUpcoming.word} comes back ${formatDueLabel(nextUpcoming.dueAt)} if you want to stay warm.`
                        : 'You can stop here, or import fresh words and keep the streak feeling easy.'}
                    </Text>
                  </View>
                ) : null}
              </SectionCard>

              <SectionCard
                eyebrow="Keep nearby"
                tone="mint"
                title="Favorite Shelf"
                description="Favorite words stay closer to the front of your study flow and live here as quick visual memory cards."
              >
                {favoriteShowcaseCards.length > 0 ? (
                  <View style={styles.favoriteShelf}>
                    {favoriteShowcaseCards.map((card) => (
                      <FavoriteWordCard
                        key={card.id}
                        card={card}
                        studyKit={favoriteStudyKits[card.id] ?? null}
                        onOpen={() => setSelectedWordId(card.id)}
                        onToggleFavorite={() => void handleToggleFavorite(card)}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.favoriteEmptyCard}>
                    <FavoriteShelfIllustration />
                    <Text style={styles.favoriteEmptyTitle}>Save words you want extra time with</Text>
                    <Text style={styles.favoriteEmptyCopy}>
                      Favorite a word from the study card or library and it will surface earlier in sessions and stay pinned here.
                    </Text>
                    {currentCard ? (
                      <GhostButton
                        label={`Favorite ${currentCard.word}`}
                        onPress={() => void handleToggleFavorite(currentCard)}
                      />
                    ) : null}
                  </View>
                )}
              </SectionCard>

              <SectionCard
                eyebrow="Live session"
                tone="sky"
                title="Study Session"
                description={
                  currentCard
                    ? 'Switch modes when you want a different kind of recall challenge.'
                    : nextUpcoming
                      ? `${nextUpcoming.word} comes back ${formatDueLabel(nextUpcoming.dueAt)}.`
                      : 'Add or import words to begin.'
                }
              >
                <Text style={styles.controlLabel}>Queue</Text>
                <View style={styles.segmentRow}>
                  {queueModes.map((option) => (
                    <SegmentButton
                      key={option.value}
                      label={option.label}
                      isActive={queueMode === option.value}
                      onPress={() => setQueueMode(option.value)}
                    />
                  ))}
                </View>

                <Text style={styles.controlLabel}>Practice Mode</Text>
                <View style={styles.segmentRow}>
                  {practiceModes.map((option) => (
                    <SegmentButton
                      key={option.value}
                      label={option.label}
                      isActive={practiceMode === option.value}
                      onPress={() => setPracticeMode(option.value)}
                    />
                  ))}
                </View>

                {currentCard ? (
                  <Animated.View style={[styles.studyCard, cardAnimatedStyle]}>
                    <View style={styles.studyHeader}>
                      <View style={styles.studyBadge}>
                        <Text style={styles.studyBadgeText}>{getWordStatus(currentCard)}</Text>
                      </View>
                      <View style={styles.studyHeaderActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.iconButton,
                            currentCard.isFavorite && styles.favoriteIconButton,
                            pressed && styles.iconButtonPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`${currentCard.isFavorite ? 'Remove' : 'Add'} ${currentCard.word} ${currentCard.isFavorite ? 'from' : 'to'} favorites`}
                          onPress={() => void handleToggleFavorite(currentCard)}
                        >
                          <Text
                            style={[
                              styles.iconButtonLabel,
                              currentCard.isFavorite && styles.favoriteIconButtonLabel,
                            ]}
                          >
                            {currentCard.isFavorite ? 'Favorited' : 'Favorite'}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.iconButton,
                            pressed && styles.iconButtonPressed,
                          ]}
                          onPress={() => void handlePlayPronunciation(currentCard)}
                        >
                          <Text style={styles.iconButtonLabel}>
                            {currentCard.audioUrl ? 'Listen' : 'Speak'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {practiceMode === 'flashcard' ? (
                      <>
                        <Text style={styles.studyPromptLabel}>Prompt</Text>
                        <Text style={styles.studyWord}>{currentCard.word}</Text>
                        <Text style={styles.studyHint}>Recall the meaning, then reveal the answer.</Text>
                      </>
                    ) : null}

                    {practiceMode === 'choices' ? (
                      <>
                        <Text style={styles.studyPromptLabel}>Choose the word</Text>
                        <Text style={styles.studyQuestion}>{currentCard.definition}</Text>
                        <View style={styles.choiceList}>
                          {choiceOptions.map((choice) => (
                            <QuizChoiceButton
                              key={choice}
                              label={choice}
                              disabled={answerVisible}
                              isSelected={selectedChoice === choice}
                              isCorrect={answerVisible && choice === currentCard.word}
                              onPress={() => handleChoiceSelect(choice)}
                            />
                          ))}
                        </View>
                      </>
                    ) : null}

                    {practiceMode === 'typing' ? (
                      <>
                        <Text style={styles.studyPromptLabel}>Type the word</Text>
                        <Text style={styles.studyQuestion}>{currentCard.definition}</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Type the matching word"
                          placeholderTextColor="#b39b93"
                          value={typingGuess}
                          onChangeText={setTypingGuess}
                          editable={!answerVisible}
                        />
                        <Pressable
                          style={({ pressed }) => [
                            styles.secondaryAction,
                            pressed && styles.secondaryActionPressed,
                            (answerVisible || isActionBusy) && styles.actionDisabled,
                          ]}
                          disabled={answerVisible || isActionBusy}
                          onPress={handleTypingSubmit}
                        >
                          <Text style={styles.secondaryActionLabel}>Check answer</Text>
                        </Pressable>
                      </>
                    ) : null}

                    {practiceMode === 'context' ? (
                      <>
                        <Text style={styles.studyPromptLabel}>Fill the blank</Text>
                        <Text style={styles.studyQuestion}>{buildContextPrompt(currentCard)}</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Type the missing word"
                          placeholderTextColor="#b39b93"
                          value={typingGuess}
                          onChangeText={setTypingGuess}
                          editable={!answerVisible}
                        />
                        <Pressable
                          style={({ pressed }) => [
                            styles.secondaryAction,
                            pressed && styles.secondaryActionPressed,
                            (answerVisible || isActionBusy) && styles.actionDisabled,
                          ]}
                          disabled={answerVisible || isActionBusy}
                          onPress={handleTypingSubmit}
                        >
                          <Text style={styles.secondaryActionLabel}>Check context answer</Text>
                        </Pressable>
                      </>
                    ) : null}

                    {practiceMode === 'usage' ? (
                      <>
                        <Text style={styles.studyPromptLabel}>Pick the best usage</Text>
                        <Text style={styles.studyQuestion}>
                          Which sentence uses &quot;{currentCard.word}&quot; most clearly?
                        </Text>
                        <View style={styles.choiceList}>
                          {usageOptions.map((option) => (
                            <QuizChoiceButton
                              key={option}
                              label={option}
                              disabled={answerVisible}
                              isSelected={selectedChoice === option}
                              isCorrect={answerVisible && option === currentCard.example}
                              onPress={() => handleUsageSelect(option)}
                            />
                          ))}
                        </View>
                      </>
                    ) : null}

                    {!answerVisible && practiceMode === 'flashcard' ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.primaryAction,
                          pressed && styles.primaryActionPressed,
                        ]}
                        onPress={() => setAnswerVisible(true)}
                      >
                        <Text style={styles.primaryActionLabel}>Reveal answer</Text>
                      </Pressable>
                    ) : null}

                    {answerVisible ? (
                      <>
                        <View style={styles.answerPanel}>
                          <Text style={styles.answerLabel}>Definition</Text>
                          <Text style={styles.answerValue}>{currentCard.definition}</Text>
                          <Text style={styles.answerLabel}>Example</Text>
                          <Text style={styles.answerExample}>{currentCard.example}</Text>
                          {currentCard.extraExamples.length > 0 ? (
                            <>
                              <Text style={styles.answerLabel}>More examples</Text>
                              <Text style={styles.answerExtra}>
                                {currentCard.extraExamples.join('  •  ')}
                              </Text>
                            </>
                          ) : null}
                          <Text style={styles.answerFootnote}>{getWhyNow(currentCard, now)}</Text>
                          {practiceFeedback ? (
                            <Text style={styles.practiceFeedback}>{practiceFeedback}</Text>
                          ) : null}
                        </View>

                        <View style={styles.reviewGrid}>
                          {reviewButtons.map((button) => (
                            <ReviewButton
                              key={button.rating}
                              label={button.label}
                              hint={button.hint}
                              tone={button.tone}
                              disabled={isActionBusy}
                              onPress={() => handleReview(button.rating)}
                            />
                          ))}
                        </View>

                        <View style={styles.aiPanel}>
                          <View style={styles.aiPanelHeader}>
                            <View style={styles.aiPanelTitleWrap}>
                              <Text style={styles.aiPanelEyebrow}>Study notes</Text>
                              <Text style={styles.aiPanelTitle}>Make this word easier to keep</Text>
                            </View>
                            {currentAiStudyKit ? (
                              <Text style={styles.aiPanelMeta}>
                                Updated {formatCompactTimestamp(currentAiStudyKit.generatedAt)}
                              </Text>
                            ) : null}
                          </View>

                          <Text style={styles.aiPanelCopy}>
                            {currentAiStudyKit
                              ? `Keep ${currentCard.word} in plain language, one memory scene, and one quick self-check.`
                              : `Create a calm study view for ${currentCard.word}: a clearer meaning, a visual cue, and one quick recall prompt.`}
                          </Text>

                          {aiGenerationStatus?.note ? (
                            <View style={styles.aiUsageCard}>
                              <Text style={styles.aiUsageCopy}>{aiGenerationStatus.note}</Text>
                            </View>
                          ) : null}

                          {aiGenerationStatus ? (
                            <View style={styles.aiStatusCard}>
                              <Text style={styles.aiStatusLabel}>Study notes mode</Text>
                              <Text style={styles.aiStatusCopy}>
                                {formatAiStatusCopy(aiGenerationStatus)}
                              </Text>
                            </View>
                          ) : null}

                          {aiMessage && aiMessageTone === 'error' ? (
                            <BannerCard
                              tone="error"
                              title="Study notes issue"
                              copy={aiMessage}
                              actionLabel={isAiLoading ? 'Working...' : 'Try again'}
                              actionDisabled={isActionBusy || isAiLoading}
                              onAction={() => handleGenerateAiStudyKit(currentCard, 'current')}
                            />
                          ) : null}

                          {currentAiStudyKit ? (
                            <AiStudyNotesPanel word={currentCard.word} studyKit={currentAiStudyKit} />
                          ) : (
                            <AiStudyEmptyState word={currentCard.word} />
                          )}

                          <Pressable
                            style={({ pressed }) => [
                              styles.aiAction,
                              pressed && styles.aiActionPressed,
                              (isActionBusy || isAiLoading) && styles.actionDisabled,
                            ]}
                            disabled={isActionBusy || isAiLoading}
                            onPress={() => handleGenerateAiStudyKit(currentCard, 'current')}
                          >
                            <Text style={styles.aiActionLabel}>
                              {isAiLoading
                                ? 'Building notes...'
                                : currentAiStudyKit
                                  ? 'Refresh notes'
                                  : 'Create study notes'}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    ) : null}
                  </Animated.View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>Nothing in this queue</Text>
                    <Text style={styles.emptyCopy}>
                      {queueMode === 'mistakes'
                        ? 'You have no mistakes from today. Try the Due queue or All queue.'
                        : 'Import fresh words or add your own to keep the session moving.'}
                    </Text>
                    <View style={styles.row}>
                      <GhostButton label="Go to Add" onPress={() => setActiveTab('add')} />
                      <GhostButton label="Refresh" onPress={() => refreshData()} />
                    </View>
                  </View>
                )}
              </SectionCard>

              <SectionCard
                eyebrow="Spotlight"
                tone="mint"
                title="Focus Queue"
                description="Tap a word to inspect it, edit it, favorite it, or clean it up."
              >
                <View style={styles.stack}>
                  {focusCards.map((card) => (
                    <WordRow
                      key={card.id}
                      title={card.word}
                      subtitle={card.definition}
                      isFavorite={card.isFavorite}
                      meta={`${getWordStatus(card)} · ${formatDueLabel(card.dueAt)}`}
                      onPress={() => setSelectedWordId(card.id)}
                    />
                  ))}
                </View>
              </SectionCard>
            </>
          ) : null}

          {activeTab === 'library' ? (
            <>
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
            </>
          ) : null}

          {activeTab === 'add' ? (
            <>
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
                  <Text style={styles.inlineHint}>
                    Import {importBatchSize} words with a {importDifficulty} mix for {importTopic}.
                  </Text>
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
                    onChangeText={handleNewWordChange}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryAction,
                      pressed && styles.secondaryActionPressed,
                      isActionBusy && styles.actionDisabled,
                    ]}
                    disabled={isActionBusy}
                    onPress={() => void lookupWordDetails({ announceSuccess: true })}
                  >
                    <Text style={styles.secondaryActionLabel}>
                      {isWordLookupLoading ? 'Looking up word...' : 'Find details from web'}
                    </Text>
                  </Pressable>
                  {lookupMessage ? (
                    <Text style={styles.inlineHint}>{lookupMessage}</Text>
                  ) : (
                    <Text style={styles.inlineHint}>
                      Definition and example are optional. If they are empty, save will look them up automatically.
                    </Text>
                  )}
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
            </>
          ) : null}

          {activeTab === 'profile' ? (
            <>
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
                    Placement score: {profile.placementScore} / {placementQuestions.length}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryAction,
                      pressed && styles.secondaryActionPressed,
                    ]}
                    onPress={startAssessment}
                  >
                    <Text style={styles.secondaryActionLabel}>Retake starter quiz</Text>
                  </Pressable>
                </View>

                <AdjusterRow
                  label="Daily goal"
                  value={`${profile.dailyGoal} reviews`}
                  onDecrease={() => void persistProfile({ dailyGoal: Math.max(4, profile.dailyGoal - 2) })}
                  onIncrease={() => void persistProfile({ dailyGoal: Math.min(30, profile.dailyGoal + 2) })}
                />

                <AdjusterRow
                  label="Reminder time"
                  value={`${profile.reminderHour}:00`}
                  onDecrease={() => void handleReminderHourChange(profile.reminderHour - 1)}
                  onIncrease={() => void handleReminderHourChange(profile.reminderHour + 1)}
                />

                <View style={styles.settingRow}>
                  <View style={styles.settingCopyWrap}>
                    <Text style={styles.settingLabel}>Daily reminder</Text>
                    <Text style={styles.settingDescription}>
                      Schedule a local reminder to come back and review.
                    </Text>
                  </View>
                  <Switch
                    value={profile.reminderEnabled}
                    trackColor={{ false: '#f3d2c2', true: '#ff9f77' }}
                    thumbColor={profile.reminderEnabled ? '#fff8f1' : '#fff'}
                    ios_backgroundColor="#f1d9cd"
                    onValueChange={(value) => {
                      void handleReminderToggle(value);
                    }}
                  />
                </View>
              </SectionCard>

              <SectionCard
                eyebrow="Direction"
                tone="sun"
                title="Preferred Topic"
                description="This steers imports and your post-assessment recommendation."
              >
                <View style={styles.segmentWrap}>
                  {topicPresets.map((preset) => (
                    <SegmentButton
                      key={preset}
                      label={preset}
                      isActive={profile.favoriteTopic === preset}
                      onPress={() => void persistProfile({ favoriteTopic: preset, recommendedTopic: preset })}
                    />
                  ))}
                </View>
              </SectionCard>

              <SectionCard
                eyebrow="Weekly rhythm"
                tone="sky"
                title="7-Day Activity"
                description={`You completed ${weekProgress.reviews} reviews this week against a ${weekProgress.target} review target.`}
              >
                <View
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel="Weekly review progress"
                  accessibilityValue={{
                    min: 0,
                    max: weekProgress.target,
                    now: weekProgress.reviews,
                  }}
                  style={styles.goalProgressTrack}
                >
                  <View style={[styles.goalProgressFill, { width: `${weekProgress.ratio * 100}%` }]} />
                </View>
                <View style={styles.activitySummaryRow}>
                  <ActivitySummaryCard
                    label="Today"
                    value={`${todayActivityPoint?.count ?? 0}`}
                    detail={`${todayActivityPoint?.count === 1 ? 'review' : 'reviews'} completed`}
                  />
                  <ActivitySummaryCard
                    label="Best day"
                    value={strongestActivityPoint.label}
                    detail={`${strongestActivityPoint.count} reviews`}
                  />
                  <ActivitySummaryCard
                    label="Active days"
                    value={`${activeDaysCount}`}
                    detail={`${activeDaysCount === 1 ? 'day' : 'days'} with activity`}
                  />
                </View>
                <View
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={formatWeeklyActivityLabel(weeklyActivity)}
                  style={styles.activityChart}
                >
                  {weeklyActivity.map((point) => (
                    <ActivityBar
                      key={point.label}
                      label={point.label}
                      count={point.count}
                      peak={weeklyActivityPeak}
                      isToday={point.isToday}
                    />
                  ))}
                </View>
              </SectionCard>

              <SectionCard
                eyebrow="Retention"
                tone="mint"
                title="By Topic"
                description="See which themes are staying sticky and which ones need more reps."
              >
                <View style={styles.stack}>
                  {topicRetention.length > 0 ? (
                    topicRetention.map((item) => (
                      <InsightRow
                        key={item.topic}
                        title={capitalize(item.topic)}
                        value={`${item.retention}%`}
                        detail={`${item.total} reviews`}
                      />
                    ))
                  ) : (
                    <Text style={styles.sectionEmpty}>Review a few cards to unlock topic retention.</Text>
                  )}
                </View>
              </SectionCard>

              <SectionCard
                eyebrow="Friction"
                tone="rose"
                title="Hardest Words"
                description="These are the cards asking for extra attention right now."
              >
                <View style={styles.stack}>
                  {hardestWords.length > 0 ? (
                    hardestWords.map((item) => (
                      <InsightRow
                        key={item.wordId}
                        title={item.word}
                        value={`score ${item.troubleScore}`}
                        detail={`${item.misses} misses · ${item.lapses} lapses`}
                      />
                    ))
                  ) : (
                    <Text style={styles.sectionEmpty}>No hard words yet. Your deck is in a clean state.</Text>
                  )}
                </View>
              </SectionCard>

              <SectionCard
                eyebrow="Snapshot"
                tone="mint"
                title="Quick Stats"
                description="A quick read on how your vocabulary set is evolving."
              >
                <View style={styles.goalMetaRow}>
                  <MetaPill label="Saved words" value={String(cards.length)} />
                  <MetaPill label="New" value={String(newCount)} />
                  <MetaPill label="Trouble" value={String(troubleCount)} />
                  <MetaPill label="Goal hit" value={reviewsToday >= profile.dailyGoal ? 'Yes' : 'No'} />
                </View>
              </SectionCard>

              <SectionCard
                eyebrow="Backup"
                tone="default"
                title="Export & Restore"
                description="Save your study data to JSON or restore it on another device later."
              >
                <View style={styles.row}>
                  <GhostButton
                    label={isBackupBusy ? 'Working...' : 'Export backup'}
                    onPress={() => void handleExportBackup()}
                  />
                  <GhostButton
                    label={isBackupBusy ? 'Working...' : 'Import backup'}
                    onPress={() => void handleImportBackup()}
                  />
                </View>
              </SectionCard>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.bottomNav}>
          {([
            ['today', 'Today'],
            ['library', 'Library'],
            ['add', 'Add'],
            ['profile', 'Profile'],
          ] as const).map(([tab, label]) => (
            <BottomNavButton
              key={tab}
              label={label}
              isActive={activeTab === tab}
              onPress={() => setActiveTab(tab)}
            />
          ))}
        </View>
      </View>

      <Modal
        transparent
        animationType="slide"
        visible={selectedWord !== null}
        onRequestClose={() => setSelectedWordId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {selectedWord ? (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{selectedWord.word}</Text>
                    <View style={styles.modalHeaderActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.iconButton,
                          selectedWord.isFavorite && styles.favoriteIconButton,
                          pressed && styles.iconButtonPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${selectedWord.isFavorite ? 'Remove' : 'Add'} ${selectedWord.word} ${selectedWord.isFavorite ? 'from' : 'to'} favorites`}
                        onPress={() => void handleToggleFavorite(selectedWord)}
                      >
                        <Text
                          style={[
                            styles.iconButtonLabel,
                            selectedWord.isFavorite && styles.favoriteIconButtonLabel,
                          ]}
                        >
                          {selectedWord.isFavorite ? 'Favorited' : 'Favorite'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.iconButton,
                          pressed && styles.iconButtonPressed,
                        ]}
                        onPress={() => void handlePlayPronunciation(selectedWord)}
                      >
                        <Text style={styles.iconButtonLabel}>
                          {selectedWord.audioUrl ? 'Listen' : 'Speak'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <Text style={styles.modalMeta}>
                    {selectedWord.partOfSpeech ?? 'word'} · {selectedWord.source} · {selectedWord.topic} · {selectedWord.difficulty ?? 'mixed'}{selectedWord.isFavorite ? ' · favorite' : ''}
                  </Text>

                  {isEditingWord ? (
                    <View style={styles.form}>
                      <TextInput style={styles.input} value={editWord} onChangeText={setEditWord} />
                      <TextInput
                        style={styles.input}
                        value={editDefinition}
                        onChangeText={setEditDefinition}
                      />
                      <TextInput
                        style={[styles.input, styles.inputTall]}
                        value={editExample}
                        onChangeText={setEditExample}
                        multiline
                      />
                    </View>
                  ) : (
                    <View style={styles.stack}>
                      <DetailBlock label="Definition" value={selectedWord.definition} />
                      <DetailBlock label="Example" value={selectedWord.example} />
                      <DetailBlock label="Why now?" value={getWhyNow(selectedWord, now)} />
                      <DetailBlock
                        label="Review stats"
                        value={`Status: ${getWordStatus(selectedWord)} · Reps: ${selectedWord.reps} · Lapses: ${selectedWord.lapses}`}
                      />
                      <DetailBlock
                        label="Favorite"
                        value={
                          selectedWord.isFavorite
                            ? 'This word is pinned higher in your study flow and home shelf.'
                            : 'Not favorited yet.'
                        }
                      />
                      {selectedWord.pronunciation ? (
                        <DetailBlock label="Pronunciation" value={selectedWord.pronunciation} />
                      ) : null}
                      {selectedWord.synonyms.length > 0 ? (
                        <DetailBlock label="Synonyms" value={selectedWord.synonyms.join(', ')} />
                      ) : null}
                      {selectedWord.antonyms.length > 0 ? (
                        <DetailBlock label="Antonyms" value={selectedWord.antonyms.join(', ')} />
                      ) : null}
                      {selectedWord.extraExamples.length > 0 ? (
                        <DetailBlock
                          label="More examples"
                          value={selectedWord.extraExamples.join('\n')}
                        />
                      ) : null}
                      {selectedAiStudyKit ? (
                        <AiStudyNotesPanel word={selectedWord.word} studyKit={selectedAiStudyKit} />
                      ) : null}
                    </View>
                  )}

                  <View style={styles.modalActions}>
                    <GhostButton
                      label={isEditingWord ? 'Cancel' : 'Edit'}
                      onPress={() => setIsEditingWord((current) => !current)}
                    />
                    <GhostButton label="Delete" onPress={handleDeleteWord} />
                    <GhostButton
                      label={isAiLoading ? 'Notes...' : 'Study notes'}
                      onPress={() => void handleGenerateAiStudyKit(selectedWord, 'selected')}
                    />
                    <GhostButton label="Close" onPress={() => setSelectedWordId(null)} />
                  </View>

                  {isEditingWord ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryAction,
                        pressed && styles.primaryActionPressed,
                        isActionBusy && styles.actionDisabled,
                      ]}
                      disabled={isActionBusy}
                      onPress={() => void handleSaveEditedWord()}
                    >
                      <Text style={styles.primaryActionLabel}>Save changes</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={isAssessmentVisible}
        onRequestClose={() => {}}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.assessmentCard}>
            {assessmentStep < placementQuestions.length ? (
              <>
                <Text style={styles.assessmentEyebrow}>
                  Starter Quiz {assessmentStep + 1}/{placementQuestions.length}
                </Text>
                <Text style={styles.assessmentTitle}>
                  Pick the closest meaning.
                </Text>
                <Text style={styles.assessmentPrompt}>
                  {placementQuestions[assessmentStep]?.prompt}
                </Text>

                <View style={styles.stack}>
                  {placementQuestions[assessmentStep]?.choices.map((choice, index) => (
                    <QuizChoiceButton
                      key={`${placementQuestions[assessmentStep]?.id}-${choice}`}
                      label={choice}
                      disabled={false}
                      isSelected={false}
                      isCorrect={false}
                      onPress={() => handleAssessmentAnswer(index)}
                    />
                  ))}
                </View>
                <GhostButton label="Skip for now" onPress={() => void handleSkipAssessment()} />
              </>
            ) : (
              <>
                <Text style={styles.assessmentEyebrow}>Almost there</Text>
                <Text style={styles.assessmentTitle}>Pick your first focus topic</Text>
                <Text style={styles.assessmentPrompt}>
                  This helps set your recommended import deck and a better default path.
                </Text>
                <View style={styles.segmentWrap}>
                  {topicPresets.map((preset) => (
                    <SegmentButton
                      key={preset}
                      label={preset}
                      isActive={assessmentTopic === preset}
                      onPress={() => setAssessmentTopic(preset)}
                    />
                  ))}
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryAction,
                    pressed && styles.primaryActionPressed,
                  ]}
                  onPress={() => void handleCompleteAssessment()}
                >
                  <Text style={styles.primaryActionLabel}>Start with my level</Text>
                </Pressable>
                <GhostButton label="Skip for now" onPress={() => void handleSkipAssessment()} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'warm' | 'cool' | 'mint' | 'sand';
}) {
  return (
    <View style={[styles.metricCard, metricAccentStyles[accent]]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function BannerCard({
  tone,
  title,
  copy,
  actionLabel,
  actionDisabled = false,
  onAction,
}: {
  tone: 'error' | 'success';
  title: string;
  copy: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <View style={[styles.bannerCard, tone === 'error' ? styles.errorBanner : styles.successBanner]}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.bannerCopy}>{copy}</Text>
      {actionLabel && onAction ? (
        <Pressable
          style={({ pressed }) => [
            styles.bannerAction,
            pressed && styles.bannerActionPressed,
            actionDisabled && styles.actionDisabled,
          ]}
          disabled={actionDisabled}
          onPress={onAction}
        >
          <Text style={styles.bannerActionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AiProviderCard({ option }: { option: AiProviderOption }) {
  return (
    <View style={[styles.aiProviderCard, option.isActive && styles.aiProviderCardActive]}>
      <View style={styles.aiProviderHeader}>
        <Text style={styles.aiProviderTitle}>{option.name}</Text>
        <View style={[styles.aiProviderBadge, option.isActive && styles.aiProviderBadgeActive]}>
          <Text
            style={[
              styles.aiProviderBadgeText,
              option.isActive && styles.aiProviderBadgeTextActive,
            ]}
          >
            {option.badge}
          </Text>
        </View>
      </View>
      <Text style={styles.aiProviderDescription}>{option.description}</Text>
    </View>
  );
}

function SectionCard({
  eyebrow,
  tone = 'default',
  title,
  description,
  children,
}: {
  eyebrow?: string;
  tone?: 'default' | 'sun' | 'sky' | 'mint' | 'rose';
  title: string;
  description: string;
  children: React.ReactNode;
}) {
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

function SegmentButton({
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

function BottomNavButton({
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
        styles.bottomNavButton,
        isActive && styles.bottomNavButtonActive,
        pressed && styles.bottomNavButtonPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.bottomNavMarker, isActive && styles.bottomNavMarkerActive]} />
      <Text style={[styles.bottomNavLabel, isActive && styles.bottomNavLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillValue}>{value}</Text>
      <Text style={styles.metaPillLabel}>{label}</Text>
    </View>
  );
}

function ChallengeItem({ label, status }: { label: string; status: string }) {
  return (
    <View style={styles.challengeItem}>
      <Text style={styles.challengeLabel}>{label}</Text>
      <Text style={styles.challengeStatus}>{status}</Text>
    </View>
  );
}

function ReviewButton({
  label,
  hint,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  hint: string;
  tone: 'danger' | 'steady' | 'good' | 'easy';
  disabled: boolean;
  onPress: () => void;
}) {
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

function QuizChoiceButton({
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

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.ghostButton, pressed && styles.ghostButtonPressed]}
      onPress={onPress}
    >
      <Text style={styles.ghostButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function ActivityBar({
  label,
  count,
  peak,
  isToday,
}: {
  label: string;
  count: number;
  peak: number;
  isToday: boolean;
}) {
  const height = Math.max(12, Math.round((count / peak) * 72));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label}${isToday ? ', today' : ''}: ${count} ${count === 1 ? 'review' : 'reviews'}`}
      style={styles.activityBarItem}
    >
      <Text style={[styles.activityBarCount, isToday && styles.activityBarCountToday]}>{count}</Text>
      <View style={styles.activityBarTrack}>
        <View
          style={[
            styles.activityBarFill,
            isToday && styles.activityBarFillToday,
            { height },
          ]}
        />
      </View>
      <Text style={[styles.activityBarLabel, isToday && styles.activityBarLabelToday]}>{label}</Text>
    </View>
  );
}

function ActivitySummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}. ${detail}.`}
      style={styles.activitySummaryCard}
    >
      <Text style={styles.activitySummaryLabel}>{label}</Text>
      <Text style={styles.activitySummaryValue}>{value}</Text>
      <Text style={styles.activitySummaryDetail}>{detail}</Text>
    </View>
  );
}

function InsightRow({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <View style={styles.insightRow}>
      <View style={styles.insightCopy}>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={styles.insightDetail}>{detail}</Text>
      </View>
      <Text style={styles.insightValue}>{value}</Text>
    </View>
  );
}

function WordRow({
  title,
  subtitle,
  meta,
  isFavorite,
  onPress,
}: {
  title: string;
  subtitle: string;
  meta: string;
  isFavorite?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.wordRow, pressed && styles.wordRowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${meta}. Open word details.`}
      onPress={onPress}
    >
      <View style={styles.wordRowHeader}>
        <View style={styles.wordRowTitleWrap}>
          <Text style={styles.wordRowTitle}>{title}</Text>
          {isFavorite ? (
            <View style={styles.wordRowFavoriteBadge}>
              <Text style={styles.wordRowFavoriteBadgeText}>Favorite</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.wordRowOpen}>Open</Text>
      </View>
      <Text style={styles.wordRowSubtitle}>{subtitle}</Text>
      <Text style={styles.wordRowMeta}>{meta}</Text>
    </Pressable>
  );
}

function FavoriteWordCard({
  card,
  studyKit,
  onOpen,
  onToggleFavorite,
}: {
  card: VocabCard;
  studyKit: AiStudyKit | null;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const fallbackScene = buildFavoriteSceneCopy(card.word, card.topic, studyKit?.memoryImagePrompt);
  const studyCopy = studyKit?.simplifiedDefinition || card.definition;

  return (
    <View style={styles.favoriteWordCard}>
      <Pressable
        style={({ pressed }) => [styles.favoriteWordVisual, pressed && styles.favoriteWordCardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Open favorite word ${card.word}`}
        onPress={onOpen}
      >
        {studyKit?.memoryImageUri ? (
          <Image source={{ uri: studyKit.memoryImageUri }} style={styles.favoriteWordImage} resizeMode="cover" />
        ) : (
          <View style={styles.favoriteWordPlaceholder}>
            <View style={styles.favoriteWordGlowTop} />
            <View style={styles.favoriteWordGlowBottom} />
            <Text style={styles.favoriteWordEyebrow}>Funny cue</Text>
            <Text style={styles.favoriteWordHeadline}>{card.word}</Text>
            <Text style={styles.favoriteWordScene}>{fallbackScene}</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.favoriteWordBody}>
        <View style={styles.favoriteWordTopRow}>
          <View style={styles.favoriteWordCopy}>
            <Text style={styles.favoriteWordTitle}>{card.word}</Text>
            <Text style={styles.favoriteWordMeta}>
              {getWordStatus(card)} · {formatDueLabel(card.dueAt)}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.favoriteToggleChip,
              pressed && styles.favoriteToggleChipPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${card.word} from favorites`}
            onPress={onToggleFavorite}
          >
            <Text style={styles.favoriteToggleChipLabel}>Favorited</Text>
          </Pressable>
        </View>

        <Text style={styles.favoriteWordDefinition} numberOfLines={3}>
          {studyCopy}
        </Text>

        <View style={styles.favoriteWordFooter}>
          <Text style={styles.favoriteWordFooterCopy}>
            {studyKit?.usageTip || `Keep ${card.word} nearby for quicker recall.`}
          </Text>
          <GhostButton label="Open card" onPress={onOpen} />
        </View>
      </View>
    </View>
  );
}

function FavoriteShelfIllustration() {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Illustration showing favorite word cards waiting to be pinned to the shelf."
      style={styles.favoriteEmptyIllustration}
    >
      <View style={[styles.favoriteEmptyIllustrationCard, styles.favoriteEmptyIllustrationCardBack]}>
        <Text style={styles.favoriteEmptyIllustrationWord}>spark</Text>
      </View>
      <View style={[styles.favoriteEmptyIllustrationCard, styles.favoriteEmptyIllustrationCardMid]}>
        <Text style={styles.favoriteEmptyIllustrationWord}>wander</Text>
      </View>
      <View style={styles.favoriteEmptyIllustrationCard}>
        <View style={styles.favoriteEmptyIllustrationBadge}>
          <Text style={styles.favoriteEmptyIllustrationBadgeText}>favorite</Text>
        </View>
        <Text style={styles.favoriteEmptyIllustrationWord}>bright</Text>
        <Text style={styles.favoriteEmptyIllustrationCopy}>Pin words you want to meet more often.</Text>
      </View>
      <View style={styles.favoriteEmptyIllustrationSpark} />
      <View style={styles.favoriteEmptyIllustrationSparkSmall} />
    </View>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function AiInsightCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aiInsightCard}>
      <Text style={styles.aiInsightLabel}>{label}</Text>
      <Text style={styles.aiInsightValue}>{value}</Text>
    </View>
  );
}

function AiStudyNotesPanel({
  word,
  studyKit,
}: {
  word: string;
  studyKit: AiStudyKit;
}) {
  return (
    <View style={styles.aiStudySheet}>
      <AiMemorySceneCard
        word={word}
        uri={studyKit.memoryImageUri}
        prompt={studyKit.memoryImagePrompt}
      />

      <View style={styles.aiMeaningCard}>
        <Text style={styles.aiMeaningEyebrow}>Hold onto the meaning</Text>
        <Text style={styles.aiMeaningValue}>{studyKit.simplifiedDefinition}</Text>
        <View style={styles.aiMeaningDivider} />
        <Text style={styles.aiMeaningSupportLabel}>Memory cue</Text>
        <Text style={styles.aiMeaningSupport}>{studyKit.memoryHook}</Text>
      </View>

      <View style={styles.aiLearningGrid}>
        <View style={styles.aiLearningCard}>
          <Text style={styles.aiLearningCardLabel}>Quick check</Text>
          <Text style={styles.aiLearningCardValue}>{studyKit.quizQuestion}</Text>
          <View style={styles.aiAnswerPill}>
            <Text style={styles.aiAnswerPillLabel}>Answer</Text>
            <Text style={styles.aiAnswerPillValue}>{studyKit.quizAnswer}</Text>
          </View>
        </View>

        <View style={[styles.aiLearningCard, styles.aiLearningCardSoft]}>
          <Text style={styles.aiLearningCardLabel}>Use it today</Text>
          <Text style={styles.aiLearningCardValue}>{studyKit.usageTip}</Text>
        </View>
      </View>
    </View>
  );
}

function AiStudyEmptyState({ word }: { word: string }) {
  return (
    <View style={styles.aiStudyEmpty}>
      <Text style={styles.aiStudyEmptyTitle}>Start with {word}</Text>
      <Text style={styles.aiStudyEmptyCopy}>
        Build a simpler meaning, a scene to picture, and one short recall prompt to help
        the word stick faster.
      </Text>
      <View style={styles.aiStudyEmptyChipRow}>
        {['Simple meaning', 'Memory cue', 'Quick recall'].map((item) => (
          <View key={item} style={styles.aiStudyEmptyChip}>
            <Text style={styles.aiStudyEmptyChipText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AiMemorySceneCard({
  word,
  uri,
  prompt,
}: {
  word: string;
  uri?: string | null;
  prompt?: string | null;
}) {
  return (
    <View style={styles.aiMemoryImageCard}>
      {uri ? (
        <Image source={{ uri }} style={styles.aiMemoryImage} resizeMode="cover" />
      ) : (
        <View style={styles.aiMemoryScenePlaceholder}>
          <View style={styles.aiMemorySceneGlowOne} />
          <View style={styles.aiMemorySceneGlowTwo} />
          <Text style={styles.aiMemorySceneEyebrow}>Picture this</Text>
          <Text style={styles.aiMemorySceneWord}>{word}</Text>
          <Text style={styles.aiMemoryScenePrompt}>
            {prompt?.trim() || 'Imagine a vivid scene that locks the word into memory.'}
          </Text>
        </View>
      )}
      <View style={styles.aiMemoryImageCaption}>
        <Text style={styles.aiMemoryImageLabel}>{uri ? 'Picture this' : 'Scene cue'}</Text>
        <Text style={styles.aiMemoryImageCopy}>
          {uri
            ? prompt?.trim() || 'A playful visual cue to help the word stick.'
            : 'Keep this little scene in mind while you review the word.'}
        </Text>
      </View>
    </View>
  );
}

function AdjusterRow({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.adjusterRow}>
      <View style={styles.settingCopyWrap}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{value}</Text>
      </View>
      <View style={styles.adjusterButtons}>
        <GhostButton label="-" onPress={onDecrease} />
        <GhostButton label="+" onPress={onIncrease} />
      </View>
    </View>
  );
}

function buildFavoriteSceneCopy(word: string, topic: string | null, memoryPrompt?: string | null) {
  if (memoryPrompt?.trim()) {
    return memoryPrompt.trim();
  }

  const mascots = ['otter', 'robot', 'fox', 'astronaut', 'painter', 'skater'];
  const props = ['oversized flashcards', 'floating notebooks', 'comically large pencils', 'sticky notes everywhere', 'a tiny stage spotlight', 'a bouncing suitcase'];
  const moods = ['cheerful', 'dramatic', 'playful', 'sunny', 'slightly chaotic', 'storybook'];
  const seed = [...word.toLowerCase()].reduce((total, character) => total + character.charCodeAt(0), 0);
  const mascot = mascots[seed % mascots.length];
  const prop = props[(seed + 2) % props.length];
  const mood = moods[(seed + 4) % moods.length];
  const topicHint = topic ? ` in a ${topic} scene` : '';

  return `Picture a ${mood} ${mascot}${topicHint} acting out "${word}" with ${prop}.`;
}

function formatAiStatusCopy(status: AiGenerationStatus) {
  if (
    typeof status.dailyLimit === 'number' &&
    typeof status.remainingToday === 'number'
  ) {
    return `${status.providerLabel} is active. ${status.remainingToday} of ${status.dailyLimit} cloud notes left today.`;
  }

  if (status.provider === 'smart-coach') {
    return 'Smart Coach is active and always available on this device.';
  }

  return `${status.providerLabel} is active for this study kit.`;
}

function getDateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function calculateStreak(entries: ReviewLogEntry[], now: Date) {
  const uniqueDays = new Set(entries.map((entry) => getDateKey(entry.reviewedAt)));
  let streak = 0;

  for (let offset = 0; offset < 365; offset += 1) {
    const probe = new Date(now);
    probe.setDate(probe.getDate() - offset);

    if (!uniqueDays.has(getDateKey(probe))) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function formatDueLabel(dueAt: string) {
  const difference = new Date(dueAt).getTime() - Date.now();

  if (difference <= 0) {
    return 'due now';
  }

  const minutes = Math.round(difference / (60 * 1000));

  if (minutes < 60) {
    return `in ${minutes}m`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `in ${hours}h`;
  }

  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

function formatImportSummary(
  addedCount: number,
  duplicateCount: number,
  topic: string,
  batchSize: number,
  difficulty: ImportDifficulty,
) {
  const difficultyLabel = difficulty === 'mixed' ? 'mixed difficulty' : `${difficulty} difficulty`;

  if (addedCount === 0) {
    return duplicateCount > 0
      ? `No new words were added for "${topic}". The ${batchSize}-word ${difficultyLabel} deck was already saved.`
      : `No words were added for "${topic}". Try another topic or loosen the difficulty filter.`;
  }

  if (duplicateCount === 0) {
    return `Imported ${addedCount} fresh ${difficultyLabel} words for "${topic}".`;
  }

  return `Imported ${addedCount} fresh ${difficultyLabel} words for "${topic}" and skipped ${duplicateCount} duplicates.`;
}

function formatSnapshotSummary(summary: SnapshotImportSummary) {
  return `Backup restored. Added ${summary.addedCount} words, merged ${summary.mergedCount}, skipped ${summary.skippedCount}.`;
}

function formatCompactTimestamp(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatWeeklyActivityLabel(
  activity: Array<{ label: string; count: number; isToday: boolean }>,
) {
  const segments = activity.map(
    (point) =>
      `${point.label}${point.isToday ? ' today' : ''}: ${point.count} ${point.count === 1 ? 'review' : 'reviews'}`,
  );

  return `7 day activity chart. ${segments.join('. ')}.`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.trim();
    const normalized = message.toLowerCase();

    if (
      normalized.includes('network request failed') ||
      normalized.includes('fetch failed') ||
      normalized.includes('networkerror') ||
      normalized.includes('internet')
    ) {
      return 'No internet right now. Check your connection and try again.';
    }

    if (
      normalized.includes('daily limit') ||
      normalized.includes('quota') ||
      normalized.includes('too many requests')
    ) {
      return 'Today’s cloud AI limit is used up. Smart Coach can still help for the rest of today.';
    }

    if (
      normalized.includes('no dictionary result') ||
      normalized.includes("couldn't find details") ||
      normalized.includes('word not found')
    ) {
      return 'That word was not found. Try a simpler spelling or the base form of the word.';
    }

    if (normalized.includes('database is not ready')) {
      return 'The app is still loading your study data. Try again in a moment.';
    }

    if (
      normalized.includes('notification') &&
      (normalized.includes('permission') || normalized.includes('denied'))
    ) {
      return 'Notifications are off for this app. Enable them in device settings to get reminders.';
    }

    return message;
  }

  return 'Unknown error';
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase();
}

const metricAccentStyles = StyleSheet.create({
  warm: {
    backgroundColor: '#ffe2d2',
    borderColor: '#ffbb95',
  },
  cool: {
    backgroundColor: '#def0ff',
    borderColor: '#99cffa',
  },
  mint: {
    backgroundColor: '#dff8ef',
    borderColor: '#94dfc5',
  },
  sand: {
    backgroundColor: '#fff1c9',
    borderColor: '#f2cf68',
  },
});

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
  container: {
    flex: 1,
    backgroundColor: '#fff7ef',
  },
  appBody: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ef',
    paddingHorizontal: 28,
    gap: 12,
  },
  loadingTitle: {
    color: '#25314c',
    fontSize: 24,
    fontWeight: '800',
  },
  loadingCopy: {
    color: '#6f748f',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  backgroundGlowPrimary: {
    position: 'absolute',
    top: -90,
    right: -10,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#ff8c5d',
    opacity: 0.2,
  },
  backgroundGlowSecondary: {
    position: 'absolute',
    bottom: 120,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#8ce1cf',
    opacity: 0.18,
  },
  backgroundGlowTertiary: {
    position: 'absolute',
    top: 220,
    left: 40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#ffe18b',
    opacity: 0.14,
  },
  content: {
    padding: 18,
    paddingBottom: 132,
    gap: 18,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 34,
    backgroundColor: '#ff996d',
    borderWidth: 1,
    borderColor: '#ffc4a7',
    padding: 22,
    shadowColor: '#d86d42',
    shadowOpacity: 0.2,
    shadowRadius: 26,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    elevation: 7,
  },
  heroInteractive: {
    minHeight: 0,
  },
  heroPressed: {
    opacity: 0.96,
  },
  heroGlowWarm: {
    position: 'absolute',
    top: -26,
    right: -12,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 228, 168, 0.68)',
  },
  heroGlowCool: {
    position: 'absolute',
    bottom: -36,
    left: -28,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(139, 233, 216, 0.28)',
  },
  heroGlowSoft: {
    position: 'absolute',
    top: 82,
    right: 56,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 248, 241, 0.34)',
  },
  heroContent: {
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 248, 241, 0.78)',
  },
  heroChipText: {
    color: '#6f3f2a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroChipSecondary: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(44, 76, 122, 0.14)',
  },
  heroChipSecondaryText: {
    color: '#4b3a48',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroMainRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  heroCopyColumn: {
    flex: 1,
    gap: 8,
  },
  heroEyebrow: {
    color: '#6a3b2a',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#2f2218',
    fontSize: 38,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#67473b',
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 320,
  },
  heroTapHint: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 248, 241, 0.74)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroTapHintText: {
    color: '#7b5441',
    fontSize: 12,
    fontWeight: '800',
  },
  heroOrbWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOrbPulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 247, 238, 0.74)',
  },
  heroOrb: {
    width: 102,
    minHeight: 102,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 251, 248, 0.88)',
    borderWidth: 1,
    borderColor: '#ffd6c0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 3,
  },
  heroOrbCompleted: {
    borderColor: '#ffc493',
    backgroundColor: 'rgba(255, 251, 248, 0.96)',
  },
  heroOrbValue: {
    color: '#23314d',
    fontSize: 26,
    fontWeight: '800',
  },
  heroOrbLabel: {
    color: '#7a6a67',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroHighlightRow: {
    gap: 10,
  },
  heroHighlightCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(255, 247, 241, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 221, 203, 0.92)',
    padding: 14,
    gap: 6,
  },
  heroHighlightLabel: {
    color: '#7e655a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroHighlightValue: {
    color: '#30334a',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  heroMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  metricValue: {
    color: '#23314d',
    fontSize: 24,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#6d6b74',
    fontSize: 13,
    fontWeight: '700',
  },
  bannerCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    shadowColor: '#c98b69',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },
  errorBanner: {
    backgroundColor: '#fff0ec',
    borderColor: '#f1b1a5',
  },
  successBanner: {
    backgroundColor: '#effcf5',
    borderColor: '#a8e0c3',
  },
  bannerTitle: {
    color: '#27324d',
    fontSize: 15,
    fontWeight: '800',
  },
  bannerCopy: {
    color: '#6d718c',
    fontSize: 14,
    lineHeight: 20,
  },
  bannerAction: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2c3b0',
    backgroundColor: '#fff9f4',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerActionPressed: {
    opacity: 0.82,
  },
  bannerActionLabel: {
    color: '#7c5748',
    fontSize: 12,
    fontWeight: '800',
  },
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
  challengeGrid: {
    gap: 10,
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
  completionCard: {
    borderRadius: 24,
    backgroundColor: '#fff0e4',
    borderWidth: 1,
    borderColor: '#f6c9a7',
    padding: 16,
    gap: 8,
  },
  completionCelebratePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#fff7f0',
    borderWidth: 1,
    borderColor: '#f6cda9',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  completionCelebrateDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#ff9a62',
  },
  completionCelebrateLabel: {
    color: '#9a562e',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  completionTitle: {
    color: '#874b2c',
    fontSize: 18,
    fontWeight: '800',
  },
  completionCopy: {
    color: '#715a57',
    fontSize: 14,
    lineHeight: 21,
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
  controlLabel: {
    color: '#8e7480',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  studyCard: {
    backgroundColor: '#22446f',
    borderRadius: 30,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#3d6291',
    shadowColor: '#456489',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 4,
  },
  studyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studyHeaderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  studyBadge: {
    borderRadius: 999,
    backgroundColor: '#ffe2d2',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  studyBadgeText: {
    color: '#8b4d34',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  iconButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffd5c0',
    backgroundColor: '#fff8f2',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  favoriteIconButton: {
    backgroundColor: '#fff0e4',
    borderColor: '#ffbb8d',
  },
  iconButtonPressed: {
    opacity: 0.8,
  },
  iconButtonLabel: {
    color: '#7d4c38',
    fontWeight: '800',
    fontSize: 13,
  },
  favoriteIconButtonLabel: {
    color: '#bc5d2e',
  },
  studyPromptLabel: {
    color: '#b8d8ff',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  studyWord: {
    color: '#fffdf9',
    fontSize: 36,
    fontWeight: '800',
  },
  studyHint: {
    color: '#d7e6ff',
    fontSize: 15,
    lineHeight: 22,
  },
  studyQuestion: {
    color: '#f7fbff',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
  },
  primaryAction: {
    backgroundColor: '#ff8a55',
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#ef8355',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 3,
  },
  primaryActionPressed: {
    opacity: 0.82,
  },
  primaryActionLabel: {
    color: '#fffaf4',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryAction: {
    backgroundColor: '#fff6ef',
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#efcfbc',
  },
  secondaryActionPressed: {
    opacity: 0.82,
  },
  secondaryActionLabel: {
    color: '#8a553d',
    fontWeight: '800',
    fontSize: 15,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  input: {
    backgroundColor: '#fffdfb',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#efdcd0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#25314c',
    fontSize: 15,
  },
  inputTall: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  answerPanel: {
    gap: 8,
    backgroundColor: '#fff8f2',
    borderRadius: 22,
    padding: 16,
  },
  answerLabel: {
    color: '#8f7883',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  answerValue: {
    color: '#25314c',
    fontSize: 18,
    lineHeight: 26,
  },
  answerExample: {
    color: '#6e7088',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  answerExtra: {
    color: '#6f748f',
    fontSize: 14,
    lineHeight: 21,
  },
  answerFootnote: {
    color: '#8b7782',
    fontSize: 13,
    lineHeight: 20,
  },
  practiceFeedback: {
    color: '#27785a',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  choiceList: {
    gap: 10,
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
  aiPanel: {
    gap: 14,
    borderRadius: 26,
    backgroundColor: '#f8faf6',
    borderWidth: 1,
    borderColor: '#dbe5dc',
    padding: 18,
  },
  aiPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  aiPanelTitleWrap: {
    flex: 1,
    gap: 4,
  },
  aiPanelEyebrow: {
    color: '#738579',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  aiPanelTitle: {
    color: '#223147',
    fontSize: 20,
    fontWeight: '800',
  },
  aiPanelMeta: {
    color: '#768392',
    fontSize: 12,
    fontWeight: '700',
  },
  aiPanelCopy: {
    color: '#586575',
    fontSize: 14,
    lineHeight: 21,
  },
  aiUsageCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dce7dd',
    backgroundColor: '#f3f8f3',
    padding: 12,
  },
  aiUsageCopy: {
    color: '#587060',
    fontSize: 13,
    lineHeight: 19,
  },
  aiStatusCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8e4db',
    backgroundColor: '#f7fbf8',
    padding: 12,
    gap: 4,
  },
  aiStatusLabel: {
    color: '#708175',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  aiStatusCopy: {
    color: '#516171',
    fontSize: 13,
    lineHeight: 19,
  },
  aiProviderStack: {
    gap: 8,
  },
  aiProviderCard: {
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d7e4f1',
    backgroundColor: '#f7fbff',
    padding: 14,
  },
  aiProviderCardActive: {
    borderColor: '#8fc7e7',
    backgroundColor: '#e9f6ff',
  },
  aiProviderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  aiProviderTitle: {
    flex: 1,
    color: '#274267',
    fontSize: 14,
    fontWeight: '800',
  },
  aiProviderBadge: {
    borderRadius: 999,
    backgroundColor: '#edf2f8',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  aiProviderBadgeActive: {
    backgroundColor: '#bfe6fb',
  },
  aiProviderBadgeText: {
    color: '#607286',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aiProviderBadgeTextActive: {
    color: '#195784',
  },
  aiProviderDescription: {
    color: '#56708b',
    fontSize: 13,
    lineHeight: 19,
  },
  aiStudySheet: {
    gap: 12,
  },
  aiStudyEmpty: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dfe8dc',
    backgroundColor: '#fcfdf9',
    padding: 16,
    gap: 10,
  },
  aiStudyEmptyTitle: {
    color: '#25314c',
    fontSize: 18,
    fontWeight: '800',
  },
  aiStudyEmptyCopy: {
    color: '#617082',
    fontSize: 14,
    lineHeight: 21,
  },
  aiStudyEmptyChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aiStudyEmptyChip: {
    borderRadius: 999,
    backgroundColor: '#eef5ed',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  aiStudyEmptyChipText: {
    color: '#55705c',
    fontSize: 12,
    fontWeight: '800',
  },
  aiMemoryImageCard: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dde7de',
    backgroundColor: '#fcfdf9',
  },
  aiMemoryImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#edf1ea',
  },
  aiMemoryScenePlaceholder: {
    aspectRatio: 4 / 3,
    justifyContent: 'flex-end',
    gap: 10,
    overflow: 'hidden',
    backgroundColor: '#eef5ed',
    padding: 20,
  },
  aiMemorySceneGlowOne: {
    position: 'absolute',
    top: -18,
    right: -10,
    height: 140,
    width: 140,
    borderRadius: 999,
    backgroundColor: '#d9ebc8',
  },
  aiMemorySceneGlowTwo: {
    position: 'absolute',
    bottom: -26,
    left: -8,
    height: 120,
    width: 120,
    borderRadius: 999,
    backgroundColor: '#d5e7f6',
  },
  aiMemorySceneEyebrow: {
    color: '#6d7d6e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  aiMemorySceneWord: {
    color: '#243247',
    fontSize: 30,
    fontWeight: '900',
  },
  aiMemoryScenePrompt: {
    color: '#586675',
    fontSize: 14,
    lineHeight: 21,
  },
  aiMemoryImageCaption: {
    gap: 6,
    padding: 16,
  },
  aiMemoryImageLabel: {
    color: '#6d7d6e',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aiMemoryImageCopy: {
    color: '#576676',
    fontSize: 13,
    lineHeight: 20,
  },
  aiMeaningCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dce6dc',
    backgroundColor: '#fcfdf9',
    padding: 16,
    gap: 8,
  },
  aiMeaningEyebrow: {
    color: '#748577',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  aiMeaningValue: {
    color: '#243247',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
  },
  aiMeaningDivider: {
    height: 1,
    backgroundColor: '#e5ece4',
    marginVertical: 2,
  },
  aiMeaningSupportLabel: {
    color: '#7d7082',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  aiMeaningSupport: {
    color: '#5b6579',
    fontSize: 14,
    lineHeight: 21,
  },
  aiLearningGrid: {
    gap: 10,
  },
  aiLearningCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe6df',
    backgroundColor: '#f6faf7',
    padding: 14,
    gap: 8,
  },
  aiLearningCardSoft: {
    backgroundColor: '#f8fafc',
    borderColor: '#dce3ea',
  },
  aiLearningCardLabel: {
    color: '#718174',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  aiLearningCardValue: {
    color: '#2b3750',
    fontSize: 15,
    lineHeight: 22,
  },
  aiAnswerPill: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    backgroundColor: '#e6f0e7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  aiAnswerPillLabel: {
    color: '#66766c',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  aiAnswerPillValue: {
    color: '#233547',
    fontSize: 14,
    fontWeight: '800',
  },
  aiInsightCard: {
    backgroundColor: '#fff6ef',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0dacb',
    padding: 14,
    gap: 6,
  },
  aiInsightLabel: {
    color: '#8a6f8c',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aiInsightValue: {
    color: '#2d3650',
    fontSize: 14,
    lineHeight: 21,
  },
  aiAction: {
    borderRadius: 18,
    backgroundColor: '#6e8c80',
    borderWidth: 1,
    borderColor: '#8fa89f',
    paddingVertical: 15,
    alignItems: 'center',
  },
  aiActionPressed: {
    opacity: 0.82,
  },
  aiActionLabel: {
    color: '#fffdfb',
    fontSize: 15,
    fontWeight: '800',
  },
  favoriteShelf: {
    gap: 12,
  },
  favoriteEmptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dbe8df',
    backgroundColor: '#f9fcfa',
    padding: 18,
    gap: 10,
  },
  favoriteEmptyIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 164,
    marginBottom: 4,
  },
  favoriteEmptyIllustrationCard: {
    width: 170,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d8e8df',
    backgroundColor: '#fffefc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#d8b6a0',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },
  favoriteEmptyIllustrationCardBack: {
    position: 'absolute',
    top: 18,
    left: 28,
    transform: [{ rotate: '-8deg' }],
    backgroundColor: '#f7fbff',
  },
  favoriteEmptyIllustrationCardMid: {
    position: 'absolute',
    top: 8,
    right: 28,
    transform: [{ rotate: '9deg' }],
    backgroundColor: '#fff7f2',
  },
  favoriteEmptyIllustrationBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#fff0e4',
    borderWidth: 1,
    borderColor: '#ffc29c',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  favoriteEmptyIllustrationBadgeText: {
    color: '#c06435',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  favoriteEmptyIllustrationWord: {
    color: '#243247',
    fontSize: 22,
    fontWeight: '900',
  },
  favoriteEmptyIllustrationCopy: {
    color: '#657484',
    fontSize: 13,
    lineHeight: 18,
  },
  favoriteEmptyIllustrationSpark: {
    position: 'absolute',
    top: 10,
    right: 44,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#ffe2be',
  },
  favoriteEmptyIllustrationSparkSmall: {
    position: 'absolute',
    bottom: 18,
    left: 54,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#cfe5f7',
  },
  favoriteEmptyTitle: {
    color: '#243247',
    fontSize: 20,
    fontWeight: '800',
  },
  favoriteEmptyCopy: {
    color: '#607083',
    fontSize: 14,
    lineHeight: 21,
  },
  favoriteWordCard: {
    overflow: 'hidden',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#dde6e0',
    backgroundColor: '#fffdfb',
    shadowColor: '#d3b29d',
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 2,
  },
  favoriteWordVisual: {
    backgroundColor: '#eef5ed',
  },
  favoriteWordCardPressed: {
    opacity: 0.9,
  },
  favoriteWordImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#edf3ed',
  },
  favoriteWordPlaceholder: {
    aspectRatio: 16 / 9,
    justifyContent: 'flex-end',
    gap: 8,
    padding: 18,
    overflow: 'hidden',
    backgroundColor: '#eef6f2',
  },
  favoriteWordGlowTop: {
    position: 'absolute',
    top: -30,
    right: -10,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: '#ffe2be',
  },
  favoriteWordGlowBottom: {
    position: 'absolute',
    bottom: -22,
    left: -8,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: '#cfe5f7',
  },
  favoriteWordEyebrow: {
    color: '#6f7f76',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  favoriteWordHeadline: {
    color: '#243247',
    fontSize: 28,
    fontWeight: '900',
  },
  favoriteWordScene: {
    color: '#586877',
    fontSize: 14,
    lineHeight: 20,
  },
  favoriteWordBody: {
    gap: 12,
    padding: 16,
  },
  favoriteWordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  favoriteWordCopy: {
    flex: 1,
    gap: 4,
  },
  favoriteWordTitle: {
    color: '#243247',
    fontSize: 20,
    fontWeight: '800',
  },
  favoriteWordMeta: {
    color: '#7b7b8b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  favoriteToggleChip: {
    borderRadius: 999,
    backgroundColor: '#fff0e4',
    borderWidth: 1,
    borderColor: '#ffc29c',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  favoriteToggleChipPressed: {
    opacity: 0.8,
  },
  favoriteToggleChipLabel: {
    color: '#c06435',
    fontSize: 12,
    fontWeight: '800',
  },
  favoriteWordDefinition: {
    color: '#526070',
    fontSize: 14,
    lineHeight: 21,
  },
  favoriteWordFooter: {
    gap: 10,
  },
  favoriteWordFooterCopy: {
    color: '#667485',
    fontSize: 13,
    lineHeight: 19,
  },
  emptyState: {
    backgroundColor: '#fff8f2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#efdbce',
    padding: 18,
    gap: 10,
  },
  emptyTitle: {
    color: '#25314c',
    fontSize: 22,
    fontWeight: '800',
  },
  emptyCopy: {
    color: '#6f748f',
    fontSize: 15,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  form: {
    gap: 12,
  },
  inlineHint: {
    color: '#7f747e',
    fontSize: 13,
    lineHeight: 19,
  },
  stack: {
    gap: 10,
  },
  activityChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 6,
  },
  activitySummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activitySummaryCard: {
    flex: 1,
    minWidth: 96,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cfe2f5',
    backgroundColor: '#f7fbff',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 4,
  },
  activitySummaryLabel: {
    color: '#587191',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activitySummaryValue: {
    color: '#233755',
    fontSize: 24,
    fontWeight: '900',
  },
  activitySummaryDetail: {
    color: '#5e7087',
    fontSize: 13,
    lineHeight: 18,
  },
  activityBarItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  activityBarCount: {
    color: '#5c6882',
    fontSize: 13,
    fontWeight: '800',
  },
  activityBarCountToday: {
    color: '#c76031',
  },
  activityBarTrack: {
    width: '100%',
    height: 80,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#fff5ee',
    overflow: 'hidden',
    paddingBottom: 6,
  },
  activityBarFill: {
    width: '72%',
    borderRadius: 999,
    backgroundColor: '#9fd5fb',
  },
  activityBarFillToday: {
    backgroundColor: '#ff9a67',
  },
  activityBarLabel: {
    color: '#59667f',
    fontSize: 12,
    fontWeight: '800',
  },
  activityBarLabelToday: {
    color: '#25314c',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 20,
    backgroundColor: '#fff7f2',
    borderWidth: 1,
    borderColor: '#f0dbc9',
    padding: 14,
  },
  insightCopy: {
    flex: 1,
    gap: 4,
  },
  insightTitle: {
    color: '#25314c',
    fontSize: 16,
    fontWeight: '800',
  },
  insightDetail: {
    color: '#767686',
    fontSize: 13,
    lineHeight: 19,
  },
  insightValue: {
    color: '#ff8b56',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionEmpty: {
    color: '#707690',
    fontSize: 14,
  },
  wordRow: {
    backgroundColor: '#fffdfb',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#efdccf',
    borderLeftWidth: 4,
    borderLeftColor: '#ff996d',
    padding: 14,
    gap: 6,
    shadowColor: '#dab49f',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },
  wordRowPressed: {
    opacity: 0.78,
  },
  wordRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  wordRowTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordRowTitle: {
    color: '#25314c',
    fontSize: 18,
    fontWeight: '800',
  },
  wordRowFavoriteBadge: {
    borderRadius: 999,
    backgroundColor: '#fff0e4',
    borderWidth: 1,
    borderColor: '#ffc29c',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  wordRowFavoriteBadgeText: {
    color: '#c06435',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  wordRowOpen: {
    color: '#ff8b56',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  wordRowSubtitle: {
    color: '#6f748f',
    fontSize: 14,
    lineHeight: 20,
  },
  wordRowMeta: {
    color: '#8a8088',
    fontSize: 12,
  },
  bottomNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: '#f0ddd1',
    borderRadius: 28,
    padding: 8,
    shadowColor: '#cc9b83',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 6,
  },
  bottomNavButton: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  bottomNavButtonActive: {
    backgroundColor: '#fff2e9',
  },
  bottomNavButtonPressed: {
    opacity: 0.8,
  },
  bottomNavMarker: {
    width: 26,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  bottomNavMarkerActive: {
    backgroundColor: '#ff996d',
  },
  bottomNavLabel: {
    color: '#8d7b80',
    fontWeight: '800',
  },
  bottomNavLabelActive: {
    color: '#25314c',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(70, 51, 42, 0.18)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    maxHeight: '84%',
    borderRadius: 32,
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#efdcd0',
  },
  modalContent: {
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalTitle: {
    flex: 1,
    color: '#25314c',
    fontSize: 28,
    fontWeight: '800',
  },
  modalMeta: {
    color: '#707590',
    fontSize: 14,
    lineHeight: 21,
  },
  detailBlock: {
    borderRadius: 20,
    backgroundColor: '#fff7f1',
    borderWidth: 1,
    borderColor: '#f0dbc9',
    padding: 14,
    gap: 6,
  },
  detailLabel: {
    color: '#8d728b',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#2e3651',
    fontSize: 14,
    lineHeight: 21,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  assessmentCard: {
    borderRadius: 32,
    backgroundColor: '#fff8f2',
    borderWidth: 1,
    borderColor: '#f0d9ca',
    padding: 20,
    gap: 14,
    shadowColor: '#d9aa8e',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 5,
  },
  assessmentEyebrow: {
    color: '#ff8a54',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  assessmentTitle: {
    color: '#25314c',
    fontSize: 26,
    fontWeight: '800',
  },
  assessmentPrompt: {
    color: '#6f748f',
    fontSize: 15,
    lineHeight: 22,
  },
  profileCard: {
    borderRadius: 22,
    backgroundColor: '#fff7f2',
    borderWidth: 1,
    borderColor: '#f0dbc9',
    padding: 16,
    gap: 8,
  },
  profileValue: {
    color: '#25314c',
    fontSize: 24,
    fontWeight: '800',
  },
  profileCopy: {
    color: '#6f748f',
    fontSize: 14,
    lineHeight: 21,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 20,
    backgroundColor: '#fff7f2',
    borderWidth: 1,
    borderColor: '#f0dbc9',
    padding: 14,
  },
  settingCopyWrap: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    color: '#25314c',
    fontSize: 16,
    fontWeight: '800',
  },
  settingDescription: {
    color: '#6f748f',
    fontSize: 13,
    lineHeight: 19,
  },
  adjusterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    backgroundColor: '#fff7f2',
    borderWidth: 1,
    borderColor: '#f0dbc9',
    padding: 14,
  },
  adjusterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
});
