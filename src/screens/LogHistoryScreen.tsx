import React, {useCallback, useMemo, useState} from 'react';
import {
 Pressable,
 View,
 Text,
 ScrollView,
 StyleSheet,
 TouchableOpacity,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import moment from 'moment';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import CustomCalendarStrip from '../components/CustomCalendarStrip';
import {AnimatedCard} from '../components/ui';
import {TopHeader} from '../components/TopHeader';
import {LogEntry, LogStatus, useLogs} from '../context/LogsContext';
import {
 useFocusEffect,
 useNavigation,
 useRoute,
} from '@react-navigation/native';
import {useAppTheme} from '../context/ThemeContext';
import {AppTheme} from '../theme';
import {useDialog} from '../context/DialogContext';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {fetchLogs} from '../store/logSlice';
import {deleteManualLogRequest} from '../services/manualLogService';

const getDuration = (start: string, end: string) => {
 const [sh, sm] = start.split(':').map(Number);
 const [eh, em] = end.split(':').map(Number);

 const minutes = eh * 60 + em - (sh * 60 + sm);
 const h = Math.floor(minutes / 60);
 const m = minutes % 60;

 return `${h}h ${m}m`;
};

const parseBillableStatus = (value: unknown): boolean => {
 if (typeof value === 'boolean') {
  return value;
 }
 if (typeof value === 'number') {
  return value === 1;
 }
 if (typeof value === 'string') {
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'billable', 'is_billable'].includes(normalized)) {
   return true;
  }
  if (
   [
    '0',
    'false',
    'no',
    'non-billable',
    'non_billable',
    'non billable',
   ].includes(normalized)
  ) {
   return false;
  }
 }
 return false;
};

const sanitizeLogEntry = (log: Partial<LogEntry>, index: number): LogEntry => ({
 id:
  typeof log.id === 'string' && log.id.trim() ? log.id : `manual-log-${index}`,
 date:
  typeof log.date === 'string' && log.date.trim()
   ? log.date
   : new Date().toISOString().slice(0, 10),
 projectId:
  typeof log.projectId === 'string' && log.projectId.trim()
   ? log.projectId
   : '0',
 projectName:
  typeof log.projectName === 'string' && log.projectName.trim()
   ? log.projectName
   : 'Project',
 taskId:
  typeof log.taskId === 'string' && log.taskId.trim() ? log.taskId : null,
 taskName:
  typeof log.taskName === 'string' && log.taskName.trim() ? log.taskName : null,
 startTime:
  typeof log.startTime === 'string' && log.startTime.trim()
   ? log.startTime
   : '00:00',
 endTime:
  typeof log.endTime === 'string' && log.endTime.trim() ? log.endTime : '00:00',
 category:
  typeof log.category === 'string' && log.category.trim()
   ? log.category
   : 'Meeting',
 notes: typeof log.notes === 'string' ? log.notes : '',
 billable: parseBillableStatus(log.billable),
 status:
  log.status === 'approved' ||
  log.status === 'rejected' ||
  log.status === 'review'
   ? log.status
   : 'review',
 fromLocation: log.fromLocation,
 toLocation: log.toLocation,
 fromCoords: log.fromCoords ?? null,
 toCoords: log.toCoords ?? null,
 routePoints: Array.isArray(log.routePoints) ? log.routePoints : [],
 stops: Array.isArray(log.stops) ? log.stops : [],
 routeDistanceMeters: log.routeDistanceMeters ?? null,
 routeDurationSeconds: log.routeDurationSeconds ?? null,
 routeSummary: log.routeSummary,
 auditStatus: log.auditStatus,
 auditFlags: log.auditFlags,
});

export default function LogsHistoryScreen() {
 const dispatch = useAppDispatch();
 const navigation = useNavigation<any>();
 const route = useRoute<any>();
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const {startEditing} = useLogs();
 const {showDialog} = useDialog();
 const apiLogs = useAppSelector(state =>
  Array.isArray(state.logs.logs) ? state.logs.logs : [],
 );
 const authToken = useAppSelector(state => state.auth.token);
 const [selectedDate, setSelectedDate] = useState(moment());
 const [showPicker, setShowPicker] = useState(false);
 const [monthLabel, setMonthLabel] = useState(selectedDate.format('MMM, YYYY'));
 /* FILTER LOGS */

 const logsByDate = useMemo(() => {
  return apiLogs
   .filter((log): log is LogEntry => Boolean(log))
   .map((log, index) => sanitizeLogEntry(log, index))
   .filter(log => moment(log.date, 'YYYY-MM-DD', true).isValid())
   .filter(log => moment(log.date).isSame(selectedDate, 'day'));
 }, [apiLogs, selectedDate]);

 /* TOTAL HOURS */

 const totalHours = useMemo(() => {
  let minutes = 0;

  logsByDate.forEach(log => {
   const [sh, sm] = log.startTime.split(':').map(Number);
   const [eh, em] = log.endTime.split(':').map(Number);
   minutes += eh * 60 + em - (sh * 60 + sm);
  });

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${h}h ${m}m`;
 }, [logsByDate]);

 const getStatusColor = (status: LogStatus) => {
  switch (status) {
   case 'approved':
    return '#16A34A';
   case 'rejected':
    return '#DC2626';
   case 'review':
    return '#F59E0B';
  }
 };

 /* DATE PICKER */

 const handleConfirmDate = (date: Date) => {
  const m = moment(date);
  setSelectedDate(m);
  setMonthLabel(m.format('MMM, YYYY'));
  setShowPicker(false);
 };

 const handleEdit = (log: LogEntry) => {
  startEditing(log);
  navigation.navigate('LogsHome');
 };

 const handleDelete = (log: LogEntry) => {
  showDialog({
   title: 'Delete log',
   message: 'Are you sure you want to delete this log?',
   variant: 'error',
   dismissOnBackdrop: false,
   secondaryAction: {label: 'Cancel'},
   primaryAction: {
    label: 'Delete',
    onPress: async () => {
     try {
      await deleteManualLogRequest(log.id, authToken);
      await dispatch(fetchLogs()).unwrap();
     } catch (deleteError) {
      const message =
       deleteError instanceof Error
        ? deleteError.message
        : 'Unable to delete manual log. Please try again.';

      showDialog({
       title: 'Delete failed',
       message,
       variant: 'error',
       primaryAction: {label: 'OK'},
      });
     }
    },
   },
  });
 };

 const routeDate: string | undefined = route?.params?.date;

 useFocusEffect(
  useCallback(() => {
   dispatch(fetchLogs());

   if (routeDate) {
    const parsed = moment(routeDate, 'YYYY-MM-DD', true);
    if (parsed.isValid()) {
     setSelectedDate(parsed);
     setMonthLabel(parsed.format('MMM, YYYY'));
    }
    navigation.setParams({date: undefined});
   }
  }, [dispatch, navigation, routeDate]),
 );

 return (
  <SafeAreaView style={styles.container}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title="Log History" />
   {/* HEADER */}

   <TouchableOpacity
    style={styles.headerRow}
    onPress={() => setShowPicker(true)}
    activeOpacity={0.8}>
    <Feather name="calendar" size={18} color={theme.colors.primary} />
    <Text allowFontScaling={false} style={styles.monthText}>
     {monthLabel}
    </Text>
   </TouchableOpacity>

   <View style={styles.calendarWrap}>
    <CustomCalendarStrip
     selectedDate={selectedDate}
     onDateChange={(date: any) => {
      setSelectedDate(date);
      setMonthLabel(date.format('MMM, YYYY'));
     }}
     onMonthChange={setMonthLabel}
    />
   </View>

   {/* DATE PICKER MODAL */}

   <DateTimePickerModal
    isVisible={showPicker}
    mode="date"
    date={selectedDate.toDate()}
    onConfirm={handleConfirmDate}
    onCancel={() => setShowPicker(false)}
    isDarkModeEnabled
    buttonTextColorIOS={theme.colors.primary}
    modalStyleIOS={styles.pickerModalIOS}
    pickerStyleIOS={styles.pickerSurfaceIOS}
   />

   {/* SUMMARY */}

   <AnimatedCard style={styles.summaryCard} delay={40}>
    <Text allowFontScaling={false} style={styles.summaryTitle}>
     Daily Summary
    </Text>

    <View style={styles.summaryRow}>
     <Feather name="clock" size={16} color={theme.colors.primary} />
     <Text allowFontScaling={false} style={styles.summaryText}>
      Total Logged Time: {totalHours}
     </Text>
    </View>

    <Text allowFontScaling={false} style={styles.summaryCount}>
     Logs: {logsByDate.length}
    </Text>
   </AnimatedCard>

   {/* TIMELINE */}
   <View style={styles.timelineSpacer} />
   <ScrollView showsVerticalScrollIndicator={false}>
    {logsByDate.map((log, index) => (
     <View key={log.id} style={styles.timelineRow}>
      <View style={styles.timelineColumn}>
       <View style={styles.timelineDot} />

       {index !== logsByDate.length - 1 && <View style={styles.timelineLine} />}
      </View>
      <AnimatedCard style={styles.logCardWrap} delay={70 + index * 15}>
       <Pressable
        style={({pressed}) => [
         styles.logCard,
         pressed && styles.logCardPressed,
        ]}
        onPress={() => navigation.navigate('LogDetailScreen', {log})}>
        <View style={styles.logHeader}>
         <View style={styles.logLeft}>
          <Text allowFontScaling={false} style={styles.timeText}>
           {log.startTime} → {log.endTime}
          </Text>
          <Text allowFontScaling={false} style={styles.duration}>
           {getDuration(log.startTime, log.endTime)}
          </Text>
         </View>

         <View style={styles.logRight}>
          <View
           style={[
            styles.statusBadge,
            {
             backgroundColor: getStatusColor(log.status ?? 'review') + '20',
            },
           ]}>
           <Text
            allowFontScaling={false}
            style={[
             styles.statusText,
             {color: getStatusColor(log.status ?? 'review')},
            ]}>
            {(log.status ?? 'review').toUpperCase()}
           </Text>
          </View>
          <TouchableOpacity
           style={styles.detailArrow}
           onPress={() => navigation.navigate('LogDetailScreen', {log})}
           activeOpacity={0.7}>
           <Feather name="chevron-right" size={20} color={theme.colors.muted} />
          </TouchableOpacity>
         </View>
        </View>

        <View style={styles.logContent}>
         {/* <Text allowFontScaling={false} style={styles.projectText}>
          {log.projectName}
         </Text> */}
         {/* {log.taskName && (
          <Text allowFontScaling={false} style={styles.taskText}>
           Task: {log.taskName}
          </Text>
         )} */}
         <Text allowFontScaling={false} style={styles.category}>
          {log.category}
         </Text>
        </View>

        {log.notes ? (
         <Text allowFontScaling={false} style={styles.notes}>
          {log.notes}
         </Text>
        ) : null}

        {log.billable && (
         <View style={styles.billable}>
          <Feather name="dollar-sign" size={12} color={theme.colors.success} />
          <Text allowFontScaling={false} style={styles.billableText}>
           Billable
          </Text>
         </View>
        )}

        <View style={styles.actionRow}>
         <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(log)}
          activeOpacity={0.85}>
          <Feather name="edit-3" size={14} color={theme.colors.primary} />
          <Text allowFontScaling={false} style={styles.actionText}>
           Edit
          </Text>
         </TouchableOpacity>
         <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(log)}
          activeOpacity={0.85}>
          <Feather name="trash-2" size={14} color={theme.colors.danger} />
          <Text
           allowFontScaling={false}
           style={[styles.actionText, {color: theme.colors.danger}]}>
           Delete
          </Text>
         </TouchableOpacity>
        </View>
       </Pressable>
      </AnimatedCard>
     </View>
    ))}

    {logsByDate.length === 0 && (
     <Text allowFontScaling={false} style={styles.empty}>
      No logs for this date
     </Text>
    )}
   </ScrollView>
  </SafeAreaView>
 );
}

/* STYLES */

const createStyles = (theme: AppTheme) => {
 const glassCard = theme.colors.card;
 const glassSurface = theme.colors.surface;
 const borderColor = theme.colors.border;
 const muted = theme.colors.muted;

 return StyleSheet.create({
  container: {
   flex: 1,
   backgroundColor: theme.colors.background,
   padding: 14,
  },
  backgroundGradient: {
   ...StyleSheet.absoluteFillObject,
   opacity: 0.9,
  },
  headerRow: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 10,
   marginTop: 8,
  },
  monthText: {
   fontSize: 15,
   fontWeight: '700',
   color: theme.colors.text,
  },
  calendarWrap: {
   marginTop: 16,
  },
  summaryCard: {
   backgroundColor: glassCard,
   padding: 16,
   borderRadius: 18,
   marginTop: 20,
   borderWidth: 1,
   borderColor,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.3,
   shadowRadius: 16,
   // elevation: 4,
  },
  pickerModalIOS: {
   backgroundColor: '#1B1030',
  },
  pickerSurfaceIOS: {
   backgroundColor: '#24153E',
   borderTopLeftRadius: 16,
   borderTopRightRadius: 16,
  },
  summaryTitle: {
   fontWeight: '700',
   marginBottom: 6,
   color: theme.colors.text,
   fontSize: 16,
  },
  summaryRow: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
  },
  summaryText: {
   color: theme.colors.text,
   fontWeight: '600',
  },
  summaryCount: {
   marginTop: 10,
   fontSize: 12,
   color: muted,
  },
  timelineSpacer: {
   height: 20,
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
  logCardWrap: {
   flex: 1,
  },
  logCard: {
   flex: 1,
   backgroundColor: glassSurface,
   borderRadius: 18,
   padding: 16,
   borderWidth: 1,
   borderColor,
   shadowColor: theme.colors.glowStrong,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.1,
   shadowRadius: 1,
   // elevation: 0.1,
  },
  logCardPressed: {
   backgroundColor: 'transparent',
   borderColor: 'transparent',
  },
  logHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: 6,
  },
  logLeft: {
   flex: 1,
  },
  logRight: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
  },
  detailArrow: {
   padding: 4,
  },
  logContent: {
   marginBottom: 8,
  },
  projectText: {
   fontSize: 16,
   fontWeight: '700',
   color: theme.colors.text,
   marginBottom: 4,
  },
  taskText: {
   fontSize: 14,
   color: theme.colors.muted,
   fontWeight: '500',
   marginBottom: 2,
  },
  timeText: {
   fontWeight: '700',
   color: theme.colors.text,
  },
  duration: {
   fontSize: 12,
   color: theme.colors.primary,
   fontWeight: '600',
   marginTop: 2,
  },
  category: {
   fontWeight: '500',
   color: theme.colors.muted,
   fontSize: 13,
  },
  notes: {
   marginTop: 6,
   color: muted,
   fontSize: 12,
   lineHeight: 18,
  },
  billable: {
   flexDirection: 'row',
   alignItems: 'center',
   marginTop: 8,
   gap: 6,
  },
  billableText: {
   color: theme.colors.success,
   fontWeight: '600',
   fontSize: 12,
  },
  actionRow: {
   flexDirection: 'row',
   justifyContent: 'flex-end',
   gap: 12,
   marginTop: 16,
  },
  actionButton: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
   borderRadius: 999,
   paddingHorizontal: 14,
   paddingVertical: 8,
  },
  editButton: {
   backgroundColor: 'rgba(152,28,255,0.18)',
  },
  deleteButton: {
   backgroundColor: 'rgba(220,38,38,0.12)',
  },
  actionText: {
   fontSize: 12,
   fontWeight: '600',
   color: theme.colors.primary,
  },
  statusBadge: {
   paddingHorizontal: 10,
   paddingVertical: 4,
   borderRadius: 999,
  },
  statusText: {
   fontWeight: '600',
   fontSize: 11,
  },
  empty: {
   textAlign: 'center',
   marginTop: 24,
   color: muted,
   fontSize: 13,
  },
 });
};
