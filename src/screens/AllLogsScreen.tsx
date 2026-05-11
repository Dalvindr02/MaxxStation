import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import moment from 'moment';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { TopHeader } from '../components/TopHeader';
import { ThemedIOSDateTimePicker } from '../components/ThemedIOSDateTimePicker';
import { useAppTheme } from '../context/ThemeContext';
import { Platform } from 'react-native';
import { AppTheme } from '../theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchLogs } from '../store/logSlice';
import { fetchTravelLogs } from '../store/travelLogSlice';
import { AnimatedCard } from '../components/ui';

type LogCategory = 'All' | 'Travel' | 'Manual';

type UnifiedLog = {
  id: string | number;
  type: 'manual' | 'travel';
  date: string;
  startTime: string;
  endTime: string;
  projectName: string;
  category: string;
  notes: string;
  billable: boolean;
  status: string;
  // Travel specific
  fromLocation?: string;
  toLocation?: string;
  distance?: string;
  duration?: string;
  rawItem: any;
};

const cleanAddress = (addr: string | undefined) => {
  if (!addr) return '';
  const parts = addr.split(',');
  if (parts.length > 0 && parts[0].includes('+')) {
    return parts.slice(1).join(',').trim();
  }
  return addr;
};

const FilterChip = ({
  label,
  active,
  onPress,
  theme,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: AppTheme;
  styles: any;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.filterChip,
      active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    ]}
    activeOpacity={0.8}>
    <Text
      style={[
        styles.filterChipText,
        { color: active ? '#FFFFFF' : theme.colors.muted },
      ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const LogListItem = ({
  item,
  theme,
  onPress,
  index,
  styles,
}: {
  item: UnifiedLog;
  theme: AppTheme;
  onPress: (item: UnifiedLog) => void;
  index: number;
  styles: any;
}) => {
  const isTravel = item.type === 'travel';

  return (
    <AnimatedCard delay={index * 50} style={styles.logCard}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => onPress(item)}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: isTravel ? '#3B82F620' : '#8B5CF620' },
            ]}>
            <Feather
              name={isTravel ? 'navigation' : 'edit-3'}
              size={16}
              color={isTravel ? '#3B82F6' : '#8B5CF6'}
            />
          </View>
          <View style={styles.cardMain}>
            <Text allowFontScaling={false} style={styles.projectTitle}>
              {item.projectName}
            </Text>
            <Text allowFontScaling={false} style={styles.timeLabel}>
              {item.startTime} {item.endTime ? `→ ${item.endTime}` : ''}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.status === 'approved'
                    ? '#10B98120'
                    : item.status === 'rejected'
                      ? '#EF444420'
                      : '#F59E0B20',
              },
            ]}>
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    item.status === 'approved'
                      ? '#10B981'
                      : item.status === 'rejected'
                        ? '#EF4444'
                        : '#F59E0B',
                },
              ]}>
              {(item.status || 'review').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          {isTravel ? (
            <View style={styles.travelRoute}>
              <Text numberOfLines={1} style={styles.routeText}>
                {cleanAddress(item.fromLocation) || 'Start'} → {cleanAddress(item.toLocation) || 'End'}
              </Text>
              <View style={styles.metricsRow}>
                {item.distance && (
                  <View style={styles.metric}>
                    <Feather name="map" size={10} color={theme.colors.muted} />
                    <Text style={styles.metricText}>{item.distance}</Text>
                  </View>
                )}
                {item.duration && (
                  <View style={styles.metric}>
                    <Feather name="clock" size={10} color={theme.colors.muted} />
                    <Text style={styles.metricText}>{item.duration}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.manualContent}>
              <Text style={styles.categoryText}>{item.category}</Text>
              {item.notes ? (
                <Text numberOfLines={1} style={styles.notesText}>
                  {item.notes}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: isTravel ? '#3B82F615' : '#8B5CF615',
                borderColor: isTravel ? '#3B82F630' : '#8B5CF630',
                borderWidth: 1,
              },
            ]}>
            <Text
              style={[
                styles.typeText,
                { color: isTravel ? '#60A5FA' : '#A78BFA' },
              ]}>
              {isTravel ? 'TRAVEL LOG' : 'MANUAL LOG'}
            </Text>
          </View>
          {item.billable && (
            <View style={styles.billableBadge}>
              <Feather name="dollar-sign" size={10} color="#10B981" />
              <Text style={styles.billableText}>Billable</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </AnimatedCard>
  );
};

export const AllLogsScreen = () => {
  const navigation = useNavigation<any>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useAppDispatch();

  const manualLogs = useAppSelector(state => state.logs.logs);
  const travelLogs = useAppSelector(state => state.travelLogs.travelLogs);
  const isLogsLoading = useAppSelector(state => state.logs.isLoading);
  const isTravelLoading = useAppSelector(state => state.travelLogs.isLoading);

  const [activeCategory, setActiveCategory] = useState<LogCategory>('All');
  const [selectedDate, setSelectedDate] = useState<moment.Moment | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  useEffect(() => {
    dispatch(fetchLogs());
    dispatch(fetchTravelLogs());
  }, [dispatch]);

  const unifiedLogs = useMemo(() => {
    const manual: UnifiedLog[] = (manualLogs || []).map(log => ({
      id: log.id,
      type: 'manual',
      date: log.date,
      startTime: log.startTime,
      endTime: log.endTime,
      projectName: log.projectName,
      category: log.category,
      notes: log.notes,
      billable: !!log.billable,
      status: log.status,
      rawItem: log,
    }));

    const travel: UnifiedLog[] = (travelLogs || []).map(log => ({
      id: log.id,
      type: 'travel',
      date: log.start_date,
      startTime: log.start_time?.slice(0, 5),
      endTime: log.end_date_time?.slice(11, 16),
      projectName: log.project_name || 'Project',
      category: 'Travel',
      notes: log.purpose || '',
      billable: true,
      status: 'approved',
      fromLocation: log.from_address,
      toLocation: log.to_address,
      distance: log.google_distance,
      duration: log.google_duration,
      rawItem: log,
    }));

    let combined = [...manual, ...travel];

    if (activeCategory === 'Travel') {
      combined = combined.filter(l => l.type === 'travel');
    } else if (activeCategory === 'Manual') {
      combined = combined.filter(l => l.type === 'manual');
    }

    if (selectedDate) {
      combined = combined.filter(l => moment(l.date).isSame(selectedDate, 'day'));
    }

    return combined.sort((a, b) => {
      const dateA = moment(`${a.date} ${a.startTime}`, 'YYYY-MM-DD HH:mm');
      const dateB = moment(`${b.date} ${b.startTime}`, 'YYYY-MM-DD HH:mm');
      return dateB.diff(dateA);
    });
  }, [manualLogs, travelLogs, activeCategory, selectedDate]);

  const handlePressLog = (item: UnifiedLog) => {
    if (item.type === 'travel') {
      navigation.navigate('TravelLogDetail', { id: item.id });
    } else {
      navigation.navigate('LogDetailScreen', { log: item.rawItem });
    }
  };

  const handleConfirmDate = (date: Date) => {
    setSelectedDate(moment(date));
    setDatePickerVisibility(false);
  };

  const handleIOSDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setTempDate(date);
  };

  const confirmIOSDate = () => {
    setSelectedDate(moment(tempDate));
    setDatePickerVisibility(false);
  };

  const clearDateFilter = () => setSelectedDate(null);

  const isLoading = isLogsLoading || isTravelLoading;

  const openDatePicker = () => {
    setTempDate(selectedDate ? selectedDate.toDate() : new Date());
    setDatePickerVisibility(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ padding: 14 }}>
        <TopHeader title="All Activity" />
      </View>

      <View style={styles.filterSection}>
        <View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['All', 'Travel', 'Manual'] as LogCategory[]}
            keyExtractor={item => item}
            contentContainerStyle={styles.categoryScroll}
            renderItem={({ item }) => (
              <FilterChip
                label={item === 'All' ? 'All Logs' : `${item} Logs`}
                active={activeCategory === item}
                onPress={() => setActiveCategory(item)}
                theme={theme}
                styles={styles}
              />
            )}
          />
        </View>

        <View style={styles.dateFilterRow}>
          <TouchableOpacity
            onPress={openDatePicker}
            style={styles.dateBtn}>
            <Feather name="calendar" size={14} color={theme.colors.primary} />
            <Text style={styles.dateBtnText}>
              {selectedDate ? selectedDate.format('MMM DD, YYYY') : 'Filter by Date'}
            </Text>
          </TouchableOpacity>
          {selectedDate && (
            <TouchableOpacity onPress={clearDateFilter} style={styles.clearBtn}>
              <Feather name="x" size={14} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator key="all-logs-loading" size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={unifiedLogs}
          renderItem={({ item, index }) => (
            <LogListItem
              item={item}
              theme={theme}
              onPress={handlePressLog}
              index={index % 10}
              styles={styles}
            />
          )}
          keyExtractor={item => `${item.type}-${item.id}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Feather name="inbox" size={48} color={theme.colors.muted} />
              <Text style={styles.emptyText}>No logs found</Text>
              <Text style={styles.emptySubText}>Try adjusting your filters</Text>
            </View>
          }
        />
      )}

      {Platform.OS === 'ios' ? (
        <ThemedIOSDateTimePicker
          visible={isDatePickerVisible}
          title="Select Date"
          value={tempDate}
          mode="date"
          onChange={handleIOSDateChange}
          onCancel={() => setDatePickerVisibility(false)}
          onConfirm={confirmIOSDate}
        />
      ) : (
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirmDate}
          onCancel={() => setDatePickerVisibility(false)}
          isDarkModeEnabled={theme.isDark}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  safe: {
    flex: 1,
  },
  filterSection: {
    paddingVertical: 12,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  logCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMain: {
    flex: 1,
  },
  projectTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  timeLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  cardBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  routeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
  },
  manualContent: {
    gap: 4,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  notesText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  billableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  billableText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 4,
  },
});
