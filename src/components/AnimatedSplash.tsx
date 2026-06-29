import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet } from 'react-native';

import { mark } from '@/lib/bootTiming';

const SPLASH_BG = '#E2231A'; // matches the native splash + app.json so the hand-off is seamless
const H = Dimensions.get('window').height;

/**
 * kicker-style launch: the branded screen (same logo/red as the native splash) stays on top until the app
 * is actually ready, then slides UP like a curtain to reveal the loaded app — so the user never taps into
 * a half-built UI. Rendered above everything; `reveal` triggers the slide, `onDone` unmounts it.
 */
export function AnimatedSplash({ reveal, onDone }: { reveal: boolean; onDone: () => void }) {
  const ty = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!reveal) return;
    mark('splash-fx'); // reveal effect ran (re-render after setReady processed)
    Animated.timing(ty, {
      toValue: -(H + 80),
      duration: 620,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      mark('splash-done');
      if (finished) onDone();
    });
  }, [reveal, ty, onDone]);

  return (
    <Animated.View
      pointerEvents={reveal ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.fill, { transform: [{ translateY: ty }] }]}>
      <Image source={require('../../assets/images/splash-icon.png')} style={styles.logo} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: SPLASH_BG, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  logo: { width: 170, height: 170 },
});
