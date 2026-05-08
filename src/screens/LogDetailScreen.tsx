import React, {useMemo} from 'react';
import {
 ScrollView,
 StyleSheet,
 Text,
 View,
} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useRoute} from '@react-navigation/native';
import {TopHeader} from '../components/TopHeader';
import {useAppTheme} from '../context/ThemeContext';
import {LogEntry} from '../context/LogsContext';
import {minutesToHours, parseTimeToMinutes} from '../utils/time';
import {AppTheme} from '../theme';
import {LatLng, WORK_LOCATION} from '../constants/workLocation';

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

const formatDistance = (meters?: number | null) => {
 if (!meters || meters <= 0) return 'Not available';
 if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
 return `${Math.round(meters)} m`;
};

const formatRouteDuration = (seconds?: number | null) => {
 if (!seconds || seconds <= 0) return 'Not available';
 const minutes = Math.round(seconds / 60);
 const hours = Math.floor(minutes / 60);
 const remainder = minutes % 60;
 if (hours <= 0) return `${minutes}m`;
 return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

const getValidCoordinate = (value?: LatLng | null): LatLng | null => {
 if (
  value &&
  Number.isFinite(value.latitude) &&
  Number.isFinite(value.longitude)
 ) {
  return value;
 }
 return null;
};

const getMapRegion = (points: LatLng[]) => {
 if (points.length === 0) {
  return {
   latitude: WORK_LOCATION.latitude,
   longitude: WORK_LOCATION.longitude,
   latitudeDelta: 0.04,
   longitudeDelta: 0.04,
  };
 }

 const latitudes = points.map(point => point.latitude);
 const longitudes = points.map(point => point.longitude);
 const minLat = Math.min(...latitudes);
 const maxLat = Math.max(...latitudes);
 const minLng = Math.min(...longitudes);
 const maxLng = Math.max(...longitudes);

 return {
  latitude: (minLat + maxLat) / 2,
  longitude: (minLng + maxLng) / 2,
  latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.02),
  longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.02),
 };
};

export const LogDetailScreen = () => {
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
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
 const fromCoords = getValidCoordinate(log.fromCoords);
 const toCoords = getValidCoordinate(log.toCoords);
 const routePoints: LatLng[] = Array.isArray(log.routePoints)
  ? log.routePoints
     .map(point => getValidCoordinate(point))
     .filter((point): point is LatLng => Boolean(point))
  : [];
 const stops = Array.isArray(log.stops)
  ? log.stops.filter(stop => Boolean(getValidCoordinate(stop)))
  : [];
 const markerPoints = [
  fromCoords,
  toCoords,
  ...stops,
  ...(routePoints.length > 0 ? routePoints : []),
 ].filter((point): point is LatLng => Boolean(point));
 const hasTravelDetails =
  Boolean(log.fromLocation || log.toLocation) ||
  markerPoints.length > 0 ||
  Boolean(log.routeSummary) ||
  Boolean(log.routeDistanceMeters) ||
  Boolean(log.routeDurationSeconds);
 const mapRegion = getMapRegion(markerPoints);

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title={hasTravelDetails ? 'Travel Log Detail' : 'Log Detail'} />

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
     {hasTravelDetails && (
      <View style={styles.detailCard}>
       <View style={styles.cardHeader}>
        <Text allowFontScaling={false} style={styles.cardIcon}>
         📍
        </Text>
        <Text allowFontScaling={false} style={styles.cardTitle}>
         Travel Route
        </Text>
       </View>

       {markerPoints.length > 0 ? (
        <View style={styles.mapWrap}>
         <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={mapRegion}
          region={mapRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}>
          {routePoints.length > 1 && (
           <Polyline
            coordinates={routePoints}
            strokeColor={theme.colors.primary}
            strokeWidth={4}
           />
          )}
          {fromCoords && (
           <Marker
            coordinate={fromCoords}
            title="From"
            description={`${fromCoords.latitude.toFixed(
             6,
            )}, ${fromCoords.longitude.toFixed(6)}`}
            pinColor="#2563EB"
           />
          )}
          {toCoords && (
           <Marker
            coordinate={toCoords}
            title="To"
            description={`${toCoords.latitude.toFixed(
             6,
            )}, ${toCoords.longitude.toFixed(6)}`}
            pinColor="#DC2626"
           />
          )}
          {stops.map((stop, index) => (
           <Marker
            key={`${stop.latitude}-${stop.longitude}-${index}`}
            coordinate={stop}
            title={stop.label || `Stop ${index + 1}`}
            description={`${stop.latitude.toFixed(6)}, ${stop.longitude.toFixed(
             6,
            )}`}
            pinColor="#F59E0B"
           />
          ))}
         </MapView>
        </View>
       ) : (
        <Text allowFontScaling={false} style={styles.mutedText}>
         Route coordinates are not available for this log.
        </Text>
       )}

       <View style={styles.routeDetails}>
        <Text allowFontScaling={false} style={styles.detailValue}>
         <Text allowFontScaling={false} style={styles.detailLabel}>
          From:{' '}
         </Text>
         {log.fromLocation || 'Not available'}
        </Text>
        {fromCoords && (
         <Text allowFontScaling={false} style={styles.coordinateText}>
          Lat {fromCoords.latitude.toFixed(6)} · Long{' '}
          {fromCoords.longitude.toFixed(6)}
         </Text>
        )}
        <Text allowFontScaling={false} style={styles.detailValue}>
         <Text allowFontScaling={false} style={styles.detailLabel}>
          To:{' '}
         </Text>
         {log.toLocation || 'Not available'}
        </Text>
        {toCoords && (
         <Text allowFontScaling={false} style={styles.coordinateText}>
          Lat {toCoords.latitude.toFixed(6)} · Long{' '}
          {toCoords.longitude.toFixed(6)}
         </Text>
        )}
        <View style={styles.routeMetricRow}>
         <View style={styles.routeMetric}>
          <Text allowFontScaling={false} style={styles.timeLabel}>
           Distance
          </Text>
          <Text allowFontScaling={false} style={styles.timeValue}>
           {formatDistance(log.routeDistanceMeters)}
          </Text>
         </View>
         <View style={styles.routeMetric}>
          <Text allowFontScaling={false} style={styles.timeLabel}>
           Travel Time
          </Text>
          <Text allowFontScaling={false} style={styles.timeValue}>
           {formatRouteDuration(log.routeDurationSeconds)}
          </Text>
         </View>
        </View>
        {log.routeSummary ? (
         <Text allowFontScaling={false} style={styles.notesContent}>
          {log.routeSummary}
         </Text>
        ) : null}
       </View>
      </View>
     )}

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
  mapWrap: {
   height: 220,
   borderRadius: 12,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor,
   marginBottom: 14,
   backgroundColor: theme.colors.surface,
  },
  map: {
   flex: 1,
  },
  routeDetails: {
   gap: 6,
  },
  routeMetricRow: {
   flexDirection: 'row',
   gap: 12,
   marginVertical: 8,
  },
  routeMetric: {
   flex: 1,
   borderWidth: 1,
   borderColor,
   borderRadius: 10,
   padding: 12,
   backgroundColor: theme.colors.surface,
  },
  coordinateText: {
   color: theme.colors.muted,
   fontSize: 12,
   fontWeight: '600',
   marginTop: -4,
   marginBottom: 8,
  },
  mutedText: {
   color: theme.colors.muted,
   fontSize: 13,
   fontWeight: '600',
   marginBottom: 12,
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
