import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import notifee from '@notifee/react-native';
import {
 Platform,
 NativeModules,
 StyleSheet,
 Text,
 TextInput,
 TouchableOpacity,
 View,
 AppState,
 Modal,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {useNavigation} from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import {check, PERMISSIONS, RESULTS, request} from 'react-native-permissions';
import BackgroundJob from 'react-native-background-actions';

import {useAppTheme} from '../context/ThemeContext';
import {AppTheme} from '../theme';
import {useDialog} from '../context/DialogContext';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {fetchProjects, setSelectedProject} from '../store/projectsSlice';
import {ProjectPickerModal} from '../components/Logs/ProjectPickerModal';
import {TopHeader} from '../components/TopHeader';
import {AnimatedCard, ActionButton} from '../components/ui';
import {updateBillableLocationAPI} from '../services/billableTravelService';
import {geocodeAddressAPI} from '../services/backendMapService';
import {notificationEvents} from '../services/notificationService';
import {LatLng} from '../constants/workLocation';
import {
 clearBillableTravelSession,
 persistBillableTravelSession,
 readBillableTravelSession,
} from '../services/billableTravelSessionStorage';

const sleep = (time: number) =>
 new Promise<void>(resolve => setTimeout(resolve, time));

const MIN_ROUTE_POINT_DISTANCE_METERS = 5;
const DEFAULT_BILLABLE_PURPOSE = 'Client Meeting';
const DEFAULT_ACTIVE_NOTES = 'Billable travel started';

const textOrDefault = (
 value: string | null | undefined,
 defaultValue: string,
) => {
 const trimmedValue = typeof value === 'string' ? value.trim() : '';
 return trimmedValue.length > 0 ? trimmedValue : defaultValue;
};

const extractResponseMessage = (response: unknown) => {
 if (!response || typeof response !== 'object') {
  return null;
 }
 const record = response as Record<string, unknown>;
 return typeof record.message === 'string' && record.message.trim()
  ? record.message.trim()
  : null;
};

const BillableTrackingControl = NativeModules.BillableTrackingControl as
 | {
    startTaskRemovalWatcher?: () => Promise<void>;
    stopTaskRemovalWatcher?: () => Promise<void>;
    stopBillableServices?: () => Promise<void>;
    consumeTaskRemovedFlag?: () => Promise<boolean>;
   }
 | undefined;

let activeBackgroundRunId: string | null = null;

const pad = (value: number) => String(value).padStart(2, '0');

const formatApiDateTime = (date: Date) =>
 `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
  date.getDate(),
 )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
  date.getSeconds(),
 )}`;

const calculateDurationMinutes = (startTime: string, endTime: string) => {
 const start = new Date(startTime.replace(' ', 'T')).getTime();
 const end = new Date(endTime.replace(' ', 'T')).getTime();
 if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
  return 0;
 }
 return Math.max(0, Math.round((end - start) / 60000));
};

const calculateDistanceMeters = (from: LatLng, to: LatLng) => {
 const toRad = (value: number) => (value * Math.PI) / 180;
 const radiusMeters = 6371000;
 const dLat = toRad(to.latitude - from.latitude);
 const dLng = toRad(to.longitude - from.longitude);
 const lat1 = toRad(from.latitude);
 const lat2 = toRad(to.latitude);
 const a =
  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
  Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
 return radiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const toDistanceKm = (meters: number) => Number((meters / 1000).toFixed(3));

const extractTravelLogId = (response: unknown): number | null => {
 const candidates: unknown[] = [];
 const collect = (value: unknown) => {
  if (!value || typeof value !== 'object') {
   return;
  }
  const record = value as Record<string, unknown>;
  candidates.push(record.travel_log_id, record.id);
  collect(record.data);
  collect(record.travel_log);
 };
 collect(response);
 for (const candidate of candidates) {
  const parsed = Number(candidate);
  if (Number.isFinite(parsed) && parsed > 0) {
   return parsed;
  }
 }
 return null;
};

const buildBillablePayload = ({
 projectId,
 startCoords,
 endCoords,
 distanceMeters,
 startTime,
 endTime,
 purpose,
 notes,
 status,
 travelLogId,
}: {
 projectId: string | number;
 startCoords: LatLng;
 endCoords: LatLng;
 distanceMeters: number;
 startTime: string;
 endTime: string;
 purpose: string;
 notes: string;
 status: 'active' | 'complete';
 travelLogId?: number | null;
}) => ({
 project_id: Number(projectId),
 start_lat: startCoords.latitude,
 start_lng: startCoords.longitude,
 end_lat: endCoords.latitude,
 end_lng: endCoords.longitude,
 distance: toDistanceKm(distanceMeters),
 duration: calculateDurationMinutes(startTime, endTime),
 start_time: startTime,
 end_time: endTime,
 mode: 'car',
 purpose,
 notes,
 is_billable: 1 as const,
 billable_status: status,
 ...(travelLogId ? {travel_log_id: travelLogId} : {}),
});

const backgroundTaskOptions = {
 taskName: 'BillableTravel',
 taskTitle: 'Live Travel Tracking',
 taskDesc: 'Tracking billable travel location...',
 taskIcon: {
  name: 'ic_launcher',
  type: 'mipmap',
 },
 color: '#45CAFF',
 // Required for targetSdk 34+ with FOREGROUND_SERVICE_LOCATION.
 foregroundServiceType: ['location'] as 'location'[],
 parameters: {
  delay: 1000,
 },
 // Tapping the notification opens the app without starting another task.
 linkingURI: 'maxxstation://billable',
};

/**
 * FIXED: Refactored to use a loop-based getCurrentPosition for maximum reliability
 * on aggressive Android devices (Samsung). This ensures coordinates update even
 * when watchPosition might be throttled in the background.
 */
const backgroundTrackingTask = async (taskData?: {
 token?: string;
 projectId?: string;
 delay?: number;
 runId?: string;
 startLat?: number;
 startLng?: number;
 startTime?: string;
 travelLogId?: number;
 purpose?: string;
 notes?: string;
}) => {
 const {
  token,
  projectId,
  delay = 10000,
  runId,
  startLat,
  startLng,
  startTime,
  travelLogId: initialTravelLogId,
  purpose = DEFAULT_BILLABLE_PURPOSE,
  notes = DEFAULT_ACTIVE_NOTES,
 } = taskData || {};
 const startCoords =
  typeof startLat === 'number' && typeof startLng === 'number'
   ? {latitude: startLat, longitude: startLng}
   : null;
 let travelLogId = initialTravelLogId;
 let lastCoords = startCoords;
 let totalDistanceMeters = 0;

 while (
  BackgroundJob.isRunning() &&
  (!runId || activeBackgroundRunId === runId)
 ) {
  try {
   const position = await new Promise<Geolocation.GeoPosition>(
    (resolve, reject) => {
     Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      forceRequestLocation: true,
     });
    },
   );

   const {latitude, longitude} = position.coords;
   const coords = {latitude, longitude};
   if (lastCoords) {
    const delta = calculateDistanceMeters(lastCoords, coords);
    if (delta >= MIN_ROUTE_POINT_DISTANCE_METERS) {
     totalDistanceMeters += delta;
     lastCoords = coords;
    }
   } else {
    lastCoords = coords;
   }

   if (projectId && token && startCoords && startTime) {
    console.log(`[BG Task] Sending coordinates: ${latitude}, ${longitude}`);
    const response = await updateBillableLocationAPI(
     buildBillablePayload({
      projectId,
      startCoords,
      endCoords: coords,
      distanceMeters: totalDistanceMeters,
      startTime,
      endTime: formatApiDateTime(new Date()),
      purpose,
      notes,
      status: 'active',
      travelLogId,
     }),
     token,
    );
    travelLogId = travelLogId ?? extractTravelLogId(response) ?? undefined;
    await persistBillableTravelSession(String(projectId), {
     startLat: startCoords.latitude,
     startLng: startCoords.longitude,
     startTime,
     travelLogId,
     distanceMeters: totalDistanceMeters,
     purpose,
     notes,
    }).catch(() => null);
   }
  } catch (err) {
   console.error('[BG Task] Tracking Error:', err);
  }
  await sleep(delay);
 }
};

export default function BillableTravelScreen() {
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const navigation = useNavigation();
 const {showDialog} = useDialog();
 const dispatch = useAppDispatch();

 // Redux State
 const {items: projects, selectedProjectId} = useAppSelector(
  state => state.projects,
 );
 const authToken = useAppSelector(state => state.auth.token);

 // Local State
 const [isTracking, setIsTracking] = useState(false);
 const [currentCoords, setCurrentCoords] = useState<LatLng | null>(null);
 const [projectPickerVisible, setProjectPickerVisible] = useState(false);
 const [isMapModalVisible, setIsMapModalVisible] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [startPurpose, setStartPurpose] = useState('');
 const [startNotes, setStartNotes] = useState('');
 const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
 const [distanceMeters, setDistanceMeters] = useState(0);
 const [selectedPoint, setSelectedPoint] = useState<{
  title: string;
  address: string;
 } | null>(null);

 const watchId = useRef<number | null>(null);
 const mapRef = useRef<MapView>(null);
 const fullMapRef = useRef<MapView>(null);
 const isMounted = useRef(true);
 const isStartingRef = useRef(false);
 const isStoppingRef = useRef(false);
 const appStateRef = useRef(AppState.currentState);
 // Stable ref for selectedProjectId so BG location callback never has stale closure
 const selectedProjectIdRef = useRef(selectedProjectId);
 const authTokenRef = useRef(authToken);
 const isTrackingRef = useRef(isTracking);
 const currentCoordsRef = useRef<LatLng | null>(null);
 const routeCoordsRef = useRef<LatLng[]>([]);
 const distanceMetersRef = useRef(0);
 const startCoordsRef = useRef<LatLng | null>(null);
 const startTimeRef = useRef<string | null>(null);
 const travelLogIdRef = useRef<number | null>(null);
 const lastSessionPersistAtRef = useRef(0);
 const startPurposeRef = useRef(startPurpose);
 const startNotesRef = useRef(startNotes);

 // Keep the ref in sync with Redux state without re-running heavy effects
 useEffect(() => {
  selectedProjectIdRef.current = selectedProjectId;
 }, [selectedProjectId]);

 useEffect(() => {
  authTokenRef.current = authToken;
 }, [authToken]);

 useEffect(() => {
  isTrackingRef.current = isTracking;
 }, [isTracking]);

 useEffect(() => {
  currentCoordsRef.current = currentCoords;
 }, [currentCoords]);

 useEffect(() => {
  routeCoordsRef.current = routeCoords;
 }, [routeCoords]);

 useEffect(() => {
  distanceMetersRef.current = distanceMeters;
 }, [distanceMeters]);

 useEffect(() => {
  startPurposeRef.current = startPurpose;
 }, [startPurpose]);

 useEffect(() => {
  startNotesRef.current = startNotes;
 }, [startNotes]);

 const resetTravelState = useCallback(() => {
  startCoordsRef.current = null;
  startTimeRef.current = null;
  travelLogIdRef.current = null;
  distanceMetersRef.current = 0;
  routeCoordsRef.current = [];
  lastSessionPersistAtRef.current = 0;
  if (isMounted.current) {
   setDistanceMeters(0);
   setRouteCoords([]);
  }
 }, []);

 const appendRoutePoint = useCallback((coords: LatLng) => {
  const previous = routeCoordsRef.current[routeCoordsRef.current.length - 1];
  if (previous) {
   const delta = calculateDistanceMeters(previous, coords);
   if (delta < MIN_ROUTE_POINT_DISTANCE_METERS) {
    return;
   }
   distanceMetersRef.current += delta;
   if (isMounted.current) {
    setDistanceMeters(distanceMetersRef.current);
   }
  }

  routeCoordsRef.current = [...routeCoordsRef.current, coords];
  if (isMounted.current) {
   setRouteCoords(routeCoordsRef.current);
  }
  const now = Date.now();
  const projectId = selectedProjectIdRef.current;
  const startCoords = startCoordsRef.current;
  if (
   isTrackingRef.current &&
   projectId &&
   startCoords &&
   startTimeRef.current &&
   now - lastSessionPersistAtRef.current > 15000
  ) {
   lastSessionPersistAtRef.current = now;
   persistBillableTravelSession(String(projectId), {
    startLat: startCoords.latitude,
    startLng: startCoords.longitude,
    startTime: startTimeRef.current,
    travelLogId: travelLogIdRef.current ?? undefined,
    distanceMeters: distanceMetersRef.current,
    purpose: startPurposeRef.current || DEFAULT_BILLABLE_PURPOSE,
    notes: startNotesRef.current || DEFAULT_ACTIVE_NOTES,
   }).catch(() => null);
  }
 }, []);

 const stopLocationWatch = useCallback(() => {
  if (watchId.current !== null) {
   Geolocation.clearWatch(watchId.current);
   watchId.current = null;
  }
  Geolocation.stopObserving();
 }, []);

 const stopBackgroundServices = useCallback(async () => {
  activeBackgroundRunId = null;
  if (BackgroundJob.isRunning()) {
   await BackgroundJob.stop().catch(() => null);
  }
  await BillableTrackingControl?.stopBillableServices?.().catch(() => null);
  await BillableTrackingControl?.stopTaskRemovalWatcher?.().catch(() => null);
  await notifee.cancelNotification('billable-tracking').catch(() => null);
 }, []);

 const cleanupTracking = useCallback(
  async ({clearSession = true}: {clearSession?: boolean} = {}) => {
   stopLocationWatch();
   await stopBackgroundServices();
   if (clearSession) {
    await clearBillableTravelSession();
   }
  },
  [stopBackgroundServices, stopLocationWatch],
 );

 const stopTracking = useCallback(
  async ({
   purpose,
   notes,
   submitFinalUpdate = true,
  }: {
   purpose?: string | null;
   notes?: string | null;
   submitFinalUpdate?: boolean;
  } = {}) => {
   if (isStoppingRef.current) {
    return;
   }
   isStoppingRef.current = true;
   if (isMounted.current) {
    setIsSubmitting(true);
   }
   try {
    const projectId = selectedProjectIdRef.current;
    const startCoords = startCoordsRef.current;
    const endCoords = currentCoordsRef.current ?? startCoords;
    const startTime = startTimeRef.current;
    const endTime = formatApiDateTime(new Date());
    const finalPurpose = textOrDefault(purpose, DEFAULT_BILLABLE_PURPOSE);
    const finalNotes = textOrDefault(notes, DEFAULT_ACTIVE_NOTES);
    let responseMessage: string | null = null;

    if (
     submitFinalUpdate &&
     projectId &&
     startCoords &&
     endCoords &&
     startTime &&
     authTokenRef.current
    ) {
     const response = await updateBillableLocationAPI(
      buildBillablePayload({
       projectId,
       startCoords,
       endCoords,
       distanceMeters: distanceMetersRef.current,
       startTime,
       endTime,
       purpose: finalPurpose,
       notes: finalNotes,
       status: 'complete',
       travelLogId: travelLogIdRef.current,
      }),
      authTokenRef.current,
     );
     travelLogIdRef.current =
      travelLogIdRef.current ?? extractTravelLogId(response);
     responseMessage = extractResponseMessage(response);
    }

    await cleanupTracking();
    resetTravelState();
    if (isMounted.current) {
     setIsTracking(false);
     setStartPurpose('');
     setStartNotes('');
     if (submitFinalUpdate) {
      showDialog({
       title: 'Travel Saved',
       message: responseMessage || 'Billable travel saved successfully.',
       variant: 'success',
       primaryAction: {label: 'Okay'},
      });
     }
    }
   } catch (error: any) {
    if (isMounted.current) {
     showDialog({
      title: 'Stop Failed',
      message:
       error?.message ||
       'Unable to submit the final billable travel update. Please try again.',
      variant: 'error',
      primaryAction: {label: 'Okay'},
     });
    }
   } finally {
    isStoppingRef.current = false;
    if (isMounted.current) {
     setIsSubmitting(false);
    }
   }
  },
  [cleanupTracking, resetTravelState, showDialog],
 );

 const requestStopTracking = useCallback(() => {
  stopTracking({
   purpose: startPurposeRef.current,
   notes: startNotesRef.current,
  }).catch(error => console.warn('[BillableTravel] Stop failed', error));
 }, [stopTracking]);

 const syncTrackingState = useCallback(async () => {
  const wasTaskRemoved =
   (await BillableTrackingControl?.consumeTaskRemovedFlag?.().catch(
    () => false,
   )) ?? false;

  if (wasTaskRemoved) {
   await clearBillableTravelSession();
   isTrackingRef.current = false;
   if (isMounted.current) {
    setIsTracking(false);
   }
   return;
  }

  const session = await readBillableTravelSession();
  const isBgRunning = BackgroundJob.isRunning();

  if (isBgRunning || session?.active) {
   if (session) {
    selectedProjectIdRef.current = session.projectId;
    if (
     typeof session.startLat === 'number' &&
     typeof session.startLng === 'number'
    ) {
     startCoordsRef.current = {
      latitude: session.startLat,
      longitude: session.startLng,
     };
    }
    startTimeRef.current = session.startTime ?? startTimeRef.current;
    travelLogIdRef.current = session.travelLogId ?? travelLogIdRef.current;
    distanceMetersRef.current =
     typeof session.distanceMeters === 'number'
      ? session.distanceMeters
      : distanceMetersRef.current;
    isTrackingRef.current = true;
    if (isMounted.current) {
     dispatch(setSelectedProject(session.projectId));
     setStartPurpose(session.purpose || '');
     setStartNotes(session.notes || '');
     if (startCoordsRef.current && !currentCoordsRef.current) {
      setCurrentCoords(startCoordsRef.current);
      setRouteCoords([startCoordsRef.current]);
     }
     setDistanceMeters(distanceMetersRef.current);
     setIsTracking(true);
    }
   } else if (isBgRunning) {
    isTrackingRef.current = true;
    if (isMounted.current) {
     setIsTracking(true);
    }
   }
  }
 }, [dispatch]);

 // AppState listener — registered ONCE on mount, never re-subscribed.
 // Registering inside an effect that depends on [isTracking] caused a new
 // listener to be added on every tracking toggle, leaking duplicate handlers.
 useEffect(() => {
  isMounted.current = true;

  const appStateSubscription = AppState.addEventListener(
   'change',
   nextAppState => {
    const prev = appStateRef.current;
    appStateRef.current = nextAppState;

    if (nextAppState === 'background') {
     console.log('[BillableTravel] App moved to background');
    } else if (nextAppState === 'active' && prev !== 'active') {
     console.log('[BillableTravel] App returned to foreground');
     syncTrackingState().catch(error =>
      console.warn('[BillableTravel] Tracking state sync failed', error),
     );
     const coords = currentCoordsRef.current;
     if (isTrackingRef.current && coords && mapRef.current) {
      requestAnimationFrame(() => {
       mapRef.current?.animateToRegion(
        {
         latitude: coords.latitude,
         longitude: coords.longitude,
         latitudeDelta: 0.01,
         longitudeDelta: 0.01,
        },
        400,
       );
      });
     }
    }
   },
  );

  return () => {
   isMounted.current = false;
   appStateSubscription.remove();
   stopLocationWatch();
   if (appStateRef.current === 'active') {
    cleanupTracking().catch(error =>
     console.warn('[BillableTravel] Cleanup on unmount failed', error),
    );
   }
  };
 }, [cleanupTracking, stopLocationWatch, syncTrackingState]);

 useEffect(() => {
  syncTrackingState().catch(error =>
   console.warn('[BillableTravel] Initial tracking state sync failed', error),
  );
 }, [syncTrackingState]);

 useEffect(() => {
  if (projects.length === 0) {
   dispatch(fetchProjects());
  }
 }, [dispatch, projects.length]);

 // Listen for the 'Stop Billable' button click via the notification event bus.
 useEffect(() => {
  const handleStop = () => {
   stopTracking().catch(error =>
    console.warn('[BillableTravel] Notification stop failed', error),
   );
  };
  notificationEvents.on('stop-billable', handleStop);
  return () => notificationEvents.off('stop-billable', handleStop);
 }, [stopTracking]);

 const selectedProject = useMemo(
  () => projects.find(p => p.id === selectedProjectId) || null,
  [projects, selectedProjectId],
 );

 const requestLocationPermission = async () => {
  if (Platform.OS === 'ios') {
   let status = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
   if (status === RESULTS.DENIED) {
    status = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
   }
   return status === RESULTS.GRANTED;
  } else {
   let status = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
   if (status === RESULTS.DENIED) {
    status = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
   }

   if (status === RESULTS.GRANTED) {
    let bgStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    if (bgStatus === RESULTS.DENIED) {
     await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    }
   }

   return status === RESULTS.GRANTED;
  }
 };

 const startTracking = async () => {
  if (isStartingRef.current || isTrackingRef.current) {
   return;
  }

  const projectIdForSession = selectedProjectIdRef.current ?? selectedProjectId;
  if (!projectIdForSession) {
   showDialog({
    title: 'Project Required',
    message: 'Please select a project before starting billable travel.',
    variant: 'warning',
    primaryAction: {label: 'Okay'},
   });
   return;
  }

  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
   showDialog({
    title: 'Permission Denied',
    message: 'Location access is required for billable travel tracking.',
    variant: 'error',
    primaryAction: {label: 'Settings', onPress: () => {}},
   });
   return;
  }

  setIsSubmitting(true);
  isStartingRef.current = true;
  try {
   await cleanupTracking({clearSession: false});
   resetTravelState();

   // Get initial position
   const position = await new Promise<Geolocation.GeoPosition>(
    (resolve, reject) => {
     Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
     });
    },
   );

   const coords = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
   };
   setCurrentCoords(coords);
   appendRoutePoint(coords);
   startCoordsRef.current = coords;
   const startTime = formatApiDateTime(new Date());
   startTimeRef.current = startTime;

   console.log(
    `[BillableTravel] Submitting initial API log with Purpose: "${
     startPurpose.trim() || DEFAULT_BILLABLE_PURPOSE
    }" | Notes: "${startNotes.trim() || DEFAULT_ACTIVE_NOTES}"`,
   );

   const initialResponse = await updateBillableLocationAPI(
    buildBillablePayload({
     projectId: projectIdForSession,
     startCoords: coords,
     endCoords: coords,
     distanceMeters: 0,
     startTime,
     endTime: startTime,
     purpose: startPurpose.trim() || DEFAULT_BILLABLE_PURPOSE,
     notes: startNotes.trim() || DEFAULT_ACTIVE_NOTES,
     status: 'active',
    }),
    authTokenRef.current,
   );
   travelLogIdRef.current = extractTravelLogId(initialResponse);

   // Start BackgroundJob to keep the app alive (creates a foreground service on Android)
   const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
   activeBackgroundRunId = runId;

   console.log(
    `[BillableTravel] Starting background job with Purpose: "${
     startPurpose.trim() || DEFAULT_BILLABLE_PURPOSE
    }" | Notes: "${startNotes.trim() || DEFAULT_ACTIVE_NOTES}"`,
   );

   if (BackgroundJob.isRunning()) {
    await BackgroundJob.stop().catch(() => null);
   }
   await BackgroundJob.start(backgroundTrackingTask, {
    ...backgroundTaskOptions,
    parameters: {
     token: authTokenRef.current ?? undefined,
     projectId: String(projectIdForSession),
     delay: 5000,
     runId,
     startLat: coords.latitude,
     startLng: coords.longitude,
     startTime,
     travelLogId: travelLogIdRef.current ?? undefined,
     purpose: startPurpose.trim() || DEFAULT_BILLABLE_PURPOSE,
     notes: startNotes.trim() || DEFAULT_ACTIVE_NOTES,
    },
   });
   await BillableTrackingControl?.startTaskRemovalWatcher?.().catch(() => null);

   // Start continuous location watching
   stopLocationWatch();

   watchId.current = Geolocation.watchPosition(
    location => {
     if (!isMounted.current) return;

     const lat = location.coords.latitude;
     const lng = location.coords.longitude;

     console.log(
      `[UI Tracking] AppState: ${AppState.currentState} | LAT: ${lat}, LNG: ${lng}`,
     );

     setCurrentCoords({latitude: lat, longitude: lng});
     const nextCoords = {latitude: lat, longitude: lng};
     appendRoutePoint(nextCoords);
     mapRef.current?.animateToRegion(
      {
       latitude: lat,
       longitude: lng,
       latitudeDelta: 0.01,
       longitudeDelta: 0.01,
      },
      600,
     );
     fullMapRef.current?.animateToRegion(
      {
       latitude: lat,
       longitude: lng,
       latitudeDelta: 0.02,
       longitudeDelta: 0.02,
      },
      600,
     );
    },
    error => {
     console.error('[Geolocation] Watch Error:', error);
    },
    {
     enableHighAccuracy: true,
     distanceFilter: 0,
     interval: 5000,
     fastestInterval: 2000,
     showsBackgroundLocationIndicator: true,
     forceRequestLocation: true,
     ...(Platform.OS === 'ios' ? {allowsBackgroundLocationUpdates: true} : {}),
    },
   );

   if (isMounted.current) {
    setIsTracking(true);
    persistBillableTravelSession(String(projectIdForSession), {
     startLat: coords.latitude,
     startLng: coords.longitude,
     startTime,
     travelLogId: travelLogIdRef.current ?? undefined,
     distanceMeters: 0,
     purpose: startPurpose.trim() || DEFAULT_BILLABLE_PURPOSE,
     notes: startNotes.trim() || DEFAULT_ACTIVE_NOTES,
    }).catch(() => null);
   }

   // FIXED: Show an interactive Notifee notification with a 'Stop' button
   await notifee.displayNotification({
    id: 'billable-tracking',
    title: 'Live Travel Tracking',
    body: 'Tracking billable travel location in background...',
    android: {
     channelId: 'maxxstation-alerts',
     smallIcon: 'ic_launcher',
     ongoing: true,
     pressAction: {id: 'default'},
     actions: [
      {
       title: 'Stop Billable',
       pressAction: {id: 'stop-billable'},
      },
     ],
    },
   });
  } catch (error: any) {
   await cleanupTracking();
   resetTravelState();
   if (isMounted.current) {
    showDialog({
     title: 'Start Failed',
     message: error.message || 'Unable to start billable travel session.',
     variant: 'error',
     primaryAction: {label: 'Retry'},
    });
   }
  } finally {
   isStartingRef.current = false;
   if (isMounted.current) {
    setIsSubmitting(false);
   }
  }
 };

 const toggleMapSize = () => {
  setIsMapModalVisible(true);
 };

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    style={StyleSheet.absoluteFill}
   />
   <View style={{padding: 14}}>
    <TopHeader title="Billable Travel" />
   </View>

   <View style={styles.container}>
    <AnimatedCard style={styles.projectCard} delay={100}>
     <Text style={styles.label}>Project</Text>
     <TouchableOpacity
      style={styles.projectSelector}
      onPress={() => setProjectPickerVisible(true)}
      disabled={isTracking}>
      <View style={styles.projectInfo}>
       <Feather name="briefcase" size={16} color={theme.colors.primary} />
       <Text
        style={[styles.projectText, !selectedProject && styles.placeholder]}>
        {selectedProject?.name || 'Choose a project'}
       </Text>
      </View>
      {!isTracking && (
       <Feather name="chevron-down" size={18} color={theme.colors.muted} />
      )}
     </TouchableOpacity>
    </AnimatedCard>

    {!isTracking ? (
     <AnimatedCard style={styles.optionalCard} delay={150}>
      <View style={styles.optionalHeader}>
       <Feather name="edit-3" size={14} color={theme.colors.primary} />
       <Text style={styles.optionalTitle}>Travel Details</Text>
      </View>
      <View style={styles.optionalInputContainer}>
       <View style={[styles.inputGroup, {marginRight: 8, flex: 1}]}>
        <Text style={styles.inputLabel}>Purpose</Text>
        <TextInput
         value={startPurpose}
         onChangeText={setStartPurpose}
         placeholder="Client Meeting"
         placeholderTextColor={theme.colors.muted}
         style={styles.optionalInput}
        />
       </View>
       <View style={[styles.inputGroup, {flex: 1.2}]}>
        <Text style={styles.inputLabel}>Notes</Text>
        <TextInput
         value={startNotes}
         onChangeText={setStartNotes}
         placeholder="Billable travel started"
         placeholderTextColor={theme.colors.muted}
         style={styles.optionalInput}
        />
       </View>
      </View>
     </AnimatedCard>
    ) : (
     <AnimatedCard style={styles.trackingDetailsCard} delay={150}>
      <View style={styles.trackingDetailRow}>
       <Feather name="tag" size={14} color={theme.colors.primary} />
       <View style={styles.trackingDetailTextGroup}>
        <Text style={styles.trackingDetailLabel}>Purpose</Text>
        <Text style={styles.trackingDetailValue}>
         {startPurpose || DEFAULT_BILLABLE_PURPOSE}
        </Text>
       </View>
      </View>
      <View style={[styles.trackingDetailRow, {marginTop: 10}]}>
       <Feather name="file-text" size={14} color={theme.colors.primary} />
       <View style={styles.trackingDetailTextGroup}>
        <Text style={styles.trackingDetailLabel}>Notes</Text>
        <Text style={styles.trackingDetailValue}>
         {startNotes || DEFAULT_ACTIVE_NOTES}
        </Text>
       </View>
      </View>
     </AnimatedCard>
    )}

    <View style={styles.mapContainer}>
     <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={{
       latitude: currentCoords?.latitude || 30.7196,
       longitude: currentCoords?.longitude || 76.7649,
       latitudeDelta: 0.01,
       longitudeDelta: 0.01,
      }}
      showsUserLocation
      showsMyLocationButton={false}>
      {routeCoords.length > 1 && (
       <Polyline
        coordinates={routeCoords}
        strokeColor={theme.colors.primary}
        strokeWidth={4}
        lineJoin="round"
        lineCap="round"
       />
      )}
      {routeCoords[0] && (
       <Marker coordinate={routeCoords[0]} anchor={{x: 0.5, y: 0.5}}>
        <View style={styles.markerWrapper}>
         <View style={[styles.customPin, {backgroundColor: '#10B981'}]}>
          <Feather name="map-pin" size={12} color="#FFF" />
         </View>
         <View style={[styles.pinTail, {borderTopColor: '#10B981'}]} />
         <Text style={[styles.markerLabel, {color: '#10B981'}]}>START</Text>
        </View>
       </Marker>
      )}
      {currentCoords && (
       <Marker
        coordinate={currentCoords}
        anchor={{x: 0.5, y: 0.5}}
        onPress={async () => {
         setSelectedPoint({
          title: 'Current Position',
          address: 'Locating...',
         });
         try {
          const addrString = `${currentCoords.latitude},${currentCoords.longitude}`;
          const geocoded = await geocodeAddressAPI(addrString, authToken ?? '');
          setSelectedPoint({
           title: 'Current Position',
           address: geocoded.address,
          });
         } catch {
          setSelectedPoint({
           title: 'Current Position',
           address: `${currentCoords.latitude.toFixed(
            6,
           )}, ${currentCoords.longitude.toFixed(6)}`,
          });
         }
        }}>
        <View style={styles.markerWrapper}>
         <View
          style={[styles.customPin, {backgroundColor: theme.colors.primary}]}>
          <Feather name="navigation" size={12} color="#FFF" />
         </View>
         <View
          style={[styles.pinTail, {borderTopColor: theme.colors.primary}]}
         />
         <Text style={styles.markerLabel}>LIVE</Text>
         {isTracking && <View style={styles.markerPulse} />}
        </View>
       </Marker>
      )}
     </MapView>

     <TouchableOpacity
      style={styles.mapExpandBtn}
      onPress={toggleMapSize}
      activeOpacity={0.8}>
      <Feather name="maximize-2" size={18} color="#FFF" />
     </TouchableOpacity>

     {isTracking && (
      <View style={styles.liveIndicator}>
       <View style={styles.liveDot} />
       <Text style={styles.liveText}>TRACKING LIVE</Text>
      </View>
     )}

     {/* Floating Detail Card */}
     {selectedPoint && (
      <AnimatedCard style={styles.floatingInfoCard} delay={0}>
       <View style={styles.calloutHeader}>
        <View style={styles.calloutTitleGroup}>
         <Feather name="map-pin" size={14} color={theme.colors.primary} />
         <Text style={styles.calloutTitle}>{selectedPoint.title}</Text>
        </View>
        <TouchableOpacity
         onPress={() => setSelectedPoint(null)}
         style={styles.closeCalloutBtn}>
         <Feather name="x" size={16} color={theme.colors.muted} />
        </TouchableOpacity>
       </View>
       <Text style={styles.calloutAddress}>{selectedPoint.address}</Text>
       <View style={styles.calloutStatus}>
        <View
         style={[
          styles.statusDot,
          {backgroundColor: isTracking ? '#10B981' : theme.colors.muted},
         ]}
        />
        <Text style={styles.statusLabel}>
         {isTracking ? 'Active Session' : 'Idle'}
        </Text>
       </View>
      </AnimatedCard>
     )}
    </View>

    <View style={styles.actionSection}>
     <ActionButton
      label={isTracking ? 'Stop Billable' : 'Start Billable'}
      icon={isTracking ? 'stop-circle' : 'play-circle'}
      onPress={isTracking ? requestStopTracking : startTracking}
      variant="primary"
      // @ts-ignore
      loading={isSubmitting}
      style={styles.mainBtn}
     />

     <TouchableOpacity
      style={styles.premiumCancelWrap}
      onPress={() => navigation.goBack()}
      disabled={isSubmitting}
      activeOpacity={0.8}>
      <LinearGradient
       colors={theme.isDark ? ['#1E293B', '#0F172A'] : ['#F8FAFC', '#F1F5F9']}
       style={styles.premiumCancelInner}>
       <Feather name="arrow-left" size={16} color={theme.colors.muted} />
       <Text style={styles.premiumCancelText}>Back to Attendance</Text>
      </LinearGradient>
     </TouchableOpacity>
    </View>
   </View>

   {/* Full Screen Map Modal */}
   <Modal visible={isMapModalVisible} transparent animationType="slide">
    <View style={styles.modalOverlay}>
     <View style={styles.modalContent}>
      <MapView
       ref={fullMapRef}
       provider={PROVIDER_GOOGLE}
       style={styles.fullScreenMap}
       showsUserLocation
       showsMyLocationButton
       initialRegion={{
        latitude: currentCoords?.latitude || 30.7196,
        longitude: currentCoords?.longitude || 76.7649,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
       }}>
       {routeCoords.length > 1 && (
        <Polyline
         coordinates={routeCoords}
         strokeColor={theme.colors.primary}
         strokeWidth={4}
         lineJoin="round"
         lineCap="round"
        />
       )}
       {routeCoords[0] && (
        <Marker coordinate={routeCoords[0]} title="Starting Point" />
       )}
       {currentCoords && (
        <Marker
         coordinate={currentCoords}
         title="Your Location"
         description="Real-time travel position"
        />
       )}
      </MapView>
      <TouchableOpacity
       style={styles.closeModalBtn}
       onPress={() => setIsMapModalVisible(false)}>
       <Feather name="x" size={24} color={theme.colors.text} />
      </TouchableOpacity>
     </View>
    </View>
   </Modal>

   <ProjectPickerModal
    visible={projectPickerVisible}
    onClose={() => setProjectPickerVisible(false)}
    theme={theme}
    projects={projects}
    selectedProjectId={selectedProjectId}
    onSelectProject={id => {
     dispatch(setSelectedProject(id));
     setProjectPickerVisible(false);
    }}
   />
  </SafeAreaView>
 );
}

const createStyles = (theme: AppTheme) =>
 StyleSheet.create({
  safe: {
   flex: 1,
  },
  container: {
   flex: 1,
   paddingHorizontal: 16,
   paddingTop: 8,
   paddingBottom: 20,
  },
  projectCard: {
   padding: 12,
   marginBottom: 12,
   borderRadius: 20,
   backgroundColor: theme.colors.card,
   borderWidth: 1,
   borderColor: theme.colors.border,
  },
  label: {
   fontSize: 11,
   fontWeight: '800',
   color: theme.colors.muted,
   textTransform: 'uppercase',
   letterSpacing: 1,
   marginBottom: 6,
  },
  projectSelector: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   backgroundColor: theme.isDark
    ? 'rgba(255,255,255,0.05)'
    : 'rgba(0,0,0,0.02)',
   padding: 12,
   borderRadius: 14,
   borderWidth: 1,
   borderColor: theme.colors.border,
  },
  projectInfo: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 10,
  },
  projectText: {
   fontSize: 15,
   fontWeight: '700',
   color: theme.colors.text,
  },
  placeholder: {
   color: theme.colors.muted,
  },
  mapContainer: {
   flex: 1,
   maxHeight: 380,
   borderRadius: 28,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor: theme.colors.border,
   backgroundColor: theme.colors.card,
   position: 'relative',
   marginBottom: 16,
  },
  mapExpandBtn: {
   position: 'absolute',
   right: 16,
   top: 16,
   width: 42,
   height: 42,
   borderRadius: 21,
   backgroundColor: 'rgba(15, 23, 42, 0.75)',
   alignItems: 'center',
   justifyContent: 'center',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.1)',
  },
  liveIndicator: {
   position: 'absolute',
   left: 16,
   top: 16,
   flexDirection: 'row',
   alignItems: 'center',
   backgroundColor: 'rgba(239, 68, 68, 0.95)',
   paddingHorizontal: 12,
   paddingVertical: 6,
   borderRadius: 24,
   gap: 8,
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.2)',
  },
  liveDot: {
   width: 8,
   height: 8,
   borderRadius: 4,
   backgroundColor: '#FFF',
  },
  liveText: {
   color: '#FFF',
   fontSize: 10,
   fontWeight: '900',
   letterSpacing: 0.8,
  },
  actionSection: {
   gap: 10,
  },
  mainBtn: {
   height: 64,
   borderRadius: 20,
   shadowColor: theme.colors.primary,
   shadowOffset: {width: 0, height: 8},
   shadowOpacity: 0.2,
   shadowRadius: 16,
   elevation: 8,
  },
  premiumCancelWrap: {
   borderRadius: 20,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor: theme.colors.border,
  },
  premiumCancelInner: {
   height: 54,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   gap: 8,
  },
  premiumCancelText: {
   color: theme.colors.text,
   fontSize: 14,
   fontWeight: '700',
  },
  modalOverlay: {
   flex: 1,
   backgroundColor: 'rgba(0,0,0,0.85)',
   justifyContent: 'center',
   alignItems: 'center',
  },
  modalContent: {
   width: '94%',
   height: '80%',
   backgroundColor: theme.colors.background,
   borderRadius: 32,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor: theme.colors.border,
  },
  fullScreenMap: {
   flex: 1,
  },
  closeModalBtn: {
   position: 'absolute',
   top: 20,
   right: 20,
   width: 48,
   height: 48,
   borderRadius: 24,
   backgroundColor: theme.colors.card,
   alignItems: 'center',
   justifyContent: 'center',
   borderWidth: 1,
   borderColor: theme.colors.border,
   shadowColor: '#000',
   shadowOpacity: 0.2,
   shadowRadius: 8,
   elevation: 10,
  },
  markerWrapper: {
   alignItems: 'center',
   justifyContent: 'center',
  },
  customPin: {
   width: 32,
   height: 32,
   borderRadius: 16,
   alignItems: 'center',
   justifyContent: 'center',
   borderWidth: 3,
   borderColor: '#FFF',
   elevation: 10,
   shadowColor: '#000',
   shadowOpacity: 0.3,
   shadowRadius: 5,
   zIndex: 10,
  },
  pinTail: {
   width: 0,
   height: 0,
   backgroundColor: 'transparent',
   borderStyle: 'solid',
   borderLeftWidth: 6,
   borderRightWidth: 6,
   borderTopWidth: 10,
   borderLeftColor: 'transparent',
   borderRightColor: 'transparent',
   marginTop: -3,
   zIndex: 5,
  },
  markerLabel: {
   fontSize: 9,
   fontWeight: '900',
   color: theme.colors.primary,
   marginTop: 2,
   backgroundColor: theme.colors.background,
   paddingHorizontal: 4,
   paddingVertical: 1,
   borderRadius: 4,
   borderWidth: 1,
   borderColor: theme.colors.primary,
   overflow: 'hidden',
  },
  markerPulse: {
   width: 48,
   height: 48,
   borderRadius: 24,
   backgroundColor: 'rgba(59, 130, 246, 0.25)',
   position: 'absolute',
   zIndex: 1,
  },
  floatingInfoCard: {
   position: 'absolute',
   bottom: 16,
   left: 16,
   right: 16,
   backgroundColor: '#1E1035',
   padding: 16,
   borderRadius: 24,
   borderWidth: 1.5,
   borderColor: 'rgba(255,255,255,0.2)',
   elevation: 20,
   shadowColor: '#000',
   shadowOpacity: 0.4,
   shadowRadius: 15,
  },
  calloutHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: 8,
  },
  calloutTitleGroup: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
  },
  calloutTitle: {
   fontSize: 14,
   fontWeight: '900',
   color: '#FFF',
   letterSpacing: 0.5,
  },
  closeCalloutBtn: {
   padding: 4,
  },
  calloutAddress: {
   fontSize: 13,
   color: 'rgba(255,255,255,0.7)',
   fontWeight: '600',
   lineHeight: 18,
   marginBottom: 12,
  },
  calloutStatus: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
   backgroundColor: 'rgba(255,255,255,0.1)',
   alignSelf: 'flex-start',
   paddingHorizontal: 10,
   paddingVertical: 5,
   borderRadius: 12,
  },
  statusDot: {
   width: 6,
   height: 6,
   borderRadius: 3,
  },
  statusLabel: {
   fontSize: 10,
   fontWeight: '800',
   color: '#FFF',
   textTransform: 'uppercase',
   letterSpacing: 0.5,
  },
  optionalCard: {
   padding: 12,
   marginBottom: 12,
   borderRadius: 20,
   backgroundColor: theme.colors.card,
   borderWidth: 1,
   borderColor: theme.colors.border,
  },
  optionalHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
   marginBottom: 10,
  },
  optionalTitle: {
   fontSize: 12,
   fontWeight: '800',
   color: theme.colors.text,
   letterSpacing: 0.5,
  },
  optionalInputContainer: {
   flexDirection: 'row',
   alignItems: 'center',
  },
  inputGroup: {
   flexDirection: 'column',
  },
  inputLabel: {
   fontSize: 10,
   fontWeight: '700',
   color: theme.colors.muted,
   textTransform: 'uppercase',
   marginBottom: 4,
   letterSpacing: 0.5,
  },
  optionalInput: {
   height: 40,
   borderRadius: 10,
   borderWidth: 1,
   borderColor: theme.colors.border,
   backgroundColor: theme.isDark
    ? 'rgba(255,255,255,0.03)'
    : 'rgba(0,0,0,0.01)',
   color: theme.colors.text,
   paddingHorizontal: 10,
   fontSize: 13,
   fontWeight: '600',
  },
  trackingDetailsCard: {
   padding: 12,
   marginBottom: 12,
   borderRadius: 20,
   backgroundColor: theme.colors.card,
   borderWidth: 1,
   borderColor: theme.colors.border,
  },
  trackingDetailRow: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 10,
  },
  trackingDetailTextGroup: {
   flexDirection: 'column',
  },
  trackingDetailLabel: {
   fontSize: 9,
   fontWeight: '800',
   color: theme.colors.muted,
   textTransform: 'uppercase',
   letterSpacing: 0.5,
  },
  trackingDetailValue: {
   fontSize: 13,
   fontWeight: '700',
   color: theme.colors.text,
   marginTop: 1,
  },
 });
