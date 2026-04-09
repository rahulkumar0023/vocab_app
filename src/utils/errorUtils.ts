export function getErrorMessage(error: unknown): string {
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
