import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Thin wrapper so call sites stay clean and web stays a no-op.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  selection() {
    if (enabled) Haptics.selectionAsync().catch(() => {});
  },
  light() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
