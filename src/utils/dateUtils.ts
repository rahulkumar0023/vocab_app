export function formatDueLabel(dueAt: string) {
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

export function getDateKey(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

export function formatCompactTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
}
