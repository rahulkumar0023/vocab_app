import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { openAppDatabase, loadUserProfile, ensureAccountSession } from '../db';
import { detectAvailableSignInOptions } from '../services/account'; // Assuming moved here or still in App.tsx but needs to be accessible
import { loadSubscriptionState } from '../services/subscriptions';
import { getRecommendedImportDifficulty, getStarterDeckSize } from '../assessment';

// We might need to move detectAvailableSignInOptions to a service if it's not already
export function useInitializeApp() {
  const {
    setDatabase,
    setProfile,
    setAccountSession,
    setSubscriptionState,
    setIsBooting,
    refreshData,
  } = useAppStore();

  useEffect(() => {
    let isCancelled = false;
    let openedDatabase: any = null;

    async function boot() {
      try {
        const db = await openAppDatabase();
        openedDatabase = db;

        const [profile, accountSession, subscriptionState] = await Promise.all([
          loadUserProfile(db),
          ensureAccountSession(),
          loadSubscriptionState(),
        ]);

        if (isCancelled) {
          await db.closeAsync();
          return;
        }

        setDatabase(db);
        setProfile(profile);
        setAccountSession(accountSession);
        setSubscriptionState(subscriptionState);

        await refreshData();
      } catch (error) {
        console.error("Failed to boot app", error);
      } finally {
        if (!isCancelled) {
          setIsBooting(false);
        }
      }
    }

    boot();

    return () => {
      isCancelled = true;
      if (openedDatabase) {
        openedDatabase.closeAsync();
      }
    };
  }, []);
}
