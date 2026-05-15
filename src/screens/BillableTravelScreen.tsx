import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import notifee from '@notifee/react-native';
import {
 Platform,
 StyleSheet,
 Text,
 TouchableOpacity,
 View,
 AppState,
 Modal,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
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
} from '../services/billableTravelSessionStorage';

const sleep = (time: number) =>
 new Promise<void>(resolve => setTimeout(resolve, time));

let activeBackgroundRunId: string | null = null;

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
}) => {
 const {token, projectId, delay = 10000, runId} = taskData || {};

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
   if (projectId && token) {
    console.log(`[BG Task] Sending coordinates: ${latitude}, ${longitude}`);
    await updateBillableLocationAPI(
     {project_id: Number(projectId), latitude, longitude},
     token,
    );
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
 const [selectedPoint, setSelectedPoint] = useState<{
  title: string;
  address: string;
 } | null>(null);

 const watchId = useRef<number | null>(null);
 const mapRef = useRef<MapView>(null);
 const isMounted = useRef(true);
 const isStartingRef = useRef(false);
 const isStoppingRef = useRef(false);
 const appStateRef = useRef(AppState.currentState);
 // Stable ref for selectedProjectId so BG location callback never has stale closure
 const selectedProjectIdRef = useRef(selectedProjectId);
 const authTokenRef = useRef(authToken);
 const isTrackingRef = useRef(isTracking);
 const currentCoordsRef = useRef<LatLng | null>(null);

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
  await notifee.stopForegroundService().catch(() => null);
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

 const stopTracking = useCallback(async () => {
  if (isStoppingRef.current) {
   return;
  }
  isStoppingRef.current = true;
  try {
   await cleanupTracking();
   if (isMounted.current) {
    setIsTracking(false);
   }
  } finally {
   isStoppingRef.current = false;
  }
 }, [cleanupTracking]);

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
   cleanupTracking().catch(error =>
    console.warn('[BillableTravel] Cleanup on unmount failed', error),
   );
  };
 }, [cleanupTracking]);

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

   // Start BackgroundJob to keep the app alive (creates a foreground service on Android)
   const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
   activeBackgroundRunId = runId;
   if (!BackgroundJob.isRunning()) {
    await BackgroundJob.start(backgroundTrackingTask, {
     ...backgroundTaskOptions,
     parameters: {
      token: authTokenRef.current ?? undefined,
      projectId: String(projectIdForSession),
      delay: 5000,
      runId,
     },
    });
   }

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
    persistBillableTravelSession(String(projectIdForSession)).catch(() => null);
   }

   // FIXED: Show an interactive Notifee notification with a 'Stop' button
   await notifee.displayNotification({
    id: 'billable-tracking',
    title: 'Live Travel Tracking',
    body: 'Tracking billable travel location in background...',
    android: {
     channelId: 'maxxstation-alerts',
     smallIcon: 'ic_launcher',
     asForegroundService: true,
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
   <TopHeader title="Billable Travel" />

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
      onPress={isTracking ? stopTracking : startTracking}
      variant={isTracking ? 'secondary' : 'primary'}
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
 });
