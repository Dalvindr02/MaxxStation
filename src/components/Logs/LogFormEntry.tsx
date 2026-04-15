import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { Dropdown } from 'react-native-element-dropdown';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';

import { ActionButton, AnimatedCard } from '../ui';
import { ThemedIOSDateTimePicker } from '../ThemedIOSDateTimePicker';
import { ProjectPickerModal } from './ProjectPickerModal';
import { useAppTheme } from '../../context/ThemeContext';
import { useLogs } from '../../context/LogsContext';
import { useDialog } from '../../context/DialogContext';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchProjects, setSelectedProject } from '../../store/projectsSlice';
import { fetchLogs } from '../../store/logSlice';
import { createManualLogRequest } from '../../services/manualLogService';
import { parseTimeToMinutes } from '../../utils/time';
import { AppTheme } from '../../theme';

const categoryOptions = [
  { key: 'Meeting', label: 'Meeting', icon: 'users' },
  { key: 'Field', label: 'Field', icon: 'briefcase' },
  { key: 'Offline', label: 'Offline', icon: 'wifi-off' },
];

const formatTime = (date: Date) => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const stringToDate = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
};

const formatDateKey = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatApiDateTime = (date: Date, time: string) =>
  `${formatDateKey(date)} ${time}:00`;

const parseDateKey = (value?: string) => {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

const getCategoryIcon = (key: string) =>
  categoryOptions.find(c => c.key === key)?.icon || 'tag';

export const LogFormEntry: React.FC = () => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useAppDispatch();

  const { logs, addLog, updateLog, editingLog, clearEditing } = useLogs();
  const { showDialog } = useDialog();

  const {
    items: projects,
    selectedProjectId,
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useAppSelector(state => state.projects);
  const authToken = useAppSelector(state => state.auth.token);

  // Form State
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('Meeting');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notes, setNotes] = useState('Manual log entry');
  const [billable, setBillable] = useState(true);
  const [logDate, setLogDate] = useState(new Date());
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Picker State
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'date' | 'start' | 'end'>('start');
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('time');
  const [pickerDate, setPickerDate] = useState(new Date());

  const lastAppliedEditingLogId = useRef<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find(project => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const availableTasks = useMemo(() => selectedProject?.tasks ?? [], [selectedProject]);
  const taskOptions = useMemo(
    () => availableTasks.map(task => ({ label: task.name, value: task.id })),
    [availableTasks],
  );

  useEffect(() => {
    if (projects.length === 0 && !isProjectsLoading) {
      dispatch(fetchProjects());
    }
  }, [dispatch, isProjectsLoading, projects.length]);

  useEffect(() => {
    if (!editingLog || lastAppliedEditingLogId.current === editingLog.id) {
      return;
    }

    if (selectedProjectId !== editingLog.projectId) {
      dispatch(setSelectedProject(editingLog.projectId));
    }
    setSelectedTaskId(editingLog.taskId);
    setStartTime(editingLog.startTime);
    setEndTime(editingLog.endTime);
    setCategory(editingLog.category);
    setNotes(editingLog.notes);
    setBillable(editingLog.billable);
    setLogDate(parseDateKey(editingLog.date));
    setEditingId(editingLog.id);
    
    lastAppliedEditingLogId.current = editingLog.id;
    // clearEditing() will be handled when actual form logic completes, but we sync locally first.
  }, [dispatch, editingLog, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) {
      if (selectedTaskId !== null) setSelectedTaskId(null);
      return;
    }
    const nextTaskId = selectedProject.tasks.some(task => task.id === selectedTaskId)
      ? selectedTaskId
      : selectedProject.tasks[0]?.id ?? null;
    if (nextTaskId !== selectedTaskId) {
      setSelectedTaskId(nextTaskId);
    }
  }, [selectedProject, selectedTaskId]);

  const openTimePicker = (target: 'start' | 'end') => {
    setPickerMode('time');
    setPickerTarget(target);
    setPickerDate(stringToDate(target === 'start' ? startTime : endTime));
    setPickerVisible(true);
  };

  const openDatePicker = () => {
    setPickerMode('date');
    setPickerTarget('date');
    setPickerDate(logDate);
    setPickerVisible(true);
  };

  const applyPickerValue = (date: Date) => {
    if (pickerTarget === 'date') {
      setLogDate(date);
      return;
    }
    const next = formatTime(date);
    if (pickerTarget === 'start') setStartTime(next);
    else setEndTime(next);
  };

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setPickerVisible(false);
      if (event.type !== 'set' || !date) return;
      applyPickerValue(date);
      return;
    }
    if (date) setPickerDate(date);
  };

  const confirmPicker = () => {
    applyPickerValue(pickerDate);
    setPickerVisible(false);
  };

  const resetForm = () => {
    setNotes('');
    setCategory('Meeting');
    setSelectedTaskId(null);
    setStartTime('09:00');
    setEndTime('10:00');
    setBillable(true);
    setLogDate(new Date());
    setEditingId(null);
    lastAppliedEditingLogId.current = null;
    clearEditing();
  };

  const handleSave = async () => {
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);

    if (!selectedProjectId || !selectedProject) {
      setError('Please select a project before saving the log.');
      return;
    }

    const selectedTask = selectedProject.tasks.find(task => task.id === selectedTaskId);
    if (selectedProject.tasks.length > 0 && !selectedTask) {
      setError('Please select a task for the chosen project.');
      return;
    }

    if (start === null || end === null || end <= start) {
      setError('Enter valid start and end time.');
      return;
    }

    const dateKey = formatDateKey(logDate);
    const entry = {
      date: dateKey,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      taskId: selectedTask?.id ?? null,
      taskName: selectedTask?.name ?? null,
      startTime,
      endTime,
      category,
      notes,
      billable,
    };

    if (editingId) {
      updateLog(editingId, entry);
      setError('');
      resetForm();
      return;
    }

    const projectIdNumber = Number(selectedProject.id);
    if (Number.isNaN(projectIdNumber)) {
      setError('Selected project has an invalid project id.');
      return;
    }

    const manualLogPayload = {
      meeting_type: category,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      start_date_time: formatApiDateTime(logDate, startTime),
      end_date_time: formatApiDateTime(logDate, endTime),
      choose_participant: selectedTask?.id ?? '5',
      billable: billable ? '1' : '0',
      meeting_agenda: notes.trim() || 'Manual log entry',
      project_id: projectIdNumber,
    };

    try {
      setIsSubmitting(true);
      setError('');
      const result = await createManualLogRequest(manualLogPayload, authToken);
      dispatch(fetchLogs());
      
      showDialog({
        title: 'Log created',
        message: result.message,
        variant: 'success',
        primaryAction: { label: 'OK' },
      });
      resetForm();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to create manual log.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategoryIcon = getCategoryIcon(category);
  const selectedProjectTasksLabel = selectedProject?.tasks.length === 1
    ? '1 task'
    : `${selectedProject?.tasks.length ?? 0} tasks`;

  const handleProjectSelect = (projectId: string) => {
    dispatch(setSelectedProject(projectId));
    setProjectPickerVisible(false);
    if (error) setError('');
  };

  return (
    <AnimatedCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text allowFontScaling={false} style={styles.cardTitle}>
            Add Manual Log
          </Text>
        </View>
      </View>
      <Text allowFontScaling={false} style={styles.cardDescription}>
        Capture project work with cleaner notes, task linkage, and billing state.
      </Text>

      <Text allowFontScaling={false} style={styles.label}>
        Date
      </Text>
      <TouchableOpacity style={styles.inputWrap} onPress={openDatePicker}>
        <Text allowFontScaling={false} style={styles.pickerText}>
          {formatDisplayDate(logDate)}
        </Text>
        <Feather name="calendar" size={14} color={theme.colors.muted} />
      </TouchableOpacity>

      <View style={styles.row}>
        <View style={styles.fieldBlock}>
          <Text allowFontScaling={false} style={styles.label}>Start Time</Text>
          <TouchableOpacity style={styles.inputWrap} onPress={() => openTimePicker('start')}>
            <Text style={styles.pickerText}>{startTime}</Text>
            <Feather name="clock" size={14} color={theme.colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.fieldBlock}>
          <Text allowFontScaling={false} style={styles.label}>End Time</Text>
          <TouchableOpacity style={styles.inputWrap} onPress={() => openTimePicker('end')}>
            <Text style={styles.pickerText}>{endTime}</Text>
            <Feather name="clock" size={14} color={theme.colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <Text allowFontScaling={false} style={styles.label}>Project</Text>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.projectPickerTrigger}
        onPress={() => setProjectPickerVisible(true)}
        disabled={isProjectsLoading}
      >
        <View style={styles.dropdownBackdrop} />
        <View style={styles.dropdownLeftIcon}>
          <Feather name="briefcase" size={14} color={theme.colors.primary} />
        </View>
        <View style={styles.projectPickerContent}>
          <Text
            allowFontScaling={false}
            style={[styles.projectPickerTitle, !selectedProject && styles.projectPickerPlaceholder]}
          >
            {isProjectsLoading ? 'Loading projects...' : selectedProject?.name ?? 'Select project'}
          </Text>
          <Text allowFontScaling={false} style={styles.projectPickerSubtext}>
            {selectedProject ? selectedProjectTasksLabel : 'Choose project to load tasks'}
          </Text>
        </View>
        <View style={styles.projectPickerChevron}>
          <Feather name="chevron-down" size={18} color={theme.colors.primary} />
        </View>
      </TouchableOpacity>

      {projectsError ? (
        <View style={styles.projectMetaRow}>
          <Text allowFontScaling={false} style={styles.error}>{projectsError}</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => dispatch(fetchProjects())}>
            <Text allowFontScaling={false} style={styles.viewAllLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text allowFontScaling={false} style={styles.label}>Task</Text>
      <View style={styles.dropdownWrap}>
        <View style={styles.dropdownBackdrop} />
        <View pointerEvents="none" style={styles.dropdownLeftIcon}>
          <Feather name="check-square" size={14} color={theme.colors.primary} />
        </View>

        <Dropdown
          style={styles.dropdownControl}
          containerStyle={styles.dropdownMenu}
          itemContainerStyle={styles.dropdownItem}
          itemTextStyle={styles.dropdownItemText}
          selectedTextStyle={styles.dropdownSelectedText}
          placeholderStyle={styles.dropdownPlaceholder}
          activeColor={theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}
          data={taskOptions}
          labelField="label"
          valueField="value"
          value={selectedTaskId}
          autoScroll
          maxHeight={260}
          onChange={(item) => {
            setSelectedTaskId(item.value);
            if (error) setError('');
          }}
          placeholder={!selectedProject ? 'Select project first' : availableTasks.length > 0 ? 'Select task' : 'No tasks for this project'}
          disable={!selectedProject || availableTasks.length === 0}
        />
      </View>

      <Text style={[styles.label, { marginTop: '5%' }]}>Category</Text>
      <View style={styles.dropdownWrap}>
        <View style={styles.dropdownBackdrop} />
        <View pointerEvents="none" style={styles.dropdownLeftIcon}>
          <Feather name={selectedCategoryIcon} size={14} color={theme.colors.primary} />
        </View>

        <Dropdown
          style={styles.dropdownControl}
          containerStyle={styles.dropdownMenu}
          itemContainerStyle={styles.dropdownItem}
          itemTextStyle={styles.dropdownItemText}
          selectedTextStyle={styles.dropdownSelectedText}
          placeholderStyle={styles.dropdownPlaceholder}
          activeColor={theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}
          data={categoryOptions}
          labelField="label"
          valueField="key"
          value={category}
          autoScroll
          maxHeight={220}
          onChange={(item) => setCategory(item.key)}
          placeholder="Select category"
        />
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        allowFontScaling={false}
        style={styles.notesInput}
        multiline
        value={notes}
        onChangeText={setNotes}
        placeholder="Describe your work"
        placeholderTextColor={theme.colors.muted}
      />

      <View style={styles.switchRow}>
        <Text allowFontScaling={false} style={styles.label}>Billable</Text>
        <Switch
          value={billable}
          onValueChange={setBillable}
          trackColor={{ false: '#CBD5E1', true: theme.colors.primary }}
          thumbColor="#fff"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={[styles.actionButtons, editingId && styles.actionButtonsEditing]}>
        {editingId ? (
          <TouchableOpacity activeOpacity={0.9} style={styles.cancelActionWrap} onPress={resetForm}>
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cancelActionButton}
            >
              <View style={styles.cancelActionIcon}>
                <Feather name="x-circle" size={17} color={theme.colors.muted} />
              </View>
              <View style={styles.cancelActionContent}>
                <Text allowFontScaling={false} style={styles.cancelActionTitle}>Cancel Edit</Text>
                <Text allowFontScaling={false} style={styles.cancelActionText}>Discard the current changes</Text>
              </View>
              <View style={styles.cancelActionArrow}>
                <Feather name="rotate-ccw" size={16} color={theme.colors.muted} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        <ActionButton
          style={[styles.flexButton, isSubmitting && styles.disabledButton]}
          onPress={handleSave}
          disabled={isSubmitting}
          icon={editingId ? 'save' : 'plus-circle'}
          label={isSubmitting ? 'Saving...' : editingId ? 'Update Log' : 'Save Log'}
          subtitle={editingId ? 'Apply changes to this work log' : 'Create a new work log entry'}
        />
      </View>

      {pickerVisible && Platform.OS === 'ios' ? (
        <ThemedIOSDateTimePicker
          visible={pickerVisible}
          title={pickerTarget === 'date' ? 'Select Date' : `Select ${pickerTarget === 'start' ? 'Start' : 'End'} Time`}
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
          is24Hour
          display="default"
          onChange={handlePickerChange}
        />
      ) : null}

      <ProjectPickerModal
        visible={projectPickerVisible}
        onClose={() => setProjectPickerVisible(false)}
        theme={theme}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleProjectSelect}
      />
    </AnimatedCard>
  );
};

const createStyles = (theme: AppTheme) => {
  const glassCard = theme.colors.card;
  const borderColor = theme.colors.border;
  const inputBg = 'rgba(255,255,255,0.02)';
  const muted = theme.colors.muted;

  return StyleSheet.create({
    card: {
      backgroundColor: glassCard,
      paddingVertical: 20,
      paddingHorizontal: 16,
      borderRadius: 22,
      marginBottom: 14,
      borderWidth: 1,
      borderColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
    },
    cardHeader: {
      marginBottom: 6,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 0,
    },
    cardDescription: {
      color: muted,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
      marginBottom: 4,
    },
    fieldBlock: {
      flex: 1,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 6,
      color: theme.colors.text,
    },
    inputWrap: {
      borderWidth: 1,
      borderColor,
      borderRadius: 14,
      height: 50,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: inputBg,
    },
    pickerText: {
      color: theme.colors.text,
      fontWeight: '600',
    },
    dropdownWrap: {
      position: 'relative',
      marginBottom: 10,
    },
    projectPickerTrigger: {
      position: 'relative',
      minHeight: 70,
      borderRadius: 18,
      marginBottom: 12,
      justifyContent: 'center',
      paddingLeft: 38,
      paddingRight: 48,
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: borderColor,
    },
    dropdownBackdrop: { display: 'none' },
    dropdownLeftIcon: {
      position: 'absolute',
      left: 14,
      top: 0,
      bottom: 0,
      zIndex: 2,
      width: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    projectPickerContent: {
      minHeight: 40,
      justifyContent: 'center',
      paddingVertical: 10,
    },
    projectPickerTitle: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 14,
    },
    projectPickerPlaceholder: {
      color: theme.isDark ? 'rgba(233,239,255,0.62)' : theme.colors.muted,
    },
    projectPickerSubtext: {
      marginTop: 3,
      color: theme.colors.muted,
      fontWeight: '600',
      fontSize: 11,
    },
    projectPickerChevron: {
      position: 'absolute',
      right: 16,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdownControl: {
      height: 52,
      borderRadius: 16,
      paddingLeft: 40,
      paddingRight: 40,
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: borderColor,
      justifyContent: 'center',
    },
    dropdownMenu: {
      marginTop: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: borderColor,
      backgroundColor: theme.isDark ? 'rgba(8,15,28,0.98)' : 'rgba(255,255,255,0.98)',
      overflow: 'hidden',
      paddingVertical: 8,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: theme.isDark ? 0.42 : 0.12,
      shadowRadius: 20,
      elevation: 12,
    },
    dropdownItem: {
      borderRadius: 12,
      marginHorizontal: 8,
      marginVertical: 4,
      minHeight: 44,
      justifyContent: 'center',
    },
    dropdownItemText: {
      color: theme.colors.text,
      fontWeight: '600',
      fontSize: 14,
      lineHeight: 20,
    },
    dropdownSelectedText: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 14,
      lineHeight: 20,
    },
    dropdownPlaceholder: {
      color: theme.isDark ? 'rgba(233,239,255,0.62)' : theme.colors.muted,
      fontWeight: '600',
      fontSize: 14,
      lineHeight: 20,
    },
    notesInput: {
      borderWidth: 1,
      borderColor,
      borderRadius: 16,
      minHeight: 112,
      padding: 14,
      color: theme.colors.text,
      textAlignVertical: 'top',
      backgroundColor: inputBg,
      marginBottom: 10,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
      alignItems: 'center',
    },
    error: {
      color: theme.colors.error,
      marginTop: 6,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    actionButtonsEditing: {
      flexDirection: 'column',
      gap: 14,
    },
    flexButton: {
      flex: 1,
    },
    disabledButton: {
      opacity: 0.7,
    },
    cancelActionWrap: {
      width: '100%',
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
    },
    cancelActionButton: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cancelActionIcon: {
      width: 42,
      height: 42,
      margin: 12,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    cancelActionContent: {
      flex: 1,
    },
    cancelActionTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    cancelActionText: {
      marginTop: 2,
      color: muted,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
    },
    cancelActionArrow: {
      width: 34,
      height: 34,
      right: 16,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    projectMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
    },
    viewAllLink: {
      fontSize: 11,
      color: theme.colors.primary,
      fontWeight: '700',
    },
  });
};
