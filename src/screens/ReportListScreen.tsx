import React, {useCallback, useMemo, useState} from 'react';
import {
 FlatList,
 RefreshControl,
 StyleSheet,
 Text,
 TouchableOpacity,
 View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';

import {TopHeader} from '../components/TopHeader';
import {ActionButton, AnimatedCard} from '../components/ui';
import {useAppTheme} from '../context/ThemeContext';
import {ReportEntry, STATIC_REPORTS} from '../constants/reportMocks';
import {AppTheme} from '../theme';

const STAT_GRADIENTS = [
 ['#FDBA74', '#FDE1A2'],
 ['#C4F1D6', '#E0FFE5'],
 ['#D9E8FF', '#F1F5FF'],
 ['#FEC6D0', '#FDE0E7'],
];

export const ReportListScreen = () => {
 const navigation = useNavigation<any>();
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const [reports, setReports] = useState<ReportEntry[]>(STATIC_REPORTS);
 const [isRefreshing, setIsRefreshing] = useState(false);

 useFocusEffect(
  useCallback(() => {
   setReports(STATIC_REPORTS);
  }, []),
 );

 const onRefresh = useCallback(() => {
  setIsRefreshing(true);
  setReports(STATIC_REPORTS);
  setTimeout(() => setIsRefreshing(false), 350);
 }, []);

 const getStatusMeta = useCallback(
  (status: ReportEntry['status']) => {
   const statusMap = {
    approved: {
     label: 'Approved',
     color: theme.colors.success,
     background: theme.colors.greenSoft,
     icon: 'check-circle',
    },
    submitted: {
     label: 'Submitted',
     color: theme.colors.secondary,
     background: theme.colors.blueSoft,
     icon: 'send',
    },
    pending: {
     label: 'Pending',
     color: theme.colors.warning,
     background: theme.colors.orangeSoft,
     icon: 'clock',
    },
    rejected: {
     label: 'Rejected',
     color: theme.colors.danger,
     background: theme.colors.sunsetSoft,
     icon: 'alert-circle',
    },
   } as const;

   return statusMap[status];
  },
  [theme],
 );

 const stats = useMemo(() => {
  const approved = reports.filter(
   report => report.status === 'approved',
  ).length;
  const pending = reports.filter(
   report => report.status === 'pending' || report.status === 'submitted',
  ).length;
  const totalHours = reports.reduce((sum, report) => {
   const match = report.total_hours.match(/(\d+)/);
   return sum + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  return [
   {
    key: 'reports',
    label: 'Reports',
    value: String(reports.length).padStart(2, '0'),
    icon: 'file-text',
   },
   {
    key: 'approved',
    label: 'Approved',
    value: String(approved).padStart(2, '0'),
    icon: 'check',
   },
   {
    key: 'pending',
    label: 'In Queue',
    value: String(pending).padStart(2, '0'),
    icon: 'clock',
   },
   {
    key: 'hours',
    label: 'Hours',
    value: `${totalHours}h`,
    icon: 'activity',
   },
  ];
 }, [reports]);

 const openReportDetail = useCallback(
  (report: ReportEntry) => {
   navigation.navigate('ReportDetail', {report});
  },
  [navigation],
 );

 const renderHeader = () => (
  <View style={styles.headerContent}>
   <AnimatedCard style={styles.heroCard} delay={30}>
    <LinearGradient
     colors={theme.gradients.card}
     start={{x: 0, y: 0}}
     end={{x: 1, y: 1}}
     style={styles.heroGradient}>
     <View style={styles.heroTopRow}>
      <View style={styles.heroBadge}>
       <Feather name="radio" size={13} color={theme.colors.warning} />
       <Text allowFontScaling={false} style={styles.heroBadgeText}>
        Static preview mode
       </Text>
      </View>
      <TouchableOpacity
       activeOpacity={0.85}
       style={styles.heroActionChip}
       onPress={() => navigation.navigate('Report')}>
       <Text allowFontScaling={false} style={styles.heroActionText}>
        Today's report
       </Text>
       <Feather name="arrow-up-right" size={14} color={theme.colors.text} />
      </TouchableOpacity>
     </View>

     <Text allowFontScaling={false} style={styles.heroTitle}>
      Report history built for the current flow
     </Text>
     <Text allowFontScaling={false} style={styles.heroSubtitle}>
      View recent submissions, spot pending reviews, and open details without
      waiting for the reports API.
     </Text>

     <View style={styles.statsRow}>
      {stats.map((item, index) => (
       <View key={item.key} style={styles.statCard}>
        <LinearGradient
         colors={STAT_GRADIENTS[index % STAT_GRADIENTS.length]}
         start={{x: 0, y: 0}}
         end={{x: 1, y: 1}}
         style={styles.statGradient}>
         <View style={styles.statTopRow}>
          <View style={styles.statIconWrap}>
           <Feather name={item.icon as any} size={15} color="#0F172A" />
          </View>
          <Text allowFontScaling={false} style={styles.statLabel}>
           {item.label}
          </Text>
         </View>
         <Text allowFontScaling={false} style={styles.statValue}>
          {item.value}
         </Text>
         <Text allowFontScaling={false} style={styles.statHint}>
          Live preview data
         </Text>
        </LinearGradient>
       </View>
      ))}
     </View>
    </LinearGradient>
   </AnimatedCard>

   <View style={styles.sectionRow}>
    <Text allowFontScaling={false} style={styles.sectionTitle}>
     Recent Reports
    </Text>
    <Text allowFontScaling={false} style={styles.sectionMeta}>
     Last {reports.length} entries
    </Text>
   </View>
  </View>
 );

 const renderReportCard = ({
  item,
  index,
 }: {
  item: ReportEntry;
  index: number;
 }) => {
  const statusMeta = getStatusMeta(item.status);
  const reportGradient =
   item.status === 'approved'
    ? ['rgba(196,241,214,0.28)', 'rgba(224,255,229,0.08)']
    : item.status === 'submitted'
    ? ['rgba(217,232,255,0.28)', 'rgba(241,245,255,0.08)']
    : item.status === 'pending'
    ? ['rgba(253,186,116,0.26)', 'rgba(253,225,162,0.08)']
    : ['rgba(254,198,208,0.26)', 'rgba(253,224,231,0.08)'];

  return (
   <AnimatedCard style={styles.reportCard} delay={100 + index * 40}>
    <LinearGradient
     colors={reportGradient}
     start={{x: 0, y: 0}}
     end={{x: 1, y: 1}}
     style={styles.reportGradient}>
     <TouchableOpacity
      activeOpacity={0.9}
      style={styles.reportTouchable}
      onPress={() => openReportDetail(item)}>
      <View style={styles.reportTopRow}>
       <View style={styles.reportTitleBlock}>
        <Text allowFontScaling={false} style={styles.reportDate}>
         {item.report_date}
        </Text>
        <Text allowFontScaling={false} style={styles.reportProject}>
         {item.project}
        </Text>
       </View>

       <View
        style={[
         styles.statusPill,
         {
          backgroundColor: statusMeta.background,
          borderColor: `${statusMeta.color}55`,
         },
        ]}>
        <Feather
         name={statusMeta.icon as any}
         size={12}
         color={statusMeta.color}
        />
        <Text
         allowFontScaling={false}
         style={[styles.statusPillText, {color: statusMeta.color}]}>
         {statusMeta.label}
        </Text>
       </View>
      </View>

      <Text
       allowFontScaling={false}
       style={styles.reportNotes}
       numberOfLines={2}>
       {item.notes}
      </Text>

      <View style={styles.reportMetaRow}>
       <View style={styles.metaChip}>
        <Feather name="clock" size={12} color={theme.colors.secondary} />
        <Text allowFontScaling={false} style={styles.metaChipText}>
         {item.total_hours}
        </Text>
       </View>
       <View style={styles.metaChip}>
        <Feather name="layers" size={12} color={theme.colors.primary} />
        <Text allowFontScaling={false} style={styles.metaChipText}>
         {item.shift_label}
        </Text>
       </View>
       <View style={styles.metaChip}>
        <Feather name="bookmark" size={12} color={theme.colors.warning} />
        <Text allowFontScaling={false} style={styles.metaChipText}>
         {item.focus}
        </Text>
       </View>
      </View>

      <View style={styles.reportFooter}>
       <Text allowFontScaling={false} style={styles.reportSubmittedAt}>
        {item.submitted_at}
       </Text>
       <View style={styles.openDetailRow}>
        <Text allowFontScaling={false} style={styles.openDetailText}>
         Open details
        </Text>
        <Feather name="chevron-right" size={16} color={theme.colors.text} />
       </View>
      </View>
     </TouchableOpacity>
    </LinearGradient>
   </AnimatedCard>
  );
 };

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title="Reports" />

   <FlatList
    data={reports}
    keyExtractor={item => String(item.id)}
    renderItem={renderReportCard}
    showsVerticalScrollIndicator={false}
    contentContainerStyle={styles.listContent}
    ListHeaderComponent={renderHeader}
    ListFooterComponent={
     <View style={styles.footer}>
      <ActionButton
       label="Create Daily Report"
       subtitle="Go back to the report form"
       icon="edit-3"
       onPress={() => navigation.navigate('Report')}
      />
     </View>
    }
    refreshControl={
     <RefreshControl
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.backgroundSecondary}
     />
    }
   />
  </SafeAreaView>
 );
};

const createStyles = (theme: AppTheme) => {
 const borderColor = theme.colors.border;
 const glassCard = theme.colors.card;

 return StyleSheet.create({
  safe: {
   flex: 1,
   backgroundColor: theme.colors.background,
   padding: 10,
  },
  backgroundGradient: {
   ...StyleSheet.absoluteFillObject,
   opacity: 0.94,
  },
  listContent: {
   paddingHorizontal: 14,
   paddingBottom: 28,
  },
  headerContent: {
   paddingTop: 12,
   paddingBottom: 8,
  },
  heroCard: {
   marginBottom: 14,
   borderRadius: 22,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor,
   shadowColor: theme.colors.glowStrong,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.24,
   shadowRadius: 16,
  },
  heroGradient: {
   padding: 16,
  },
  heroTopRow: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   marginBottom: 16,
  },
  heroBadge: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
   paddingHorizontal: 10,
   paddingVertical: 6,
   borderRadius: 999,
   backgroundColor: 'rgba(255,255,255,0.08)',
   borderWidth: 1,
   borderColor: borderColor,
  },
  heroBadgeText: {
   color: theme.colors.text,
   fontSize: 11,
   fontWeight: '700',
   textTransform: 'uppercase',
   letterSpacing: 0.6,
  },
  heroActionChip: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
  },
  heroActionText: {
   color: theme.colors.text,
   fontSize: 12,
   fontWeight: '700',
  },
  heroTitle: {
   color: theme.colors.text,
   fontSize: 24,
   fontWeight: '800',
   lineHeight: 30,
   marginBottom: 8,
  },
  heroSubtitle: {
   color: theme.colors.muted,
   fontSize: 13,
   lineHeight: 19,
   marginBottom: 18,
  },
  statsRow: {
   flexDirection: 'row',
   flexWrap: 'wrap',
   gap: 10,
   justifyContent: 'space-between',
  },
  statCard: {
   width: '48%',
   borderRadius: 16,
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.08)',
   overflow: 'hidden',
   shadowColor: theme.colors.glowStrong,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.2,
   shadowRadius: 10,
  },
  statGradient: {
   padding: 12,
  },
  statTopRow: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
   marginBottom: 12,
  },
  statIconWrap: {
   width: 28,
   height: 28,
   borderRadius: 10,
   backgroundColor: 'rgba(255,255,255,0.12)',
   alignItems: 'center',
   justifyContent: 'center',
  },
  statValue: {
   color: '#0F172A',
   fontSize: 24,
   fontWeight: '800',
  },
  statLabel: {
   color: '#334155',
   fontSize: 12,
   fontWeight: '700',
   textTransform: 'uppercase',
   letterSpacing: 0.5,
  },
  statHint: {
   marginTop: 4,
   color: '#475569',
   fontSize: 11,
   fontWeight: '600',
  },
  flowCard: {
   backgroundColor: glassCard,
   borderWidth: 1,
   borderColor,
   borderRadius: 20,
   padding: 16,
   marginBottom: 16,
  },
  sectionRow: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   marginBottom: 10,
  },
  sectionTitle: {
   color: theme.colors.text,
   fontSize: 16,
   fontWeight: '800',
  },
  sectionMeta: {
   color: theme.colors.muted,
   fontSize: 11,
   fontWeight: '600',
   textTransform: 'uppercase',
   letterSpacing: 0.5,
  },
  flowRow: {
   flexDirection: 'row',
   alignItems: 'stretch',
   gap: 12,
   paddingVertical: 4,
  },
  flowRail: {
   alignItems: 'center',
  },
  flowDot: {
   width: 28,
   height: 28,
   borderRadius: 14,
   backgroundColor: theme.colors.primary,
   alignItems: 'center',
   justifyContent: 'center',
   shadowColor: theme.colors.primary,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.32,
   shadowRadius: 10,
  },
  flowIndex: {
   color: '#FFFFFF',
   fontSize: 12,
   fontWeight: '800',
  },
  flowLine: {
   width: 1,
   flex: 1,
   backgroundColor: borderColor,
   marginVertical: 6,
  },
  flowContent: {
   flex: 1,
   paddingBottom: 14,
  },
  flowTitle: {
   color: theme.colors.text,
   fontSize: 14,
   fontWeight: '700',
   marginBottom: 2,
  },
  flowSubtitle: {
   color: theme.colors.muted,
   fontSize: 12,
   lineHeight: 18,
  },
  reportCard: {
   marginBottom: 12,
   borderWidth: 1,
   borderColor,
   borderRadius: 20,
   overflow: 'hidden',
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.18,
   shadowRadius: 12,
  },
  reportGradient: {
   borderRadius: 20,
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.08)',
   backgroundColor: glassCard,
  },
  reportTouchable: {
   padding: 16,
  },
  reportTopRow: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'flex-start',
   gap: 12,
   marginBottom: 12,
  },
  reportTitleBlock: {
   flex: 1,
  },
  reportDate: {
   color: theme.colors.text,
   fontSize: 16,
   fontWeight: '800',
   marginBottom: 4,
  },
  reportProject: {
   color: theme.colors.muted,
   fontSize: 13,
   fontWeight: '600',
  },
  statusPill: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
   borderRadius: 999,
   paddingHorizontal: 10,
   paddingVertical: 6,
   borderWidth: 1,
  },
  statusPillText: {
   fontSize: 11,
   fontWeight: '700',
   textTransform: 'uppercase',
   letterSpacing: 0.5,
  },
  reportNotes: {
   color: theme.colors.text,
   fontSize: 13,
   lineHeight: 20,
   marginBottom: 14,
  },
  reportMetaRow: {
   flexDirection: 'row',
   flexWrap: 'wrap',
   gap: 8,
   marginBottom: 14,
  },
  metaChip: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
   paddingHorizontal: 10,
   paddingVertical: 7,
   borderRadius: 999,
   backgroundColor: 'rgba(13,19,38,0.38)',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.1)',
  },
  metaChipText: {
   color: theme.colors.text,
   fontSize: 11,
   fontWeight: '600',
  },
  reportFooter: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   borderTopWidth: 1,
   borderTopColor: borderColor,
   paddingTop: 12,
  },
  reportSubmittedAt: {
   color: theme.colors.muted,
   fontSize: 11,
   fontWeight: '600',
  },
  openDetailRow: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 2,
  },
  openDetailText: {
   color: theme.colors.text,
   fontSize: 12,
   fontWeight: '700',
  },
  footer: {
   marginTop: 8,
  },
 });
};
