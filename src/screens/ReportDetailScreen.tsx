import React, {useEffect, useMemo, useState} from 'react';
import {
 ScrollView,
 StyleSheet,
 Text,
 View,
 ActivityIndicator,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import {TopHeader} from '../components/TopHeader';
import {useDialog} from '../context/DialogContext';
import {useAppTheme} from '../context/ThemeContext';
import {REPORTS_API_ENABLED} from '../constants/reportMocks';
import {AppTheme} from '../theme';
import {fetchReportDetail} from '../services/reportService';
import {useAppSelector} from '../store/hooks';
import {AnimatedCard} from '../components/ui';

export const ReportDetailScreen = () => {
 const route = useRoute<any>();
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const {showDialog} = useDialog();
 const authToken = useAppSelector(state => state.auth.token);

 const [reportData, setReportData] = useState<Record<string, unknown> | null>(
  null,
 );
 const [isLoading, setIsLoading] = useState(true);

 const reportFromList = route.params?.report;
 const reportId = reportFromList?.id;

 useEffect(() => {
  const loadReportDetail = async () => {
   if (!REPORTS_API_ENABLED || !reportId || !authToken) {
    setIsLoading(false);
    return;
   }

   try {
    setIsLoading(true);
    const result = await fetchReportDetail(reportId, authToken);

    if (result.success && result.data) {
     setReportData(result.data);
    } else {
     showDialog({
      title: 'Load Failed',
      message: result.message || 'Unable to fetch report details',
      variant: 'error',
      primaryAction: {label: 'Okay'},
     });
    }
   } catch (err) {
    console.log('Failed to fetch report detail', err);
    showDialog({
     title: 'Error',
     message:
      err instanceof Error ? err.message : 'Failed to load report details',
     variant: 'error',
     primaryAction: {label: 'Okay'},
    });
   } finally {
    setIsLoading(false);
   }
  };

  loadReportDetail();
 }, [reportId, authToken, showDialog]);

 const displayData = reportData || reportFromList;

 const getStatus = (data: Record<string, unknown>) => {
  const status =
   (typeof data.status === 'string' && data.status.toLowerCase()) || 'pending';
  const statusColors: {[key: string]: string} = {
   approved: '#10B981',
   rejected: '#EF4444',
   pending: '#F59E0B',
   submitted: '#3B82F6',
  };
  return {
   status: status.charAt(0).toUpperCase() + status.slice(1),
   color: statusColors[status] || '#6B7280',
  };
 };

 const renderDetailRow = (label: string, value: string | undefined) => {
  if (!value) return null;
  return (
   <View style={styles.detailRow}>
    <Text allowFontScaling={false} style={styles.detailLabel}>
     {label}
    </Text>
    <Text allowFontScaling={false} style={styles.detailValue} numberOfLines={3}>
     {value}
    </Text>
   </View>
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
   <TopHeader title="Report Details" />

   {isLoading ? (
    <View style={styles.loadingContainer}>
     <ActivityIndicator size="large" color={theme.colors.primary} />
     <Text allowFontScaling={false} style={styles.loadingText}>
      Loading report details...
     </Text>
    </View>
   ) : displayData ? (
    <ScrollView
     style={styles.container}
     contentContainerStyle={styles.scrollContent}
     showsVerticalScrollIndicator={false}>
     <AnimatedCard style={styles.headerCard} delay={0}>
      <View style={styles.headerTop}>
       <View style={styles.headerIconWrap}>
        <Feather name="file-text" size={24} color={theme.colors.primary} />
       </View>
       <View style={styles.headerInfo}>
        <Text
         allowFontScaling={false}
         style={styles.headerDate}
         numberOfLines={1}>
         {(typeof displayData.date === 'string' && displayData.date) ||
          (typeof displayData.report_date === 'string' &&
           displayData.report_date) ||
          'N/A'}
        </Text>
        {displayData.status && (
         <View
          style={[
           styles.statusBadge,
           {
            backgroundColor: `${getStatus(displayData).color}20`,
           },
          ]}>
          <View
           style={[
            styles.statusDot,
            {
             backgroundColor: getStatus(displayData).color,
            },
           ]}
          />
          <Text
           allowFontScaling={false}
           style={[
            styles.statusBadgeText,
            {color: getStatus(displayData).color},
           ]}>
           {getStatus(displayData).status}
          </Text>
         </View>
        )}
       </View>
      </View>
     </AnimatedCard>

     {/* Summary Section */}
     <AnimatedCard style={styles.summaryCard} delay={50}>
      <Text allowFontScaling={false} style={styles.sectionTitle}>
       Summary
      </Text>
      <View style={styles.summaryGrid}>
       {renderDetailRow(
        'Date',
        (typeof displayData.date === 'string' && displayData.date) ||
         (typeof displayData.report_date === 'string' &&
          displayData.report_date),
       )}
       {renderDetailRow(
        'Total Hours',
        (typeof displayData.total_hours === 'string' &&
         displayData.total_hours) ||
         (typeof displayData.tracked_hours === 'string' &&
          displayData.tracked_hours) ||
         (typeof displayData.hours === 'string' && displayData.hours),
       )}
       {renderDetailRow(
        'Billable Hours',
        typeof displayData.billable_hours === 'string'
         ? displayData.billable_hours
         : undefined,
       )}
       {renderDetailRow(
        'Status',
        typeof displayData.status === 'string' ? displayData.status : undefined,
       )}
      </View>
     </AnimatedCard>

     {/* Details Section */}
     <AnimatedCard style={styles.detailsCard} delay={100}>
      <Text allowFontScaling={false} style={styles.sectionTitle}>
       Details
      </Text>
      <View style={styles.detailsList}>
       {renderDetailRow(
        'Employee',
        (typeof displayData.employee_name === 'string' &&
         displayData.employee_name) ||
         (typeof displayData.user_name === 'string' && displayData.user_name),
       )}
       {renderDetailRow(
        'Project',
        typeof displayData.project_name === 'string'
         ? displayData.project_name
         : undefined,
       )}
       {renderDetailRow(
        'Department',
        typeof displayData.department === 'string'
         ? displayData.department
         : undefined,
       )}
       {renderDetailRow(
        'Submitted On',
        typeof displayData.submitted_at === 'string'
         ? displayData.submitted_at
         : undefined,
       )}
      </View>
     </AnimatedCard>

     {/* Notes Section */}
     {displayData.notes &&
      typeof displayData.notes === 'string' &&
      displayData.notes.trim() && (
       <AnimatedCard style={styles.notesCard} delay={150}>
        <Text allowFontScaling={false} style={styles.sectionTitle}>
         Notes
        </Text>
        <Text allowFontScaling={false} style={styles.notesText}>
         {displayData.notes}
        </Text>
       </AnimatedCard>
      )}

     {/* Additional Info */}
     {(displayData.remarks || displayData.comments || displayData.feedback) && (
      <AnimatedCard style={styles.remarksCard} delay={200}>
       <Text allowFontScaling={false} style={styles.sectionTitle}>
        Additional Information
       </Text>
       {renderDetailRow(
        'Remarks',
        typeof displayData.remarks === 'string'
         ? displayData.remarks
         : undefined,
       )}
       {renderDetailRow(
        'Comments',
        typeof displayData.comments === 'string'
         ? displayData.comments
         : undefined,
       )}
       {renderDetailRow(
        'Feedback',
        typeof displayData.feedback === 'string'
         ? displayData.feedback
         : undefined,
       )}
      </AnimatedCard>
     )}
    </ScrollView>
   ) : (
    <View style={styles.loadingContainer}>
     <Text allowFontScaling={false} style={styles.loadingText}>
      No report data available.
     </Text>
    </View>
   )}
  </SafeAreaView>
 );
};

const createStyles = (theme: AppTheme) => {
 const glassCard = theme.colors.card;
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
  container: {
   flex: 1,
   paddingHorizontal: 14,
   paddingVertical: 12,
  },
  scrollContent: {
   paddingBottom: 20,
  },
  loadingContainer: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
   gap: 12,
  },
  loadingText: {
   fontSize: 14,
   color: muted,
   fontWeight: '500',
  },
  headerCard: {
   borderWidth: 1,
   borderColor,
   borderRadius: 16,
   padding: 14,
   marginBottom: 12,
   backgroundColor: glassCard,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.2,
   shadowRadius: 12,
  },
  headerTop: {
   flexDirection: 'row',
   alignItems: 'flex-start',
   gap: 12,
  },
  headerIconWrap: {
   width: 50,
   height: 50,
   borderRadius: 14,
   backgroundColor: `${theme.colors.primary}15`,
   alignItems: 'center',
   justifyContent: 'center',
  },
  headerInfo: {
   flex: 1,
  },
  headerDate: {
   fontSize: 16,
   fontWeight: '700',
   color: theme.colors.text,
   marginBottom: 6,
  },
  statusBadge: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
   paddingHorizontal: 10,
   paddingVertical: 4,
   borderRadius: 8,
   alignSelf: 'flex-start',
  },
  statusDot: {
   width: 8,
   height: 8,
   borderRadius: 4,
  },
  statusBadgeText: {
   fontSize: 12,
   fontWeight: '600',
  },
  summaryCard: {
   borderWidth: 1,
   borderColor,
   borderRadius: 16,
   padding: 14,
   marginBottom: 12,
   backgroundColor: glassCard,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.2,
   shadowRadius: 12,
  },
  sectionTitle: {
   fontSize: 14,
   fontWeight: '700',
   color: theme.colors.text,
   marginBottom: 12,
  },
  summaryGrid: {
   gap: 10,
  },
  detailsCard: {
   borderWidth: 1,
   borderColor,
   borderRadius: 16,
   padding: 14,
   marginBottom: 12,
   backgroundColor: glassCard,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.2,
   shadowRadius: 12,
  },
  detailsList: {
   gap: 12,
  },
  detailRow: {
   paddingBottom: 10,
   borderBottomWidth: 1,
   borderBottomColor: borderColor,
  },
  detailLabel: {
   fontSize: 11,
   fontWeight: '600',
   color: muted,
   textTransform: 'uppercase',
   letterSpacing: 0.5,
   marginBottom: 4,
  },
  detailValue: {
   fontSize: 13,
   fontWeight: '500',
   color: theme.colors.text,
   lineHeight: 18,
  },
  notesCard: {
   borderWidth: 1,
   borderColor,
   borderRadius: 16,
   padding: 14,
   marginBottom: 12,
   backgroundColor: glassCard,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.2,
   shadowRadius: 12,
  },
  notesText: {
   fontSize: 13,
   color: theme.colors.text,
   lineHeight: 20,
  },
  remarksCard: {
   borderWidth: 1,
   borderColor,
   borderRadius: 16,
   padding: 14,
   marginBottom: 12,
   backgroundColor: glassCard,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.2,
   shadowRadius: 12,
  },
 });
};
