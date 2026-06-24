import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

// Custom fonts don't synthesize weights in RN, so each weight is its own family. Map the
// effective fontWeight onto the matching Archivo face → the whole app renders in Archivo.
function archivoFamily(weight: TextStyle['fontWeight']): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight) || 400;
  if (w >= 900) return 'Archivo_900Black';
  if (w >= 800) return 'Archivo_800ExtraBold';
  if (w >= 700) return 'Archivo_700Bold';
  if (w >= 600) return 'Archivo_600SemiBold';
  if (w >= 500) return 'Archivo_500Medium';
  return 'Archivo_400Regular';
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  const typeStyle =
    type === 'default'
      ? styles.default
      : type === 'title'
        ? styles.title
        : type === 'small'
          ? styles.small
          : type === 'smallBold'
            ? styles.smallBold
            : type === 'subtitle'
              ? styles.subtitle
              : type === 'link'
                ? styles.link
                : type === 'linkPrimary'
                  ? styles.linkPrimary
                  : type === 'code'
                    ? styles.code
                    : undefined;

  // Code stays monospace; everything else maps its weight onto the right Archivo face.
  const flat = StyleSheet.flatten([typeStyle, style]) as TextStyle | undefined;
  const fontStyle: TextStyle =
    type === 'code' ? {} : { fontFamily: archivoFamily(flat?.fontWeight), fontWeight: 'normal' };

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, typeStyle, style, fontStyle]} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
