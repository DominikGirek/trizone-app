import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BriefingItem, RaceBriefing } from '@/types';

function open(url?: string) {
  if (url) WebBrowser.openBrowserAsync(url);
}

function Row({ item }: { item: BriefingItem }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const href = item.mapsUrl ?? item.url;
  const right = item.time ? (
    <ThemedText type="small" style={[styles.time, { color: theme.text }]}>
      {item.time}
    </ThemedText>
  ) : item.mapsUrl ? (
    <ThemedText type="small" themeColor="textSecondary">
      {t('local.map')} ›
    </ThemedText>
  ) : null;

  return (
    <Pressable
      onPress={href ? () => open(href) : undefined}
      disabled={!href}
      style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && href && { opacity: 0.6 }]}>
      <View style={styles.rowLeft}>
        {!!item.mapsUrl && (
          <Ionicons name="location" size={14} color={theme.primary} style={{ marginRight: 6 }} />
        )}
        <ThemedText type="small" style={{ color: theme.text }} numberOfLines={2}>
          {item.label}
          {!!item.place && (
            <ThemedText type="small" themeColor="textSecondary">
              {' · '}
              {item.place}
            </ThemedText>
          )}
        </ThemedText>
      </View>
      {right}
    </Pressable>
  );
}

export function RaceBriefingView({ briefing }: { briefing: RaceBriefing }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const d = new Date(briefing.updated);
  const stand = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;

  return (
    <View style={styles.wrap}>
      {/* Honesty banner — always shows the dated source; a status caveat (note) tints it red. */}
      <View
        style={[
          styles.note,
          briefing.note
            ? { backgroundColor: theme.primary + '1A', borderColor: theme.primary + '59' }
            : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <Ionicons
          name={briefing.note ? 'flame' : 'information-circle-outline'}
          size={16}
          color={briefing.note ? theme.primary : theme.textSecondary}
        />
        <ThemedText type="small" style={styles.noteText}>
          {!!briefing.note && (
            <ThemedText type="small" style={{ color: theme.primary }}>
              {briefing.note}
              {'  '}
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {t('briefing.asOf', { date: stand, source: briefing.source })}
          </ThemedText>
        </ThemedText>
      </View>

      {briefing.sections.map((sec) => (
        <View key={sec.title} style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            {sec.title}
          </ThemedText>
          {sec.items.map((it, i) => (
            <Row key={`${sec.title}-${i}`} item={it} />
          ))}
        </View>
      ))}

      {/* presented by */}
      {(!!briefing.presentedBy || !!briefing.hashtag) && (
        <View style={[styles.presented, { backgroundColor: theme.backgroundElement }]}>
          {!!briefing.hashtag && (
            <ThemedText type="small" themeColor="textSecondary">
              {briefing.hashtag}
            </ThemedText>
          )}
          {!!briefing.presentedBy && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('briefing.presentedBy')} <ThemedText type="smallBold">{briefing.presentedBy}</ThemedText>
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.one },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two + 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.two,
  },
  noteText: { flex: 1, lineHeight: 17 },
  section: { marginTop: Spacing.three },
  sectionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  time: { fontVariant: ['tabular-nums'], fontWeight: '600' },
  presented: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    marginTop: Spacing.four,
  },
});
