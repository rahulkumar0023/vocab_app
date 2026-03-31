import * as Haptics from 'expo-haptics';

import type { ReviewRating } from '../reviewScheduler';

export async function triggerSelectionHaptic() {
  await Haptics.selectionAsync();
}

export async function triggerSuccessHaptic() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export async function triggerErrorHaptic() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export async function triggerReviewHaptic(rating: ReviewRating) {
  if (rating === 'again') {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    return;
  }

  if (rating === 'easy') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  }

  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
