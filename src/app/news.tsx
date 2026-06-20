import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { NewsCard } from '@/components/NewsCard';
import { SegmentedControl } from '@/components/SegmentedControl';
import { NewsListSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/States';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { NEWS_TOPICS, relevanceOf, TOPIC_ICON, topicsOf, type NewsTopic } from '@/lib/newsTopics';
import { getAthletesByIds } from '@/services/athletes';
import { fetchNews } from '@/services/news';
import { useBookmarks } from '@/store/bookmarks';
import { useFavorites } from '@/store/favorites';
import type { Article } from '@/types';

type Mode = 'foryou' | 'all' | 'saved';
type Lang = 'de' | 'en';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.primary : theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function NewsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('foryou');
  const [topic, setTopic] = useState<NewsTopic | null>(null);
  const [lang, setLang] = useState<Lang | null>(null);

  const { saved } = useBookmarks();
  const { idsOf } = useFavorites();
  const seriesIds = idsOf('series');
  const athleteIds = idsOf('athlete');
  const brandIds = idsOf('brand');
  const hasInterests = seriesIds.length > 0 || athleteIds.length > 0 || brandIds.length > 0;

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['news'],
    queryFn: fetchNews,
  });
  const { data: favAthletes } = useQuery({
    queryKey: ['favoriteAthletes', athleteIds],
    queryFn: () => getAthletesByIds(athleteIds),
    enabled: athleteIds.length > 0,
  });
  const athleteNames = useMemo(() => (favAthletes ?? []).map((a) => a.name), [favAthletes]);

  const list = useMemo(() => {
    let base: Article[] = mode === 'saved' ? saved : (data ?? []);
    if (lang) base = base.filter((a) => a.lang === lang);
    if (topic) base = base.filter((a) => topicsOf(a).includes(topic));
    if (mode === 'foryou' && hasInterests) {
      const opts = { athleteNames, seriesIds, brandIds };
      base = [...base].sort((a, b) => {
        const diff = relevanceOf(b, opts) - relevanceOf(a, opts);
        return diff !== 0 ? diff : +new Date(b.publishedAt) - +new Date(a.publishedAt);
      });
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, saved, data, lang, topic, hasInterests, athleteNames.join('|'), seriesIds.join('|'), brandIds.join('|')]);

  const openArticle = (link: string) => {
    if (link) WebBrowser.openBrowserAsync(link);
  };

  const showFilters = mode !== 'saved' || saved.length > 0;

  const header =
    mode === 'foryou' && !hasInterests ? (
      <Pressable
        onPress={() => router.push('/onboarding')}
        style={[styles.hint, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Ionicons name="sparkles-outline" size={20} color={theme.primary} />
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">{t('news.personalizeTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('news.personalizeHint')}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>
    ) : null;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('news.title') }} />

      <View style={styles.segmentWrap}>
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          segments={[
            { value: 'foryou', label: t('news.foryou') },
            { value: 'all', label: t('news.all') },
            { value: 'saved', label: t('news.saved') },
          ]}
        />
      </View>

      {showFilters && (
        <View style={styles.filters}>
          <View style={styles.facetRow}>
            <Chip label={t('news.allTopics')} active={topic == null} onPress={() => setTopic(null)} />
            {NEWS_TOPICS.map((tp) => (
              <Chip
                key={tp}
                label={`${TOPIC_ICON[tp]} ${t(`news.topics.${tp}`)}`}
                active={topic === tp}
                onPress={() => setTopic(topic === tp ? null : tp)}
              />
            ))}
          </View>
          <View style={styles.facetRow}>
            <Chip label={`🌐 ${t('news.allLanguages')}`} active={lang == null} onPress={() => setLang(null)} />
            <Chip label="🇩🇪 DE" active={lang === 'de'} onPress={() => setLang(lang === 'de' ? null : 'de')} />
            <Chip label="🇬🇧 EN" active={lang === 'en'} onPress={() => setLang(lang === 'en' ? null : 'en')} />
          </View>
        </View>
      )}

      {mode !== 'saved' && isLoading ? (
        <NewsListSkeleton />
      ) : mode !== 'saved' && isError ? (
        <ErrorState message={t('news.loadError')} onRetry={refetch} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => <NewsCard article={item} onPress={() => openArticle(item.link)} />}
          refreshControl={
            mode !== 'saved' ? (
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={mode === 'saved' ? 'bookmark-outline' : 'newspaper-outline'}
              message={mode === 'saved' ? t('favorites.empty') : t('news.empty')}
            />
          }
          contentContainerStyle={list?.length ? undefined : styles.empty}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentWrap: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  filters: { gap: Spacing.two, paddingBottom: Spacing.two },
  facetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.three },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    margin: Spacing.three,
    marginTop: 0,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  empty: { flexGrow: 1 },
});
