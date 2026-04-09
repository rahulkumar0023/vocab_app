import { create } from 'zustand';
import { type SQLiteDatabase } from 'expo-sqlite';
import {
  type VocabCard,
  type ReviewLogEntry,
  type UserProfile,
  type AiStudyKit,
  loadCards,
  loadReviewLog,
  loadUserProfile,
  saveUserProfile as saveProfileToDb,
} from '../db';
import { type AccountSession } from '../services/account';
import { type SubscriptionState, getDefaultSubscriptionState } from '../services/subscriptions';

interface AppState {
  // Data State
  database: SQLiteDatabase | null;
  cards: VocabCard[];
  logs: ReviewLogEntry[];
  profile: UserProfile;
  accountSession: AccountSession | null;
  subscriptionState: SubscriptionState;

  // Loading/Busy States
  isBooting: boolean;
  isRefreshing: boolean;
  isMutating: boolean;
  isImporting: boolean;
  isAiLoading: boolean;

  // Setters/Actions
  setDatabase: (db: SQLiteDatabase | null) => void;
  setCards: (cards: VocabCard[]) => void;
  setLogs: (logs: ReviewLogEntry[]) => void;
  setProfile: (profile: UserProfile) => void;
  setAccountSession: (session: AccountSession | null) => void;
  setSubscriptionState: (state: SubscriptionState) => void;

  setIsBooting: (isBooting: boolean) => void;
  setIsRefreshing: (isRefreshing: boolean) => void;
  setIsMutating: (isMutating: boolean) => void;
  setIsImporting: (isImporting: boolean) => void;
  setIsAiLoading: (isAiLoading: boolean) => void;

  // Async Actions
  refreshData: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

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

export const useAppStore = create<AppState>((set, get) => ({
  database: null,
  cards: [],
  logs: [],
  profile: defaultProfile,
  accountSession: null,
  subscriptionState: getDefaultSubscriptionState(),

  isBooting: true,
  isRefreshing: false,
  isMutating: false,
  isImporting: false,
  isAiLoading: false,

  setDatabase: (database) => set({ database }),
  setCards: (cards) => set({ cards }),
  setLogs: (logs) => set({ logs }),
  setProfile: (profile) => set({ profile }),
  setAccountSession: (accountSession) => set({ accountSession }),
  setSubscriptionState: (subscriptionState) => set({ subscriptionState }),

  setIsBooting: (isBooting) => set({ isBooting }),
  setIsRefreshing: (isRefreshing) => set({ isRefreshing }),
  setIsMutating: (isMutating) => set({ isMutating }),
  setIsImporting: (isImporting) => set({ isImporting }),
  setIsAiLoading: (isAiLoading) => set({ isAiLoading }),

  refreshData: async () => {
    const { database } = get();
    if (!database) return;

    set({ isRefreshing: true });
    try {
      const [newCards, newLogs, newProfile] = await Promise.all([
        loadCards(database),
        loadReviewLog(database),
        loadUserProfile(database),
      ]);
      set({ cards: newCards, logs: newLogs, profile: newProfile });
    } finally {
      set({ isRefreshing: false });
    }
  },

  updateProfile: async (updates) => {
    const { database, profile } = get();
    if (!database) return;

    const updatedProfile = { ...profile, ...updates };
    set({ profile: updatedProfile });
    await saveProfileToDb(database, updates);
  },
}));
