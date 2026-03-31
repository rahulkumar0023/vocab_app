import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { AppSnapshot } from '../db';

const SNAPSHOT_VERSION = 1;

export async function shareAppSnapshot(snapshot: AppSnapshot) {
  const fileUri = await writeSnapshotFile(snapshot);
  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Share your Vocab Builder backup',
      UTI: 'public.json',
    });
  }

  return {
    fileUri,
    shared: canShare,
  };
}

export async function pickAppSnapshot() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];

  if (!asset?.uri) {
    throw new Error('The selected file could not be opened.');
  }

  const raw = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const parsed = JSON.parse(raw) as unknown;

  if (!isAppSnapshot(parsed)) {
    throw new Error('This file is not a valid Vocab Builder backup.');
  }

  return parsed;
}

async function writeSnapshotFile(snapshot: AppSnapshot) {
  if (!FileSystem.cacheDirectory) {
    throw new Error('Local file storage is not available on this device.');
  }

  const fileUri = `${FileSystem.cacheDirectory}vocab-builder-backup-${formatTimestamp()}.json`;

  await FileSystem.writeAsStringAsync(
    fileUri,
    JSON.stringify(
      {
        ...snapshot,
        version: SNAPSHOT_VERSION,
      },
      null,
      2,
    ),
    {
      encoding: FileSystem.EncodingType.UTF8,
    },
  );

  return fileUri;
}

function formatTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function isAppSnapshot(value: unknown): value is AppSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const snapshot = value as Partial<AppSnapshot> & { version?: unknown };

  return (
    typeof snapshot.exportedAt === 'string' &&
    Array.isArray(snapshot.words) &&
    Array.isArray(snapshot.reviewLog) &&
    Array.isArray(snapshot.aiStudyKits) &&
    !!snapshot.userProfile &&
    (snapshot.version === undefined || typeof snapshot.version === 'number')
  );
}
