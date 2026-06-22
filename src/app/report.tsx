import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/Toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { submitReport } from '@/lib/report';

type Kind = 'race' | 'athlete' | 'brand';
const KINDS: Kind[] = ['race', 'athlete', 'brand'];

export default function ReportScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { type, prefill } = useLocalSearchParams<{ type?: string; prefill?: string }>();
  const fixedKind: Kind | undefined = type === 'athlete' || type === 'brand' || type === 'race' ? type : undefined;

  const [kind, setKind] = useState<Kind>(fixedKind ?? 'race');
  const [name, setName] = useState(prefill ?? '');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const cap = kind.charAt(0).toUpperCase() + kind.slice(1);
  const title = fixedKind ? t(`report.title${cap}`) : t('report.titleGeneral');
  const subtitle = t(`report.subtitle${cap}`);
  const nameLabel = t(`report.name${cap}`);

  const submit = async () => {
    if (!name.trim() || sending) {
      if (!name.trim()) toast.show(t('report.nameRequired'), 'alert-circle');
      return;
    }
    setSending(true);
    const ok = await submitReport({
      subject: `${t(`report.title${cap}`)}: ${name.trim()}`,
      fields: { [nameLabel]: name, [t('report.link')]: link, [t('report.note')]: note },
    });
    setSending(false);
    if (ok) {
      haptics.success();
      toast.show(t('report.sent'), 'checkmark-circle');
      router.back();
    } else {
      toast.show(t('report.error'), 'alert-circle');
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.head}>
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!fixedKind && (
          <View style={styles.segment}>
            {KINDS.map((k) => {
              const active = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[
                    styles.segItem,
                    {
                      backgroundColor: active ? theme.primary : theme.backgroundElement,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: active ? theme.onPrimary : theme.text, fontSize: 13 }}>
                    {t(`report.kind${k.charAt(0).toUpperCase() + k.slice(1)}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.three }}>
          {subtitle}
        </ThemedText>

        <ThemedText type="smallBold" style={styles.label}>
          {nameLabel}
        </ThemedText>
        <TextInput value={name} onChangeText={setName} autoFocus placeholderTextColor={theme.textSecondary} style={inputStyle} />

        <ThemedText type="smallBold" style={styles.label}>
          {t('report.link')}
        </ThemedText>
        <TextInput
          value={link}
          onChangeText={setLink}
          placeholder={t('report.linkPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={inputStyle}
        />

        <ThemedText type="smallBold" style={styles.label}>
          {t('report.note')}
        </ThemedText>
        <TextInput value={note} onChangeText={setNote} multiline placeholderTextColor={theme.textSecondary} style={[inputStyle, styles.note]} />

        <Pressable
          onPress={submit}
          disabled={sending}
          style={[styles.cta, { backgroundColor: theme.primary, opacity: sending ? 0.7 : 1 }]}>
          {sending ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>
              {t('report.submit')}
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: { flex: 1, fontSize: 18 },
  body: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  segment: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: { marginBottom: Spacing.one, marginTop: Spacing.three },
  input: { height: 46, borderRadius: 12, paddingHorizontal: Spacing.three, fontSize: 16 },
  note: { height: 100, paddingTop: Spacing.two, textAlignVertical: 'top' },
  cta: { marginTop: Spacing.five, paddingVertical: Spacing.three, borderRadius: 14, alignItems: 'center' },
});
