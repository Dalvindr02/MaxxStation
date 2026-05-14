import React, { useMemo, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { moderateScale } from 'react-native-size-matters';
import { AnimatedCard } from '../components/ui';
import { TopHeader } from '../components/TopHeader';
import { useAppTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import { AppTheme } from '../theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { SHIFT_WINDOW } from '../constants/shift';
import { fetchHomeData } from '../store/homeSlice';

type ActionTone = 'blue' | 'sunset' | 'orange' | 'green';

const quickActions: {
  label: string;
  icon: string;
  hint: string;
  route: string;
  tone: ActionTone;
}[] = [
    {
      label: 'Mark Presence',
      icon: 'navigation',
      hint: 'Attendance',
      route: 'Attendance',
      tone: 'blue',
    },
    {
      label: 'All Logs',
      icon: 'list',
      hint: 'View history',
      route: 'AllLogs',
      tone: 'orange',
    },
    {
      label: 'Add Manual Log',
      icon: 'edit-3',
      hint: 'Time entry',
      route: 'Logs',
      tone: 'sunset',
    },
    {
      label: 'Add Expense',
      icon: 'credit-card',
      hint: 'Receipts',
      route: 'Expenses',
      tone: 'blue',
    },
    {
      label: 'E.O.D Report',
      icon: 'send',
      hint: 'Day-end',
      route: 'Report',
      tone: 'green',
    },
  ];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { showDialog } = useDialog();
  const { theme } = useAppTheme();
  const auth = useAppSelector(state => state.auth);
  const homeData = useAppSelector(state => state.home.data);
  const { items: projects, selectedProjectId } = useAppSelector(
    state => state.projects,
  );

  useEffect(() => {
    if (auth.token) {
      dispatch(fetchHomeData(auth.token));
    }
  }, [auth.token, dispatch]);

  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme, width), [theme, width]);
  const heroGradientColors = useMemo(
    () => ['#3B0A63', '#2B1450', '#6A0DAD'],
    [],
  );

  const profile = useMemo(
    () => buildHomeProfile(auth.loginData, auth.user, auth.token, homeData),
    [auth.loginData, auth.token, auth.user, homeData],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
      />

      <TopHeader title="Home" hideBack />
      <ScrollView showsVerticalScrollIndicator={false}>
        <AnimatedCard style={styles.heroCard} delay={40}>
          <LinearGradient
            colors={heroGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}>
            <View style={[styles.heroGradientGlowA, styles.heroGlow]} />
            <View style={[styles.heroGradientGlowC, styles.heroGlow]} />
            <View style={styles.heroContent}>
              <View style={styles.heroRow}>
                <Text allowFontScaling={false} style={styles.heroEyebrow}>
                  {profile.greeting}
                </Text>
                <Text allowFontScaling={false} style={styles.heroTitle}>
                  {profile.firstName}
                </Text>
                <Text allowFontScaling={false} style={styles.heroSubTitle}>
                  {profile.homeDate}
                </Text>
              </View>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatCard}>
                  <Text allowFontScaling={false} style={styles.heroStatLabel}>
                    Tracked Today
                  </Text>
                  <Text allowFontScaling={false} style={styles.heroStatValue}>
                    {profile.trackedTimeLabel}
                  </Text>
                </View>

                <View style={styles.heroStatCard}>
                  <Text allowFontScaling={false} style={styles.heroStatLabel}>
                    Shift Start
                  </Text>
                  <Text allowFontScaling={false} style={styles.heroStatValue}>
                    {profile.shiftStartLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${profile.shiftProgress}%` }]}
                  />
                </View>
                <Text allowFontScaling={false} style={styles.progressLabel}>
                  {profile.shiftProgress}% shift complete
                </Text>
              </View>
            </View>
          </LinearGradient>
        </AnimatedCard>

        <AnimatedCard style={styles.alertCard} delay={70}>
          <View style={styles.alertIconWrap}>
            <Feather name="alert-triangle" size={14} color="#92400E" />
          </View>
          <View style={styles.alertContent}>
            <Text allowFontScaling={false} style={styles.alertTitle}>
              {profile.alertTitle}
            </Text>
            <Text allowFontScaling={false} style={styles.alertText}>
              {profile.alertText}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.alertAction}
            onPress={() => navigation.navigate('Report')}
            activeOpacity={0.85}>
            <Text allowFontScaling={false} style={styles.alertActionText}>
              Review
            </Text>
          </TouchableOpacity>
        </AnimatedCard>

        <AnimatedCard style={styles.shiftCard} delay={100}>
          <View style={styles.shiftHeader}>
            <Text allowFontScaling={false} style={styles.shiftTitle}>
              Today's Shift
            </Text>
            <View style={styles.presentBadge}>
              <Text allowFontScaling={false} style={styles.presentText}>
                {profile.attendanceStatus}
              </Text>
            </View>
          </View>
          <View style={styles.shiftMetaRow}>
            <View style={styles.shiftMetaChip}>
              <Feather name="sunrise" size={12} color="#F97316" />
              <Text allowFontScaling={false} style={styles.shiftMetaText}>
                Start {profile.shiftStartLabel}
              </Text>
            </View>
            <View style={styles.shiftMetaChip}>
              <Feather name="sunset" size={12} color="#9333EA" />
              <Text allowFontScaling={false} style={styles.shiftMetaText}>
                End {profile.shiftEndLabel}
              </Text>
            </View>
          </View>

          <View style={styles.shiftTimeRow}>
            <View style={styles.shiftTimeItem}>
              <Text allowFontScaling={false} style={styles.shiftLabel}>
                Start
              </Text>
              <Text allowFontScaling={false} style={styles.shiftValue}>
                {profile.shiftStartLabel}
              </Text>
            </View>

            <View style={styles.shiftDivider} />

            <View style={styles.shiftTimeItem}>
              <Text allowFontScaling={false} style={styles.shiftLabel}>
                End
              </Text>
              <Text allowFontScaling={false} style={styles.shiftValue}>
                {profile.shiftEndLabel}
              </Text>
            </View>
          </View>

          <View style={styles.trackedStrip}>
            <View style={styles.trackedIconBubble}>
              <Feather name="activity" size={16} color="#0F172A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={styles.trackedLabel}>
                Total hours
              </Text>
              <Text allowFontScaling={false} style={styles.trackedValue}>
                {profile.trackedTimeLabel}
              </Text>
            </View>
            <View style={styles.trackedBadge}>
              <Text allowFontScaling={false} style={styles.trackedBadgeText}>
                {profile.roleLabel}
              </Text>
            </View>
          </View>
        </AnimatedCard>

        <View style={styles.sectionRow}>
          <Text allowFontScaling={false} style={styles.sectionTitle}>
            Quick Actions
          </Text>
        </View>

        <View style={styles.activityHub}>
          <View style={styles.hubGrid}>
            {quickActions.map(item => (
              <TouchableOpacity
                key={item.label}
                style={styles.hubGridItem}
                onPress={() => {
                  if (item.label === 'Add Manual Log') {
                    showDialog({
                      title: 'Create Log',
                      message: 'What type of log would you like to create?',
                      variant: 'info',
                      primaryAction: {
                        label: 'Manual Log',
                        onPress: () => navigation.navigate('Logs'),
                      },
                      secondaryAction: {
                        label: 'Travel Log',
                        onPress: () =>
                          navigation.navigate('AttendanceTravel', {
                            mode: 'manual',
                            fromCoords: null,
                            toCoords: null,
                          }),
                      },
                    });
                  } else if (item.label === 'E.O.D Report') {
                    showDialog({
                      title: 'Reports',
                      message: "View today's report or all previous reports?",
                      variant: 'info',
                      primaryAction: {
                        label: "Today's Report",
                        onPress: () => navigation.navigate('Report'),
                      },
                      secondaryAction: {
                        label: 'All Reports',
                        onPress: () => navigation.navigate('ReportList'),
                      },
                    });
                  } else {
                    navigation.navigate(item.route);
                  }
                }}
                activeOpacity={0.7}>
                <LinearGradient
                  colors={
                    item.tone === 'blue'
                      ? ['#3B82F615', '#3B82F605']
                      : item.tone === 'sunset'
                        ? ['#F43F5E15', '#F43F5E05']
                        : item.tone === 'orange'
                          ? ['#F9731615', '#F9731605']
                          : ['#10B98115', '#10B98105']
                  }
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[
                    styles.hubIconWrap,
                    {
                      backgroundColor:
                        item.tone === 'blue'
                          ? '#3B82F615'
                          : item.tone === 'sunset'
                            ? '#F43F5E15'
                            : item.tone === 'orange'
                              ? '#F9731615'
                              : '#10B98115',
                    },
                  ]}>
                  <Feather
                    name={item.icon}
                    size={16}
                    color={
                      item.tone === 'blue'
                        ? '#3B82F6'
                        : item.tone === 'sunset'
                          ? '#F43F5E'
                          : item.tone === 'orange'
                            ? '#F97316'
                            : '#10B981'
                    }
                  />
                </View>
                <Text allowFontScaling={false} style={styles.hubItemLabel}>
                  {item.label}
                </Text>
                <Text allowFontScaling={false} style={styles.hubItemHint}>
                  {item.hint}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const findNestedValue = (payload: unknown, keys: string[]): unknown => {
  if (!isRecord(payload)) {
    return undefined;
  }

  for (const key of keys) {
    if (key in payload) {
      return payload[key];
    }
  }

  for (const value of Object.values(payload)) {
    if (isRecord(value)) {
      const nested = findNestedValue(value, keys);
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  return undefined;
};

const getStringValue = (payload: unknown, keys: string[]): string | null => {
  const value = findNestedValue(payload, keys);

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const getNumberValue = (payload: unknown, keys: string[]): number | null => {
  const value = findNestedValue(payload, keys);

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeTime = (value: string | null, fallback: string) => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (/am|pm/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      const suffix = hour >= 12 ? 'PM' : 'AM';
      const normalizedHour = hour % 12 || 12;
      return `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(
        2,
        '0',
      )} ${suffix}`;
    }
  }

  return trimmed;
};

const buildHomeProfile = (
  loginData: Record<string, unknown> | null,
  user: Record<string, unknown> | null,
  token: string | null,
  apiHomeData: any | null = null,
) => {
  const source = user ?? loginData ?? {};
  // Prioritize apiHomeData if available
  const homeData = apiHomeData || findNestedValue(source, ['home']);
  const fullName =
    getStringValue(source, [
      'userName',
      'user_name',
      'name',
      'full_name',
      'fullName',
      'employee_name',
    ]) ?? 'User';
  const firstName = fullName.split(' ').filter(Boolean)[0] || 'User';
  const role =
    getStringValue(source, ['role', 'b', 'user_type', 'department']) ??
    'On Track';
  const employeeId =
    getStringValue(source, [
      'emp_id',
      'employee_id',
      'employeeId',
      'staff_id',
      'staffId',
      'id',
    ]) ?? 'N/A';
  const greeting = getStringValue(homeData, ['greeting']) ?? 'Good Morning';
  const homeDate = getStringValue(homeData, ['date']);
  const startTime = normalizeTime(
    getStringValue(homeData, ['start_time', 'start']) ??
    getStringValue(source, ['shift_start', 'shiftStart', 'start_time', 'start']),
    `${SHIFT_WINDOW.start} AM`,
  );
  const endTime = normalizeTime(
    getStringValue(homeData, ['end_time', 'end']) ??
    getStringValue(source, ['shift_end', 'shiftEnd', 'end_time', 'end']),
    '05:00 PM',
  );
  const shiftProgress = Math.max(
    0,
    Math.min(100, getNumberValue(homeData, ['shift_progress', 'progress']) ?? 0),
  );
  const trackedTimeLabel =
    getStringValue(homeData, ['tracked_time']) ?? '00h 00m';
  const attendanceStatus = toTitleCase(
    getStringValue(homeData, ['track_status']) ??
    getStringValue(source, [
      'attendance_status',
      'attendanceStatus',
      'status',
    ]) ??
    'Present',
  );
  const hasPendingReport = Boolean(
    findNestedValue(homeData, ['pending_eod_report', 'pending']),
  );
  const eodMessage =
    getStringValue(homeData, ['eod_message', 'pending_message']) ??
    "Yesterday's report has not been submitted";

  console.log('Home screen auth payload:', {
    token,
    user,
    loginData,
    derivedHomeProfile: {
      fullName,
      role,
      employeeId,
      greeting,
      homeDate,
      startTime,
      endTime,
      shiftProgress,
      attendanceStatus,
      trackedTimeLabel,
    },
  });

  return {
    alertText: hasPendingReport
      ? eodMessage
      : 'Pending E.O.D Report',
    alertTitle: hasPendingReport
      ? 'Pending E.O.D Report'
      : 'Daily sync is healthy',
    attendanceStatus,
    firstName,
    greeting,
    homeDate,
    roleLabel: role,
    shiftEndLabel: endTime,
    shiftProgress,
    shiftStartLabel: startTime,
    trackedTimeLabel,
    totalMinutesToday: 0,
  };
};

const createStyles = (theme: AppTheme, screenWidth: number) => {
  const borderColor = theme.colors.border;
  const glassCard = theme.colors.card;
  const glassSurface = theme.colors.surface;
  const textMuted = theme.colors.muted;
  const chipBorder = theme.colors.border;
  const gridGap = moderateScale(12);

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: moderateScale(14),
    },
    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.85,
    },
    backgroundGlowA: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: 'rgba(255, 27, 107, 0.14)',
      top: -60,
      right: -140,
      transform: [{ rotate: '18deg' }],
    },
    backgroundGlowB: {
      position: 'absolute',
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: 'rgba(106, 13, 173, 0.24)',
      bottom: -160,
      left: -120,
    },
    heroCard: {
      borderRadius: moderateScale(24),
      marginBottom: moderateScale(16),
      borderWidth: 1,
      borderColor,
      width: '100%',
      alignSelf: 'stretch',
      overflow: 'hidden',
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.32,
      shadowRadius: 18,
      elevation: 1,
      backgroundColor: 'transparent',
    },
    heroGradient: {
      // padding: moderateScale(24),
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
    },
    heroContent: {
      position: 'relative',
      zIndex: 1,
      margin: moderateScale(16),
    },
    heroChipRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    heroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    heroChipText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    heroLivePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroLiveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#10B981',
    },
    heroLiveText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    heroGlow: {
      position: 'absolute',
      zIndex: 0,
    },
    heroGradientGlowA: {
      top: -90,
      right: -60,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: 'rgba(255, 27, 107, 0.18)',
    },
    heroGradientGlowB: {
      bottom: -100,
      left: -80,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: 'rgba(69, 202, 255, 0.16)',
    },
    heroGradientGlowC: {
      top: 30,
      left: -30,
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    heroRow: {
      alignItems: 'flex-start',
      marginBottom: moderateScale(16),
    },
    heroEyebrow: {
      color: textMuted,
      fontSize: moderateScale(12),
      fontWeight: '700',
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    heroTitle: {
      color: '#FFFFFF',
      fontSize: moderateScale(30),
      fontWeight: '800',
      lineHeight: moderateScale(34),
    },
    heroSubTitle: {
      color: textMuted,
      fontSize: moderateScale(13),
      marginTop: 2,
      fontWeight: '600',
    },
    heroStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: moderateScale(10),
    },
    heroStatCard: {
      flex: 1,
      borderRadius: moderateScale(16),
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(12),
      backgroundColor: glassSurface,
      borderWidth: 1,
      borderColor: borderColor,
    },
    heroStatLabel: {
      color: textMuted,
      fontSize: moderateScale(11),
      fontWeight: '600',
      marginBottom: 4,
    },
    heroStatValue: {
      color: theme.isDark ? '#FFFFFF' : '#7C2D12',
      fontSize: moderateScale(18),
      fontWeight: '800',
    },
    progressRow: {
      marginTop: moderateScale(16),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    },
    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.12)',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    progressLabel: {
      color: '#FFFFFF',
      fontSize: moderateScale(12),
      fontWeight: '700',
    },
    heroRibbon: {
      marginTop: 16,
      backgroundColor: glassSurface,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: borderColor,
      gap: 12,
    },
    heroRibbonItem: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
    },
    heroRibbonIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.12)'
        : 'rgba(250,204,21,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroRibbonTitle: {
      color: theme.isDark ? '#F8FAFC' : '#7C2D12',
      fontSize: 12,
      fontWeight: '700',
    },
    heroRibbonSubtitle: {
      color: theme.isDark ? 'rgba(248,250,252,0.75)' : '#9A4A0A',
      fontSize: 11,
      fontWeight: '600',
    },
    heroRibbonDivider: {
      width: 1,
      height: 34,
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.12)'
        : 'rgba(122,69,8,0.2)',
    },
    alertCard: {
      backgroundColor: '#FFF4DB',
      borderRadius: moderateScale(18),
      borderWidth: 1,
      borderColor: '#FFE3B8',
      padding: moderateScale(14),
      marginBottom: moderateScale(18),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
    },
    alertIconWrap: {
      width: moderateScale(40),
      height: moderateScale(40),
      borderRadius: moderateScale(14),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFE4B5',
    },
    alertContent: {
      flex: 1,
    },
    alertTitle: {
      fontSize: moderateScale(14),
      fontWeight: '700',
      color: '#78350F',
    },
    alertText: {
      marginTop: 2,
      color: '#92400E',
      fontSize: moderateScale(12),
    },
    alertAction: {
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(8),
      borderRadius: moderateScale(12),
      backgroundColor: theme?.colors?.primary,
    },
    alertActionText: {
      color: '#FFFFFF',
      fontSize: moderateScale(12),
      fontWeight: '700',
    },
    shiftCard: {
      backgroundColor: glassCard,
      borderRadius: moderateScale(18),
      borderWidth: 1,
      borderColor,
      padding: moderateScale(16),
      marginBottom: moderateScale(16),
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: theme.isDark ? 0.35 : 0.12,
      shadowRadius: 12,
      // elevation: 4,
    },
    shiftHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: moderateScale(12),
    },
    shiftTitle: {
      fontSize: moderateScale(18),
      color: theme.isDark ? '#FFFFFF' : theme.colors.text,
      fontWeight: '800',
    },
    presentBadge: {
      backgroundColor: theme.isDark
        ? 'rgba(34,197,94,0.2)'
        : 'rgba(34,197,94,0.2)',
      borderRadius: moderateScale(12),
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(4),
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.5)',
    },
    presentText: {
      color: 'green',
      fontWeight: '700',
      fontSize: moderateScale(11),
    },
    shiftTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    shiftMetaRow: {
      flexDirection: 'row',
      gap: moderateScale(8),
      marginBottom: moderateScale(12),
    },
    shiftMetaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(6),
      borderRadius: moderateScale(12),
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.12)'
        : 'rgba(254,243,199,0.7)',
    },
    shiftMetaText: {
      color: theme.isDark ? '#FFFFFF' : '#7C2D12',
      fontSize: moderateScale(12),
      fontWeight: '600',
    },
    shiftTimeItem: {
      flex: 1,
    },
    shiftLabel: {
      fontSize: moderateScale(12),
      color: textMuted,
      marginBottom: 3,
    },
    shiftValue: {
      fontSize: moderateScale(20),
      color: theme.isDark ? '#FFFFFF' : theme.colors.text,
      fontWeight: '700',
    },
    shiftDivider: {
      width: 1,
      height: moderateScale(34),
      backgroundColor: 'rgba(255,255,255,0.18)',
      marginHorizontal: 10,
    },
    trackedStrip: {
      borderRadius: moderateScale(18),
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#FFF7ED',
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(12),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.2)' : '#FED7AA',
    },
    trackedIconBubble: {
      width: moderateScale(40),
      height: moderateScale(40),
      borderRadius: moderateScale(14),
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.18)' : '#FED7AA',
      alignItems: 'center',
      justifyContent: 'center',
    },
    trackedLabel: {
      fontSize: moderateScale(11),
      color: theme.isDark ? 'rgba(255,255,255,0.7)' : '#9A4A0A',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: '600',
    },
    trackedValue: {
      fontSize: moderateScale(18),
      fontWeight: '800',
      color: theme.isDark ? '#FFFFFF' : '#7C2D12',
      marginTop: 2,
    },
    trackedBadge: {
      borderRadius: 999,
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(6),
      backgroundColor: theme.isDark ? 'rgba(34,197,94,0.2)' : '#D9F99D',
    },
    trackedBadgeText: {
      fontSize: moderateScale(11),
      fontWeight: '700',
      color: theme.isDark ? '#BBF7D0' : '#3F6212',
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: moderateScale(10),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: 0.3,
    },
    activityHub: {
      backgroundColor: glassCard,
      borderRadius: moderateScale(24),
      borderWidth: 1,
      borderColor,
      padding: moderateScale(16),
      marginBottom: moderateScale(12),
      shadowColor: theme.colors.glowStrong,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
    },
    hubGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: moderateScale(8),
    },
    hubGridItem: {
      width: '48%',
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: moderateScale(14),
      padding: moderateScale(8),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
      overflow: 'hidden',
      minHeight: moderateScale(75),
      marginBottom: moderateScale(4),
    },
    hubIconWrap: {
      width: moderateScale(34),
      height: moderateScale(34),
      borderRadius: moderateScale(10),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: moderateScale(6),
    },
    hubItemLabel: {
      color: theme.colors.text,
      fontSize: moderateScale(11),
      fontWeight: '700',
      textAlign: 'center',
    },
    hubItemHint: {
      color: textMuted,
      fontSize: moderateScale(9),
      fontWeight: '600',
      marginTop: 1,
      textAlign: 'center',
    },
  });
};
// EOD report
