import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedCard } from '../components/ui';
import { TopHeader } from '../components/TopHeader';
import { useAppTheme } from '../context/ThemeContext';
import { AppTheme } from '../theme';
import { formatShortDate } from '../utils/date';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import LinearGradient from 'react-native-linear-gradient';
import Geolocation from 'react-native-geolocation-service';
import { check, PERMISSIONS, RESULTS, request } from 'react-native-permissions';
import {
  LatLng,
  WorkLocation,
  WORK_LOCATION,
  getDistanceMeters,
} from '../constants/workLocation';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDialog } from '../context/DialogContext';
import { useAttendance } from '../context/AttendanceContext';
import { lastNDays } from '../utils/date';
import NetInfo from '@react-native-community/netinfo';
import {
  NotificationBanner,
  NotificationBannerProps,
} from '../components/NotificationBanner';
import { SHIFT_WINDOW } from '../constants/shift';
import { parseTimeToMinutes } from '../utils/time';
import {
  notificationEvents,
  NotificationActionId,
  syncAttendanceNotifications,
} from '../services/notificationService';
import { LocationStatus } from '../types/attendance';
const formatNow = (baseDate?: Date) => {
  const now = baseDate ?? new Date();
  const time = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return { time, day };
};

const statusColor = (status: string) => {
  if (status === 'Late') return '#F97316';
  if (status === 'Present') return '#16A34A';
  if (status === 'Absent') return '#DC2626';
  return '#6B7280';
};

const toLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day);
};

const getDateLabel = (value: string) => {
  const date = toLocalDate(value);
  if (Number.isNaN(date.getTime())) return value;

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const dateStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diff = Math.floor(
    (todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
};

const MANUAL_REASON_PRESETS = [
  'Client onsite support',
  'Ops-approved remote work',
  'Travel disruption override',
] as const;

const formatMeters = (value: number | null) => {
  if (value == null) return null;
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toFixed(2)} km`;
};

type InlineNotification = NotificationBannerProps & { id: string };

const buildLocationVisual = (
  status: LocationStatus,
  distance: number | null,
  radius: number,
  locationError?: string | null,
) => {
  const formattedDistance = formatMeters(distance);
  switch (status) {
    case 'inside':
      return {
        icon: 'check-circle',
        message: 'You are at the work location',
        detail:
          formattedDistance != null
            ? `GPS lock ${formattedDistance} from geofence center`
            : `Inside the ${radius} m allowed radius`,
        backgroundColor: 'rgba(34,197,94,0.2)',
        borderColor: 'rgba(34,197,94,0.5)',
        textColor: 'green',
      };
    case 'outside':
      return {
        icon: 'alert-triangle',
        message: 'Outside the allowed radius',
        detail:
          formattedDistance != null
            ? `Currently about ${formattedDistance} away`
            : 'Step inside the marked area to proceed',
        backgroundColor: 'rgba(252,165,165,0.18)',
        borderColor: 'rgba(248,113,113,0.45)',
        textColor: 'red',
      };
    case 'denied':
      return {
        icon: 'slash',
        message: 'Location permission required',
        detail: 'Enable GPS/location access to mark attendance',
        backgroundColor: 'rgba(251,191,36,0.22)',
        borderColor: 'rgba(251,191,36,0.55)',
        textColor: '#FDE68A',
      };
    case 'error':
      return {
        icon: 'x-circle',
        message: 'Unable to verify location',
        detail: locationError || 'Please try refreshing your GPS lock',
        backgroundColor: 'rgba(248,113,113,0.2)',
        borderColor: 'rgba(248,113,113,0.45)',
        textColor: 'red',
      };
    default:
      return {
        icon: 'loader',
        message: 'Locking onto your location…',
        detail: 'This only takes a moment',
        backgroundColor: 'rgba(59,130,246,0.2)',
        borderColor: 'rgba(59,130,246,0.45)',
        textColor: 'blue',
      };
  }
};

export default function AttendanceScreen() {
  const { entries, markPresence, todayEntry } = useAttendance();
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>('checking');
  const [distanceFromOffice, setDistanceFromOffice] = useState<number | null>(
    null,
  );
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const locationPermission =
    Platform.OS === 'ios'
      ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
      : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
  const [currentCoords, setCurrentCoords] = useState<LatLng | null>(null);
  const [customLocation, setCustomLocation] = useState<LatLng | null>(null);
  const [selectedManualReason, setSelectedManualReason] = useState<
    string | null
  >(null);
  const [isCustomReasonMode, setIsCustomReasonMode] = useState(false);
  const [customManualReason, setCustomManualReason] = useState('');
  const [customLocationReason, setCustomLocationReason] = useState<
    string | null
  >(null);
  const activeWorkLocation: WorkLocation = useMemo(
    () =>
      customLocation
        ? {
            ...WORK_LOCATION,
            latitude: customLocation.latitude,
            longitude: customLocation.longitude,
            label: 'Temporary work site',
          }
        : WORK_LOCATION,
    [customLocation],
  );

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [systemTime, setSystemTime] = useState(Date.now());
  const clock = useMemo(() => formatNow(new Date(systemTime)), [systemTime]);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showDialog } = useDialog();
  const scrollRef = useRef<ScrollView | null>(null);
  const [manualCardOffset, setManualCardOffset] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const shiftStartMinutes = parseTimeToMinutes(SHIFT_WINDOW.start) ?? 540;
  const shiftEndMinutes = parseTimeToMinutes(SHIFT_WINDOW.end) ?? 1080;
  const hasMarkedIn = Boolean(todayEntry?.clockIn);
  const hasMarkedOut = Boolean(todayEntry?.clockOut);
  const now = useMemo(() => new Date(systemTime), [systemTime]);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const shiftHasStarted = nowMinutes >= shiftStartMinutes;
  const shiftNearEnd =
    nowMinutes >= shiftEndMinutes - SHIFT_WINDOW.wrapReminderMinutes &&
    nowMinutes < shiftEndMinutes;
  const shiftEnded = nowMinutes >= shiftEndMinutes;
  const graceDeadline = shiftStartMinutes + SHIFT_WINDOW.graceMinutes;
  const graceRemaining = Math.max(graceDeadline - nowMinutes, 0);
  const minutesRemaining = Math.max(shiftEndMinutes - nowMinutes, 0);
  const locationVisual = useMemo(
    () =>
      buildLocationVisual(
        locationStatus,
        distanceFromOffice,
        activeWorkLocation.radiusMeters,
        locationError,
      ),
    [distanceFromOffice, locationError, locationStatus, activeWorkLocation],
  );
  const lastCheckedLabel = useMemo(() => {
    if (!lastCheckedAt) return 'Never';
    return new Date(lastCheckedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [lastCheckedAt]);
  const canMarkPresence = locationStatus === 'inside';
  const isCheckingLocation = locationStatus === 'checking';
  const markButtonDisabled = !canMarkPresence || isCheckingLocation;
  const markButtonGradient = canMarkPresence
    ? [theme.colors.primary, theme.colors.secondary]
    : ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.08)'];
  const markButtonTitle = isCheckingLocation
    ? 'Checking location…'
    : canMarkPresence
    ? 'Mark Presence'
    : 'Reach work location';
  const markButtonSubtitle = isCheckingLocation
    ? 'Getting a precise GPS lock before attendance capture.'
    : canMarkPresence
    ? 'Your device is verified inside the work radius.'
    : locationStatus === 'outside'
    ? `Move inside the ${activeWorkLocation.radiusMeters} m attendance radius.`
    : locationStatus === 'denied'
    ? 'Enable GPS permissions to continue.'
    : locationStatus === 'error'
    ? locationError || 'Unable to verify GPS right now.'
    : 'Waiting for a stable location signal.';
  const coordinatesLabel = useMemo(() => {
    if (!currentCoords) {
      return 'Refresh location to capture accurate coordinates';
    }
    return `${currentCoords.latitude.toFixed(
      5,
    )}, ${currentCoords.longitude.toFixed(5)}`;
  }, [currentCoords]);
  const manualReasonValue = useMemo(() => {
    if (isCustomReasonMode) {
      return customManualReason.trim();
    }
    return selectedManualReason ?? '';
  }, [customManualReason, isCustomReasonMode, selectedManualReason]);
  const manualReasonReady = manualReasonValue.length > 0;
  const shouldShowManualCard =
    locationStatus !== 'inside' || Boolean(customLocation);
  const manualCardTitle = customLocation
    ? 'Temporary work site active'
    : 'Outside the mapped area?';
  const manualCardSubtitle = customLocation
    ? 'Update or reset the temporary pin once you are back in the default office.'
    : 'Share your current pin with operations or apply it as a temporary work site for today.';
  const canApplyManualLocation = Boolean(currentCoords) && manualReasonReady;

  const handleMarkPresence = () => {
    if (locationStatus === 'checking') {
      return;
    }
    if (!canMarkPresence) {
      showDialog({
        title: 'Cannot mark presence',
        message: `Move within ${activeWorkLocation.radiusMeters} m of ${activeWorkLocation.label} and refresh your GPS.`,
        variant: 'error',
        primaryAction: { label: 'Okay' },
      });
      return;
    }

    markPresence({
      locationStatus: 'at',
      workLocation: activeWorkLocation,
      distanceMeters: distanceFromOffice,
    });

    showDialog({
      title: 'Presence marked',
      message: 'Your attendance for today has been captured.',
      variant: 'success',
      primaryAction: { label: 'Okay' },
    });
  };

  const refreshLocation = useCallback(async () => {
    if (!locationPermission) {
      setLocationStatus('error');
      setLocationError('Location permission unavailable on this platform');
      return;
    }
    setIsRefreshingLocation(true);
    setLocationError(null);
    setLocationStatus('checking');
    try {
      let permissionStatus = await check(locationPermission);
      if (permissionStatus === RESULTS.DENIED) {
        permissionStatus = await request(locationPermission);
      }

      if (permissionStatus !== RESULTS.GRANTED) {
        setLocationStatus('denied');
        return;
      }

      await new Promise<void>(resolve => {
        Geolocation.getCurrentPosition(
          position => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            const distance = getDistanceMeters(coords, activeWorkLocation);
            setCurrentCoords(coords);
            setDistanceFromOffice(distance);
            setLastCheckedAt(Date.now());
            setLocationStatus(
              distance <= activeWorkLocation.radiusMeters
                ? 'inside'
                : 'outside',
            );
            resolve();
          },
          error => {
            setLocationStatus('error');
            setLocationError(error.message);
            resolve();
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 5000,
            forceRequestLocation: true,
            distanceFilter: 0,
          },
        );
      });
    } catch (error: any) {
      setLocationStatus('error');
      setLocationError(error?.message || 'Unexpected location error');
    } finally {
      setIsRefreshingLocation(false);
    }
  }, [locationPermission, activeWorkLocation]);

  const handleSelectManualPreset = (reason: string) => {
    setSelectedManualReason(reason);
    setIsCustomReasonMode(false);
    setCustomManualReason('');
  };

  const handleSwitchToCustomReason = () => {
    setIsCustomReasonMode(true);
    setSelectedManualReason(null);
  };

  const handleApplyCurrentLocation = () => {
    if (!currentCoords) {
      showDialog({
        title: 'No location captured',
        message: 'Refresh your GPS lock before using it as the work site.',
        variant: 'error',
        primaryAction: { label: 'Okay' },
      });
      return;
    }
    if (!manualReasonReady) {
      showDialog({
        title: 'Add a manual note',
        message:
          'Pick a quick note or write your own reason before applying this pin.',
        variant: 'warning',
        primaryAction: { label: 'Okay' },
      });
      return;
    }
    setCustomLocation(currentCoords);
    setCustomLocationReason(manualReasonValue);
    showDialog({
      title: 'Temporary location set',
      message: `Your current pin will be treated as the work site for this session. Reason noted: ${manualReasonValue}. Reset it once you are back at the default office.`,
      variant: 'success',
      primaryAction: { label: 'Got it' },
    });
  };

  const handleResetLocation = () => {
    setCustomLocation(null);
    setCustomLocationReason(null);
    showDialog({
      title: 'Location reset',
      message: `Reverted to ${WORK_LOCATION.label}.`,
      variant: 'info',
      primaryAction: { label: 'Okay' },
    });
  };

  const handleShareLocationRequest = async () => {
    if (!currentCoords) {
      showDialog({
        title: 'No location captured',
        message: 'Refresh your GPS lock before sharing coordinates.',
        variant: 'error',
        primaryAction: { label: 'Okay' },
      });
      return;
    }
    const manualNote = (customLocationReason ?? manualReasonValue) || 'N/A';
    const payload = `Location update requested for ${
      WORK_LOCATION.label
    }:\nLatitude: ${currentCoords.latitude.toFixed(
      6,
    )}\nLongitude: ${currentCoords.longitude.toFixed(
      6,
    )}\nDistance from pinned site: ${
      formatMeters(distanceFromOffice) ?? 'N/A'
    }\nManual note: ${manualNote}`;
    try {
      await Share.share({
        title: 'Share new work location',
        message: payload,
      });
    } catch {
      showDialog({
        title: 'Share unavailable',
        message: 'Unable to open the share sheet on this device.',
        variant: 'error',
        primaryAction: { label: 'Okay' },
      });
    }
  };

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);
  const last7 = lastNDays(7);
  const mappedHistory = last7
    .map(dateKey => {
      const entry = entries.find(e => e.date === dateKey);
      if (!entry) {
        return {
          date: dateKey,
          status: 'Absent',
        };
      }
      return entry;
    })
    .slice(0, 5);

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || state.isInternetReachable === false;
      setIsOffline(offline);
    });
    return unsubscribe;
  }, []);

  const refreshNetworkStatus = useCallback(() => {
    NetInfo.fetch().then(state => {
      const offline = !state.isConnected || state.isInternetReachable === false;
      setIsOffline(offline);
    });
  }, []);

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings().catch(() => null);
  }, []);

  const handleFocusManualCard = useCallback(() => {
    if (manualCardOffset == null) return;
    scrollRef.current?.scrollTo({
      y: Math.max(manualCardOffset - 24, 0),
      animated: true,
    });
  }, [manualCardOffset]);

  useEffect(() => {
    if (!shouldShowManualCard) {
      setManualCardOffset(null);
    }
  }, [shouldShowManualCard]);

  useEffect(() => {
    const handlerMap: Record<NotificationActionId, () => void> = {
      'open-manual-card': handleFocusManualCard,
      'refresh-location': () => refreshLocation(),
      'refresh-network': () => refreshNetworkStatus(),
      'mark-presence': () => handleMarkPresence(),
      'open-report': () => navigation.navigate('Report' as never),
    };

    (Object.keys(handlerMap) as NotificationActionId[]).forEach(action => {
      notificationEvents.on(action, handlerMap[action]);
    });

    return () => {
      (Object.keys(handlerMap) as NotificationActionId[]).forEach(action => {
        notificationEvents.off(action, handlerMap[action]);
      });
    };
  }, [
    handleFocusManualCard,
    handleMarkPresence,
    navigation,
    refreshLocation,
    refreshNetworkStatus,
  ]);

  const notifications = useMemo<InlineNotification[]>(() => {
    const items: InlineNotification[] = [];

    if (isOffline) {
      items.push({
        id: 'offline',
        variant: 'danger',
        title: 'You are offline',
        description:
          'Attendance, manual logs, and reports will sync automatically when the device reconnects.',
        icon: 'wifi-off',
        actions: [{ label: 'Retry connection', onPress: refreshNetworkStatus }],
      });
    }

    if (locationStatus === 'denied' || locationStatus === 'error') {
      items.push({
        id: 'location-permission',
        variant: 'warning',
        title: 'Location services needed',
        description:
          locationStatus === 'denied'
            ? 'Enable GPS permissions to mark your presence.'
            : locationError || 'We could not get a reliable GPS lock.',
        icon: 'map-pin',
        actions: [
          { label: 'Open settings', onPress: handleOpenSettings },
          { label: 'Retry', onPress: refreshLocation },
        ],
      });
    }

    if (locationStatus === 'outside') {
      items.push({
        id: 'outside-radius',
        variant: 'info',
        title: 'Outside mapped location',
        description:
          'Drop a temporary pin or move within the geofence before marking attendance.',
        icon: 'navigation-2',
        actions: [{ label: 'Add manual pin', onPress: handleFocusManualCard }],
      });
    }

    if (shiftHasStarted && !hasMarkedIn) {
      const inside = locationStatus === 'inside';
      const graceCopy =
        graceRemaining > 0
          ? `Mark presence within ${graceRemaining} min to stay on time.`
          : 'Mark presence immediately to avoid a late flag.';

      items.push({
        id: 'shift-start',
        variant: inside ? 'success' : 'warning',
        title: inside ? 'Shift is live' : 'Shift live • outside geofence',
        description: inside
          ? graceCopy
          : 'Refresh GPS once you are inside or add a manual note for ops.',
        icon: inside ? 'clock' : 'alert-triangle',
        actions: [
          inside
            ? { label: 'Mark presence', onPress: handleMarkPresence }
            : { label: 'Refresh GPS', onPress: refreshLocation },
        ],
      });
    }

    if ((shiftNearEnd || shiftEnded) && hasMarkedIn && !hasMarkedOut) {
      items.push({
        id: 'shift-end',
        variant: shiftEnded ? 'danger' : 'info',
        title: shiftEnded ? 'Shift end reached' : 'Shift wrapping soon',
        description: shiftEnded
          ? 'Clock out, sync logs, and file your E.O.D report.'
          : `About ${minutesRemaining} min left in your shift. Wrap up attendance + report.`,
        icon: 'log-out',
        actions: [
          {
            label: shiftEnded ? 'Wrap up day' : 'Review day',
            onPress: () => navigation.navigate('Report' as never),
          },
        ],
      });
    }

    return items;
  }, [
    graceRemaining,
    handleFocusManualCard,
    handleMarkPresence,
    handleOpenSettings,
    hasMarkedIn,
    hasMarkedOut,
    isOffline,
    locationError,
    locationStatus,
    minutesRemaining,
    navigation,
    refreshLocation,
    refreshNetworkStatus,
    shiftEnded,
    shiftHasStarted,
    shiftNearEnd,
  ]);

  useEffect(() => {
    syncAttendanceNotifications({
      offline: isOffline,
      locationStatus,
      canMarkPresence,
      shiftHasStarted,
      shiftNearEnd,
      shiftEnded,
      hasMarkedIn,
      hasMarkedOut,
      graceRemaining,
      minutesRemaining,
    }).catch(error =>
      console.warn('Attendance notification sync failed', error),
    );
  }, [
    canMarkPresence,
    graceRemaining,
    hasMarkedIn,
    hasMarkedOut,
    isOffline,
    locationStatus,
    minutesRemaining,
    shiftEnded,
    shiftHasStarted,
    shiftNearEnd,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
      />
      <TopHeader title="Attendance" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        {notifications.length ? (
          <View style={styles.notificationStack}>
            {notifications.map(notification => (
              <NotificationBanner
                key={notification.id}
                {...notification}
                style={styles.notificationBanner}
              />
            ))}
          </View>
        ) : null}
        <AnimatedCard style={styles.timeCard} delay={40}>
          <View style={styles.timeCardHeader}>
            <View>
              <Text allowFontScaling={false} style={styles.timeCardTitle}>
                Shift verification
              </Text>
            </View>
          </View>
          <Text allowFontScaling={false} style={styles.timeText}>
            {clock.time}
          </Text>
          <Text allowFontScaling={false} style={styles.dateText}>
            {clock.day}
          </Text>
          <TouchableOpacity
            style={[
              styles.markButtonWrap,
              markButtonDisabled && styles.markButtonWrapDisabled,
            ]}
            onPress={handleMarkPresence}
            activeOpacity={markButtonDisabled ? 1 : 0.9}
            disabled={markButtonDisabled}
          >
            <LinearGradient
              colors={markButtonGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.markButton}
            >
              <View style={styles.markButtonIconWrap}>
                {isCheckingLocation ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <MaterialCommunityIcons
                    name={
                      canMarkPresence
                        ? 'fingerprint'
                        : 'map-marker-alert-outline'
                    }
                    size={18}
                    color="#0F172A"
                  />
                )}
              </View>
              <View style={styles.markButtonContent}>
                <Text allowFontScaling={false} style={styles.markButtonText}>
                  {markButtonTitle}
                </Text>
                <Text allowFontScaling={false} style={styles.markButtonSubtext}>
                  {markButtonSubtitle}
                </Text>
              </View>
              <View style={styles.markButtonArrow}>
                <Feather
                  name={canMarkPresence ? 'arrow-up-right' : 'navigation'}
                  size={16}
                  color="#FFFFFF"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <Text allowFontScaling={false} style={styles.markButtonHint}>
            {locationStatus === 'outside'
              ? `Outside the ${activeWorkLocation.radiusMeters} m radius.`
              : locationStatus === 'denied'
              ? 'Enable GPS permissions to continue.'
              : locationStatus === 'error'
              ? locationError || 'Unable to verify GPS.'
              : locationStatus === 'checking'
              ? 'Waiting for a precise GPS lock…'
              : `Last verified at ${lastCheckedLabel}.`}
          </Text>
        </AnimatedCard>

        <AnimatedCard style={styles.card} delay={80}>
          <Text allowFontScaling={false} style={styles.sectionTitle}>
            Current Location
          </Text>
          <View style={styles.map}>
            <View style={styles.streetA} />
            <View style={styles.streetB} />
            <View style={styles.streetC} />
          </View>
          <View
            style={[
              styles.locationPill,
              {
                backgroundColor: locationVisual.backgroundColor,
                borderColor: locationVisual.borderColor,
              },
            ]}
          >
            <Feather
              name={locationVisual.icon as any}
              size={13}
              color={locationVisual.textColor}
            />
            <Text
              allowFontScaling={false}
              style={[
                styles.locationPillText,
                { color: locationVisual.textColor },
              ]}
            >
              {locationVisual.message}
            </Text>
          </View>
          <Text allowFontScaling={false} style={styles.locationDetail}>
            {locationVisual.detail}
          </Text>
          <Text allowFontScaling={false} style={styles.address}>
            {activeWorkLocation.label}
          </Text>
          {customLocation ? (
            <>
              <Text allowFontScaling={false} style={styles.addressSub}>
                {customLocation.latitude.toFixed(5)},{' '}
                {customLocation.longitude.toFixed(5)}
              </Text>
              <View style={styles.customLocationBanner}>
                <Feather
                  name="alert-circle"
                  size={12}
                  color={theme.colors.warning}
                />
                <View style={styles.customLocationBannerTextWrap}>
                  <Text
                    allowFontScaling={false}
                    style={styles.customLocationText}
                  >
                    Temporary pin active
                  </Text>
                  {customLocationReason ? (
                    <Text
                      allowFontScaling={false}
                      style={styles.customLocationReason}
                      numberOfLines={2}
                    >
                      Reason: {customLocationReason}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={handleResetLocation}>
                  <Text allowFontScaling={false} style={styles.resetLink}>
                    Reset
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
          <View style={styles.locationFooter}>
            <View style={styles.locationMetaRow}>
              <Feather name="map-pin" size={12} color={theme.colors.muted} />
              <Text allowFontScaling={false} style={styles.locationMetaText}>
                Radius {activeWorkLocation.radiusMeters} m • Last check{' '}
                {lastCheckedLabel}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshLocation}
              disabled={isRefreshingLocation}
            >
              {isRefreshingLocation ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Feather
                  name="refresh-ccw"
                  size={12}
                  color={theme.colors.primary}
                />
              )}
              <Text
                allowFontScaling={false}
                style={[
                  styles.refreshText,
                  isRefreshingLocation && { color: theme.colors.primary },
                ]}
              >
                {isRefreshingLocation ? 'Checking…' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>
        </AnimatedCard>

        {shouldShowManualCard ? (
          <View
            onLayout={event => setManualCardOffset(event.nativeEvent.layout.y)}
          >
            <AnimatedCard style={styles.card} delay={100}>
              <Text allowFontScaling={false} style={styles.sectionTitle}>
                {manualCardTitle}
              </Text>
              <Text allowFontScaling={false} style={styles.outsideHelperText}>
                {manualCardSubtitle}
              </Text>
              <View style={styles.coordinatesChip}>
                <Feather
                  name="navigation"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text allowFontScaling={false} style={styles.coordinatesValue}>
                  {coordinatesLabel}
                </Text>
              </View>
              <Text allowFontScaling={false} style={styles.manualReasonLabel}>
                Auto manual suggestions
              </Text>
              <View style={styles.reasonChipWrap}>
                {MANUAL_REASON_PRESETS.map(reason => {
                  const isActive =
                    !isCustomReasonMode && selectedManualReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonChip,
                        isActive && styles.reasonChipActive,
                      ]}
                      onPress={() => handleSelectManualPreset(reason)}
                      activeOpacity={0.85}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.reasonChipText,
                          isActive && styles.reasonChipTextActive,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[
                    styles.reasonChip,
                    isCustomReasonMode && styles.reasonChipActive,
                  ]}
                  onPress={handleSwitchToCustomReason}
                  activeOpacity={0.85}
                >
                  <Feather
                    name="edit-3"
                    size={12}
                    color={
                      isCustomReasonMode ? '#FFFFFF' : theme.colors.primary
                    }
                  />
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.reasonChipText,
                      isCustomReasonMode && styles.reasonChipTextActive,
                    ]}
                  >
                    Write my own
                  </Text>
                </TouchableOpacity>
              </View>
              {isCustomReasonMode ? (
                <TextInput
                  style={styles.manualReasonInput}
                  placeholder="Add a short note for operations…"
                  placeholderTextColor={
                    theme.isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'
                  }
                  multiline
                  value={customManualReason}
                  onChangeText={setCustomManualReason}
                />
              ) : selectedManualReason ? (
                <View style={styles.selectedReasonNotice}>
                  <Feather
                    name="check"
                    size={12}
                    color={theme.colors.primary}
                  />
                  <Text
                    allowFontScaling={false}
                    style={styles.selectedReasonText}
                  >
                    {selectedManualReason}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedManualReason(null)}
                    style={styles.selectedReasonClear}
                  >
                    <Feather
                      name="x"
                      size={12}
                      color={theme.isDark ? '#FFFFFF' : '#1F2937'}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text allowFontScaling={false} style={styles.manualReasonHint}>
                  Pick a quick suggestion or write your own before applying.
                </Text>
              )}
              <TouchableOpacity
                style={[
                  styles.outsideButton,
                  !canApplyManualLocation && styles.outsideButtonDisabled,
                ]}
                onPress={handleApplyCurrentLocation}
                disabled={!canApplyManualLocation}
              >
                <Feather name="map-pin" size={14} color="#FFFFFF" />
                <Text allowFontScaling={false} style={styles.outsideButtonText}>
                  {customLocation
                    ? 'Update temporary pin'
                    : 'Use this location today'}
                </Text>
              </TouchableOpacity>
              {/* <TouchableOpacity
                style={styles.outsideShareButton}
                onPress={handleShareLocationRequest}
              >
                <Feather
                  name="share-2"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text
                  allowFontScaling={false}
                  style={styles.outsideShareText}
                >
                  Share coordinates with ops
                </Text>
              </TouchableOpacity> */}
            </AnimatedCard>
          </View>
        ) : null}

        <View style={styles.lastRowHeader}>
          <View>
            <Text allowFontScaling={false} style={styles.sectionTitle}>
              Last 7 Days
            </Text>
          </View>
          <TouchableOpacity
            disabled={true}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('AttendanceHistory' as never)}
          >
            <Text allowFontScaling={false} style={styles.viewAll}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        <AnimatedCard style={styles.card} delay={120}>
          {mappedHistory.map((entry, index) => (
            <View
              key={entry.date}
              style={[
                styles.historyRow,
                index === mappedHistory.length - 1 && styles.historyLast,
              ]}
            >
              <View
                style={[
                  styles.historyAccent,
                  { backgroundColor: statusColor(entry.status) },
                ]}
              />

              <View style={styles.calendarIcon}>
                <Feather
                  name={
                    entry.status === 'Present'
                      ? 'check-circle'
                      : entry.status === 'Late'
                      ? 'clock'
                      : 'calendar'
                  }
                  size={15}
                  color={statusColor(entry.status)}
                />
              </View>

              <View style={styles.historyCenter}>
                <View style={styles.historyTopRow}>
                  <Text allowFontScaling={false} style={styles.historyDate}>
                    {getDateLabel(entry.date)}
                  </Text>
                  <Text allowFontScaling={false} style={styles.historyDayTag}>
                    {formatShortDate(entry.date)}
                  </Text>
                </View>
                <View style={styles.historyMetaRow}>
                  <View style={styles.historyMetaChip}>
                    <Feather
                      name="clock"
                      size={11}
                      color={theme.colors.primary}
                    />
                    <Text allowFontScaling={false} style={styles.historyTime}>
                      09:00 AM - 05:05 PM
                    </Text>
                  </View>
                  <View style={styles.historyMetaChip}>
                    <Feather
                      name={
                        entry.status === 'Present'
                          ? 'zap'
                          : entry.status === 'Late'
                          ? 'alert-triangle'
                          : 'minus-circle'
                      }
                      size={11}
                      color={statusColor(entry.status)}
                    />
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.historyMetaText,
                        { color: statusColor(entry.status) },
                      ]}
                    >
                      {entry.status === 'Present'
                        ? 'On time'
                        : entry.status === 'Late'
                        ? 'Late arrival'
                        : 'No mark'}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={[
                  styles.statusTag,
                  { backgroundColor: statusColor(entry.status) },
                ]}
              >
                <Text allowFontScaling={false} style={styles.statusText}>
                  {entry.status}
                </Text>
              </View>
            </View>
          ))}
        </AnimatedCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => {
  const glassCard = theme.colors.card;
  const borderColor = theme.colors.border;
  const chipBg = 'rgba(255,255,255,0.08)';

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 14,
    },
    scrollContent: {
      paddingBottom: 28,
    },

    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.9,
    },

    notificationStack: {
      marginBottom: 12,
      gap: 12,
    },

    notificationBanner: {
      width: '100%',
    },

    timeCard: {
      backgroundColor: glassCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor,
      padding: 20,
      marginBottom: 12,
      alignItems: 'center',
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      // elevation: 4,
    },
    timeCardHeader: {
      width: '100%',
      marginBottom: 12,
    },
    timeCardTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
    },
    timeText: {
      fontSize: 34,
      fontWeight: '800',
      color: theme.colors.text,
    },
    dateText: {
      marginTop: 2,
      color: theme.colors.muted,
      fontSize: 12,
    },
    markButtonWrap: {
      marginTop: 14,
      borderRadius: 22,
      overflow: 'hidden',
      width: '100%',
      borderWidth: 1,
      borderColor: theme.isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,255,255,0.18)',
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
    },
    markButtonWrapDisabled: {
      opacity: 0.72,
    },
    markButton: {
      minHeight: 74,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      // paddingHorizontal: 14,
      // paddingVertical: 12,
    },
    markButtonIconWrap: {
      width: 44,
      height: 44,
      margin: 12,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.36)',
    },
    markButtonContent: {
      flex: 1,
    },
    markButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    markButtonSubtext: {
      marginTop: 2,
      color: 'rgba(255,255,255,0.82)',
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
    },
    markButtonArrow: {
      width: 34,
      height: 34,
      borderRadius: 17,
      right: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(15,23,42,0.22)',
    },
    markButtonHint: {
      marginTop: 8,
      color: theme.colors.muted,
      fontSize: 11,
      textAlign: 'center',
    },
    card: {
      backgroundColor: glassCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor,
      padding: 20,
      marginBottom: 12,
      shadowColor: theme.colors.glowStrong,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      // elevation: 2,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 8,
    },
    map: {
      height: 112,
      borderRadius: 16,
      backgroundColor: chipBg,
      borderWidth: 1,
      borderColor: borderColor,
      overflow: 'hidden',
      position: 'relative',
    },
    streetA: {
      position: 'absolute',
      width: 220,
      height: 4,
      backgroundColor: '#FFFFFF',
      top: 66,
      left: -10,
      transform: [{ rotate: '20deg' }],
    },
    streetB: {
      position: 'absolute',
      width: 190,
      height: 4,
      backgroundColor: '#FFFFFF',
      top: 50,
      left: 20,
      transform: [{ rotate: '-40deg' }],
    },
    streetC: {
      position: 'absolute',
      width: 240,
      height: 4,
      backgroundColor: '#FFFFFF',
      top: 88,
      left: 5,
      transform: [{ rotate: '-5deg' }],
    },
    locationPill: {
      marginTop: 10,
      minHeight: 38,
      borderRadius: 12,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      gap: 8,
      borderWidth: 1,
    },
    locationPillText: {
      fontSize: 12,
      fontWeight: '700',
    },
    locationDetail: {
      marginTop: 6,
      color: theme.colors.muted,
      fontSize: 12,
    },
    address: {
      marginTop: 8,
      color: theme.colors.muted,
      fontSize: 12,
    },
    addressSub: {
      marginTop: 2,
      color: theme.colors.muted,
      fontSize: 11,
    },
    customLocationBanner: {
      marginTop: 8,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    customLocationBannerTextWrap: {
      flex: 1,
    },
    customLocationText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    customLocationReason: {
      marginTop: 2,
      color: theme.colors.muted,
      fontSize: 11,
    },
    resetLink: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    locationFooter: {
      marginTop: 12,
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 12,
    },
    locationMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    locationMetaText: {
      color: theme.colors.muted,
      fontSize: 11,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    refreshText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    outsideHelperText: {
      color: theme.colors.muted,
      fontSize: 12,
      marginBottom: 12,
    },
    coordinatesChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor,
      backgroundColor: chipBg,
    },
    coordinatesValue: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '600',
    },
    manualReasonLabel: {
      marginTop: 14,
      marginBottom: 6,
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
    },
    reasonChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    reasonChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'transparent',
      flexShrink: 1,
    },
    reasonChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    reasonChipText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    reasonChipTextActive: {
      color: '#FFFFFF',
    },
    manualReasonInput: {
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 70,
      color: theme.colors.text,
      backgroundColor: chipBg,
      textAlignVertical: 'top',
      fontSize: 13,
    },
    selectedReasonNotice: {
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: chipBg,
    },
    selectedReasonText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    selectedReasonClear: {
      padding: 4,
      borderRadius: 999,
    },
    manualReasonHint: {
      marginTop: 8,
      fontSize: 11,
      color: theme.colors.muted,
    },
    outsideButton: {
      marginTop: 12,
      borderRadius: 12,
      height: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
    },
    outsideButtonDisabled: {
      opacity: 0.5,
    },
    outsideButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    outsideShareButton: {
      marginTop: 12,
      borderRadius: 12,
      height: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor,
    },
    outsideShareText: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    lastRowHeader: {
      marginTop: 2,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    viewAll: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor,
      borderRadius: 20,
      backgroundColor: glassCard,
      shadowColor: theme.colors.glowStrong,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    historyLast: {
      marginBottom: 0,
    },
    historyAccent: {
      position: 'absolute',
      left: 0,
      top: 12,
      bottom: 12,
      width: 4,
      borderRadius: 999,
    },
    calendarIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyCenter: {
      flex: 1,
    },
    historyTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    historyDate: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
      flex: 1,
    },
    historyDayTag: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor,
    },
    historyMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    historyMetaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor,
    },
    historyTime: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    historyMetaText: {
      fontSize: 11,
      fontWeight: '700',
    },
    statusTag: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minWidth: 82,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
  });
};
