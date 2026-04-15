import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import { AppTheme } from '../theme';
import { TopHeader } from '../components/TopHeader';
import { ActionButton, AnimatedCard } from '../components/ui';
import { ExpenseEntry } from './ExpensesScreen';

const fallbackExpense: ExpenseEntry = {
  id: '',
  amount: '0.00',
  category: 'Unknown',
  date: '--',
  notes: '',
  status: 'pending',
};

type ExpenseDetailRoute = RouteProp<
  {
    ExpenseDetail: {
      expense?: ExpenseEntry;
    };
  },
  'ExpenseDetail'
>;

const formatTimestamp = (isoString?: string) => {
  if (!isoString) return '--';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const trackerEvents = (expense: ExpenseEntry) => {

  
};

const quickFacts = (expense: ExpenseEntry) => [
  { label: 'Category', value: expense.category_name || expense.category, icon: 'layers' },
  { label: 'Date', value: expense.date, icon: 'calendar' },
  { label: 'Time', value: expense.time || (expense.created_at ? new Date(expense.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'), icon: 'clock' },
  {
    label: 'Receipt',
    value: (expense.hasReceipt || expense.receipt) ? 'Attached' : 'Missing',
    icon: 'file-text',
  },
];

export const ExpenseDetailScreen = () => {
  const route = useRoute<ExpenseDetailRoute>();
  const expense = route.params?.expense ?? fallbackExpense;
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const summaryStats = useMemo(() => quickFacts(expense), [expense]);
  const events = useMemo(() => trackerEvents(expense), [expense]);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.background}
      />
      <TopHeader title="Expense Detail" rightType="none" forceShowBack />

      <ScrollView showsVerticalScrollIndicator={false}>
        <AnimatedCard style={styles.summaryCard} delay={30}>
          <View style={styles.summaryHeader}>
            <View>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                Total Amount
              </Text>
              <Text allowFontScaling={false} style={styles.summaryAmount}>
                ${expense.amount}
              </Text>
            </View>
            <View style={[styles.statusPill, expense.status === 'pending' && { backgroundColor: 'rgba(255,216,107,0.16)' }]}>
              <Feather name="clock" size={14} color={expense.status === 'pending' ? theme.colors.warning : theme.colors.primary} />
              <Text allowFontScaling={false} style={[styles.statusText, expense.status === 'pending' && { color: theme.colors.warning }]}>
                {expense.status === 'pending' ? 'Pending' : 'Completed'}
              </Text>
            </View>
          </View>
          <Text allowFontScaling={false} style={styles.summaryNotes}>
            {expense.notes}
          </Text>
        </AnimatedCard>

        <AnimatedCard style={styles.quickCard} delay={60}>
          <Text allowFontScaling={false} style={styles.cardTitle}>
            Breakdown
          </Text>
          {summaryStats.map(stat => (
            <View key={stat.label} style={styles.quickRow}>
              <View style={styles.quickIcon}>
                <Feather
                  name={stat.icon as any}
                  size={14}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text allowFontScaling={false} style={styles.quickLabel}>
                  {stat.label}
                </Text>
                <Text allowFontScaling={false} style={styles.quickValue}>
                  {stat.value}
                </Text>
              </View>
            </View>
          ))}
        </AnimatedCard>


        <AnimatedCard style={styles.attachmentCard} delay={110}>
          <Text allowFontScaling={false} style={styles.cardTitle}>
            Attachments
          </Text>
          {expense.hasReceipt || expense.receipt ? (
            <View style={styles.attachmentRow}>
              <View style={styles.attachmentIcon}>
                <Feather
                  name="paperclip"
                  size={14}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text allowFontScaling={false} style={styles.attachmentName}>
                  {expense.receipt ? expense.receipt.split('/').pop()?.slice(-20) : 'Receipt.jpg'}
                </Text>
                <Text allowFontScaling={false} style={styles.attachmentMeta}>
                  Uploaded with expense
                </Text>
              </View>
              <TouchableOpacity style={styles.attachmentButton}>
                <Feather name="download" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text allowFontScaling={false} style={styles.emptyText}>
              No attachments provided.
            </Text>
          )}
        </AnimatedCard>


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
    background: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.88,
    },
    summaryCard: {
      backgroundColor: glassCard,
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor,
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      // elevation: 5,
    },
    summaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 12,
      color: theme.colors.muted,
      marginBottom: 4,
    },
    summaryAmount: {
      fontSize: 32,
      fontWeight: '800',
      color: theme.colors.text,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,216,107,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,216,107,0.24)',
    },
    statusText: {
      color: theme.colors.warning,
      fontWeight: '700',
      fontSize: 12,
    },
    summaryNotes: {
      marginTop: 10,
      color: muted,
      lineHeight: 20,
      fontSize: 13,
    },
    quickCard: {
      backgroundColor: glassCard,
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
    },
    quickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
      paddingVertical: 10,
    },
    quickIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    quickLabel: {
      fontSize: 11,
      color: muted,
    },
    quickValue: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    timelineCard: {
      backgroundColor: glassCard,
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor,
    },
    timelineRow: {
      flexDirection: 'row',
      marginBottom: 18,
    },
    timelineColumn: {
      width: 26,
      alignItems: 'center',
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
      marginTop: 8,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: borderColor,
      marginTop: 4,
    },
    timelineBody: {
      flex: 1,
      backgroundColor: glassSurface,
      borderRadius: 12,
      padding: 12,
    },
    timelineHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    timelineTitle: {
      fontWeight: '700',
      color: theme.colors.text,
    },
    timelineTime: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    timelineDetail: {
      marginTop: 4,
      color: muted,
      fontSize: 12,
    },
    attachmentCard: {
      backgroundColor: glassCard,
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor,
    },
    attachmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
    },
    attachmentIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    attachmentName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    attachmentMeta: {
      fontSize: 11,
      color: muted,
    },
    attachmentButton: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: muted,
      fontSize: 13,
    },
    actionRow: {
      flexDirection: 'column',
      gap: 14,
      marginBottom: 32,
      marginTop: 4,
    },
    actionButton: {
      width: '100%',
    },
    editActionWrap: {
      width: '100%',
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,216,107,0.28)',
      shadowColor: theme.colors.warning,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      // elevation: 5,
    },
    editActionButton: {
      minHeight: 64,
      // paddingHorizontal: 14,
      // paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    editActionIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      margin: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,216,107,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,216,107,0.24)',
    },
    editActionContent: {
      flex: 1,
    },
    editActionTitle: {
      color: '#F8EEFF',
      fontSize: 14,
      fontWeight: '800',
    },
    editActionText: {
      marginTop: 2,
      color: muted,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
    },
    editActionArrow: {
      width: 34,
      height: 34,
      right: 16,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,216,107,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,216,107,0.2)',
    },
  });
};

export default ExpenseDetailScreen;
