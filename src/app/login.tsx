import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/Toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/store/auth';

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { show } = useToast();
  const { signedIn, displayName, sendEmailCode, verifyEmailCode, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);

  const done = () => {
    haptics.success();
    show(t('auth.signedInToast'), 'checkmark-circle');
    router.back();
  };

  const onSend = async () => {
    if (!email.includes('@')) return;
    setBusy(true);
    const res = await sendEmailCode(email);
    setBusy(false);
    if (res.ok) {
      haptics.light();
      setStage('code');
    } else {
      show(t('auth.errorGeneric'), 'alert-circle');
    }
  };

  const onVerify = async () => {
    if (code.trim().length < 4) return;
    setBusy(true);
    const res = await verifyEmailCode(email, code);
    setBusy(false);
    if (res.ok) done();
    else show(t('auth.codeWrong'), 'alert-circle');
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <View style={styles.head}>
        <ThemedText type="subtitle">{t('auth.title')}</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      {signedIn ? (
        <View style={styles.body}>
          <View style={[styles.profile, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="person-circle-outline" size={40} color={theme.primary} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{t('auth.signedInAs')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{displayName}</ThemedText>
            </View>
          </View>
          <Pressable
            onPress={async () => {
              await signOut();
              show(t('auth.signedOutToast'), 'checkmark-circle');
            }}
            style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && { opacity: 0.7 }]}>
            <ThemedText type="smallBold">{t('auth.signOut')}</ThemedText>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
            {t('auth.intro')}
          </ThemedText>

          {stage === 'email' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                inputMode="email"
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
              />
              <Pressable
                onPress={onSend}
                disabled={busy || !email.includes('@')}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.primary, opacity: busy || !email.includes('@') ? 0.5 : pressed ? 0.85 : 1 },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>
                  {t('auth.sendCode')}
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
                {t('auth.codeSent', { email })}
              </ThemedText>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                style={[styles.input, styles.code, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
              />
              <Pressable
                onPress={onVerify}
                disabled={busy || code.trim().length < 4}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.primary, opacity: busy || code.trim().length < 4 ? 0.5 : pressed ? 0.85 : 1 },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>
                  {t('auth.verify')}
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => setStage('email')} hitSlop={8} style={styles.changeRow}>
                <ThemedText type="small" themeColor="textSecondary">{t('auth.changeEmail')}</ThemedText>
              </Pressable>
            </>
          )}
        </KeyboardAvoidingView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  body: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  flex: { flex: 1 },
  intro: { lineHeight: 19 },
  appleBtn: { height: 48, width: '100%' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  code: { fontSize: 22, letterSpacing: 6, textAlign: 'center', fontVariant: ['tabular-nums'] },
  primary: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: 14 },
  secondary: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  changeRow: { alignItems: 'center', paddingVertical: Spacing.two },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 14 },
});
