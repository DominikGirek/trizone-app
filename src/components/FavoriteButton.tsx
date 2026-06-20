import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { useToast } from '@/components/Toast';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useFavorites } from '@/store/favorites';
import type { FavoriteKind } from '@/types';

export function FavoriteButton({
  kind,
  id,
  size = 24,
}: {
  kind: FavoriteKind;
  id: string;
  size?: number;
}) {
  const { isFavorite, toggle } = useFavorites();
  const { show } = useToast();
  const { t } = useTranslation();
  const theme = useTheme();
  const active = isFavorite(kind, id);
  const scale = useRef(new Animated.Value(1)).current;

  const onPress = () => {
    const willBeActive = !active;
    toggle(kind, id);
    haptics.light();
    show(t(willBeActive ? 'favorites.added' : 'favorites.removed'), willBeActive ? 'star' : 'star-outline');
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      hitSlop={10}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? t('favorites.removed') : t('favorites.added')}
      style={styles.button}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={active ? 'star' : 'star-outline'}
          size={size}
          color={active ? theme.primary : theme.textSecondary}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 2 },
});
