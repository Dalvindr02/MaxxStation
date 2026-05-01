import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
 ActivityIndicator,
 Modal,
 ScrollView,
 StyleSheet,
 Switch,
 Text,
 TextInput,
 TouchableOpacity,
 View,
} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import {GooglePlacesAutocomplete} from 'react-native-google-places-autocomplete';
import {AnimatedCard} from '../components/ui';
import {TopHeader} from '../components/TopHeader';
import {useAppTheme} from '../context/ThemeContext';
import {useDialog} from '../context/DialogContext';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {fetchProjects} from '../store/projectsSlice';
import {RootStackParamList} from '../navigation/types';
import {
 LatLng,
 WORK_LOCATION,
 getDistanceMeters,
} from '../constants/workLocation';
import {GOOGLE_MAPS_WEB_API_KEY} from '../services/googleMapsService';
import {createManualLogRequest} from '../services/manualLogService';
import {buildTravelAuditResult} from '../services/travelAuditService';
import {AppTheme} from '../theme';

type TravelStop = {
 id: string;
 label: string;
 coords: LatLng;
};

type TravelRouteOption = {
 id: string;
 label: string;
 points: LatLng[];
 distanceKm: string;
 durationMin: number;
 distanceMeters: number;
 durationSeconds: number;
 summary: string;
};

const nudgePoint = (
 point: LatLng,
 latitudeDelta: number,
 longitudeDelta: number,
) => ({
 latitude: point.latitude + latitudeDelta,
 longitude: point.longitude + longitudeDelta,
});

const midpoint = (from: LatLng, to: LatLng) => ({
 latitude: (from.latitude + to.latitude) / 2,
 longitude: (from.longitude + to.longitude) / 2,
});

const buildFallbackRoutes = (
 from: LatLng,
 to: LatLng,
 stops: TravelStop[],
): TravelRouteOption[] => {
 const distanceMeters = getDistanceMeters(from, to);
 const stopPenalty = stops.length * 8;
 const mid = midpoint(from, to);
 const stopPoints = stops.map(stop => stop.coords);

 return [
  {
   id: 'fastest-route',
   label: 'Fastest route',
   points: [from, ...stopPoints, to],
   distanceKm: (distanceMeters / 1000).toFixed(1),
   durationMin: Math.max(12, Math.round(distanceMeters / 500) + stopPenalty),
   distanceMeters,
   durationSeconds:
    Math.max(12, Math.round(distanceMeters / 500) + stopPenalty) * 60,
   summary: 'Fastest route',
  },
  {
   id: 'alternate-route',
   label: 'Alternate route',
   points: [from, nudgePoint(mid, 0.0045, -0.0035), ...stopPoints, to],
   distanceKm: ((distanceMeters * 1.12) / 1000).toFixed(1),
   durationMin: Math.max(16, Math.round(distanceMeters / 430) + stopPenalty),
   distanceMeters: Math.round(distanceMeters * 1.12),
   durationSeconds:
    Math.max(16, Math.round(distanceMeters / 430) + stopPenalty) * 60,
   summary: 'Alternate route',
  },
  {
   id: 'client-detour',
   label: 'Client detour',
   points: [from, nudgePoint(mid, -0.0055, 0.004), ...stopPoints, to],
   distanceKm: ((distanceMeters * 1.24) / 1000).toFixed(1),
   durationMin: Math.max(18, Math.round(distanceMeters / 390) + stopPenalty),
   distanceMeters: Math.round(distanceMeters * 1.24),
   durationSeconds:
    Math.max(18, Math.round(distanceMeters / 390) + stopPenalty) * 60,
   summary: 'Client detour',
  },
 ];
};

const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (value: Date) =>
 `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const timeValue = (value: Date) =>
 `${pad(value.getHours())}:${pad(value.getMinutes())}`;

export default function AttendanceTravelScreen() {
 const route = useRoute<RouteProp<RootStackParamList, 'AttendanceTravel'>>();
 const navigation = useNavigation();
 const dispatch = useAppDispatch();
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const {showDialog} = useDialog();
 const isMounted = useRef(true);
 const authToken = useAppSelector(state => state.auth.token);
 const selectedProjectId = useAppSelector(
  state => state.projects.selectedProjectId,
 );
 const projects = useAppSelector(state => state.projects.items);
 const selectedProject =
  projects.find(project => project.id === selectedProjectId) ?? null;
 const initialFrom = route.params?.fromCoords ?? WORK_LOCATION;
 const initialTo =
  route.params?.toCoords ?? nudgePoint(initialFrom, -0.012, 0.018);
 const [mode, setMode] = useState<'tracking' | 'manual'>(
  route.params?.mode === 'billable' ? 'tracking' : 'manual',
 );
 const [billable, setBillable] = useState(true);
 const [startedAt, setStartedAt] = useState(
  route.params?.mode === 'billable' ? Date.now() : null,
 );
 const [now, setNow] = useState(Date.now());
 const [fromLabel, setFromLabel] = useState(
  route.params?.mode === 'billable' ? 'Office exit point' : 'From location',
 );
 const [toLabel, setToLabel] = useState(
  route.params?.mode === 'billable' ? 'Current live location' : 'To location',
 );
 const [fromCoords, setFromCoords] = useState<LatLng>(initialFrom);
 const [toCoords, setToCoords] = useState<LatLng>(initialTo);
 const [stops, setStops] = useState<TravelStop[]>([]);
 const [topic, setTopic] = useState('');
 const [description, setDescription] = useState('');
 const [fetchingRoutes, setFetchingRoutes] = useState(false);
 const [routeError, setRouteError] = useState<string | null>(null);
 const [serverRoutes, setServerRoutes] = useState<TravelRouteOption[]>([]);
 const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
 const [saving, setSaving] = useState(false);
 const [mapModalVisible, setMapModalVisible] = useState(false);

 useEffect(() => {
  isMounted.current = true;
  return () => {
   isMounted.current = false;
  };
 }, []);

 useEffect(() => {
  if (authToken) {
   dispatch(fetchProjects());
  }
 }, [authToken, dispatch]);

 useEffect(() => {
  const timer = setInterval(() => setNow(Date.now()), 60000);
  return () => clearInterval(timer);
 }, []);

 const fallbackRoutes = useMemo(
  () => buildFallbackRoutes(fromCoords, toCoords, stops),
  [fromCoords, stops, toCoords],
 );
 const routeOptions = serverRoutes.length ? serverRoutes : fallbackRoutes;
 const selectedRoute =
  routeOptions.find(option => option.id === selectedRouteId) ??
  routeOptions[0] ??
  null;
 const activeMinutes = startedAt
  ? Math.max(1, Math.round((now - startedAt) / 60000))
  : selectedRoute?.durationMin ?? 0;
 const mapCenter = midpoint(fromCoords, toCoords);
 const auditResult = selectedRoute
  ? buildTravelAuditResult({
     actualDurationMinutes: activeMinutes,
     routeDurationMinutes: selectedRoute.durationMin,
     actualDistanceMeters: selectedRoute.distanceMeters,
     routeDistanceMeters: selectedRoute.distanceMeters,
    })
  : null;
 const canSave =
  mode === 'manual' &&
  fromLabel.trim().length > 0 &&
  toLabel.trim().length > 0 &&
  topic.trim().length > 0 &&
  description.trim().length > 0 &&
  Boolean(selectedRoute) &&
  Boolean(selectedProject);

 useEffect(() => {
  if (!routeOptions.length) {
   setSelectedRouteId(null);
   return;
  }
  if (
   !selectedRouteId ||
   !routeOptions.some(option => option.id === selectedRouteId)
  ) {
   setSelectedRouteId(routeOptions[0].id);
  }
 }, [routeOptions, selectedRouteId]);

 useEffect(() => {
  if (mode !== 'manual') return;
  setFetchingRoutes(true);
  setRouteError(null);
 }, [fromCoords, toCoords, stops, mode]);

 const addStopFromMap = useCallback((event: any) => {
  const coordinate = event?.nativeEvent?.coordinate;
  if (!coordinate) return;
  setStops(previous => [
   ...previous,
   {
    id: `stop-${Date.now()}-${previous.length}`,
    label: `Stop ${previous.length + 1}`,
    coords: coordinate,
   },
  ]);
 }, []);

 const updateStopCoordinate = useCallback((stopId: string, coords: LatLng) => {
  setStops(previous =>
   previous.map(stop => (stop.id === stopId ? {...stop, coords} : stop)),
  );
 }, []);

 const handleStopTracking = () => {
  setMode('manual');
  setStartedAt(null);
  if (!topic.trim()) setTopic('Billable travel');
  if (!description.trim()) {
   setDescription('Work-related travel captured from attendance.');
  }
 };

 const handleSave = () => {
  if (!canSave || !selectedRoute || !selectedProject) {
   showDialog({
    title: 'Travel log incomplete',
    message: !selectedProject
     ? 'Select a project in Logs first, then save this travel log.'
     : 'Enter from/to locations, topic, description, and select a route.',
    variant: 'error',
    primaryAction: {label: 'Okay'},
   });
   return;
  }

  const projectIdNumber = Number(selectedProject.id);
  if (Number.isNaN(projectIdNumber)) {
   showDialog({
    title: 'Invalid project',
    message: 'Selected project id is invalid.',
    variant: 'error',
    primaryAction: {label: 'Okay'},
   });
   return;
  }

  const startDate = new Date();
  const endDate = new Date(
   startDate.getTime() + selectedRoute.durationSeconds * 1000,
  );
  setSaving(true);
  createManualLogRequest(
   {
    meeting_type: 'Offline',
    start_time: `${timeValue(startDate)}:00`,
    end_time: `${timeValue(endDate)}:00`,
    start_date_time: `${dateKey(startDate)} ${timeValue(startDate)}:00`,
    end_date_time: `${dateKey(endDate)} ${timeValue(endDate)}:00`,
    choose_participant: selectedProject.tasks[0]?.id ?? '5',
    billable: billable ? '1' : '0',
    meeting_agenda: `${topic.trim()} | ${description.trim()}`,
    project_id: projectIdNumber,
    from_location: fromLabel.trim(),
    to_location: toLabel.trim(),
    route_distance_meters: selectedRoute.distanceMeters,
    route_duration_seconds: selectedRoute.durationSeconds,
    route_polyline: JSON.stringify(selectedRoute.points),
    route_summary: selectedRoute.summary,
    audit_status: auditResult?.status ?? 'review',
    audit_flags: auditResult?.flags.join(' | ') ?? '',
   },
   authToken,
  )
   .then(() => {
    showDialog({
     title: 'Travel log saved',
     message: `${fromLabel} to ${toLabel} saved as ${
      billable ? 'billable' : 'non-billable'
     } travel.`,
     variant: 'success',
     primaryAction: {label: 'Okay', onPress: () => navigation.goBack()},
    });
   })
   .catch(error => {
    showDialog({
     title: 'Save failed',
     message:
      error instanceof Error ? error.message : 'Unable to create travel log.',
     variant: 'error',
     primaryAction: {label: 'Okay'},
    });
   })
   .finally(() => {
    if (isMounted.current) setSaving(false);
   });
 };

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title={mode === 'tracking' ? 'Billable Travel' : 'Manual Log'} />
   <ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerStyle={styles.scrollContent}>
    {mode === 'tracking' ? (
     <AnimatedCard style={styles.card} delay={40}>
      <View style={styles.liveHeader}>
       <View>
        <Text allowFontScaling={false} style={styles.sectionTitle}>
         Billable travel live
        </Text>
        <Text allowFontScaling={false} style={styles.helperText}>
         Stop travel when the visit ends, then review and save the route.
        </Text>
       </View>
       <View style={styles.liveBadge}>
        <Text allowFontScaling={false} style={styles.liveBadgeText}>
         {activeMinutes} min
        </Text>
       </View>
      </View>
      <TouchableOpacity
       style={styles.primaryButton}
       onPress={handleStopTracking}>
       <Feather name="pause-circle" size={15} color="#FFFFFF" />
       <Text allowFontScaling={false} style={styles.primaryButtonText}>
        Stop and review route
       </Text>
      </TouchableOpacity>
     </AnimatedCard>
    ) : null}

    <AnimatedCard style={styles.card} delay={80}>
     <Text allowFontScaling={false} style={styles.sectionTitle}>
      Route map
     </Text>
     <View style={styles.mapContainer}>
      <MapView
       provider={PROVIDER_GOOGLE}
       style={styles.map}
       onPress={addStopFromMap}
       initialRegion={{
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
       }}
       region={{
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
       }}>
       <Marker
        coordinate={fromCoords}
        title={fromLabel || 'From'}
        pinColor="#2563EB"
        draggable
        onDragEnd={event => setFromCoords(event.nativeEvent.coordinate)}
       />
       <Marker
        coordinate={toCoords}
        title={toLabel || 'To'}
        pinColor="#DC2626"
        draggable
        onDragEnd={event => setToCoords(event.nativeEvent.coordinate)}
       />
       {stops.map(stop => (
        <Marker
         key={stop.id}
         coordinate={stop.coords}
         title={stop.label}
         pinColor="#F59E0B"
         draggable
         onDragEnd={event =>
          updateStopCoordinate(stop.id, event.nativeEvent.coordinate)
         }
        />
       ))}
       {mode === 'manual' ? (
        <MapViewDirections
         origin={fromCoords}
         destination={toCoords}
         waypoints={stops.map(stop => stop.coords)}
         apikey={GOOGLE_MAPS_WEB_API_KEY}
         strokeWidth={4}
         strokeColor={theme.colors.primary}
         optimizeWaypoints
         onReady={(result: any) => {
          setFetchingRoutes(false);
          const routeOption: TravelRouteOption = {
           id: 'google-directions-route',
           label: 'Suggested route',
           points: result.coordinates,
           distanceKm: result.distance.toFixed(1),
           durationMin: Math.max(1, Math.round(result.duration)),
           distanceMeters: Math.round(result.distance * 1000),
           durationSeconds: Math.max(1, Math.round(result.duration * 60)),
           summary: 'Suggested route',
          };
          setServerRoutes([routeOption]);
          setSelectedRouteId(routeOption.id);
         }}
         onError={(error: any) => {
          setFetchingRoutes(false);
          setRouteError(
           error?.message ??
            'Unable to load route. Please check the locations.',
          );
         }}
        />
       ) : null}
      </MapView>
      <TouchableOpacity
       style={styles.mapExpandButton}
       onPress={() => setMapModalVisible(true)}
       activeOpacity={0.85}>
       <Feather name="maximize" size={18} color="#FFFFFF" />
      </TouchableOpacity>
     </View>
     <Text allowFontScaling={false} style={styles.helperText}>
      Drag pins to edit the route. Tap the map to add stops.
     </Text>
    </AnimatedCard>

    <AnimatedCard style={styles.card} delay={120}>
     <Text allowFontScaling={false} style={styles.sectionTitle}>
      Manual travel details
     </Text>
     <GooglePlacesAutocomplete
      placeholder="From location"
      fetchDetails
      onPress={(data: any, details: any = null) => {
       if (!details?.geometry?.location) return;
       setFromLabel(
        String(
         details.formatted_address ??
          data.description ??
          data.structured_formatting?.main_text ??
          'From location',
        ),
       );
       setFromCoords({
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
       });
      }}
      query={{
       key: GOOGLE_MAPS_WEB_API_KEY,
       language: 'en',
       components: 'country:in',
      }}
      styles={{
       textInput: styles.input,
       textInputContainer: styles.placesTextInputContainer,
       listView: styles.placesListView,
       row: styles.placesRow,
       description: styles.suggestionTitle,
      }}
      enablePoweredByContainer={false}
      nearbyPlacesAPI="GooglePlacesSearch"
      debounce={350}
      textInputProps={{
       placeholderTextColor: 'rgba(255,255,255,0.46)',
       value: fromLabel,
       onChangeText: setFromLabel,
      }}
     />
     <GooglePlacesAutocomplete
      placeholder="To location"
      fetchDetails
      onPress={(data: any, details: any = null) => {
       if (!details?.geometry?.location) return;
       setToLabel(
        String(
         details.formatted_address ??
          data.description ??
          data.structured_formatting?.main_text ??
          'To location',
        ),
       );
       setToCoords({
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
       });
      }}
      query={{
       key: GOOGLE_MAPS_WEB_API_KEY,
       language: 'en',
       components: 'country:in',
      }}
      styles={{
       textInput: styles.input,
       textInputContainer: styles.placesTextInputContainer,
       listView: styles.placesListView,
       row: styles.placesRow,
       description: styles.suggestionTitle,
      }}
      enablePoweredByContainer={false}
      nearbyPlacesAPI="GooglePlacesSearch"
      debounce={350}
      textInputProps={{
       placeholderTextColor: 'rgba(255,255,255,0.46)',
       value: toLabel,
       onChangeText: setToLabel,
      }}
     />
     {routeError ? (
      <Text allowFontScaling={false} style={styles.errorText}>
       {routeError}
      </Text>
     ) : null}
     <TextInput
      style={styles.input}
      placeholder="Travel/work topic"
      placeholderTextColor="rgba(255,255,255,0.46)"
      value={topic}
      onChangeText={setTopic}
     />
     <TextInput
      style={[styles.input, styles.multilineInput]}
      placeholder="Description"
      placeholderTextColor="rgba(255,255,255,0.46)"
      value={description}
      onChangeText={setDescription}
      multiline
     />
     <View style={styles.billableRow}>
      <Text allowFontScaling={false} style={styles.helperText}>
       Billable travel
      </Text>
      <Switch value={billable} onValueChange={setBillable} />
     </View>
    </AnimatedCard>

    <AnimatedCard style={styles.card} delay={160}>
     <Text allowFontScaling={false} style={styles.sectionTitle}>
      Suggested routes
     </Text>
     {fetchingRoutes ? (
      <Text allowFontScaling={false} style={styles.helperText}>
       Fetching Google Maps route suggestions...
      </Text>
     ) : null}
     {routeOptions.map(option => {
      const selected = selectedRoute?.id === option.id;
      return (
       <TouchableOpacity
        key={option.id}
        style={[styles.routeCard, selected && styles.routeCardActive]}
        onPress={() => setSelectedRouteId(option.id)}>
        <View style={styles.routeHeader}>
         <Text
          allowFontScaling={false}
          style={[styles.routeTitle, selected && styles.routeTitleActive]}>
          {option.label}
         </Text>
         <Feather
          name={selected ? 'check-circle' : 'circle'}
          size={17}
          color={selected ? theme.colors.primary : theme.colors.muted}
         />
        </View>
        <Text allowFontScaling={false} style={styles.helperText}>
         {option.distanceKm} km • {option.durationMin} min
        </Text>
       </TouchableOpacity>
      );
     })}
     <Text allowFontScaling={false} style={styles.stopTitle}>
      Stops
     </Text>
     {stops.length ? (
      <View style={styles.stopWrap}>
       {stops.map((stop, index) => (
        <TouchableOpacity
         key={stop.id}
         style={styles.stopChip}
         onPress={() =>
          setStops(previous => previous.filter(item => item.id !== stop.id))
         }>
         <Text allowFontScaling={false} style={styles.stopText}>
          {stop.label || `Stop ${index + 1}`}
         </Text>
         <Feather name="x" size={12} color={theme.colors.primary} />
        </TouchableOpacity>
       ))}
      </View>
     ) : (
      <Text allowFontScaling={false} style={styles.helperText}>
       No stops added.
      </Text>
     )}
     {auditResult ? (
      <View style={styles.auditCard}>
       <Text allowFontScaling={false} style={styles.routeTitle}>
        Audit preview
       </Text>
       <Text allowFontScaling={false} style={styles.helperText}>
        {auditResult.summary}
       </Text>
      </View>
     ) : null}
    </AnimatedCard>

    <TouchableOpacity
     style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
     disabled={!canSave || saving}
     onPress={handleSave}>
     {saving ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
     ) : (
      <Feather name="save" size={15} color="#FFFFFF" />
     )}
     <Text allowFontScaling={false} style={styles.primaryButtonText}>
      {saving ? 'Saving...' : 'Save travel log'}
     </Text>
    </TouchableOpacity>
   </ScrollView>
   <Modal visible={mapModalVisible} transparent animationType="fade">
    <View style={styles.mapModalOverlay}>
     <View style={styles.mapModalContent}>
      <MapView
       provider={PROVIDER_GOOGLE}
       style={styles.fullScreenMap}
       onPress={addStopFromMap}
       initialRegion={{
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
       }}
       region={{
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
       }}>
       <Marker
        coordinate={fromCoords}
        title={fromLabel || 'From'}
        pinColor="#2563EB"
        draggable
        onDragEnd={event => setFromCoords(event.nativeEvent.coordinate)}
       />
       <Marker
        coordinate={toCoords}
        title={toLabel || 'To'}
        pinColor="#DC2626"
        draggable
        onDragEnd={event => setToCoords(event.nativeEvent.coordinate)}
       />
       {stops.map(stop => (
        <Marker
         key={stop.id}
         coordinate={stop.coords}
         title={stop.label}
         pinColor="#F59E0B"
         draggable
         onDragEnd={event =>
          updateStopCoordinate(stop.id, event.nativeEvent.coordinate)
         }
        />
       ))}
       {mode === 'manual' ? (
        <MapViewDirections
         origin={fromCoords}
         destination={toCoords}
         waypoints={stops.map(stop => stop.coords)}
         apikey={GOOGLE_MAPS_WEB_API_KEY}
         strokeWidth={4}
         strokeColor={theme.colors.primary}
         optimizeWaypoints
         onReady={(result: any) => {
          setFetchingRoutes(false);
          const routeOption: TravelRouteOption = {
           id: 'google-directions-route',
           label: 'Suggested route',
           points: result.coordinates,
           distanceKm: result.distance.toFixed(1),
           durationMin: Math.max(1, Math.round(result.duration)),
           distanceMeters: Math.round(result.distance * 1000),
           durationSeconds: Math.max(1, Math.round(result.duration * 60)),
           summary: 'Suggested route',
          };
          setServerRoutes([routeOption]);
          setSelectedRouteId(routeOption.id);
         }}
         onError={(error: any) => {
          setFetchingRoutes(false);
          setRouteError(
           error?.message ??
            'Unable to load route. Please check the locations.',
          );
         }}
        />
       ) : null}
      </MapView>
      <TouchableOpacity
       style={styles.mapModalCloseButton}
       onPress={() => setMapModalVisible(false)}
       activeOpacity={0.85}>
       <Feather name="x" size={24} color="#FFFFFF" />
      </TouchableOpacity>
     </View>
    </View>
   </Modal>
  </SafeAreaView>
 );
}

const createStyles = (theme: AppTheme) =>
 StyleSheet.create({
  safe: {
   flex: 1,
   backgroundColor: theme.colors.background,
  },
  backgroundGradient: {
   ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
   paddingHorizontal: 18,
   paddingBottom: 38,
   gap: 16,
  },
  card: {
   //  borderWidth: 1,
   //  borderColor: theme.colors.border,
   //  backgroundColor: theme.colors.card,
  },
  sectionTitle: {
   color: theme.colors.text,
   fontSize: 17,
   fontWeight: '800',
  },
  helperText: {
   marginTop: 5,
   color: theme.colors.muted,
   fontSize: 12,
   lineHeight: 18,
  },
  liveHeader: {
   flexDirection: 'row',
   alignItems: 'flex-start',
   gap: 12,
  },
  liveBadge: {
   borderRadius: 999,
   paddingHorizontal: 12,
   paddingVertical: 8,
   backgroundColor: 'rgba(16,185,129,0.18)',
   borderWidth: 1,
   borderColor: 'rgba(16,185,129,0.4)',
  },
  liveBadgeText: {
   color: theme.colors.success,
   fontSize: 12,
   fontWeight: '800',
  },
  mapContainer: {
   position: 'relative',
   height: 260,
   marginTop: 14,
   borderRadius: 18,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor: theme.colors.border,
  },
  map: {
   flex: 1,
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
  input: {
   minHeight: 48,
   marginTop: 12,
   borderRadius: 12,
   borderWidth: 1,
   borderColor: theme.colors.border,
   backgroundColor: theme.colors.chip,
   paddingHorizontal: 14,
   color: theme.colors.text,
   fontSize: 13,
  },
  placesTextInputContainer: {
   backgroundColor: 'transparent',
   borderTopWidth: 0,
   borderBottomWidth: 0,
   paddingHorizontal: 0,
  },
  placesListView: {
   backgroundColor: theme.colors.card,
   marginTop: 4,
   borderRadius: 12,
   overflow: 'hidden',
  },
  placesRow: {
   backgroundColor: theme.colors.card,
   paddingVertical: 10,
   paddingHorizontal: 14,
  },
  inlineSearchButton: {
   alignSelf: 'flex-start',
   marginTop: 8,
   minHeight: 34,
   borderRadius: 10,
   borderWidth: 1,
   borderColor: theme.colors.border,
   paddingHorizontal: 12,
   flexDirection: 'row',
   alignItems: 'center',
   gap: 7,
   backgroundColor: 'transparent',
  },
  inlineSearchText: {
   color: theme.colors.primary,
   fontSize: 12,
   fontWeight: '700',
  },
  multilineInput: {
   minHeight: 92,
   paddingTop: 12,
   textAlignVertical: 'top',
  },
  suggestionList: {
   marginTop: 8,
   borderRadius: 12,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor: theme.colors.border,
  },
  suggestionItem: {
   padding: 12,
   backgroundColor: theme.colors.chip,
   borderBottomWidth: StyleSheet.hairlineWidth,
   borderBottomColor: theme.colors.border,
  },
  suggestionTitle: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '700',
  },
  suggestionSubtitle: {
   marginTop: 3,
   color: theme.colors.muted,
   fontSize: 11,
  },
  errorText: {
   marginTop: 10,
   color: theme.colors.warning,
   fontSize: 12,
   lineHeight: 18,
  },
  billableRow: {
   marginTop: 14,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
  },
  routeCard: {
   marginTop: 10,
   borderRadius: 14,
   borderWidth: 1,
   borderColor: theme.colors.border,
   backgroundColor: theme.colors.chip,
   padding: 14,
  },
  routeCardActive: {
   borderColor: theme.colors.primary,
   backgroundColor: theme.colors.sunsetSoft,
  },
  routeHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   gap: 10,
  },
  routeTitle: {
   color: theme.colors.text,
   fontSize: 14,
   fontWeight: '800',
  },
  routeTitleActive: {
   color: '#FFFFFF',
  },
  stopTitle: {
   marginTop: 16,
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '800',
  },
  stopWrap: {
   marginTop: 10,
   flexDirection: 'row',
   flexWrap: 'wrap',
   gap: 8,
  },
  stopChip: {
   borderRadius: 999,
   borderWidth: 1,
   borderColor: theme.colors.border,
   paddingHorizontal: 12,
   paddingVertical: 8,
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
  },
  stopText: {
   color: theme.colors.text,
   fontSize: 12,
   fontWeight: '700',
  },
  auditCard: {
   marginTop: 14,
   borderRadius: 14,
   borderWidth: 1,
   borderColor: 'rgba(251,191,36,0.36)',
   backgroundColor: 'rgba(251,191,36,0.10)',
   padding: 14,
  },
  primaryButton: {
   minHeight: 50,
   borderRadius: 14,
   backgroundColor: theme.colors.primary,
   alignItems: 'center',
   justifyContent: 'center',
   flexDirection: 'row',
   gap: 8,
   paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
   opacity: 0.45,
  },
  primaryButtonText: {
   color: '#FFFFFF',
   fontSize: 14,
   fontWeight: '800',
  },
 });
