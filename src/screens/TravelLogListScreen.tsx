import React, { useEffect, useMemo } from 'react';
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
import { TopHeader } from '../components/TopHeader';
import { useAppTheme } from '../context/ThemeContext';
import { AppTheme } from '../theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchTravelLogs, TravelLogEntry } from '../store/travelLogSlice';
import { AnimatedCard } from '../components/ui';

const cleanAddress = (addr: string | undefined) => {
  if (!addr) return '';
  // Split by comma and check if the first part is a Plus Code (contains +)
  const parts = addr.split(',');
  if (parts.length > 0 && parts[0].includes('+')) {
    return parts.slice(1).join(',').trim();
  }
  return addr;
};

const TravelLogListItem = ({
  item,
  theme,
  styles,
  onPress,
  index,
}: {
  item: TravelLogEntry;
  theme: AppTheme;
  styles: any;
  onPress: (item: TravelLogEntry) => void;
  index: number;
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const from = cleanAddress(item.from_address) || 'Start';
  const to = cleanAddress(item.to_address) || 'End';
  const address = `${from} → ${to}`;
  const isLongAddress = address.length > 50;

  return (
    <AnimatedCard delay={index * 100} style={styles.logCard}>
      <TouchableOpacity activeOpacity={0.84} onPress={() => onPress(item)}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <Feather name="navigation" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text
              allowFontScaling={false}
              style={styles.routeTitle}
              numberOfLines={isExpanded ? undefined : 1}>
              {address}
            </Text>
            <Text allowFontScaling={false} style={styles.routeMeta}>
              {formatDate(item.start_date)} • {item.start_time?.slice(0, 5)} –{' '}
              {item.end_date_time?.slice(11, 16)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.expandIconWrap}>
            <Feather
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.colors.muted}
            />
          </TouchableOpacity>
        </View>

        {/* Metric chips */}
        <View style={styles.metricRow}>
          {item.google_distance ? (
            <View style={styles.metricChip}>
              <Feather name="map" size={11} color={theme.colors.primary} />
              <Text allowFontScaling={false} style={styles.metricText}>
                {item.google_distance}
              </Text>
            </View>
          ) : null}

          {item.google_duration ? (
            <View style={styles.metricChip}>
              <Feather name="clock" size={11} color={theme.colors.primary} />
              <Text allowFontScaling={false} style={styles.metricText}>
                {item.google_duration}
              </Text>
            </View>
          ) : null}

          {item.project_name ? (
            <View style={styles.metricChip}>
              <Feather name="briefcase" size={11} color={theme.colors.primary} />
              <Text
                allowFontScaling={false}
                style={styles.metricText}
                numberOfLines={1}>
                {item.project_name}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Description / Summary */}
        {(item.description || item.purpose) && (
          <View style={styles.summaryContainer}>
            <Text
              allowFontScaling={false}
              style={styles.summaryText}
              numberOfLines={isExpanded ? undefined : 2}>
              {item.description || item.purpose}
            </Text>
            {(item.description?.length || 0) > 80 && !isExpanded && (
              <TouchableOpacity onPress={() => setIsExpanded(true)}>
                <Text style={styles.readMoreText}>Read More</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    </AnimatedCard>
  );
};

const formatDate = (dateKey?: string) => {
  if (!dateKey) return 'No date';
  const parsed = new Date(dateKey);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const TravelLogListScreen = () => {
  const navigation = useNavigation<any>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useAppDispatch();

  const { travelLogs, isLoading, error } = useAppSelector(
    state => state.travelLogs,
  );

  useEffect(() => {
    dispatch(fetchTravelLogs());
  }, [dispatch]);

  const handlePressLog = (item: TravelLogEntry) => {
    navigation.navigate('TravelLogDetail', { id: item.id });
  };

  const renderItem = ({ item, index }: { item: TravelLogEntry; index: number }) => (
    <TravelLogListItem
      item={item}
      theme={theme}
      styles={styles}
      onPress={handlePressLog}
      index={index % 10}
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
      />
      <View style={{ padding: 14 }}>
        <TopHeader title="Travel Logs" />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator key="travel-log-list-loading" size="large" color={theme.colors.primary} />
          <Text allowFontScaling={false} style={styles.loadingText}>
            Fetching travel logs...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Feather name="alert-circle" size={40} color={theme.colors.muted} />
          <Text allowFontScaling={false} style={styles.emptyText}>
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={travelLogs}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Feather name="map" size={48} color={theme.colors.muted} />
              <Text allowFontScaling={false} style={styles.emptyText}>
                No travel logs found.
              </Text>
              <Text allowFontScaling={false} style={styles.emptySubText}>
                Travel logs you create will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.9,
    },
    listContent: {
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 28,
      gap: 12,
    },
    logCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      padding: 16,
      marginBottom: 4, // Spacing handled by gap in FlatList but AnimatedCard adds some margin
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      marginTop: 2,
    },
    cardTitleWrap: {
      flex: 1,
    },
    routeTitle: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    routeMeta: {
      marginTop: 4,
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    expandIconWrap: {
      padding: 4,
      marginLeft: 4,
    },
    metricRow: {
      marginTop: 14,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metricChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    metricText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '700',
    },
    summaryContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.05)',
    },
    summaryText: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '500',
    },
    readMoreText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 4,
    },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      marginTop: 60,
    },
    loadingText: {
      marginTop: 12,
      color: theme.colors.muted,
      fontSize: 14,
      fontWeight: '600',
    },
    emptyText: {
      marginTop: 14,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
    emptySubText: {
      marginTop: 8,
      color: theme.colors.muted,
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
