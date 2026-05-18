import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
 ActivityIndicator,
 Modal,
 Platform,
 ScrollView,
 StyleSheet,
 Text,
 TouchableOpacity,
 View,
 Linking,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AnimatedCard} from '../components/ui';
import {TopHeader} from '../components/TopHeader';
import {useAppTheme} from '../context/ThemeContext';
import {AppTheme} from '../theme';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/types';
import LinearGradient from 'react-native-linear-gradient';
import Geolocation from 'react-native-geolocation-service';
import {check, PERMISSIONS, RESULTS, request} from 'react-native-permissions';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {LatLng, WorkLocation, WORK_LOCATION} from '../constants/workLocation';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {reverseGeocodeCoords} from '../services/googleMapsService';
import {useDialog} from '../context/DialogContext';
import {useAttendance} from '../context/AttendanceContext';
import NetInfo from '@react-native-community/netinfo';
import {
 NotificationBanner,
 NotificationBannerProps,
} from '../components/NotificationBanner';
import {SHIFT_WINDOW} from '../constants/shift';
import {parseTimeToMinutes} from '../utils/time';
import {
 notificationEvents,
 NotificationActionId,
 syncBackendLocationReminderNotification,
 syncAttendanceNotifications,
 checkNotificationStatus,
} from '../services/notificationService';
import {LocationStatus} from '../types/attendance';
import {useAppSelector} from '../store/hooks';
import {
 BackendLocationReminder,
 extractBackendLocationReminder,
 checkUserLocation,
} from '../services/attendanceLocationService';
import {geocodeAddressAPI} from '../services/backendMapService';
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
 return {time, day};
};

type InlineNotification = NotificationBannerProps & {id: string};
const LOCATION_CHECK_THROTTLE_MS = 60000;

const buildBackendReminderSignature = (
 reminder: BackendLocationReminder | null,
) =>
 reminder
  ? JSON.stringify({
     type: reminder.type,
     title: reminder.title,
     body: reminder.body,
     message: reminder.message,
     action_1: reminder.action_1,
     action_1_title: reminder.action_1_title,
     action_2: reminder.action_2,
     action_2_title: reminder.action_2_title,
     action_3: reminder.action_3,
     action_3_title: reminder.action_3_title,
    })
  : 'null';

const buildLocationVisual = (
 status: LocationStatus,
 locationError?: string | null,
) => {
 switch (status) {
  case 'inside':
   return {
    icon: 'check-circle',
    message: 'Location verified',
    detail: 'Backend confirmed this location for attendance.',
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderColor: 'rgba(34,197,94,0.5)',
    textColor: 'green',
   };
  case 'outside':
   return {
    icon: 'alert-triangle',
    message: 'Outside Office Radius',
    detail: 'Your location appears to be outside the office premises.',
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
    detail: 'The MaxxStations will verify the submitted coordinates.',
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderColor: 'rgba(59,130,246,0.45)',
    textColor: 'blue',
   };
 }
};

export default function AttendanceScreen() {
 const {markPresence, todayEntry} = useAttendance();
 const [locationStatus, setLocationStatus] =
  useState<LocationStatus>('checking');
 const [backendLocationReminder, setBackendLocationReminder] =
  useState<BackendLocationReminder | null>(null);
 const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
 const [locationError, setLocationError] = useState<string | null>(null);
 const [gpsUnavailable, setGpsUnavailable] = useState(false);
 const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
 const [backendAddress, setBackendAddress] = useState<string | null>(null);
 const [currentAddress, setCurrentAddress] = useState<string | null>(null);
 const [isCheckingLocation, setIsCheckingLocation] = useState(false);
 // isMounted is initialised synchronously so there is zero tick race window
 // between mount and the ref being set to true.
 const isMounted = useRef(true);
 const locationCheckInFlight = useRef(false);
 const locationWatchId = useRef<number | null>(null);
 const lastBackendLocationCheckAt = useRef(0);
 const lastBackendReminderSignature = useRef<string | null>(null);

 const authToken = useAppSelector(state => state.auth.token);

 const locationPermission =
  Platform.OS === 'ios'
   ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
   : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
 const [currentCoords, setCurrentCoords] = useState<LatLng | null>(null);
 const activeWorkLocation: WorkLocation = WORK_LOCATION;

 const navigation = useNavigation<NavigationProp<RootStackParamList>>();
 const [systemTime, setSystemTime] = useState(Date.now());
 const clock = useMemo(() => formatNow(new Date(systemTime)), [systemTime]);
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const {showDialog} = useDialog();
 const [isOffline, setIsOffline] = useState(false);
 const [travelPromptDismissed, setTravelPromptDismissed] = useState(false);
 const [isMapModalVisible, setIsMapModalVisible] = useState(false);
 const handleOpenMapModal = useCallback(() => setIsMapModalVisible(true), []);
 const handleCloseMapModal = useCallback(() => setIsMapModalVisible(false), []);
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
  () => buildLocationVisual(locationStatus, locationError),
  [locationError, locationStatus],
 );
 const lastCheckedLabel = useMemo(() => {
  if (!lastCheckedAt) return 'Never';
  return new Date(lastCheckedAt).toLocaleTimeString([], {
   hour: '2-digit',
   minute: '2-digit',
  });
 }, [lastCheckedAt]);
 const canMarkPresence = locationStatus === 'inside';
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
  ? 'Your location was verified by the backend.'
  : locationStatus === 'outside'
  ? 'You are outside the office radius.'
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
 const shouldPromptForTravel =
  shiftHasStarted &&
  !shiftEnded &&
  hasMarkedIn &&
  locationStatus === 'outside' &&
  !travelPromptDismissed;
 const mapCenter = useMemo(() => {
  if (currentCoords) {
   return currentCoords;
  }
  return WORK_LOCATION;
 }, [currentCoords]);

 const handleMarkPresence = useCallback(() => {
  if (locationStatus === 'checking') {
   return;
  }
  if (!canMarkPresence) {
   showDialog({
    title: 'Cannot mark presence',
    message:
     locationStatus === 'outside'
      ? 'The backend has determined you are outside the office radius.'
      : 'Refresh your GPS and let the backend verify your location.',
    variant: 'error',
    primaryAction: {label: 'Okay'},
   });
   return;
  }

  markPresence({
   locationStatus: 'at',
   workLocation: activeWorkLocation,
   distanceMeters: null,
  });

  showDialog({
   title: 'Presence marked',
   message: 'Your attendance for today has been captured.',
   variant: 'success',
   primaryAction: {label: 'Okay'},
  });
 }, [
  activeWorkLocation,
  canMarkPresence,
  locationStatus,
  markPresence,
  showDialog,
 ]);

 const runBackendLocationCheck = useCallback(
  async (coords: LatLng, force = false) => {
   const currentTime = Date.now();
   if (
    !force &&
    currentTime - lastBackendLocationCheckAt.current <
     LOCATION_CHECK_THROTTLE_MS
   ) {
    return;
   }
   if (locationCheckInFlight.current) {
    return;
   }

   locationCheckInFlight.current = true;
   lastBackendLocationCheckAt.current = currentTime;
   try {
    const result = await checkUserLocation(coords, authToken);
    if (!isMounted.current) {
     return;
    }

    const reminder =
     result.notification ??
     extractBackendLocationReminder(result.raw) ??
     (result.locationStatus === 'outside'
      ? {
         type: 'location_reminder',
         action_1: 'CHECK_IN',
         action_1_title: 'Check In',
         action_2: 'OPEN_MAP',
         action_2_title: 'Open Map',
         action_3: 'IGNORE',
         action_3_title: 'Ignore',
        }
      : null);

    const reminderSignature = buildBackendReminderSignature(reminder);
    if (lastBackendReminderSignature.current !== reminderSignature) {
     lastBackendReminderSignature.current = reminderSignature;
     await syncBackendLocationReminderNotification(reminder);
     setBackendLocationReminder(reminder);
    }

    if (result.locationStatus === 'outside' && coords) {
     try {
      const addrString = `${coords.latitude},${coords.longitude}`;
      const geocoded = await geocodeAddressAPI(addrString, authToken ?? '');
      setBackendAddress(geocoded.address);
      setCurrentAddress(geocoded.address);
     } catch (e) {
      setBackendAddress(
       `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
      );
     }
    } else {
     setBackendAddress(null);
     setCurrentAddress(null);
    }

    if (result.locationStatus) {
     setGpsUnavailable(false);
     setLocationStatus(result.locationStatus);
    } else {
     setGpsUnavailable(false);
     setLocationStatus('error');
     setLocationError('Invalid location check response from server.');
    }
   } catch (apiError: any) {
    if (isMounted.current) {
     if (lastBackendReminderSignature.current !== 'null') {
      lastBackendReminderSignature.current = 'null';
      await syncBackendLocationReminderNotification(null);
      setBackendLocationReminder(null);
     }
     setGpsUnavailable(false);
     setLocationStatus('error');
     setLocationError(
      apiError?.response?.data?.message ||
       apiError?.message ||
       'Unable to check location with server.',
     );
    }
   } finally {
    locationCheckInFlight.current = false;
   }
  },
  [authToken],
 );

 const updateLocationFromPosition = useCallback(
  async (
   position: {
    coords: {
     latitude: number;
     longitude: number;
    };
   },
   forceBackendCheck = false,
  ) => {
   if (!isMounted.current) {
    return;
   }

   const coords = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
   };

   if (
    !Number.isFinite(coords.latitude) ||
    !Number.isFinite(coords.longitude)
   ) {
    setGpsUnavailable(true);
    setLocationStatus('error');
    setLocationError('Current location coordinates are invalid.');
    return;
   }

   setCurrentCoords(coords);
   setLastCheckedAt(Date.now());
   await runBackendLocationCheck(coords, forceBackendCheck);
  },
  [runBackendLocationCheck],
 );

 const stopLocationWatch = useCallback(() => {
  if (locationWatchId.current != null) {
   Geolocation.clearWatch(locationWatchId.current);
   locationWatchId.current = null;
  }
 }, []);

 const startLocationWatch = useCallback(() => {
  if (locationWatchId.current != null) {
   return;
  }

  locationWatchId.current = Geolocation.watchPosition(
   position => {
    updateLocationFromPosition(position).catch(error =>
     console.warn('Unable to update watched location', error),
    );
   },
   error => {
    if (isMounted.current) {
     if (lastBackendReminderSignature.current !== 'null') {
      lastBackendReminderSignature.current = 'null';
      syncBackendLocationReminderNotification(null).catch(() => null);
      setBackendLocationReminder(null);
     }
     setGpsUnavailable(true);
     setLocationStatus('error');
     setLocationError(error.message);
    }
   },
   {
    enableHighAccuracy: true,
    distanceFilter: 10,
    interval: 30000,
    fastestInterval: 15000,
    useSignificantChanges: false,
    showsBackgroundLocationIndicator: true,
    allowsBackgroundLocationUpdates: true,
   },
  );
 }, [updateLocationFromPosition]);

 useFocusEffect(
  useCallback(() => {
   // Start watch when focused
   if (locationPermission) {
    check(locationPermission).then(status => {
     if (status === RESULTS.GRANTED) {
      startLocationWatch();
     }
    });
   }

   return () => {
    // Stop watch when blurred (navigating away)
    stopLocationWatch();
   };
  }, [locationPermission, startLocationWatch, stopLocationWatch]),
 );

 const refreshLocation = useCallback(async () => {
  if (!locationPermission) {
   setGpsUnavailable(true);
   setLocationStatus('error');
   setLocationError('Location permission unavailable on this platform');
   return;
  }
  setIsRefreshingLocation(true);
  setIsCheckingLocation(true);
  setLocationError(null);
  setLocationStatus('checking');
  try {
   let permissionStatus = await check(locationPermission);
   if (permissionStatus === RESULTS.DENIED) {
    permissionStatus = await request(locationPermission);
   }

   if (permissionStatus !== RESULTS.GRANTED) {
    if (lastBackendReminderSignature.current !== 'null') {
     lastBackendReminderSignature.current = 'null';
     await syncBackendLocationReminderNotification(null);
     setBackendLocationReminder(null);
    }
    setGpsUnavailable(true);
    setLocationStatus('denied');
    return;
   }

   setGpsUnavailable(false);
   startLocationWatch();

   await new Promise<void>(resolve => {
    Geolocation.getCurrentPosition(
     async position => {
      await updateLocationFromPosition(position, true);
      resolve();
     },
     error => {
      if (isMounted.current) {
       if (lastBackendReminderSignature.current !== 'null') {
        lastBackendReminderSignature.current = 'null';
        syncBackendLocationReminderNotification(null).catch(() => null);
        setBackendLocationReminder(null);
       }
       setGpsUnavailable(true);
       setLocationStatus('error');
       setLocationError(error.message);
      }
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
   if (isMounted.current) {
    setGpsUnavailable(true);
    setLocationStatus('error');
    setLocationError(error?.message || 'Unexpected location error');
   }
  } finally {
   if (isMounted.current) {
    setIsRefreshingLocation(false);
    setIsCheckingLocation(false);
   }
  }
 }, [locationPermission, startLocationWatch, updateLocationFromPosition]);

 const handleStartBillableTravel = useCallback(() => {
  setTravelPromptDismissed(true);
  navigation.navigate('BillableTravel' as never);
 }, [navigation]);

 const handleStartManualTravel = useCallback(() => {
  setTravelPromptDismissed(true);
  navigation.navigate('BillableTravel', {
   mode: 'manual',
  } as never);
 }, [navigation]);

 const handleOpenTravelMap = useCallback(() => {
  setTravelPromptDismissed(true);
  navigation.navigate('BillableTravel' as never);
 }, [navigation]);

 const handleIgnoreLocationReminder = useCallback(() => {
  lastBackendReminderSignature.current = 'null';
  setBackendLocationReminder(null);
  setTravelPromptDismissed(true);
  syncBackendLocationReminderNotification(null).catch(error =>
   console.warn('Unable to dismiss location reminder notification', error),
  );
 }, []);

 useEffect(() => {
  refreshLocation();
 }, [refreshLocation]);

 useEffect(() => {
  checkNotificationStatus().catch(error =>
   console.warn('[Notification] Initial status check failed', error),
  );
 }, []);

 // Cleanup on full unmount — paired with the synchronous isMounted ref above.
 useEffect(() => {
  return () => {
   isMounted.current = false;
   if (locationWatchId.current != null) {
    Geolocation.clearWatch(locationWatchId.current);
    locationWatchId.current = null;
   }
  };
 }, []);

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

 useEffect(() => {
  if (locationStatus === 'inside') {
   setTravelPromptDismissed(false);
  }
 }, [locationStatus]);

 const refreshNetworkStatus = useCallback(() => {
  NetInfo.fetch().then(state => {
   const offline = !state.isConnected || state.isInternetReachable === false;
   setIsOffline(offline);
  });
 }, []);

 const handleOpenSettings = useCallback(() => {
  Linking.openSettings().catch(() => null);
 }, []);

 useEffect(() => {
  const handlerMap: Partial<Record<NotificationActionId, () => void>> = {
   'open-manual-card': handleStartManualTravel,
   'refresh-location': () => refreshLocation(),
   'refresh-network': () => refreshNetworkStatus(),
   'open-report': () => navigation.navigate('Report' as never),
   'bill-time': handleStartBillableTravel,
   'open-map': handleOpenTravelMap,
   'check-in': handleMarkPresence,
  };

  (Object.keys(handlerMap) as NotificationActionId[]).forEach(action => {
   const handler = handlerMap[action];
   if (handler) {
    notificationEvents.on(action, handler);
   }
  });

  return () => {
   (Object.keys(handlerMap) as NotificationActionId[]).forEach(action => {
    const handler = handlerMap[action];
    if (handler) {
     notificationEvents.off(action, handler);
    }
   });
  };
 }, [
  handleStartBillableTravel,
  handleStartManualTravel,
  handleOpenTravelMap,
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
     'Attendance and travel logs will sync automatically when the device reconnects.',
    icon: 'wifi-off',
    actions: [
     //  {label: 'Manual travel log', onPress: handleStartManualTravel},
     {label: 'Retry connection', onPress: refreshNetworkStatus},
    ],
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
     // { label: 'Manual Log', onPress: handleStartManualTravel },
     {label: 'Open settings', onPress: handleOpenSettings},
     {label: 'Retry', onPress: refreshLocation},
    ],
   });
  }

  if (backendLocationReminder) {
   const actions = [
    {
     id: backendLocationReminder.action_1,
     label: backendLocationReminder.action_1_title,
    },
    {
     id: backendLocationReminder.action_2,
     label: backendLocationReminder.action_2_title,
    },
    {
     id: backendLocationReminder.action_3,
     label: backendLocationReminder.action_3_title,
    },
   ];

   const openMapAction = actions.find(a => a.id === 'OPEN_MAP');

   const bannerActions: Array<{label: string; onPress: () => void}> = [];

   if (openMapAction) {
    bannerActions.push({
     label: openMapAction.label || 'Start Billable',
     onPress: handleOpenTravelMap,
    });
   }
   bannerActions.push({label: 'Ignore', onPress: handleIgnoreLocationReminder});

   items.push({
    id: 'backend-location-reminder',
    variant: 'info',
    title: backendLocationReminder.title || 'Location Reminder',
    description:
     backendLocationReminder.body ||
     backendLocationReminder.message ||
     'You are outside office radius. Please start billable travel or ignore.',
    icon: 'navigation',
    actions: bannerActions,
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
    title: inside ? 'Shift is live' : 'Shift is live',
    description: inside
     ? graceCopy
     : locationStatus === 'outside'
     ? 'You are currently outside the office radius.'
     : locationStatus === 'checking'
     ? 'Getting a precise GPS lock for verification...'
     : 'Refresh GPS to let the backend verify your location.',
    icon: inside ? 'clock' : 'alert-triangle',
    actions: [
     inside
      ? {label: 'Mark presence', onPress: handleMarkPresence}
      : {label: 'Refresh GPS', onPress: refreshLocation},
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
  backendLocationReminder,
  handleIgnoreLocationReminder,
  handleMarkPresence,
  handleOpenSettings,
  handleOpenTravelMap,
  handleStartManualTravel,
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
   gpsUnavailable,
   canMarkPresence,
   shiftHasStarted,
   shiftNearEnd,
   shiftEnded,
   hasMarkedIn,
   hasMarkedOut,
   graceRemaining,
   minutesRemaining,
  }).catch(error => console.warn('Attendance notification sync failed', error));
 }, [
  canMarkPresence,
  graceRemaining,
  hasMarkedIn,
  hasMarkedOut,
  gpsUnavailable,
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
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title="Attendance" />
   <ScrollView
    showsVerticalScrollIndicator={false}
    contentInsetAdjustmentBehavior="automatic"
    contentContainerStyle={styles.scrollContent}>
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
      disabled={markButtonDisabled}>
      <LinearGradient
       colors={markButtonGradient}
       start={{x: 0, y: 0.5}}
       end={{x: 1, y: 0.5}}
       style={styles.markButton}>
       <View style={styles.markButtonIconWrap}>
        {isCheckingLocation ? (
         <ActivityIndicator
          key="attendance-loading"
          size="small"
          color="#0F172A"
         />
        ) : (
         <MaterialCommunityIcons
          name={canMarkPresence ? 'fingerprint' : 'map-marker-alert-outline'}
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
       ? 'Your location appears to be outside the office premises.'
       : locationStatus === 'denied'
       ? 'Enable GPS permissions to continue.'
       : locationStatus === 'error'
       ? locationError || 'Unable to verify GPS.'
       : locationStatus === 'checking'
       ? 'Waiting for a precise GPS lock…'
       : `Presence last verified at ${lastCheckedLabel}.`}
     </Text>
    </AnimatedCard>

    <AnimatedCard style={styles.card} delay={80}>
     <Text allowFontScaling={false} style={styles.sectionTitle}>
      Current Location
     </Text>
     <View style={styles.mapContainer}>
      <MapView
       provider={PROVIDER_GOOGLE}
       style={styles.map}
       loadingEnabled
       showsUserLocation
       showsMyLocationButton
       initialRegion={{
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
       }}
       region={{
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
       }}>
       <Marker coordinate={WORK_LOCATION} title="Office" />
       {currentCoords ? (
        <Marker
         coordinate={currentCoords}
         title="Live location"
         pinColor="#F97316"
        />
       ) : null}
      </MapView>
      <TouchableOpacity
       style={styles.mapExpandButton}
       onPress={handleOpenMapModal}
       activeOpacity={0.85}>
       <Feather name="maximize" size={18} color="#FFFFFF" />
      </TouchableOpacity>
     </View>
     <View
      style={[
       styles.locationPill,
       {
        backgroundColor: locationVisual.backgroundColor,
        borderColor: locationVisual.borderColor,
       },
      ]}>
      <Feather
       name={locationVisual.icon as any}
       size={13}
       color={locationVisual.textColor}
      />
      <Text
       allowFontScaling={false}
       style={[styles.locationPillText, {color: locationVisual.textColor}]}>
       {locationVisual.message}
      </Text>
     </View>
     <Text allowFontScaling={false} style={styles.locationDetail}>
      {locationVisual.detail}
     </Text>
     <Text allowFontScaling={false} style={styles.address}>
      {backendAddress || currentAddress || activeWorkLocation.label}
     </Text>
     {/* <Text allowFontScaling={false} style={styles.addressSub}>
            {backendAddress ? 'Backend Verified Location' : coordinatesLabel}
          </Text> */}
     <View style={styles.locationFooter}>
      <View style={styles.locationMetaRow}>
       <Feather name="map-pin" size={12} color={theme.colors.muted} />
       <Text allowFontScaling={false} style={styles.locationMetaText}>
        System Review • Last Checked {lastCheckedLabel}
       </Text>
      </View>
      <TouchableOpacity
       style={styles.refreshButton}
       onPress={refreshLocation}
       disabled={isRefreshingLocation}>
       {isRefreshingLocation ? (
        <ActivityIndicator
         key="attendance-loading-recent"
         size="small"
         color={theme.colors.primary}
        />
       ) : (
        <Feather name="refresh-ccw" size={12} color={theme.colors.primary} />
       )}
       <Text
        allowFontScaling={false}
        style={[
         styles.refreshText,
         isRefreshingLocation && {color: theme.colors.primary},
        ]}>
        {isRefreshingLocation ? 'Checking…' : 'Refresh'}
       </Text>
      </TouchableOpacity>
     </View>
    </AnimatedCard>

    <AnimatedCard style={styles.activityHub} delay={100}>
     <View style={styles.hubHeader}>
      <View style={styles.hubTitleWrap}>
       <Text allowFontScaling={false} style={styles.hubTitle}>
        Activity Hub
       </Text>
       <Text allowFontScaling={false} style={styles.hubSubtitle}>
        Manage your travel and view records
       </Text>
      </View>
     </View>

     {/* Contextual Prompts */}
     {shouldPromptForTravel && (
      <View style={styles.hubPrompt}>
       <View style={styles.promptIconWrap}>
        <Feather name="navigation" size={16} color="#F59E0B" />
       </View>
       <View style={{flex: 1}}>
        <Text allowFontScaling={false} style={styles.promptTitle}>
         Outside Office Radius
        </Text>
        <Text allowFontScaling={false} style={styles.promptDesc}>
         The backend has determined you are outside the office radius.
        </Text>
       </View>
      </View>
     )}

     {(locationStatus === 'denied' || locationStatus === 'error') && (
      <TouchableOpacity
       style={styles.hubPromptWarning}
       onPress={handleStartManualTravel}
       activeOpacity={0.8}>
       <View style={styles.promptIconWrapWarning}>
        <Feather name="alert-circle" size={16} color="#EF4444" />
       </View>
       <View style={{flex: 1}}>
        <Text allowFontScaling={false} style={styles.promptTitleWarning}>
         GPS Unavailable
        </Text>
        <Text allowFontScaling={false} style={styles.promptDescWarning}>
         Switch to manual route entry to log your travel.
        </Text>
       </View>
       <Feather name="chevron-right" size={16} color={theme.colors.muted} />
      </TouchableOpacity>
     )}

     {/* Action Grid */}
     <View style={styles.hubGrid}>
      <TouchableOpacity
       style={styles.hubGridItem}
       onPress={handleStartBillableTravel}
       activeOpacity={0.7}>
       <LinearGradient
        colors={['#10B98115', '#10B98105']}
        style={styles.hubGridIconBg}>
        <Feather name="play-circle" size={22} color="#10B981" />
       </LinearGradient>
       <Text allowFontScaling={false} style={styles.hubGridLabel}>
        Bill Travel
       </Text>
      </TouchableOpacity>

      <TouchableOpacity
       style={styles.hubGridItem}
       onPress={handleStartManualTravel}
       activeOpacity={0.7}>
       <LinearGradient
        colors={['#8B5CF615', '#8B5CF605']}
        style={styles.hubGridIconBg}>
        <Feather name="edit-3" size={20} color="#8B5CF6" />
       </LinearGradient>
       <Text allowFontScaling={false} style={styles.hubGridLabel}>
        Add Travel Log
       </Text>
      </TouchableOpacity>

      <TouchableOpacity
       style={styles.hubGridItem}
       onPress={() => navigation.navigate('TravelLogs')}
       activeOpacity={0.7}>
       <LinearGradient
        colors={['#3B82F615', '#3B82F605']}
        style={styles.hubGridIconBg}>
        <Feather name="map" size={20} color="#3B82F6" />
       </LinearGradient>
       <Text allowFontScaling={false} style={styles.hubGridLabel}>
        Travel History
       </Text>
      </TouchableOpacity>

      <TouchableOpacity
       style={styles.hubGridItem}
       onPress={() => navigation.navigate('AttendanceHistory' as never)}
       activeOpacity={0.7}>
       <LinearGradient
        colors={['#EC489915', '#EC489905']}
        style={styles.hubGridIconBg}>
        <Feather name="calendar" size={20} color="#EC4899" />
       </LinearGradient>
       <Text allowFontScaling={false} style={styles.hubGridLabel}>
        Attendance
       </Text>
      </TouchableOpacity>
     </View>
    </AnimatedCard>
   </ScrollView>
   <Modal visible={isMapModalVisible} transparent animationType="fade">
    <View style={styles.mapModalOverlay}>
     <View style={styles.mapModalContent}>
      <MapView
       provider={PROVIDER_GOOGLE}
       style={styles.fullScreenMap}
       loadingEnabled
       showsUserLocation
       showsMyLocationButton
       initialRegion={{
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
       }}
       region={{
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
       }}>
       <Marker coordinate={WORK_LOCATION} title="Office" />
       {currentCoords ? (
        <Marker
         coordinate={currentCoords}
         title="Live location"
         pinColor="#F97316"
        />
       ) : null}
      </MapView>
      <TouchableOpacity
       style={styles.mapModalCloseButton}
       onPress={handleCloseMapModal}
       activeOpacity={0.85}>
       <Feather name="x" size={24} color="#FFFFFF" />
      </TouchableOpacity>
     </View>
    </View>
   </Modal>
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
   shadowOffset: {width: 0, height: 0},
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
   shadowOffset: {width: 0, height: 12},
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
   shadowOffset: {width: 0, height: 0},
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
  mapContainer: {
   position: 'relative',
   borderRadius: 16,
   overflow: 'hidden',
  },
  map: {
   height: 220,
   borderRadius: 16,
   backgroundColor: theme.isDark ? '#091426' : '#DCEBFF',
   borderWidth: 1,
   borderColor: borderColor,
   overflow: 'hidden',
  },
  mapExpandButton: {
   position: 'absolute',
   top: 12,
   right: 12,
   width: 38,
   height: 38,
   borderRadius: 12,
   backgroundColor: 'rgba(15,23,42,0.72)',
   alignItems: 'center',
   justifyContent: 'center',
   zIndex: 10,
  },
  mapModalOverlay: {
   flex: 1,
   backgroundColor: 'rgba(15,23,42,0.94)',
   justifyContent: 'center',
   alignItems: 'center',
   padding: 16,
  },
  mapModalContent: {
   width: '100%',
   height: '90%',
   borderRadius: 22,
   overflow: 'hidden',
   backgroundColor: theme.colors.background,
  },
  fullScreenMap: {
   width: '100%',
   height: '100%',
  },
  mapModalCloseButton: {
   position: 'absolute',
   top: 18,
   right: 18,
   width: 44,
   height: 44,
   borderRadius: 22,
   backgroundColor: 'rgba(0,0,0,0.42)',
   alignItems: 'center',
   justifyContent: 'center',
   zIndex: 10,
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
  activityHub: {
   backgroundColor: glassCard,
   borderRadius: 24,
   borderWidth: 1,
   borderColor,
   padding: 18,
   marginBottom: 12,
   shadowColor: theme.colors.glowStrong,
   shadowOffset: {width: 0, height: 10},
   shadowOpacity: 0.15,
   shadowRadius: 20,
  },
  hubHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   marginBottom: 18,
  },
  hubTitleWrap: {
   flex: 1,
  },
  hubTitle: {
   fontSize: 18,
   fontWeight: '800',
   color: theme.colors.text,
  },
  hubSubtitle: {
   fontSize: 11,
   color: theme.colors.muted,
   marginTop: 2,
   fontWeight: '500',
  },
  hubStatusBadge: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 10,
   paddingVertical: 6,
   borderRadius: 12,
   backgroundColor: 'rgba(255,255,255,0.05)',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.08)',
   gap: 6,
  },
  hubStatusActive: {
   borderColor: 'rgba(245,158,11,0.3)',
   backgroundColor: 'rgba(245,158,11,0.1)',
  },
  hubStatusIdle: {
   opacity: 0.8,
  },
  statusDot: {
   width: 6,
   height: 6,
   borderRadius: 3,
   backgroundColor: theme.colors.muted,
  },
  statusDotActive: {
   backgroundColor: '#F59E0B',
  },
  hubStatusText: {
   fontSize: 10,
   fontWeight: '800',
   color: theme.colors.text,
   letterSpacing: 0.5,
   textTransform: 'uppercase',
  },
  hubPrompt: {
   backgroundColor: 'rgba(245,158,11,0.08)',
   borderRadius: 16,
   padding: 12,
   flexDirection: 'row',
   alignItems: 'center',
   gap: 12,
   marginBottom: 16,
   borderWidth: 1,
   borderColor: 'rgba(245,158,11,0.15)',
  },
  hubPromptWarning: {
   backgroundColor: 'rgba(239,68,68,0.08)',
   borderRadius: 16,
   padding: 12,
   flexDirection: 'row',
   alignItems: 'center',
   gap: 12,
   marginBottom: 16,
   borderWidth: 1,
   borderColor: 'rgba(239,68,68,0.15)',
  },
  promptIconWrap: {
   width: 32,
   height: 32,
   borderRadius: 10,
   backgroundColor: 'rgba(245,158,11,0.15)',
   alignItems: 'center',
   justifyContent: 'center',
  },
  promptIconWrapWarning: {
   width: 32,
   height: 32,
   borderRadius: 10,
   backgroundColor: 'rgba(239,68,68,0.15)',
   alignItems: 'center',
   justifyContent: 'center',
  },
  promptTitle: {
   fontSize: 13,
   fontWeight: '700',
   color: theme.colors.text,
  },
  promptDesc: {
   fontSize: 11,
   color: theme.colors.muted,
   marginTop: 2,
   lineHeight: 15,
  },
  promptTitleWarning: {
   fontSize: 13,
   fontWeight: '700',
   color: '#EF4444',
  },
  promptDescWarning: {
   fontSize: 11,
   color: 'rgba(239,68,68,0.8)',
   marginTop: 2,
   lineHeight: 15,
  },
  travelPromptActions: {
   marginTop: 12,
   gap: 10,
  },
  manualLogNotice: {
   marginTop: 12,
   borderRadius: 16,
   borderWidth: 1,
   borderColor: 'rgba(251,191,36,0.36)',
   backgroundColor: 'rgba(251,191,36,0.10)',
   padding: 14,
   flexDirection: 'row',
   alignItems: 'center',
   gap: 12,
  },
  manualLogNoticeText: {
   flex: 1,
  },
  travelLiveCard: {
   marginBottom: 8,
   borderRadius: 14,
   borderWidth: 1,
   borderColor,
   backgroundColor: chipBg,
   padding: 14,
   gap: 10,
  },
  travelLiveMeta: {
   flexDirection: 'row',
   flexWrap: 'wrap',
   gap: 8,
  },
  hubGrid: {
   flexDirection: 'row',
   flexWrap: 'wrap',
   justifyContent: 'space-between',
   gap: 8,
  },
  hubGridItem: {
   width: '48%',
   backgroundColor: 'rgba(255,255,255,0.03)',
   borderRadius: 14,
   padding: 8,
   alignItems: 'center',
   justifyContent: 'center',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.05)',
   overflow: 'hidden',
   minHeight: 75,
   marginBottom: 4,
  },
  hubGridIconBg: {
   width: 34,
   height: 34,
   borderRadius: 10,
   alignItems: 'center',
   justifyContent: 'center',
   marginBottom: 6,
  },
  hubGridLabel: {
   fontSize: 11,
   fontWeight: '700',
   color: theme.colors.text,
   textAlign: 'center',
  },
  routeInputGrid: {
   marginTop: 8,
   gap: 10,
  },
  routeInput: {
   borderRadius: 12,
   borderWidth: 1,
   borderColor,
   paddingHorizontal: 12,
   paddingVertical: 11,
   color: theme.colors.text,
   backgroundColor: chipBg,
   fontSize: 13,
  },
  suggestionList: {
   marginTop: -2,
   borderRadius: 12,
   borderWidth: 1,
   borderColor,
   backgroundColor: glassCard,
   overflow: 'hidden',
  },
  suggestionItem: {
   paddingHorizontal: 12,
   paddingVertical: 10,
   borderBottomWidth: 1,
   borderBottomColor: borderColor,
  },
  suggestionTitle: {
   color: theme.colors.text,
   fontSize: 12,
   fontWeight: '700',
  },
  suggestionSubtitle: {
   marginTop: 2,
   color: theme.colors.muted,
   fontSize: 11,
  },
  coordinatesGroup: {
   marginTop: 10,
   gap: 8,
  },
  billableToggleRow: {
   marginTop: 12,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   gap: 12,
  },
  billableToggle: {
   borderRadius: 999,
   borderWidth: 1,
   borderColor,
   paddingHorizontal: 12,
   paddingVertical: 8,
   backgroundColor: chipBg,
  },
  billableToggleActive: {
   backgroundColor: theme.colors.primary,
   borderColor: theme.colors.primary,
  },
  billableToggleText: {
   color: theme.colors.text,
   fontSize: 11,
   fontWeight: '700',
  },
  billableToggleTextActive: {
   color: '#FFFFFF',
  },
  routeOptionList: {
   marginTop: 6,
   gap: 10,
  },
  routeOptionCard: {
   borderRadius: 14,
   borderWidth: 1,
   borderColor,
   padding: 12,
   backgroundColor: chipBg,
  },
  routeOptionCardActive: {
   borderColor: theme.colors.primary,
   backgroundColor: theme.isDark ? 'rgba(95,203,255,0.14)' : '#ECF5FF',
  },
  routeOptionHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   gap: 12,
  },
  routeOptionTitle: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '700',
  },
  routeOptionTitleActive: {
   color: theme.colors.primary,
  },
  routeOptionMeta: {
   marginTop: 4,
   color: theme.colors.muted,
   fontSize: 11,
  },
  auditCard: {
   marginTop: 14,
   borderRadius: 14,
   borderWidth: 1,
   padding: 12,
   gap: 4,
  },
  auditCardValid: {
   backgroundColor: 'rgba(16,185,129,0.10)',
   borderColor: 'rgba(16,185,129,0.28)',
  },
  auditCardReview: {
   backgroundColor: 'rgba(245,158,11,0.10)',
   borderColor: 'rgba(245,158,11,0.28)',
  },
  auditCardInvalid: {
   backgroundColor: 'rgba(239,68,68,0.10)',
   borderColor: 'rgba(239,68,68,0.28)',
  },
  auditTitle: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '700',
  },
  auditSummary: {
   color: theme.colors.text,
   fontSize: 12,
  },
  auditMeta: {
   marginTop: 2,
   color: theme.colors.muted,
   fontSize: 11,
  },
  auditReviewText: {
   color: theme.colors.warning,
   fontSize: 11,
   fontWeight: '600',
  },
  auditInvalidText: {
   color: theme.colors.danger,
   fontSize: 11,
   fontWeight: '600',
  },
  projectMetaRow: {
   marginTop: 12,
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
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
   shadowOffset: {width: 0, height: 0},
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
