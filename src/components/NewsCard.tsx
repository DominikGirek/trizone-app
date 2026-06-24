import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
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

// Deterministic muted hue per source, so image-less cards look intentional (and varied)
// instead of a row of identical grey boxes.
function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function NewsCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { show } = useToast();
  const { isSaved, toggle } = useBookmarks();
  const lang = i18n.language as AppLanguage;
  const saved = isSaved(article.id);
  const [imgFailed, setImgFailed] = useState(false);

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
      {article.imageUrl && !imgFailed ? (
        <Image
          source={{ uri: article.imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <View
          style={[
            styles.image,
            styles.imageFallback,
            { backgroundColor: `hsl(${hueFromString(article.source)}, 42%, 30%)` },
          ]}>
          <Ionicons name="newspaper" size={22} color="rgba(255,255,255,0.95)" />
          <ThemedText style={styles.fallbackSource} numberOfLines={1}>
            {article.source}
          </ThemedText>
        </View>
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
  imageFallback: { alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 6 },
  fallbackSource: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.95)', textAlign: 'center' },
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
