import * as FileSystem from 'expo-file-system';

const AI_MEMORY_IMAGE_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}ai-memory-images/`
  : null;

export async function cacheAiMemoryImage(
  wordId: string,
  base64Data?: string | null,
  mimeType?: string | null,
) {
  const normalizedBase64 = base64Data?.trim();
  const normalizedMimeType = mimeType?.trim();

  if (!AI_MEMORY_IMAGE_DIRECTORY || !normalizedBase64 || !normalizedMimeType) {
    return null;
  }

  const directoryInfo = await FileSystem.getInfoAsync(AI_MEMORY_IMAGE_DIRECTORY);

  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(AI_MEMORY_IMAGE_DIRECTORY, { intermediates: true });
  }

  const extension = getImageExtension(normalizedMimeType);
  const safeWordId = wordId.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const fileUri = `${AI_MEMORY_IMAGE_DIRECTORY}${safeWordId || 'word'}-${Date.now()}.${extension}`;

  await FileSystem.writeAsStringAsync(fileUri, normalizedBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
}

export async function deleteAiMemoryImage(uri?: string | null) {
  if (!uri?.trim()) {
    return;
  }

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best-effort cleanup for regenerated or deleted words.
  }
}

function getImageExtension(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}
