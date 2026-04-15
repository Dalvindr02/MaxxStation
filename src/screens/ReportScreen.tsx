import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, AnimatedCard } from '../components/ui';
import { TopHeader } from '../components/TopHeader';
import { useAppTheme } from '../context/ThemeContext';
import { AppTheme } from '../theme';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { moderateScale } from 'react-native-size-matters';

export const ReportScreen = () => {
  const report = { notes: '', billable: true }; // TODO: replace with AppContext.report.
  const navigation = useNavigation<any>();
  const reportSummary = useMemo(
    () => ({
      totalTrackedHours: '0h 00m',
      manualHours: '0h 00m',
      billableHours: '0h 00m',
      expensesCount: 0,
    }),
    [],
  ); // TODO: bring in AppContext.reportSummary.
  const submitReport = (_payload?: any) => {
    // TODO: call AppContext.submitReport once it's reintroduced.
  };
  const [notes, setNotes] = useState(report.notes);
  const [billable, setBillable] = useState(report.billable);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const summaryTiles = useMemo(
    () => [
      {
        key: 'tracked',
        label: 'Tracked',
        value: reportSummary.totalTrackedHours,
        hint: 'GPS active duration',
        icon: 'activity',
        gradient: ['#FDBA74', '#FDE1A2'],
      },
      {
        key: 'manual',
        label: 'Manual',
        value: reportSummary.manualHours,
        hint: 'Added via logs',
        icon: 'edit-3',
        gradient: ['#FEC6D0', '#FDE0E7'],
        onPress: () => navigation.navigate('Main', { screen: 'Logs' }), // TODO: replace with Logs screen once it's reintroduced.
      },
      {
        key: 'billable',
        label: 'Billable',
        value: reportSummary.billableHours,
        hint: 'Client hours',
        icon: 'briefcase',
        gradient: ['#C4F1D6', '#E0FFE5'],
      },
      {
        key: 'expenses',
        label: 'Expenses',
        value: String(reportSummary.expensesCount).padStart(2, '0'),
        hint: 'Verified receipts',
        icon: 'dollar-sign',
        gradient: ['#D9E8FF', '#F1F5FF'],
        onPress: () => navigation.navigate('Main', { screen: 'Expenses' }),
      },
    ],
    [reportSummary],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
      />
      <TopHeader title="Report" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <AnimatedCard style={styles.shiftCard} delay={40}>
          <View style={styles.dot} />
          <View style={styles.shiftContent}>
            <Text allowFontScaling={false} style={styles.shiftTitle}>
              Shift Ended • 06:00 PM
            </Text>
            <Text allowFontScaling={false} style={styles.shiftText}>
              Review the auto-summary below and submit your report.
            </Text>
          </View>
        </AnimatedCard>

        <View style={styles.summaryTitleRow}>
          <Text allowFontScaling={false} style={styles.sectionTitle}>
            Daily Summary
          </Text>
          {/* <Text allowFontScaling={false} style={styles.needsReview}>
            Needs Review
          </Text> */}
        </View>

        <View style={styles.grid}>
          {summaryTiles.map((tile, index) => (
            <AnimatedCard
              key={tile.key}
              style={styles.metricCard}
              delay={70 + index * 15}
            >
              <TouchableOpacity key={tile.key} onPress={tile.onPress}>
                <LinearGradient
                  colors={tile.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.metricGradient}
                >
                  <View style={styles.metricHeaderRow}>
                    <View style={styles.metricIconBubble}>
                      <Feather
                        name={tile.icon as any}
                        size={14}
                        color="#0F172A"
                      />
                    </View>
                    <Text allowFontScaling={false} style={styles.metricLabel}>
                      {tile.label}
                    </Text>
                  </View>
                  <Text allowFontScaling={false} style={styles.metricValue}>
                    {tile.value}
                  </Text>
                  <Text allowFontScaling={false} style={styles.metricHint}>
                    {tile.hint}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </AnimatedCard>
          ))}
        </View>

        <AnimatedCard style={styles.toggleCard} delay={150}>
          <Text allowFontScaling={false} style={styles.sectionTitle}>
            Billing & Adjustments
          </Text>
          <Text allowFontScaling={false} style={styles.subTitle}>
            Adjust core reporting parameters
          </Text>
          <View style={styles.switchRow}>
            <View>
              <Text allowFontScaling={false} style={styles.toggleTitle}>
                Mark as Billable
              </Text>
              <Text allowFontScaling={false} style={styles.toggleHint}>
                Apply standard client rates to this shift
              </Text>
            </View>
            <Switch
              value={billable}
              onValueChange={setBillable}
              trackColor={{ false: '#D2D8E2', true: theme.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </AnimatedCard>

        <AnimatedCard style={styles.notesCard} delay={170}>
          <View style={styles.notesHeader}>
            <Text allowFontScaling={false} style={styles.sectionTitle}>
              Daily Activity Notes
            </Text>
            <Text allowFontScaling={false} style={styles.counter}>
              {notes.length}/500
            </Text>
          </View>
          <TextInput
            allowFontScaling={false}
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
            placeholder="Describe your key accomplishments..."
            placeholderTextColor={theme.colors.muted}
          />
        </AnimatedCard>

        <View style={styles.infoRow}>
          <Feather name="file-text" size={13} color={theme.colors.muted} />
          <Text allowFontScaling={false} style={styles.infoText}>
            Reports not submitted within 2 hours of shift end may be
            auto-generated.
          </Text>
        </View>

        <ActionButton
          style={styles.submitButton}
          onPress={() => submitReport({ notes, billable })}
          icon="send"
          label="Submit Daily Report"
          subtitle="Finalize and send today's review"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => {
  const glassCard = theme.colors.card;
  const glassSurface = theme.colors.surface;
  const borderColor = theme.colors.border;
  const muted = theme.colors.muted;

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 14,
    },
    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.9,
    },

    shiftCard: {
      borderWidth: 1,
      borderColor,
      borderRadius: 16,
      padding: 14,
      flexDirection: 'row',
      marginBottom: 14,
      backgroundColor: glassCard,
      alignItems: 'center',
      gap: 12,
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
    },

    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
    },
    shiftContent: {
      flex: 1,
    },
    shiftTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 2,
    },
    shiftText: {
      color: muted,
      fontSize: 12,
      lineHeight: 17,
    },
    summaryTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    needsReview: {
      fontSize: 11,
      color: muted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 12,
      justifyContent: 'space-between',
    },
    metricCard: {
      width: '48%',
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor,
      shadowColor: theme.colors.glowStrong,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
    },
    metricGradient: {
      borderRadius: 18,
      padding: 10,
      height: Platform?.OS == 'ios' ? moderateScale(105) : undefined,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      backgroundColor: 'rgba(18,7,43,0.85)',
    },
    metricHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    metricIconBubble: {
      width: 30,
      height: 30,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricValue: {
      fontSize: 20,
      fontWeight: '800',
      color: '#0F172A',
    },
    metricLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#1E293B',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metricHint: {
      marginTop: 1,
      color: '#334155',
      fontSize: 10,
    },
    toggleCard: {
      borderWidth: 1,
      borderColor,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      backgroundColor: glassCard,
      shadowColor: theme.colors.glowStrong,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    },
    subTitle: {
      fontSize: 12,
      color: muted,
      marginTop: 2,
      marginBottom: 8,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toggleTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    toggleHint: {
      fontSize: 11,
      color: muted,
      marginTop: 2,
    },
    notesCard: {
      borderWidth: 1,
      borderColor,
      borderRadius: 18,
      padding: 14,
      marginBottom: 14,
      backgroundColor: glassCard,
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    },
    notesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    counter: {
      color: muted,
      fontSize: 11,
      fontWeight: '600',
    },
    notesInput: {
      borderWidth: 1,
      borderColor,
      borderRadius: 12,
      minHeight: 90,
      padding: 12,
      fontSize: 13,
      color: theme.colors.text,
      textAlignVertical: 'top',
      backgroundColor: glassSurface,
    },
    infoRow: {
      marginTop: 2,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    infoText: {
      flex: 1,
      color: muted,
      fontSize: 11,
      lineHeight: 15,
    },
    submitButton: {
      marginTop: 14,
    },
  });
};
