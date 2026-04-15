import React, {useMemo} from 'react';
import {
 ScrollView,
 StyleSheet,
 Text,
 View,
 TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation, useRoute} from '@react-navigation/native';
import {TopHeader} from '../components/TopHeader';
import {useAppTheme} from '../context/ThemeContext';
import {LogEntry} from '../context/LogsContext';
import {minutesToHours, parseTimeToMinutes} from '../utils/time';
import {AppTheme} from '../theme';

const getCategoryIcon = (key: string) =>
 ['Meeting', 'Field', 'Offline'].includes(key) ? key[0] : 'T';

const getCategoryColor = (key: string) => {
 switch (key) {
  case 'Meeting':
   return '#3B82F6'; // blue
  case 'Field':
   return '#10B981'; // green
  case 'Offline':
   return '#F59E0B'; // yellow
  default:
   return '#6B7280'; // gray
 }
};

const getStatusColor = (status: string) => {
 switch (status) {
  case 'approved':
   return '#10B981'; // green
  case 'rejected':
   return '#EF4444'; // red
  case 'review':
   return '#F59E0B'; // yellow
  default:
   return '#6B7280'; // gray
 }
};

const getDurationText = (start: string, end: string) => {
 const s = parseTimeToMinutes(start);
 const e = parseTimeToMinutes(end);
 if (s === null || e === null) return '0h';
 return minutesToHours(e - s);
};

const formatDisplayDate = (date: Date) =>
 date.toLocaleDateString([], {month: 'short', day: 'numeric', year: 'numeric'});

const parseDateKey = (value?: string) => {
 if (!value || typeof value !== 'string') return new Date();
 const [y, m, d] = value.split('-').map(Number);
 if (!y || !m || !d) return new Date();
 return new Date(y, m - 1, d);
};

export const LogDetailScreen = () => {
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const navigation = useNavigation<any>();
 const route = useRoute<any>();
 const log: LogEntry = route.params?.log;

 if (!log) {
  return (
   <SafeAreaView style={styles.safe}>
    <TopHeader title="Log Detail" />
    <View style={styles.center}>
     <Text style={styles.errorText}>Log not found</Text>
    </View>
   </SafeAreaView>
  );
 }

 const duration = getDurationText(log.startTime, log.endTime);
 const date = parseDateKey(log.date);

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title="Log Detail" />

   <ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerStyle={styles.scrollContent}>
    <View style={styles.heroSection}>
     <LinearGradient
      colors={[
       getCategoryColor(log.category),
       getCategoryColor(log.category) + '80',
      ]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.heroGradient}>
      <View style={styles.heroIcon}>
       <Text allowFontScaling={false} style={styles.heroIconText}>
        {getCategoryIcon(log.category)}
       </Text>
      </View>
      <View style={styles.heroContent}>
       <Text allowFontScaling={false} style={styles.heroTitle}>
        {log.category} Session
       </Text>
       <Text allowFontScaling={false} style={styles.heroSubtitle}>
        {formatDisplayDate(date)} • {duration}
       </Text>
       <View
        style={[
         styles.statusBadge,
         {backgroundColor: getStatusColor(log.status)},
        ]}>
        <Text allowFontScaling={false} style={styles.statusBadgeText}>
         {log.status.toUpperCase()}
        </Text>
       </View>
      </View>
     </LinearGradient>
    </View>

    <View style={styles.detailContainer}>
     <View style={styles.detailCard}>
      <View style={styles.cardHeader}>
       <Text allowFontScaling={false} style={styles.cardIcon}>
        ⏰
       </Text>
       <Text allowFontScaling={false} style={styles.cardTitle}>
        Time Details
       </Text>
      </View>
      <View style={styles.timeGrid}>
       <View style={styles.timeItem}>
        <Text allowFontScaling={false} style={styles.timeLabel}>
         Start Time
        </Text>
        <Text allowFontScaling={false} style={styles.timeValue}>
         {log.startTime}
        </Text>
       </View>
       <View style={styles.timeItem}>
        <Text allowFontScaling={false} style={styles.timeLabel}>
         End Time
        </Text>
        <Text allowFontScaling={false} style={styles.timeValue}>
         {log.endTime}
        </Text>
       </View>
       <View style={styles.timeItem}>
        <Text allowFontScaling={false} style={styles.timeLabel}>
         Duration
        </Text>
        <Text allowFontScaling={false} style={styles.timeValue}>
         {duration}
        </Text>
       </View>
      </View>
     </View>

     <View style={styles.detailCard}>
      <View style={styles.cardHeader}>
       <Text allowFontScaling={false} style={styles.cardIcon}>
        🏢
       </Text>
       <Text allowFontScaling={false} style={styles.cardTitle}>
        Project & Task
       </Text>
      </View>
      <Text allowFontScaling={false} style={styles.detailValue}>
       <Text allowFontScaling={false} style={styles.detailLabel}>
        Project:{' '}
       </Text>
       {log.projectName}
      </Text>
      {log.taskName && (
       <Text allowFontScaling={false} style={styles.detailValue}>
        <Text allowFontScaling={false} style={styles.detailLabel}>
         Task:{' '}
        </Text>
        {log.taskName}
       </Text>
      )}
     </View>

     <View style={styles.detailCard}>
      <View style={styles.cardHeader}>
       <Text allowFontScaling={false} style={styles.cardIcon}>
        📋
       </Text>
       <Text allowFontScaling={false} style={styles.cardTitle}>
        Details
       </Text>
      </View>
      <View style={styles.detailGrid}>
       <Text allowFontScaling={false} style={styles.detailValue}>
        <Text allowFontScaling={false} style={styles.detailLabel}>
         Category:{' '}
        </Text>
        {log.category}
       </Text>
       <Text allowFontScaling={false} style={styles.detailValue}>
        <Text allowFontScaling={false} style={styles.detailLabel}>
         Billable:{' '}
        </Text>
        {log.billable ? 'Yes' : 'No'}
       </Text>
      </View>
     </View>

     {log.notes && (
      <View style={styles.detailCard}>
       <View style={styles.cardHeader}>
        <Text allowFontScaling={false} style={styles.cardIcon}>
         📝
        </Text>
        <Text allowFontScaling={false} style={styles.cardTitle}>
         Notes
        </Text>
       </View>
       <Text allowFontScaling={false} style={styles.notesContent}>
        {log.notes}
       </Text>
      </View>
     )}
    </View>
   </ScrollView>
  </SafeAreaView>
 );
};

const createStyles = (theme: AppTheme) => {
 const borderColor = theme.colors.border;
 const inputBg = 'rgba(255,255,255,0.02)';

 return StyleSheet.create({
  safe: {
   flex: 1,
   backgroundColor: theme.colors.background,
  },
  backgroundGradient: {
   ...StyleSheet.absoluteFillObject,
   opacity: 0.9,
  },
  scrollContent: {
   paddingHorizontal: 16,
   paddingBottom: 28,
  },
  center: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
  },
  errorText: {
   color: theme.colors.muted,
   fontSize: 16,
   fontWeight: '600',
  },
  heroSection: {
   marginTop: 16,
   marginBottom: 24,
  },
  heroGradient: {
   borderRadius: 16,
   padding: 20,
   flexDirection: 'row',
   alignItems: 'center',
  },
  heroIcon: {
   width: 60,
   height: 60,
   borderRadius: 30,
   backgroundColor: 'rgba(255,255,255,0.2)',
   alignItems: 'center',
   justifyContent: 'center',
   marginRight: 16,
  },
  heroIconText: {
   color: '#fff',
   fontSize: 24,
   fontWeight: '800',
  },
  heroContent: {
   flex: 1,
  },
  heroTitle: {
   fontSize: 22,
   fontWeight: '800',
   color: '#fff',
   marginBottom: 4,
  },
  heroSubtitle: {
   fontSize: 14,
   color: 'rgba(255,255,255,0.9)',
   fontWeight: '600',
   marginBottom: 8,
  },
  statusBadge: {
   alignSelf: 'flex-start',
   paddingHorizontal: 10,
   paddingVertical: 4,
   borderRadius: 12,
  },
  statusBadgeText: {
   color: '#fff',
   fontSize: 10,
   fontWeight: '700',
  },
  detailContainer: {
   gap: 16,
  },
  detailCard: {
   borderWidth: 1,
   borderColor,
   backgroundColor: inputBg,
   borderRadius: 12,
   padding: 16,
   shadowColor: '#000',
   shadowOffset: {width: 0, height: 2},
   shadowOpacity: 0.1,
   shadowRadius: 4,
   //    elevation: 3,
  },
  cardHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: 12,
  },
  cardIcon: {
   fontSize: 18,
   marginRight: 8,
  },
  cardTitle: {
   fontSize: 16,
   fontWeight: '700',
   color: theme.colors.text,
  },
  timeGrid: {
   flexDirection: 'row',
   justifyContent: 'space-between',
  },
  timeItem: {
   alignItems: 'center',
   flex: 1,
  },
  timeLabel: {
   fontSize: 12,
   color: theme.colors.muted,
   fontWeight: '600',
   marginBottom: 4,
  },
  timeValue: {
   fontSize: 16,
   color: theme.colors.text,
   fontWeight: '700',
  },
  detailValue: {
   fontSize: 14,
   color: theme.colors.text,
   fontWeight: '600',
   marginBottom: 8,
  },
  detailLabel: {
   fontWeight: '700',
   color: theme.colors.muted,
  },
  detailGrid: {
   flexDirection: 'row',
   justifyContent: 'space-between',
  },
  notesContent: {
   fontSize: 14,
   color: theme.colors.text,
   lineHeight: 20,
  },
 });
};
