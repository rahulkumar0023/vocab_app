import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'vocab_builder_ai_device_id';

export function hasFirebaseGeminiConfig() {
  return Boolean(readProjectId());
}

export function getFirebaseFunctionsRegion() {
  return process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION?.trim() || 'us-central1';
}

export async function ensureFirebaseDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const nextId = createDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, nextId);
  return nextId;
}

export function getFirebaseFunctionUrl(functionName: 'generateStudyKit') {
  const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST?.trim();
  const projectId = readProjectId();

  if (!projectId) {
    return '';
  }

  if (emulatorHost) {
    return `http://${emulatorHost}/${projectId}/${getFirebaseFunctionsRegion()}/${functionName}`;
  }

  return `https://${getFirebaseFunctionsRegion()}-${projectId}.cloudfunctions.net/${functionName}`;
}

function readProjectId() {
  return process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() || '';
}

function createDeviceId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);

  return `device_${timestamp}_${random}`;
}
