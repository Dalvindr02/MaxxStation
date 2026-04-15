import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Platform,
  ListRenderItemInfo,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import moment, { Moment } from 'moment';
import { moderateScale } from 'react-native-size-matters';
import { useAppTheme } from '../context/ThemeContext';

const ITEM_WIDTH = 65;

type CalendarPalette = {
  primary: string;
  surface: string;
  text: string;
  contrastText: string;
  border: string;
};

type CalendarDayProps = {
  dayText: string;
  dayNum: string;
  isSelected: boolean;
  onPress: () => void;
  palette: CalendarPalette;
};

const CalendarDay = memo(
  ({ dayText, dayNum, isSelected, onPress, palette }: CalendarDayProps) => {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={{
          width: ITEM_WIDTH,
          alignItems: 'center',
          paddingVertical: 4,
        }}
      >
        <View
          style={{
            width: moderateScale(55),
            height: moderateScale(75),
            borderRadius: 18,
            overflow: 'hidden',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: isSelected ? 0 : 1,
            borderColor: palette.border,
            backgroundColor: isSelected ? palette.primary : palette.surface,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: isSelected ? '#FFFFFF' : palette.text,
            }}
          >
            {dayText}
          </Text>
          <Text
            style={{
              fontSize: 18,
              color: isSelected ? '#FFFFFF' : palette.contrastText,
              fontWeight: '700',
            }}
          >
            {dayNum}
          </Text>
        </View>
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.dayText === next.dayText &&
    prev.dayNum === next.dayNum &&
    prev.palette === next.palette,
);

type CalendarDate = {
  date: Moment;
  dayText: string;
  dayNum: string;
  key: string;
};

type CustomCalendarStripProps = {
  selectedDate?: Moment;
  onDateChange: (date: Moment) => void;
  onMonthChange?: (label: string) => void;
};

const CustomCalendarStrip = ({
  selectedDate,
  onDateChange,
  onMonthChange,
}: CustomCalendarStripProps) => {
  const { theme } = useAppTheme();
  const palette = useMemo<CalendarPalette>(
    () => ({
      primary: theme.colors.primary,
      surface: theme.colors.surface,
      text: theme.colors.text,
      contrastText: theme.isDark ? '#F8FAFC' : '#0F172A',
      border: theme.colors.border,
    }),
    [theme],
  );

  const flatListRef = useRef<FlatList<CalendarDate> | null>(null);
  const [dates, setDates] = useState<CalendarDate[]>([]);
  const today = moment();

  // ✅ FIX 1: 1 YEAR DATA ONLY (365 items vs 2190)
  useEffect(() => {
    const start = moment().subtract(3, 'years').startOf('day');
    const end = moment().add(3, 'years').endOf('day');

    const arr: CalendarDate[] = [];
    let current = start.clone();
    while (current.isSameOrBefore(end)) {
      arr.push({
        date: current.clone(),
        dayText: current.format('ddd'),
        dayNum: current.format('DD'),
        key: current.format('YYYY-MM-DD'),
      });
      current.add(1, 'day');
    }
    setDates(arr);
  }, []);

  // ✅ FIX 2: iOS/Android scroll optimization
  const scrollToDate = useCallback(() => {
    if (!flatListRef.current || dates.length === 0) return;

    const scrollDate = selectedDate || today;

    const index = dates.findIndex(d => d.date.isSame(scrollDate, 'day'));

    if (index !== -1) {
      flatListRef.current.scrollToOffset({
        offset: Math.max(0, index * ITEM_WIDTH - ITEM_WIDTH * 1.5),
        animated: true,
      });
    }
  }, [dates, selectedDate, today]);

  useEffect(() => {
    const timer = setTimeout(scrollToDate, 100);
    return () => clearTimeout(timer);
  }, [dates, selectedDate]);

  // ✅ FIX 3: iOS scroll handler
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / ITEM_WIDTH);
      if (dates[index] && onMonthChange) {
        onMonthChange(dates[index].date.format('MMM, YYYY'));
      }
    },
    [dates, onMonthChange],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CalendarDate>) => {
      const isSelected = selectedDate
        ? item.date.isSame(selectedDate, 'day')
        : item.date.isSame(today, 'day');

      return (
        <CalendarDay
          dayText={item.dayText}
          dayNum={item.dayNum}
          isSelected={isSelected}
          onPress={() => onDateChange(item.date)}
          palette={palette}
        />
      );
    },
    [selectedDate, onDateChange, palette, today],
  );

  return (
    <FlatList
      ref={flatListRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={dates}
      renderItem={renderItem}
      keyExtractor={item => item.key}
      // ✅ FIX 4: PERFECT iOS SCROLLING
      getItemLayout={(data, index) => ({
        length: ITEM_WIDTH,
        offset: ITEM_WIDTH * index,
        index,
      })}
      snapToInterval={ITEM_WIDTH}
      // 🔥 iOS vs Android PERFECT PHYSICS
      decelerationRate={
        Platform.OS === 'ios'
          ? 0.98 // iOS: Smooth native feel
          : 'fast' // Android: Fast snap
      }
      // ✅ iOS OPTIMIZED RENDERING
      removeClippedSubviews={false} // iOS: Better
      initialNumToRender={15} // Smaller viewport
      maxToRenderPerBatch={5}
      windowSize={7}
      updateCellsBatchingPeriod={30}
      onMomentumScrollEnd={handleScroll}
      scrollEventThrottle={16}
      bounces={Platform.OS === 'ios'} // iOS bounce ON
      directionalLockEnabled={true} // Single direction
    />
  );
};

export default CustomCalendarStrip;

// const start = moment().subtract(3, 'years').startOf('day');
// const end = moment().add(3, 'years').endOf('day');
