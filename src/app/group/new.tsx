import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { InviteCode } from '@/components/InviteCode';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/Toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { createGroup, joinGroup, type Group } from '@/services/tippspielSync';

export default function NewGroupScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { show } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [created, setCreated] = useState<Group | null>(null); // success step shows the code in-flow

  const onCreate = async () => {
    if (name.trim().length < 2 || busy) return;
    setBusy('create');
    try {
      const g = await createGroup(name.trim());
      haptics.success();
      qc.invalidateQueries({ queryKey: ['myGroups'] });
      setBusy(null);
      setCreated(g); // stay here and show the invite code right away
    } catch {
      setBusy(null);
      show(t('group.createError'), 'alert-circle');
    }
  };

  const onJoin = async () => {
    if (code.trim().length < 4 || busy) return;
    setBusy('join');
    try {
      const g = await joinGroup(code.trim());
      haptics.success();
      qc.invalidateQueries({ queryKey: ['myGroups'] });
      router.replace(`/group/${g.id}`);
    } catch {
      setBusy(null);
      show(t('group.joinError'), 'alert-circle');
    }
  };

  const onShare = (g: Group) => {
    haptics.light();
    Share.share({ message: t('group.shareMsg', { name: g.name, code: g.invite_code }) }).catch(() => {});
  };

  // Success step — the group exists; show its code prominently before moving on.
  if (created) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <View style={styles.head}>
          <ThemedText type="subtitle">{t('group.created')}</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <ThemedText type="smallBold" style={styles.createdName} numberOfLines={1}>
            {created.name}
          </ThemedText>
          <InviteCode code={created.invite_code} onShare={() => onShare(created)} />
          <Pressable
            onPress={() => router.replace(`/group/${created.id}`)}
            style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && { opacity: 0.7 }]}>
            <ThemedText type="smallBold">{t('group.toGroup')}</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <View style={styles.head}>
        <ThemedText type="subtitle">{t('group.newTitle')}</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        {/* Create */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.cardHead}>
            <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
            <ThemedText type="smallBold">{t('group.createTitle')}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {t('group.createHint')}
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('group.namePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            maxLength={40}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
          />
          <Pressable
            onPress={onCreate}
            disabled={name.trim().length < 2 || busy !== null}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.primary, opacity: name.trim().length < 2 || busy ? 0.5 : pressed ? 0.85 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>
              {busy === 'create' ? t('group.creating') : t('group.createCta')}
            </ThemedText>
          </Pressable>
        </View>

        {/* Join */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.cardHead}>
            <Ionicons name="enter-outline" size={20} color={theme.primary} />
            <ThemedText type="smallBold">{t('group.joinTitle')}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {t('group.joinHint')}
          </ThemedText>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="ABC123"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            style={[styles.input, styles.codeInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
          />
          <Pressable
            onPress={onJoin}
            disabled={code.trim().length < 4 || busy !== null}
            style={({ pressed }) => [
              styles.secondary,
              { borderColor: theme.border, opacity: code.trim().length < 4 || busy ? 0.5 : pressed ? 0.7 : 1 },
            ]}>
            <ThemedText type="smallBold">{busy === 'join' ? t('group.joining') : t('group.joinCta')}</ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  body: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  createdName: { fontSize: 17, textAlign: 'center' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hint: { lineHeight: 18 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  codeInput: { fontSize: 20, letterSpacing: 4, textAlign: 'center', fontVariant: ['tabular-nums'] },
  primary: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: 14, marginTop: Spacing.one },
  secondary: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginTop: Spacing.one },
});
