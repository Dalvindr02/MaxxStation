import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedCard } from '../components/ui';
import { TopHeader } from '../components/TopHeader';
import { useAppTheme } from '../context/ThemeContext';
import { AppTheme } from '../theme';
import { formatShortDate } from '../utils/date';
import LinearGradient from 'react-native-linear-gradient';
import { useAttendance } from '../context/AttendanceContext';

const statusColor = (status: string) => {
  if (status === 'Late') return '#F97316';
  if (status === 'Present') return '#16A34A';
  if (status === 'Absent') return '#DC2626';
  return '#6B7280';
};

const toLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day);
};

const getDateLabel = (value: string) => {
  const date = toLocalDate(value);
  if (Number.isNaN(date.getTime())) return value;

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const dateStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diff = Math.floor(
    (todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
};

const formatClockSummary = (entry: any) => {
  if (entry.clockIn && entry.clockOut) {
    return `${entry.clockIn} − ${entry.clockOut}`;
  }
  if (entry.clockIn) {
    return `Clock in ${entry.clockIn}`;
  }
  return 'Not tracked';
};

const formatLocationLabel = (entry: any) => {
  if (entry.locationStatus === 'at') return 'On-site';
  if (entry.locationStatus === 'outside') return 'Outside radius';
  return 'Location pending';
};

const formatReasonLabel = (entry: any) => {
  if (entry.reason) return entry.reason;
  if (entry.locationStatus) return 'Auto verified';
  return 'Awaiting check-in';
};

export default function AttendanceHistoryScreen() {
  const { entries } = useAttendance();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const totals = useMemo(
    () => ({
      present: entries.filter(entry => entry.status === 'Present').length,
      late: entries.filter(entry => entry.status === 'Late').length,
      absent: entries.filter(entry => entry.status === 'Absent').length,
    }),
    [entries],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator
      >
        <TopHeader title="Attendance History" rightType="none" />

        <AnimatedCard style={styles.summaryCard} delay={20}>
          <Text allowFontScaling={false} style={styles.summaryTitle}>
            Attendance overview
          </Text>
          <Text allowFontScaling={false} style={styles.summarySubtitle}>
            {' '}
            ,{entries.length} records captured
          </Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                Present
              </Text>
              <Text allowFontScaling={false} style={styles.summaryValue}>
                {totals.present}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                Late
              </Text>
              <Text allowFontScaling={false} style={styles.summaryValue}>
                {totals.late}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                Absent
              </Text>
              <Text allowFontScaling={false} style={styles.summaryValue}>
                {totals.absent}
              </Text>
            </View>
          </View>
        </AnimatedCard>

        <View style={styles.historyHeader}>
          <Text allowFontScaling={false} style={styles.historyTitle}>
            Full log
          </Text>
          <Text allowFontScaling={false} style={styles.historyHint}>
            Tap a row for context
          </Text>
        </View>

        {entries.map((entry, index) => (
          <AnimatedCard
            key={entry.date}
            style={styles.historyCardWrap}
            delay={30 + index * 20}
          >
            <Pressable
              style={({ pressed }) => [
                styles.historyCard,
                pressed && styles.historyCardPressed,
              ]}
            >
              <View style={styles.historyRow}>
                <View>
                  <Text allowFontScaling={false} style={styles.historyDate}>
                    {getDateLabel(entry.date)}
                  </Text>
                  <Text allowFontScaling={false} style={styles.historySub}>
                    {formatShortDate(entry.date)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusTag,
                    { backgroundColor: statusColor(entry.status) },
                  ]}
                >
                  <Text allowFontScaling={false} style={styles.statusText}>
                    {entry.status}
                  </Text>
                </View>
              </View>
              <View style={styles.detailLine}>
                <Feather name="clock" size={12} color={theme.colors.muted} />
                <Text allowFontScaling={false} style={styles.detailText}>
                  {formatClockSummary(entry)}
                </Text>
              </View>
              <View style={styles.detailLine}>
                <Feather name="map-pin" size={12} color={theme.colors.muted} />
                <Text allowFontScaling={false} style={styles.detailText}>
                  {formatLocationLabel(entry)}
                </Text>
              </View>
              <View style={styles.detailLine}>
                <Feather
                  name="file-text"
                  size={12}
                  color={theme.colors.muted}
                />
                <Text allowFontScaling={false} style={styles.detailText}>
                  {formatReasonLabel(entry)}
                </Text>
              </View>
            </Pressable>
          </AnimatedCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => {
  const glassCard = theme.colors.card;
  const glassSurface = theme.colors.surface;
  const borderColor = theme.colors.border;
  const muted = theme.colors.muted;

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.9,
    },
    container: {
      paddingHorizontal: 12,
      paddingBottom: 24,
    },
    summaryCard: {
      backgroundColor: glassCard,
      borderRadius: 18,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor,
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    summarySubtitle: {
      fontSize: 13,
      color: muted,
      marginTop: 4,
    },
    summaryGrid: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    summaryCell: {
      flex: 1,
      marginHorizontal: 4,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: glassSurface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor,
    },
    summaryLabel: {
      fontSize: 12,
      color: muted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    summaryValue: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: 4,
    },
    historyHeader: {
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    historyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    historyHint: {
      fontSize: 12,
      color: muted,
    },
    historyCardWrap: {
      marginBottom: 12,
    },
    historyCard: {
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor,
      backgroundColor: glassCard,
      shadowColor: theme.colors.glowStrong,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
    },
    historyCardPressed: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    historyDate: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    historySub: {
      fontSize: 12,
      color: muted,
      marginTop: 2,
    },
    statusTag: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minWidth: 90,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    detailLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    detailText: {
      color: muted,
      fontSize: 12,
    },
  });
};
