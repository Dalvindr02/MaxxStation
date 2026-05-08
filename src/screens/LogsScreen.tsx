import React, {useEffect, useMemo} from 'react';
import {
 ScrollView,
 StyleSheet,
 Text,
 TouchableOpacity,
 View,
 TextInput,
 Switch,
 Platform,
} from 'react-native';
import DateTimePicker, {
 DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {Dropdown} from 'react-native-element-dropdown';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import {useNavigation} from '@react-navigation/native';
import {ActionButton} from '../components/ui';
import {TopHeader} from '../components/TopHeader';
import {useAppTheme} from '../context/ThemeContext';
import {LogEntry, useLogs} from '../context/LogsContext';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {fetchLogs} from '../store/logSlice';
import {fetchProjects, setSelectedProject} from '../store/projectsSlice';
import {ProjectPickerModal} from '../components/Logs/ProjectPickerModal';
import {useDialog} from '../context/DialogContext';
import {
 createManualLogRequest,
 deleteManualLogRequest,
} from '../services/manualLogService';
import {minutesToHours, parseTimeToMinutes} from '../utils/time';
import {AppTheme} from '../theme';
import {ThemedIOSDateTimePicker} from '../components/ThemedIOSDateTimePicker';

const categoryOptions = [
 {key: 'Meeting', label: 'Meeting', icon: 'users'},
 {key: 'Field', label: 'Field', icon: 'briefcase'},
 {key: 'Offline', label: 'Offline', icon: 'wifi-off'},
];

const getCategoryIcon = (key: string) =>
 categoryOptions.find(c => c.key === key)?.icon || 'tag';

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

const formatDateKey = (date: Date) => {
 const yyyy = date.getFullYear();
 const mm = String(date.getMonth() + 1).padStart(2, '0');
 const dd = String(date.getDate()).padStart(2, '0');
 return `${yyyy}-${mm}-${dd}`;
};

const sanitizeLogEntry = (log: unknown, index: number): LogEntry | null => {
 if (!log || typeof log !== 'object') {
  return null;
 }
 const row = log as Partial<LogEntry>;
 const idValue =
  typeof row.id === 'string' && row.id.trim()
   ? row.id.trim()
   : `manual-log-${index}`;

 const dateValue =
  typeof row.date === 'string' && row.date.trim()
   ? row.date.trim()
   : new Date().toISOString().slice(0, 10);

 return {
  id: idValue,
  date: dateValue,
  projectId:
   typeof row.projectId === 'string' && row.projectId.trim()
    ? row.projectId.trim()
    : '0',
  projectName:
   typeof row.projectName === 'string' && row.projectName.trim()
    ? row.projectName.trim()
    : 'Project',
  taskId:
   typeof row.taskId === 'string' && row.taskId.trim()
    ? row.taskId.trim()
    : null,
  taskName:
   typeof row.taskName === 'string' && row.taskName.trim()
    ? row.taskName.trim()
    : null,
  startTime:
   typeof row.startTime === 'string' && row.startTime.trim()
    ? row.startTime.trim()
    : '00:00',
  endTime:
   typeof row.endTime === 'string' && row.endTime.trim()
    ? row.endTime.trim()
    : '00:00',
  category:
   typeof row.category === 'string' && row.category.trim()
    ? row.category.trim()
    : 'Meeting',
  notes: typeof row.notes === 'string' ? row.notes : '',
  billable: Boolean(row.billable),
  status:
   row.status === 'approved' ||
   row.status === 'rejected' ||
   row.status === 'review'
    ? row.status
    : 'review',
  fromLocation: row.fromLocation,
  toLocation: row.toLocation,
  fromCoords: row.fromCoords ?? null,
  toCoords: row.toCoords ?? null,
  routePoints: Array.isArray(row.routePoints) ? row.routePoints : [],
  stops: Array.isArray(row.stops) ? row.stops : [],
  routeDistanceMeters: row.routeDistanceMeters ?? null,
  routeDurationSeconds: row.routeDurationSeconds ?? null,
  routeSummary: row.routeSummary,
  auditStatus: row.auditStatus,
  auditFlags: row.auditFlags,
 };
};

export const LogsScreen = () => {
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const dispatch = useAppDispatch();
 const navigation = useNavigation<any>();
 const {showDialog} = useDialog();
 const {startEditing} = useLogs();
 const reduxLogs = useAppSelector(state =>
  Array.isArray(state.logs.logs) ? state.logs.logs : [],
 );
 const authToken = useAppSelector(state => state.auth.token);
 const {
  items: projects,
  selectedProjectId,
  isLoading: isProjectsLoading,
 } = useAppSelector(state => state.projects);
 const [projectPickerVisible, setProjectPickerVisible] = React.useState(false);
 const [startDate, setStartDate] = React.useState(new Date());
 const [endDate, setEndDate] = React.useState(new Date());
 const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(
  null,
 );
 const [startTime, setStartTime] = React.useState('09:00');
 const [endTime, setEndTime] = React.useState('10:00');
 const [pickerVisible, setPickerVisible] = React.useState(false);
 const [pickerMode, setPickerMode] = React.useState<'date' | 'time'>('date');
 const [pickerTarget, setPickerTarget] = React.useState<
  'startDate' | 'endDate' | 'start' | 'end'
 >('startDate');
 const [pickerDate, setPickerDate] = React.useState(new Date());
 const [category, setCategory] = React.useState('Meeting');
 const [notes, setNotes] = React.useState('Manual log entry');
 const [billable, setBillable] = React.useState(true);
 const [isSavingLog, setIsSavingLog] = React.useState(false);
 const isMounted = React.useRef(true);

 useEffect(() => {
  isMounted.current = true;
  return () => {
   isMounted.current = false;
  };
 }, []);

 useEffect(() => {
  dispatch(fetchLogs());
  dispatch(fetchProjects());
 }, [dispatch]);

 const sortedLogs = useMemo(() => {
  if (!Array.isArray(reduxLogs)) return [];
  return reduxLogs
   .map((log, index) => sanitizeLogEntry(log, index))
   .filter((log): log is LogEntry => Boolean(log))
   .sort((a, b) => {
    const dateA = a?.date || '';
    const dateB = b?.date || '';
    const timeA = a?.startTime || '';
    const timeB = b?.startTime || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return timeB.localeCompare(timeA);
   });
 }, [reduxLogs]);

 const previewLogs = useMemo(() => sortedLogs, [sortedLogs]);

 const navigateToHistory = () => {
  navigation.navigate('LogsHistoryScreen', {date: formatDateKey(new Date())});
 };

 const selectedProject = useMemo(
  () => projects.find(project => project.id === selectedProjectId) ?? null,
  [projects, selectedProjectId],
 );

 const onSelectProject = (projectId: string) => {
  dispatch(setSelectedProject(projectId));
  setProjectPickerVisible(false);
 };

 const availableTasks = useMemo(
  () => selectedProject?.tasks ?? [],
  [selectedProject],
 );

 const taskOptions = useMemo(
  () => availableTasks.map(task => ({label: task.name, value: task.id})),
  [availableTasks],
 );

 useEffect(() => {
  if (!selectedProject) {
   if (selectedTaskId !== null) {
    setSelectedTaskId(null);
   }
   return;
  }
  if (selectedProject.tasks.length === 0) {
   setSelectedTaskId(null);
   return;
  }
  const exists = selectedProject.tasks.some(task => task.id === selectedTaskId);
  if (!exists) {
   setSelectedTaskId(selectedProject.tasks[0]?.id ?? null);
  }
 }, [selectedProject, selectedTaskId]);

 const saveManualLog = async () => {
  if (!selectedProject) {
   showDialog({
    title: 'Project required',
    message: 'Please select a project before saving.',
    variant: 'error',
    primaryAction: {label: 'OK'},
   });
   return;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (
   startMinutes === null ||
   endMinutes === null ||
   endMinutes <= startMinutes
  ) {
   showDialog({
    title: 'Invalid time range',
    message: 'Please enter a valid start and end time in HH:MM format.',
    variant: 'error',
    primaryAction: {label: 'OK'},
   });
   return;
  }

  const projectIdNumber = Number(selectedProject.id);
  if (Number.isNaN(projectIdNumber)) {
   showDialog({
    title: 'Invalid project',
    message: 'Selected project id is invalid.',
    variant: 'error',
    primaryAction: {label: 'OK'},
   });
   return;
  }

  const startDateKey = formatDateKey(startDate);
  const endDateKey = formatDateKey(endDate);
  const payload = {
   meeting_type: category,
   start_time: `${startTime}:00`,
   end_time: `${endTime}:00`,
   start_date_time: `${startDateKey} ${startTime}:00`,
   end_date_time: `${endDateKey} ${endTime}:00`,
   choose_participant: selectedTaskId ?? selectedProject.tasks[0]?.id ?? '5',
   billable: billable ? '1' : '0',
   meeting_agenda: notes.trim() || 'Manual log entry',
   project_id: projectIdNumber,
  };

  try {
   setIsSavingLog(true);
   const result = await createManualLogRequest(payload, authToken);
   await dispatch(fetchLogs()).unwrap();
   // Guard: screen may have been unmounted while request was in-flight
   if (!isMounted.current) return;
   showDialog({
    title: 'Log created',
    message: result.message || 'Manual log created successfully.',
    variant: 'success',
    primaryAction: {label: 'OK'},
   });
   setNotes('Manual log entry');
  } catch (error) {
   if (!isMounted.current) return;
   showDialog({
    title: 'Save failed',
    message:
     error instanceof Error ? error.message : 'Unable to create manual log.',
    variant: 'error',
    primaryAction: {label: 'OK'},
   });
  } finally {
   if (isMounted.current) setIsSavingLog(false);
  }
 };

 const handleEdit = (log: LogEntry) => {
  startEditing(log);
  // Navigate to the form section or scroll to top
  // For now, we'll just start editing
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
      // Guard: screen may have unmounted while delete was in-flight
      if (!isMounted.current) return;
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

 const timeToDate = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
 };

 const dateToTime = (value: Date) => {
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
 };

 const openDatePicker = (target: 'startDate' | 'endDate') => {
  setPickerTarget(target);
  setPickerMode('date');
  setPickerDate(target === 'startDate' ? startDate : endDate);
  setPickerVisible(true);
 };

 const openTimePicker = (target: 'start' | 'end') => {
  setPickerTarget(target);
  setPickerMode('time');
  setPickerDate(timeToDate(target === 'start' ? startTime : endTime));
  setPickerVisible(true);
 };

 const applyPickerValue = (value: Date) => {
  if (pickerTarget === 'startDate') {
   setStartDate(value);
   return;
  }
  if (pickerTarget === 'endDate') {
   setEndDate(value);
   return;
  }
  const nextTime = dateToTime(value);
  if (pickerTarget === 'start') {
   setStartTime(nextTime);
  } else {
   setEndTime(nextTime);
  }
 };

 const handlePickerChange = (event: DateTimePickerEvent, value?: Date) => {
  if (Platform.OS === 'android') {
   setPickerVisible(false);
   if (event.type === 'set' && value) {
    applyPickerValue(value);
   }
   return;
  }
  if (value) {
   setPickerDate(value);
  }
 };

 const confirmPicker = () => {
  applyPickerValue(pickerDate);
  setPickerVisible(false);
 };

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title="Time Logs" />

   <ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerStyle={styles.scrollContent}>
    <View style={styles.formCard}>
     <Text allowFontScaling={false} style={styles.formTitle}>
      Add Manual Log
     </Text>
     <Text allowFontScaling={false} style={styles.inputHeading}>
      Select Project
     </Text>
     <TouchableOpacity
      activeOpacity={0.85}
      style={styles.projectSelect}
      onPress={() => setProjectPickerVisible(true)}>
      <Text allowFontScaling={false} style={styles.projectSelectText}>
       {isProjectsLoading
        ? 'Loading projects...'
        : selectedProject?.name ?? 'Select project'}
      </Text>
     </TouchableOpacity>
     <Text allowFontScaling={false} style={styles.inputHeading}>
      Date Range
     </Text>
     <View style={styles.dateRow}>
      <TouchableOpacity
       activeOpacity={0.85}
       style={styles.dateInput}
       onPress={() => openDatePicker('startDate')}>
       <Text allowFontScaling={false} style={styles.projectSelectText}>
        {`Start: ${formatDisplayDate(startDate)}`}
       </Text>
      </TouchableOpacity>
      <TouchableOpacity
       activeOpacity={0.85}
       style={styles.dateInput}
       onPress={() => openDatePicker('endDate')}>
       <Text allowFontScaling={false} style={styles.projectSelectText}>
        {`End: ${formatDisplayDate(endDate)}`}
       </Text>
      </TouchableOpacity>
     </View>

     <Text allowFontScaling={false} style={styles.inputHeading}>
      Select Task
     </Text>
     <View style={styles.taskDropdownWrap}>
      <Dropdown
       style={styles.taskDropdown}
       containerStyle={styles.taskDropdownMenu}
       itemContainerStyle={styles.taskDropdownItem}
       itemTextStyle={styles.taskDropdownItemText}
       selectedTextStyle={styles.taskDropdownSelectedText}
       placeholderStyle={styles.taskDropdownPlaceholder}
       data={taskOptions}
       labelField="label"
       valueField="value"
       value={selectedTaskId}
       onChange={(item: {label: string; value: string}) =>
        setSelectedTaskId(item.value)
       }
       placeholder={
        !selectedProject
         ? 'Select project first'
         : taskOptions.length > 0
         ? 'Select task'
         : 'No tasks in selected project'
       }
       disable={!selectedProject || taskOptions.length === 0}
      />
     </View>

     <Text allowFontScaling={false} style={styles.inputHeading}>
      Time Range
     </Text>
     <View style={styles.timeRow}>
      <TouchableOpacity
       activeOpacity={0.85}
       style={styles.timeInput}
       onPress={() => openTimePicker('start')}>
       <Text allowFontScaling={false} style={styles.timeInputText}>
        {`Start: ${startTime}`}
       </Text>
      </TouchableOpacity>
      <TouchableOpacity
       activeOpacity={0.85}
       style={styles.timeInput}
       onPress={() => openTimePicker('end')}>
       <Text allowFontScaling={false} style={styles.timeInputText}>
        {`End: ${endTime}`}
       </Text>
      </TouchableOpacity>
     </View>

     <Text allowFontScaling={false} style={styles.inputHeading}>
      Category
     </Text>
     <View style={styles.categoryRow}>
      {categoryOptions.map(option => (
       <TouchableOpacity
        key={option.key}
        onPress={() => setCategory(option.key)}
        style={[
         styles.categoryChip,
         category === option.key && styles.categoryChipActive,
        ]}>
        <Text allowFontScaling={false} style={styles.categoryChipText}>
         {option.label}
        </Text>
       </TouchableOpacity>
      ))}
     </View>

     <View style={styles.notesHeader}>
      <Text allowFontScaling={false} style={styles.inputHeading}>
       Notes
      </Text>
      <View style={styles.billableToggle}>
       <Text allowFontScaling={false} style={styles.billableLabel}>
        Billable
       </Text>
       <Switch value={billable} onValueChange={setBillable} />
      </View>
     </View>
     <TextInput
      value={notes}
      onChangeText={setNotes}
      placeholder="Notes"
      placeholderTextColor={theme.colors.muted}
      style={styles.notesInput}
      multiline
     />
     <ActionButton
      style={[styles.saveButton, isSavingLog && styles.saveButtonDisabled]}
      onPress={saveManualLog}
      disabled={isSavingLog}
      icon={isSavingLog ? 'loader' : 'save'}
      label={isSavingLog ? 'Saving...' : 'Save Manual Log'}
      subtitle="Save with the same expense gradient style"
     />
    </View>

    <View style={styles.logsHeader}>
     <View>
      <Text allowFontScaling={false} style={styles.todayTitle}>
       All Logs
      </Text>
      <Text allowFontScaling={false} style={styles.logsMetaText}>
       Showing {previewLogs.length} entries
      </Text>
     </View>
     <View style={styles.logsHeaderActions}>
      <TouchableOpacity
       activeOpacity={0.8}
       onPress={navigateToHistory}
       style={styles.logsHeaderAction}>
       <Text allowFontScaling={false} style={styles.viewAllLink}>
        View History
       </Text>
      </TouchableOpacity>
     </View>
    </View>
    {previewLogs.map((item, index) => (
     <TouchableOpacity
      key={`${String(item.id)}-${index}`}
      style={styles.logCard}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('LogDetailScreen', {log: item})}>
      <View style={styles.logCardContent}>
       <View style={styles.logLeft}>
        <View
         style={[
          styles.categoryIcon,
          {backgroundColor: getCategoryColor(item.category)},
         ]}>
         <Text allowFontScaling={false} style={styles.categoryIconText}>
          {getCategoryIcon(item.category) === 'users'
           ? 'M'
           : getCategoryIcon(item.category) === 'briefcase'
           ? 'F'
           : 'O'}
         </Text>
        </View>
       </View>
       <View style={styles.logCenter}>
        <Text allowFontScaling={false} style={styles.logTime}>
         {item.startTime} - {item.endTime}
        </Text>
        <Text allowFontScaling={false} style={styles.logProject}>
         {item.projectName}
        </Text>
        <Text allowFontScaling={false} style={styles.logMeta}>
         {item.category} • {getDurationText(item.startTime, item.endTime)}
        </Text>
        {item.notes ? (
         <Text
          allowFontScaling={false}
          style={styles.logNotes}
          numberOfLines={1}>
          {item.notes}
         </Text>
        ) : null}
       </View>
       <View style={styles.logRight}>
        <View
         style={[
          styles.statusBadge,
          {backgroundColor: getStatusColor(item.status)},
         ]}>
         <Text allowFontScaling={false} style={styles.statusText}>
          {item.status.toUpperCase()}
         </Text>
        </View>
        <Text allowFontScaling={false} style={styles.arrowIcon}>
         ›
        </Text>
       </View>
      </View>
      <View style={styles.actionRow}>
       <TouchableOpacity
        style={[styles.actionButton, styles.editButton]}
        onPress={() => handleEdit(item)}
        activeOpacity={0.85}>
        <Feather name="edit-3" size={14} color={theme.colors.primary} />
        <Text allowFontScaling={false} style={styles.actionText}>
         Edit
        </Text>
       </TouchableOpacity>
       <TouchableOpacity
        style={[styles.actionButton, styles.deleteButton]}
        onPress={() => handleDelete(item)}
        activeOpacity={0.85}>
        <Feather name="trash-2" size={14} color={theme.colors.danger} />
        <Text allowFontScaling={false} style={styles.deleteActionText}>
         Delete
        </Text>
       </TouchableOpacity>
      </View>
     </TouchableOpacity>
    ))}
    {previewLogs.length === 0 ? (
     <Text allowFontScaling={false} style={styles.emptyStateText}>
      No logs found yet.
     </Text>
    ) : null}
   </ScrollView>
   <ProjectPickerModal
    visible={projectPickerVisible}
    onClose={() => setProjectPickerVisible(false)}
    theme={theme}
    projects={projects}
    selectedProjectId={selectedProjectId}
    onSelectProject={onSelectProject}
   />
   {pickerVisible && Platform.OS === 'ios' ? (
    <ThemedIOSDateTimePicker
     visible={pickerVisible}
     title={
      pickerTarget === 'startDate'
       ? 'Select Start Date'
       : pickerTarget === 'endDate'
       ? 'Select End Date'
       : `Select ${pickerTarget === 'start' ? 'Start' : 'End'} Time`
     }
     value={pickerDate}
     mode={pickerMode}
     is24Hour
     onChange={handlePickerChange}
     onCancel={() => setPickerVisible(false)}
     onConfirm={confirmPicker}
    />
   ) : null}
   {pickerVisible && Platform.OS === 'android' ? (
    <DateTimePicker
     value={pickerDate}
     mode={pickerMode}
     display="default"
     is24Hour
     onChange={handlePickerChange}
    />
   ) : null}
  </SafeAreaView>
 );
};

const createStyles = (theme: AppTheme) => {
 const borderColor = theme.colors.border;
 const inputBg = 'rgba(255,255,255,0.02)';
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
  scrollContent: {
   paddingHorizontal: 8,
   paddingBottom: 28,
  },
  formCard: {
   borderWidth: 1,
   borderColor,
   backgroundColor: inputBg,
   borderRadius: 16,
   padding: 12,
   marginBottom: 12,
  },
  formTitle: {
   fontSize: 16,
   fontWeight: '800',
   color: theme.colors.text,
   marginBottom: 10,
  },
  formHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: 10,
  },
  notesHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: 6,
   marginTop: 8,
  },
  billableToggle: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
  },
  billableLabel: {
   fontSize: 14,
   fontWeight: '600',
   color: theme.colors.text,
  },
  inputHeading: {
   fontSize: 14,
   fontWeight: '700',
   color: theme.colors.text,
   marginBottom: 6,
  },
  projectSelect: {
   borderWidth: 1,
   borderColor,
   borderRadius: 12,
   paddingHorizontal: 12,
   paddingVertical: 10,
   marginBottom: 10,
   backgroundColor: theme.colors.card,
  },
  projectSelectText: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '600',
  },
  taskDropdownWrap: {
   marginBottom: 10,
  },
  taskDropdown: {
   height: 48,
   borderRadius: 12,
   borderWidth: 1,
   borderColor: borderColor,
   paddingHorizontal: 12,
   backgroundColor: theme.colors.card,
  },
  taskDropdownMenu: {
   borderRadius: 12,
   borderWidth: 1,
   borderColor: borderColor,
   backgroundColor: theme.colors.card,
   overflow: 'hidden',
  },
  taskDropdownItem: {
   minHeight: 42,
   justifyContent: 'center',
  },
  taskDropdownItemText: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '600',
  },
  taskDropdownSelectedText: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '600',
  },
  taskDropdownPlaceholder: {
   color: theme.colors.muted,
   fontSize: 13,
   fontWeight: '500',
  },
  timeRow: {
   flexDirection: 'row',
   gap: 8,
   marginBottom: 10,
  },
  dateRow: {
   flexDirection: 'row',
   gap: 8,
   marginBottom: 10,
  },
  timeInput: {
   flex: 1,
   borderWidth: 1,
   borderColor,
   borderRadius: 12,
   paddingHorizontal: 12,
   paddingVertical: 10,
   backgroundColor: theme.colors.card,
   justifyContent: 'center',
  },
  timeInputText: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '600',
  },
  dateInput: {
   flex: 1,
   borderWidth: 1,
   borderColor,
   borderRadius: 12,
   paddingHorizontal: 12,
   paddingVertical: 10,
   backgroundColor: theme.colors.card,
   justifyContent: 'center',
  },
  categoryRow: {
   flexDirection: 'row',
   flexWrap: 'wrap',
   gap: 8,
   marginBottom: 10,
  },
  categoryChip: {
   borderWidth: 1,
   borderColor,
   borderRadius: 999,
   paddingHorizontal: 10,
   paddingVertical: 6,
   backgroundColor: theme.colors.card,
  },
  categoryChipActive: {
   backgroundColor: 'rgba(37,99,235,0.16)',
   borderColor: theme.colors.primary,
  },
  categoryChipText: {
   color: theme.colors.text,
   fontSize: 12,
   fontWeight: '600',
  },
  notesInput: {
   borderWidth: 1,
   borderColor,
   borderRadius: 12,
   minHeight: 70,
   textAlignVertical: 'top',
   paddingHorizontal: 12,
   paddingVertical: 10,
   color: theme.colors.text,
   backgroundColor: theme.colors.card,
   marginBottom: 10,
  },
  billableRow: {
   flexDirection: 'row',
   justifyContent: 'center',
   alignItems: 'center',
   marginBottom: 10,
  },
  billableText: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '600',
  },
  saveButton: {
   marginTop: 4,
  },
  saveButtonDisabled: {
   opacity: 0.7,
  },
  logsHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'flex-start',
   marginBottom: 10,
   marginTop: 2,
  },
  logsHeaderActions: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
  },
  todayTitle: {
   fontSize: 20,
   fontWeight: '800',
   color: theme.colors.text,
  },
  logsMetaText: {
   marginTop: 4,
   fontSize: 11,
   color: muted,
   fontWeight: '600',
  },
  logsHeaderAction: {
   borderRadius: 999,
   paddingHorizontal: 12,
   paddingVertical: 7,
   backgroundColor: inputBg,
   borderWidth: 1,
   borderColor: borderColor,
  },
  viewAllLink: {
   fontSize: 11,
   color: theme.colors.primary,
   fontWeight: '700',
  },
  emptyStateText: {
   marginTop: 10,
   color: muted,
   textAlign: 'center',
   fontSize: 12,
   fontWeight: '600',
  },
  logCard: {
   borderWidth: 1,
   borderColor,
   backgroundColor: inputBg,
   borderRadius: 12,
   marginBottom: 12,
   shadowColor: '#000',
   shadowOffset: {width: 0, height: 2},
   shadowOpacity: 0.1,
   shadowRadius: 4,
   //  elevation: 3,
  },
  logCardContent: {
   flexDirection: 'row',
   alignItems: 'center',
   padding: 16,
  },
  logLeft: {
   marginRight: 12,
  },
  categoryIcon: {
   width: 40,
   height: 40,
   borderRadius: 20,
   alignItems: 'center',
   justifyContent: 'center',
  },
  categoryIconText: {
   color: '#fff',
   fontSize: 16,
   fontWeight: '800',
  },
  logCenter: {
   flex: 1,
  },
  logTime: {
   fontSize: 16,
   fontWeight: '700',
   color: theme.colors.text,
   marginBottom: 4,
  },
  logProject: {
   fontSize: 14,
   fontWeight: '600',
   color: theme.colors.text,
   marginBottom: 2,
  },
  logMeta: {
   fontSize: 12,
   color: muted,
   fontWeight: '500',
   marginBottom: 4,
  },
  logNotes: {
   fontSize: 12,
   color: theme.colors.text,
   fontStyle: 'italic',
  },
  logRight: {
   alignItems: 'center',
   gap: 8,
  },
  statusBadge: {
   paddingHorizontal: 8,
   paddingVertical: 4,
   borderRadius: 12,
  },
  statusText: {
   color: '#fff',
   fontSize: 10,
   fontWeight: '700',
  },
  arrowIcon: {
   color: theme.colors.muted,
   fontSize: 20,
   fontWeight: '300',
  },
  simpleActionRow: {
   marginTop: 10,
   flexDirection: 'row',
   justifyContent: 'flex-end',
   gap: 8,
  },
  simpleEditButton: {
   backgroundColor: 'rgba(37,99,235,0.14)',
   borderRadius: 999,
   paddingHorizontal: 12,
   paddingVertical: 6,
  },
  simpleEditText: {
   color: theme.colors.primary,
   fontSize: 12,
   fontWeight: '700',
  },
  simpleDeleteButton: {
   backgroundColor: 'rgba(220,38,38,0.14)',
   borderRadius: 999,
   paddingHorizontal: 12,
   paddingVertical: 6,
  },
  simpleDeleteText: {
   color: theme.colors.danger,
   fontSize: 12,
   fontWeight: '700',
  },
  actionRow: {
   flexDirection: 'row',
   justifyContent: 'flex-end',
   gap: 12,
   marginTop: 16,
   paddingHorizontal: 16,
   paddingBottom: 16,
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
  deleteActionText: {
   fontSize: 12,
   fontWeight: '600',
   color: theme.colors.danger,
  },
 });
};
