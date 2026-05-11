import React, {useMemo} from 'react';
import {
 ScrollView,
 StyleSheet,
 Text,
 View,
 TouchableOpacity,
 StatusBar,
} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useRoute, useNavigation} from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import Animated, {FadeInUp} from 'react-native-reanimated';

import {TopHeader} from '../components/TopHeader';
import {AnimatedCard} from '../components/ui';
import {useAppTheme} from '../context/ThemeContext';
import {LogEntry} from '../context/LogsContext';
import {minutesToHours, parseTimeToMinutes} from '../utils/time';
import {AppTheme} from '../theme';
import {LatLng, WORK_LOCATION} from '../constants/workLocation';

const getCategoryIcon = (key: string) => {
 switch (key) {
  case 'Meeting':
   return 'users';
  case 'Field':
   return 'map-pin';
  case 'Offline':
   return 'wifi-off';
  default:
   return 'tag';
 }
};

const getCategoryColor = (key: string) => {
 switch (key) {
  case 'Meeting':
   return '#3B82F6'; // blue
  case 'Field':
   return '#10B981'; // green
  case 'Offline':
   return '#F59E0B'; // yellow
  default:
   return '#6366F1'; // indigo
 }
};

const getStatusConfig = (status: string) => {
 switch (status.toLowerCase()) {
  case 'approved':
   return {color: '#10B981', label: 'APPROVED', icon: 'check-circle'};
  case 'rejected':
   return {color: '#EF4444', label: 'REJECTED', icon: 'x-circle'};
  case 'review':
   return {color: '#F59E0B', label: 'PENDING', icon: 'clock'};
  default:
   return {color: '#6B7280', label: 'UNKNOWN', icon: 'help-circle'};
 }
};

const getDurationText = (start: string, end: string) => {
 const s = parseTimeToMinutes(start);
 const e = parseTimeToMinutes(end);
 if (s === null || e === null) return '0h 0m';
 return minutesToHours(e - s);
};

const formatDisplayDate = (dateStr: string) => {
 const date = new Date(dateStr);
 if (isNaN(date.getTime())) return dateStr;
 return date.toLocaleDateString([], {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
 });
};

const getDateFromKey = (dateStr: string) => {
 const parts = dateStr.split('-').map(Number);
 if (parts.length === 3 && parts.every(Number.isFinite)) {
  return new Date(parts[0], parts[1] - 1, parts[2]);
 }

 const parsed = new Date(dateStr);
 return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatLongDate = (date: Date) =>
 date.toLocaleDateString([], {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
 });

const formatTimeToAmPm = (time: string) => {
 const minutes = parseTimeToMinutes(time);
 if (minutes === null) {
  return time || 'N/A';
 }

 const hours = Math.floor(minutes / 60);
 const mins = minutes % 60;
 const suffix = hours >= 12 ? 'PM' : 'AM';
 const displayHour = hours % 12 || 12;

 return `${displayHour}:${String(mins).padStart(2, '0')} ${suffix}`;
};

const getDateTimeDisplay = (dateStr: string, time: string, offsetDays = 0) => {
 const date = getDateFromKey(dateStr);
 date.setDate(date.getDate() + offsetDays);

 return {
  date: formatLongDate(date),
  time: formatTimeToAmPm(time),
 };
};

const formatDistance = (meters?: number | null) => {
 if (!meters || meters <= 0) return 'N/A';
 if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
 return `${Math.round(meters)} m`;
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

const cleanNotesText = (value: unknown): string => {
 if (typeof value !== 'string') {
  return '';
 }

 const trimmed = value.trim();
 const normalized = trimmed.toLowerCase();
 if (
  [
   'billable',
   'is_billable',
   'non-billable',
   'non_billable',
   'non billable',
  ].includes(normalized)
 ) {
  return '';
 }

 return trimmed;
};

const getValidCoordinate = (value?: LatLng | null): LatLng | null => {
 if (
  value &&
  Number.isFinite(value.latitude) &&
  Number.isFinite(value.longitude) &&
  value.latitude !== 0 &&
  value.longitude !== 0
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
  latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
  longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
 };
};

export const LogDetailScreen = () => {
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const route = useRoute<any>();
 const navigation = useNavigation();
 const log: LogEntry = route.params?.log;

 if (!log) {
  return (
   <SafeAreaView style={styles.safe}>
    <TopHeader title="Log Detail" />
    <View style={styles.center}>
     <Feather name="alert-circle" size={48} color={theme.colors.danger} />
     <Text style={styles.errorText}>Log not found</Text>
     <TouchableOpacity
      style={styles.backButton}
      onPress={() => navigation.goBack()}>
      <Text style={styles.backButtonText}>Go Back</Text>
     </TouchableOpacity>
    </View>
   </SafeAreaView>
  );
 }

 const duration = getDurationText(log.startTime, log.endTime);
 const statusConfig = getStatusConfig(log.status);
 const categoryColor = getCategoryColor(log.category);
 const isBillable = parseBillableStatus(log.billable);
 const cleanNotes = cleanNotesText(log.notes);
 const startMinutes = parseTimeToMinutes(log.startTime);
 const endMinutes = parseTimeToMinutes(log.endTime);
 const endDayOffset =
  startMinutes !== null && endMinutes !== null && endMinutes < startMinutes
   ? 1
   : 0;
 const startDateTime = getDateTimeDisplay(log.date, log.startTime);
 const endDateTime = getDateTimeDisplay(log.date, log.endTime, endDayOffset);
 const billableHighlightColor = isBillable
  ? theme.colors.success
  : theme.colors.danger;
 const billableLabel = isBillable ? 'Billable' : 'Non-Billable';

 const fromCoords = getValidCoordinate(log.fromCoords);
 const toCoords = getValidCoordinate(log.toCoords);
 const routePoints: LatLng[] = Array.isArray(log.routePoints)
  ? log.routePoints
     .map(point => getValidCoordinate(point))
     .filter((point): point is LatLng => Boolean(point))
  : [];

 const markerPoints = [
  fromCoords,
  toCoords,
  ...(routePoints.length > 0 ? routePoints : []),
 ].filter((point): point is LatLng => Boolean(point));

 const hasMap = markerPoints.length > 0;
 const mapRegion = getMapRegion(markerPoints);

 return (
  <SafeAreaView style={styles.safe}>
   <StatusBar barStyle="light-content" />
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title="Log Details" />

   <ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerStyle={styles.scrollContent}>
    {/* Hero Section */}
    <Animated.View
     entering={FadeInUp.delay(100).duration(600)}
     style={styles.heroSection}>
     <LinearGradient
      colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.heroGradient}>
      <View
       style={[styles.heroGlow, {backgroundColor: categoryColor + '1A'}]}
      />
      <View style={styles.heroHeader}>
       <View
        style={[
         styles.categoryIconContainer,
         {borderColor: categoryColor + '4D'},
        ]}>
        <Feather
         name={getCategoryIcon(log.category)}
         size={26}
         color={categoryColor}
        />
       </View>
       <View
        style={[
         styles.statusBadge,
         {
          borderColor: statusConfig.color + '4D',
          backgroundColor: statusConfig.color + '1A',
         },
        ]}>
        <Feather
         name={statusConfig.icon}
         size={12}
         color={statusConfig.color}
        />
        <Text style={[styles.statusBadgeText, {color: statusConfig.color}]}>
         {statusConfig.label}
        </Text>
       </View>
      </View>

      <Text style={styles.heroTitle}>{log.category} Session</Text>
      <Text style={styles.heroSubtitle}>{formatDisplayDate(log.date)}</Text>

      <View style={styles.heroStatsRow}>
       <View style={styles.heroStatItem}>
        <Text style={styles.heroStatLabel}>Duration</Text>
        <Text style={styles.heroStatValue}>{duration}</Text>
       </View>
       <View style={styles.heroStatDivider} />
       {/* <View style={styles.heroStatItem}>
        <Text style={styles.heroStatLabel}>Billable Status</Text>
        <View style={styles.billableBadgeContainer}>
         <Feather
          name={isBillable ? 'check-circle' : 'slash'}
          size={14}
          color={isBillable ? theme.colors.success : theme.colors.muted}
         />
         <Text
          style={[
           styles.heroStatValue,
           {
            color: isBillable ? theme.colors.success : theme.colors.muted,
            marginLeft: 6,
           },
          ]}>
          {isBillable ? 'BILLABLE' : 'NON-BILLABLE'}
         </Text>
        </View>
       </View> */}
      </View>
     </LinearGradient>
    </Animated.View>

    {/* Project Card */}
    <AnimatedCard delay={200} style={styles.infoCard}>
     <View style={styles.cardHeader}>
      <View
       style={[styles.cardIconBox, {backgroundColor: 'rgba(99,102,241,0.1)'}]}>
       <Feather name="briefcase" size={18} color="#6366F1" />
      </View>
      <Text style={styles.cardTitle}>Project Information</Text>
     </View>
     <View style={styles.projectInfo}>
      <Text style={styles.infoLabel}>PROJECT NAME</Text>
      <Text style={styles.infoValue}>{log.projectName}</Text>
      <View style={styles.divider} />
      <Text style={styles.infoLabel}>BILLABLE STATUS</Text>
      <View
       style={[
        styles.projectBillableBadge,
        {
         backgroundColor: billableHighlightColor + '1A',
         borderColor: billableHighlightColor + '66',
        },
       ]}>
       <Feather
        name={isBillable ? 'check-circle' : 'slash'}
        size={14}
        color={billableHighlightColor}
       />
       <Text
        style={[styles.projectBillableText, {color: billableHighlightColor}]}>
        {billableLabel}
       </Text>
      </View>
      {log.taskName && (
       <>
        <View style={styles.divider} />
        <Text style={styles.infoLabel}>DESCRIPTION</Text>
        <Text style={styles.infoValue}>{log.taskName}</Text>
       </>
      )}
     </View>
    </AnimatedCard>

    {/* Time Card */}
    <AnimatedCard delay={300} style={styles.infoCard}>
     <View style={styles.cardHeader}>
      <View
       style={[styles.cardIconBox, {backgroundColor: 'rgba(245,158,11,0.1)'}]}>
       <Feather name="clock" size={18} color="#F59E0B" />
      </View>
      <Text style={styles.cardTitle}>Time Range</Text>
     </View>
     <View style={styles.timeGrid}>
      <View style={styles.timeItem}>
       <Text style={styles.timeLabel}>START</Text>
       <Text style={styles.timeDateValue}>{startDateTime.date}</Text>
       <Text style={styles.timeValue}>{startDateTime.time}</Text>
      </View>
      <View style={styles.timeConnector}>
       <Feather name="arrow-right" size={16} color={theme.colors.muted} />
      </View>
      <View style={styles.timeItem}>
       <Text style={styles.timeLabel}>END</Text>
       <Text style={styles.timeDateValue}>{endDateTime.date}</Text>
       <Text style={styles.timeValue}>{endDateTime.time}</Text>
      </View>
     </View>
    </AnimatedCard>

    {/* Map Section if available */}
    {hasMap && (
     <AnimatedCard delay={400} style={styles.mapCard}>
      <View style={styles.cardHeader}>
       <View
        style={[styles.cardIconBox, {backgroundColor: 'rgba(16,185,129,0.1)'}]}>
        <Feather name="map" size={18} color="#10B981" />
       </View>
       <Text style={styles.cardTitle}>Travel Route</Text>
      </View>
      <View style={styles.mapWrap}>
       <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={mapRegion}
        region={mapRegion}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}>
        {routePoints.length > 1 && (
         <Polyline
          coordinates={routePoints}
          strokeColor={theme.colors.primary}
          strokeWidth={4}
         />
        )}
        {fromCoords && (
         <Marker coordinate={fromCoords} title="From" pinColor="#3B82F6" />
        )}
        {toCoords && (
         <Marker coordinate={toCoords} title="To" pinColor="#EF4444" />
        )}
       </MapView>
      </View>
      <View style={styles.locationDetails}>
       <View style={styles.locationItem}>
        <View style={[styles.dot, {backgroundColor: '#3B82F6'}]} />
        <View style={styles.locationTextContainer}>
         <Text style={styles.infoLabel}>FROM</Text>
         <Text style={styles.locationText}>
          {log.fromLocation || 'Unknown Location'}
         </Text>
        </View>
       </View>
       <View style={styles.locationItem}>
        <View style={[styles.dot, {backgroundColor: '#EF4444'}]} />
        <View style={styles.locationTextContainer}>
         <Text style={styles.infoLabel}>TO</Text>
         <Text style={styles.locationText}>
          {log.toLocation || 'Unknown Location'}
         </Text>
        </View>
       </View>
       <View style={styles.routeMetricRow}>
        <View style={styles.routeMetric}>
         <Feather name="activity" size={14} color={theme.colors.muted} />
         <Text style={styles.routeMetricText}>
          {formatDistance(log.routeDistanceMeters)}
         </Text>
        </View>
       </View>
      </View>
     </AnimatedCard>
    )}

    {/* Notes Card */}
    {cleanNotes ? (
     <AnimatedCard delay={500} style={styles.infoCard}>
      <View style={styles.cardHeader}>
       <View
        style={[styles.cardIconBox, {backgroundColor: 'rgba(16,185,129,0.1)'}]}>
        <Feather name="edit-3" size={18} color="#10B981" />
       </View>
       <Text style={styles.cardTitle}>Notes & Agenda</Text>
      </View>
      <View style={styles.notesContainer}>
       <Text style={styles.notesText}>{cleanNotes}</Text>
      </View>
     </AnimatedCard>
    ) : null}

    {/* Footer info */}
   </ScrollView>
  </SafeAreaView>
 );
};

const createStyles = (theme: AppTheme) => {
 const borderColor = theme.colors.border;
 const glassCard = theme.colors.card;
 const glassSurface = theme.colors.surface;
 const muted = theme.colors.muted;

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
   paddingBottom: 40,
  },
  center: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
   padding: 20,
  },
  errorText: {
   marginTop: 16,
   color: theme.colors.text,
   fontSize: 18,
   fontWeight: '700',
  },
  backButton: {
   marginTop: 24,
   paddingHorizontal: 30,
   paddingVertical: 12,
   backgroundColor: theme.colors.primary,
   borderRadius: 12,
  },
  backButtonText: {
   color: '#FFF',
   fontSize: 16,
   fontWeight: '700',
  },
  heroSection: {
   marginTop: 20,
   marginBottom: 20,
   borderRadius: 28,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.12)',
   backgroundColor: 'rgba(255,255,255,0.03)',
  },
  heroGradient: {
   padding: 24,
   borderRadius: 28,
  },
  heroGlow: {
   position: 'absolute',
   top: -100,
   right: -100,
   width: 250,
   height: 250,
   borderRadius: 125,
   backgroundColor: 'rgba(255,255,255,0.03)',
   filter: 'blur(50px)',
  },
  heroHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'flex-start',
   marginBottom: 20,
  },
  categoryIconContainer: {
   width: 52,
   height: 52,
   borderRadius: 18,
   backgroundColor: 'rgba(255,255,255,0.08)',
   alignItems: 'center',
   justifyContent: 'center',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.15)',
  },
  statusBadge: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 12,
   paddingVertical: 6,
   borderRadius: 12,
   gap: 6,
   backgroundColor: 'rgba(255,255,255,0.08)',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.1)',
  },
  statusBadgeText: {
   color: '#FFF',
   fontSize: 11,
   fontWeight: '800',
   letterSpacing: 0.5,
  },
  heroTitle: {
   fontSize: 28,
   fontWeight: '800',
   color: '#FFF',
   marginBottom: 4,
   letterSpacing: -0.5,
  },
  heroSubtitle: {
   fontSize: 14,
   color: 'rgba(255,255,255,0.6)',
   fontWeight: '600',
   marginBottom: 24,
  },
  heroStatsRow: {
   flexDirection: 'row',
   alignItems: 'center',
   backgroundColor: 'rgba(255,255,255,0.06)',
   borderRadius: 20,
   padding: 16,
   gap: 12,
  },
  heroStatItem: {
   flex: 1,
  },
  heroStatLabel: {
   fontSize: 10,
   color: 'rgba(255,255,255,0.5)',
   fontWeight: '700',
   textTransform: 'uppercase',
   letterSpacing: 1,
   marginBottom: 4,
  },
  heroStatValue: {
   fontSize: 16,
   color: '#FFF',
   fontWeight: '800',
  },
  heroStatDivider: {
   width: 1,
   height: 30,
   backgroundColor: 'rgba(255,255,255,0.1)',
   marginHorizontal: 4,
  },
  billableBadgeContainer: {
   flexDirection: 'row',
   alignItems: 'center',
  },
  infoCard: {
   backgroundColor: 'rgba(255,255,255,0.04)',
   borderRadius: 24,
   padding: 20,
   marginBottom: 16,
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 12,
   marginBottom: 20,
  },
  cardIconBox: {
   width: 40,
   height: 40,
   borderRadius: 14,
   alignItems: 'center',
   justifyContent: 'center',
  },
  cardTitle: {
   fontSize: 16,
   fontWeight: '800',
   color: theme.colors.text,
   letterSpacing: -0.3,
  },
  projectInfo: {
   gap: 4,
  },
  infoLabel: {
   fontSize: 11,
   color: muted,
   fontWeight: '800',
   letterSpacing: 0.5,
  },
  infoValue: {
   fontSize: 16,
   color: theme.colors.text,
   fontWeight: '700',
   marginBottom: 4,
  },
  projectBillableBadge: {
   alignSelf: 'flex-start',
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
   borderWidth: 1,
   borderRadius: 12,
   paddingHorizontal: 12,
   paddingVertical: 7,
   marginTop: 4,
  },
  projectBillableText: {
   fontSize: 13,
   fontWeight: '800',
  },
  divider: {
   height: 1,
   backgroundColor: borderColor,
   marginVertical: 12,
  },
  timeGrid: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   paddingHorizontal: 10,
  },
  timeItem: {
   alignItems: 'center',
   flex: 1,
  },
  timeLabel: {
   fontSize: 10,
   color: muted,
   fontWeight: '800',
   marginBottom: 6,
  },
  timeValue: {
   fontSize: 18,
   color: theme.colors.text,
   fontWeight: '800',
   textAlign: 'center',
  },
  timeDateValue: {
   fontSize: 12,
   color: muted,
   fontWeight: '700',
   textAlign: 'center',
   marginBottom: 4,
  },
  timeConnector: {
   paddingHorizontal: 12,
  },
  mapCard: {
   backgroundColor: glassCard,
   borderRadius: 20,
   padding: 20,
   marginBottom: 16,
   borderWidth: 1,
   borderColor,
  },
  mapWrap: {
   height: 200,
   borderRadius: 16,
   overflow: 'hidden',
   marginBottom: 16,
   borderWidth: 1,
   borderColor,
  },
  map: {
   flex: 1,
  },
  locationDetails: {
   gap: 14,
  },
  locationItem: {
   flexDirection: 'row',
   alignItems: 'flex-start',
   gap: 12,
  },
  dot: {
   width: 10,
   height: 10,
   borderRadius: 5,
   marginTop: 14,
  },
  locationTextContainer: {
   flex: 1,
  },
  locationText: {
   fontSize: 14,
   color: theme.colors.text,
   fontWeight: '600',
   lineHeight: 20,
  },
  routeMetricRow: {
   flexDirection: 'row',
   marginTop: 4,
   paddingLeft: 22,
  },
  routeMetric: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
   backgroundColor: glassSurface,
   paddingHorizontal: 10,
   paddingVertical: 4,
   borderRadius: 8,
  },
  routeMetricText: {
   fontSize: 12,
   color: muted,
   fontWeight: '700',
  },
  notesContainer: {
   backgroundColor: glassSurface,
   borderRadius: 12,
   padding: 14,
   borderWidth: 1,
   borderColor,
  },
  notesText: {
   fontSize: 14,
   color: theme.colors.text,
   lineHeight: 22,
   fontWeight: '500',
  },
  footer: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   gap: 8,
   marginTop: 8,
   marginBottom: 20,
  },
  footerText: {
   fontSize: 12,
   color: muted,
   fontWeight: '600',
  },
 });
};
