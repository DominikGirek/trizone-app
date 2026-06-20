import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { useToast } from '@/components/Toast';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/i18n';
import { timeAgo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useBookmarks } from '@/store/bookmarks';
import type { Article } from '@/types';

export function NewsCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { show } = useToast();
  const { isSaved, toggle } = useBookmarks();
  const lang = i18n.language as AppLanguage;
  const saved = isSaved(article.id);

  const onSave = () => {
    haptics.light();
    const nowSaved = toggle(article);
    show(t(nowSaved ? 'actions.savedToast' : 'actions.unsavedToast'), nowSaved ? 'bookmark' : 'bookmark-outline');
  };

  const onShare = () => {
    haptics.light();
    Share.share({ message: `${article.title}\n${article.link}` }).catch(() => {});
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && { opacity: 0.7 },
      ]}>
      {article.imageUrl ? (
        <Image source={{ uri: article.imageUrl }} style={styles.image} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.image, { backgroundColor: theme.backgroundElement }]} />
      )}
      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={3} style={styles.title}>
          {article.title}
        </ThemedText>
        {!!article.summary && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {article.summary}
          </ThemedText>
        )}
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>
              {article.source}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              · {timeAgo(article.publishedAt, lang)}
            </ThemedText>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onSave} hitSlop={8}>
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={saved ? theme.primary : theme.textSecondary}
              />
            </Pressable>
            <Pressable onPress={onShare} hitSlop={8}>
              <Ionicons name="share-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  image: { width: 96, height: 96, borderRadius: 10 },
  body: { flex: 1, gap: Spacing.one, justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
