import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/Toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useAuth, type OAuthProvider } from '@/store/auth';

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { show } = useToast();
  const { signedIn, isAnonymous, displayName, appleAvailable, googleAvailable, signInWithProvider, sendEmailCode, verifyEmailCode, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState<null | 'apple' | 'google' | 'email'>(null);

  const done = () => {
    haptics.success();
    show(t('auth.signedInToast'), 'checkmark-circle');
    router.back();
  };

  // Map a store error code to a friendly line (silent on user-cancel).
  const errText = (err: string): string | null => {
    if (err === 'cancelled') return null;
    const key = `auth.err.${err}`;
    const msg = t(key);
    return msg === key ? t('auth.errorGeneric') : msg;
  };
  const showErr = (err: string) => {
    const m = errText(err);
    if (m) show(m, 'alert-circle');
  };

  const onProvider = async (provider: OAuthProvider) => {
    setBusy(provider);
    const res = await signInWithProvider(provider);
    setBusy(null);
    if (res.ok) done();
    else showErr(res.error);
  };

  const onSend = async () => {
    if (!email.includes('@')) return;
    setBusy('email');
    const res = await sendEmailCode(email);
    setBusy(null);
    if (res.ok) {
      haptics.light();
      setStage('code');
    } else showErr(res.error);
  };

  const onVerify = async () => {
    if (code.trim().length < 4) return;
    setBusy('email');
    const res = await verifyEmailCode(email, code);
    setBusy(null);
    if (res.ok) done();
    else showErr(res.error);
  };

  const anyBusy = busy !== null;

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
            {isAnonymous ? t('auth.introSecure') : t('auth.intro')}
          </ThemedText>

          {/* Smoothest first: one-tap social. Apple on iOS (App Store 4.8), Google everywhere. */}
          {appleAvailable && (
            <Pressable
              onPress={() => onProvider('apple')}
              disabled={anyBusy}
              style={({ pressed }) => [styles.social, { backgroundColor: theme.text }, (anyBusy || pressed) && { opacity: 0.85 }]}>
              {busy === 'apple' ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={19} color={theme.background} />
                  <ThemedText type="smallBold" style={{ color: theme.background, fontSize: 16 }}>{t('auth.continueApple')}</ThemedText>
                </>
              )}
            </Pressable>
          )}
          {googleAvailable && (
            <Pressable
              onPress={() => onProvider('google')}
              disabled={anyBusy}
              style={({ pressed }) => [styles.social, styles.socialOutline, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, (anyBusy || pressed) && { opacity: 0.85 }]}>
              {busy === 'google' ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color={theme.text} />
                  <ThemedText type="smallBold" style={{ fontSize: 16 }}>{t('auth.continueGoogle')}</ThemedText>
                </>
              )}
            </Pressable>
          )}

          {(appleAvailable || googleAvailable) && (
            <View style={styles.orRow}>
              <View style={[styles.line, { backgroundColor: theme.border }]} />
              <ThemedText type="small" themeColor="textSecondary">{t('auth.orEmail')}</ThemedText>
              <View style={[styles.line, { backgroundColor: theme.border }]} />
            </View>
          )}

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
                editable={!anyBusy}
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
              />
              <Pressable
                onPress={onSend}
                disabled={anyBusy || !email.includes('@')}
                style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary, opacity: anyBusy || !email.includes('@') ? 0.5 : pressed ? 0.85 : 1 }]}>
                {busy === 'email' ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>{t('auth.sendCode')}</ThemedText>
                )}
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
                editable={!anyBusy}
                style={[styles.input, styles.code, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border }]}
              />
              <Pressable
                onPress={onVerify}
                disabled={anyBusy || code.trim().length < 4}
                style={({ pressed }) => [styles.primary, { backgroundColor: theme.primary, opacity: anyBusy || code.trim().length < 4 ? 0.5 : pressed ? 0.85 : 1 }]}>
                {busy === 'email' ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 16 }}>{t('auth.verify')}</ThemedText>
                )}
              </Pressable>
              <View style={styles.codeFoot}>
                <Pressable onPress={() => setStage('email')} hitSlop={8} disabled={anyBusy}>
                  <ThemedText type="small" themeColor="textSecondary">{t('auth.changeEmail')}</ThemedText>
                </Pressable>
                <Pressable onPress={onSend} hitSlop={8} disabled={anyBusy}>
                  <ThemedText type="small" style={{ color: theme.primary }}>{t('auth.resendCode')}</ThemedText>
                </Pressable>
              </View>
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
  social: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, height: 50, borderRadius: 14 },
  socialOutline: { borderWidth: StyleSheet.hairlineWidth },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginVertical: Spacing.one },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  code: { fontSize: 22, letterSpacing: 6, textAlign: 'center', fontVariant: ['tabular-nums'] },
  primary: { alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 14 },
  secondary: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  codeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.one },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 14 },
});
