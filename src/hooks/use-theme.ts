/**
 * Resolves the active color palette, honoring the user's theme preference
 * (system / light / dark) from the settings store.
 */

import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/store/settings';

export function useTheme() {
  const scheme = useResolvedScheme();
  return Colors[scheme];
}
