import AsyncStorage from '@react-native-async-storage/async-storage';

export type AccountProvider = 'guest' | 'apple' | 'device';

export type AccountSession = {
  provider: AccountProvider;
  providerLabel: string;
  displayName: string;
  email: string | null;
  userId: string | null;
  signedInAt: string;
};

const ACCOUNT_SESSION_KEY = 'vocab_builder_account_session';

export async function ensureAccountSession() {
  const existing = await loadAccountSession();

  if (existing) {
    return existing;
  }

  const guestSession = createGuestAccountSession();
  await saveAccountSession(guestSession);
  return guestSession;
}

export async function loadAccountSession() {
  const raw = await AsyncStorage.getItem(ACCOUNT_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AccountSession>;
    return normalizeAccountSession(parsed);
  } catch {
    return null;
  }
}

export async function saveAccountSession(session: AccountSession) {
  await AsyncStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(session));
}

export async function clearAccountSession() {
  await AsyncStorage.removeItem(ACCOUNT_SESSION_KEY);
}

export function createGuestAccountSession(): AccountSession {
  return {
    provider: 'guest',
    providerLabel: 'Guest',
    displayName: 'Guest learner',
    email: null,
    userId: null,
    signedInAt: new Date().toISOString(),
  };
}

export function createDeviceAccountSession(
  authLabel: string,
  previousSession?: AccountSession | null,
): AccountSession {
  const existingName =
    previousSession?.provider === 'guest' ? null : previousSession?.displayName?.trim() || null;

  return {
    provider: 'device',
    providerLabel: authLabel,
    displayName: existingName || 'Private learner',
    email: previousSession?.email ?? null,
    userId: previousSession?.userId ?? null,
    signedInAt: new Date().toISOString(),
  };
}

export function createAppleAccountSession(input: {
  appleUserId: string;
  email?: string | null;
  fullName?: string | null;
  previousSession?: AccountSession | null;
}) {
  const trimmedEmail = input.email?.trim() || input.previousSession?.email || null;
  const trimmedName = input.fullName?.trim() || null;
  const fallbackName =
    input.previousSession?.provider === 'apple'
      ? input.previousSession.displayName
      : trimmedEmail?.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Apple learner';

  return {
    provider: 'apple',
    providerLabel: 'Apple',
    displayName: trimmedName || titleCase(fallbackName),
    email: trimmedEmail,
    userId: input.appleUserId,
    signedInAt: new Date().toISOString(),
  } satisfies AccountSession;
}

function normalizeAccountSession(session: Partial<AccountSession> | null) {
  if (
    !session ||
    (session.provider !== 'guest' && session.provider !== 'apple' && session.provider !== 'device') ||
    typeof session.displayName !== 'string' ||
    typeof session.providerLabel !== 'string' ||
    typeof session.signedInAt !== 'string'
  ) {
    return null;
  }

  return {
    provider: session.provider,
    providerLabel: session.providerLabel,
    displayName: session.displayName,
    email: typeof session.email === 'string' ? session.email : null,
    userId: typeof session.userId === 'string' ? session.userId : null,
    signedInAt: session.signedInAt,
  } satisfies AccountSession;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}
