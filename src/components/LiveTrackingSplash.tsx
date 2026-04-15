import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark } from './LogoMark';
import { useAppTheme } from '../context/ThemeContext';

const STATUS_STEPS = [
  'Linking satellites',
  'Syncing crew beacons',
  'Seeding live mesh',
  'Arming dispatch core',
];

const TIMELINE = [
  { label: 'Fleet Sync', value: '87%' },
  { label: 'Zone Locks', value: '12/12' },
  { label: 'Dispatch Slots', value: 'Open' },
];

const formatStep = (index: number) =>
  STATUS_STEPS[index % STATUS_STEPS.length] || STATUS_STEPS[0];

export const LiveTrackingSplash = () => {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const sunPulse = useRef(new Animated.Value(0)).current;
  const cloudDrift = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [stepIndex, setStepIndex] = useState(0);
  const [percentComplete, setPercentComplete] = useState(0);

  useEffect(() => {
    const sunLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sunPulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    const cloudLoop = Animated.loop(
      Animated.timing(cloudDrift, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 10000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setStepIndex(prev => (prev + 1) % STATUS_STEPS.length);
    }, 2600);

    sunLoop.start();
    cloudLoop.start();

    return () => {
      sunLoop.stop();
      cloudLoop.stop();
      clearInterval(interval);
    };
  }, [sunPulse, cloudDrift, progress]);

  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      setPercentComplete(Math.min(100, Math.round(value * 100)));
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const sunStyle = {
    opacity: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] }),
    transform: [
      {
        scale: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.15] }),
      },
    ],
  };

  const cloudTranslate = cloudDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 40],
  });

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const logoSize = Math.min(width * 0.42, 180);

  const gradientColors = theme.isDark
    ? ['#010312', '#050E29', theme.colors.background]
    : ['#FFFFFF', '#E3EEFF', theme.colors.background];

  const textColor = theme.isDark ? '#FFFFFF' : '#081127';
  const subTextColor = theme.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.65)';
  const panelBg = theme.isDark ? 'rgba(4,9,22,0.85)' : 'rgba(255,255,255,0.92)';
  const panelBorder = theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';
  const timelineBg = theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)';
  const timelineBorder = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const progressRailBg = theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)';
  const progressFillColor = theme.colors.primary;
  const topGlowColor = theme.isDark
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(135,172,255,0.35)';
  const bottomGlowColor = theme.isDark
    ? 'rgba(69,202,255,0.18)'
    : 'rgba(69,202,255,0.25)';
  const sunColor = theme.isDark ? 'rgba(255,183,77,0.55)' : 'rgba(255,204,133,0.7)';
  const cloudBright = theme.isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(255,255,255,0.5)';
  const cloudSoft = theme.isDark
    ? 'rgba(255,255,255,0.05)'
    : 'rgba(255,255,255,0.35)';
  const containerStyle = useMemo(
    () => ({ backgroundColor: theme.isDark ? '#030716' : '#EAF1FF' }),
    [theme.isDark],
  );

  return (
    <SafeAreaView style={[styles.safe, containerStyle]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 0.9 }}
        style={styles.background}
      />

      <View style={[styles.glowTop, { backgroundColor: topGlowColor }]} />
      <View style={[styles.glowBottom, { backgroundColor: bottomGlowColor }]} />

      <Animated.View style={[styles.sun, { backgroundColor: sunColor }, sunStyle]} />

      <Animated.View
        style={[
          styles.cloudBand,
          { backgroundColor: cloudBright, transform: [{ translateX: cloudTranslate }] },
        ]}
      />
      <Animated.View
        style={[
          styles.cloudBandSoft,
          {
            backgroundColor: cloudSoft,
            transform: [
              {
                translateX: cloudTranslate.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, -20],
                }),
              },
            ],
          },
        ]}
      />

      <View style={styles.heroBlock}>
        <View style={styles.logoBadgeShadow} />
        <LogoMark size={logoSize} subtitle="Command" />
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.brandTitle, { color: textColor }]}>MaxxStation</Text>
        <Text style={[styles.brandSubtitle, { color: subTextColor }]}>
          Live operations grid
        </Text>
      </View>

      <View
        style={[
          styles.statusTimeline,
          { backgroundColor: timelineBg, borderColor: timelineBorder },
        ]}
      >
        {TIMELINE.map(item => (
          <View key={item.label} style={styles.timelineRow}>
            <View
              style={[styles.timelineDot, { backgroundColor: theme.colors.primary }]}
            />
            <Text style={[styles.timelineLabel, { color: subTextColor }]}>
              {item.label}
            </Text>
            <Text style={[styles.timelineValue, { color: textColor }]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.progressWrap,
          { backgroundColor: panelBg, borderColor: panelBorder },
        ]}
      >
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: subTextColor }]}>
            Systems arming
          </Text>
          <Text style={[styles.progressTitle, { color: subTextColor }]}>
            {percentComplete}%
          </Text>
        </View>
        <View style={[styles.progressRail, { backgroundColor: progressRailBg }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth, backgroundColor: progressFillColor },
            ]}
          />
        </View>
        <Text style={[styles.progressHint, { color: subTextColor }]}>
          {formatStep(stepIndex)}
        </Text>
      </View>

      <Text style={[styles.footerText, { color: subTextColor }]}>
        Field intelligence platform · v1.0
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#030716',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -120,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(69,202,255,0.18)',
  },
  sun: {
    position: 'absolute',
    top: '8%',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,183,77,0.55)',
  },
  cloudBand: {
    position: 'absolute',
    top: '28%',
    width: '140%',
    height: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 60,
  },
  cloudBandSoft: {
    position: 'absolute',
    top: '35%',
    width: '160%',
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 70,
  },
  heroBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  logoBadgeShadow: {
    position: 'absolute',
    bottom: -20,
    width: 200,
    height: 30,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.35)',
    opacity: 0.45,
  },
  textBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 30,
    color: '#FFFFFF',
  },
  brandSubtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  statusTimeline: {
    width: '100%',
    marginBottom: 24,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#45CAFF',
    marginRight: 12,
  },
  timelineLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  timelineValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  progressWrap: {
    width: '100%',
    backgroundColor: 'rgba(4,9,22,0.85)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressRail: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#45CAFF',
  },
  progressHint: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
  footerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
