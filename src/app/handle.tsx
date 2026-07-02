import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/Toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { loginEnabled } from '@/lib/supabase';
import { setMyHandle } from '@/services/tippspielSync';

const MIN = 2;
const MAX = 20;

export default function HandleScreen() {
  const { current } = useLocalSearchParams<{ current?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { show } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState(current ?? '');
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length >= MIN && name.trim().length <= MAX;

  const onSave = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const res = await setMyHandle(name);
    setBusy(false);
    if (res.ok) {
      haptics.success();
      qc.invalidateQueries({ queryKey: ['myHandle'] });
      qc.invalidateQueries({ queryKey: ['leaderboard'] });
      // The name also appears in every GROUP leaderboard (+ the global group list) — without
      // invalidating those, the cached rows keep showing the old name ("anon") for up to staleTime.
      qc.invalidateQueries({ queryKey: ['groupBoard'] });
      qc.invalidateQueries({ queryKey: ['groupGlobal'] });
      show(t('handle.savedToast'), 'checkmark-circle');
      router.back();
    } else {
      show(res.error === 'taken' ? t('handle.taken') : t('handle.error'), 'alert-circle');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <View style={styles.head}>
        <ThemedText type="subtitle">{t('handle.title')}</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          {t('handle.intro')}
        </ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('handle.placeholder')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={MAX}
          autoFocus
          onSubmitEditing={onSave}
          returnKeyType="done"
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
        />
        <Pressable
          onPress={onSave}
          disabled={!valid || busy}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.primary, opacity: !valid || busy ? 0.5 : pressed ? 0.85 : 1 },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>
            {busy ? t('handle.saving') : t('handle.save')}
          </ThemedText>
        </Pressable>

        {/* Honest, privacy-first framing: no account needed, minimal data, device-only without securing. */}
        <View style={[styles.infoCard, { borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.infoLine}>
            {t('handle.privacy')}
          </ThemedText>
          <View style={styles.warnRow}>
            <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t('handle.deviceWarn')}
            </ThemedText>
          </View>
        </View>

        {loginEnabled ? (
          <Pressable onPress={() => router.replace('/login')} hitSlop={8} style={styles.secureRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary }}>{t('handle.secure')}</ThemedText>
          </Pressable>
        ) : (
          <View style={styles.secureRow}>
            <Ionicons name="shield-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">{t('handle.secureSoon')}</ThemedText>
          </View>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  body: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  intro: { lineHeight: 19 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
  },
  primary: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: 14 },
  flex: { flex: 1 },
  infoCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  infoLine: { lineHeight: 18 },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one + 2, paddingVertical: Spacing.two },
});
