import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  LinearTransition,
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import Feather from 'react-native-vector-icons/Feather';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  searchPlacesAPI,
  placeDetailAPI,
  getDirectionAPI,
  geocodeAddressAPI,
  DirectionsRoute,
} from '../services/backendMapService';
import { useAppTheme } from '../context/ThemeContext';
import { AppTheme } from '../theme';
import { LatLng, WORK_LOCATION } from '../constants/workLocation';
import {
  createManualLogRequest,
  createTravelLogRequest,
} from '../services/manualLogService';
import { TopHeader } from '../components/TopHeader';
import { ProjectPickerModal } from '../components/Logs/ProjectPickerModal';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProjects } from '../store/projectsSlice';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { ThemedIOSDateTimePicker } from '../components/ThemedIOSDateTimePicker';
import { useDialog } from '../context/DialogContext';
import { RootStackParamList } from '../navigation/types';

type PlaceOption = {
  placeId: string;
  label: string;
  description: string;
};

type TravelStop = LatLng & {
  id: string;
  label: string;
  description?: string;
};

const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const timeValue = (value: Date) =>
  `${pad(value.getHours())}:${pad(value.getMinutes())}`;
const formatDateTime = (value: Date) =>
  `${dateKey(value)} ${timeValue(value)}:00`;

const midpoint = (from: LatLng, to: LatLng) => ({
  latitude: (from.latitude + to.latitude) / 2,
  longitude: (from.longitude + to.longitude) / 2,
});

const buildMapRegion = (center: LatLng) => ({
  latitude: center.latitude,
  longitude: center.longitude,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
});

const StepPanel = ({
  step,
  activeStep,
  title,
  subtitle,
  onPress,
  isCompleted,
  children,
  summary,
}: {
  step: number;
  activeStep: number;
  title: string;
  subtitle: string;
  onPress: () => void;
  isCompleted: boolean;
  children: React.ReactNode;
  summary?: React.ReactNode;
}) => {
  const isActive = step === activeStep;
  const { theme } = useAppTheme();

  return (
    <Animated.View
      layout={LinearTransition.springify()}
      style={[
        {
          backgroundColor: theme.isDark ? 'rgba(12, 18, 32, 0.65)' : '#FFFFFF',
          borderRadius: 24,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: isActive
            ? theme.colors.primary
            : theme.isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : '#E5E7EB',
          overflow: 'hidden',
          padding: 16,
        },
      ]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 12,
              backgroundColor: isCompleted
                ? '#22C55E'
                : isActive
                  ? theme.colors.primary
                  : theme.isDark
                    ? 'rgba(255,255,255,0.1)'
                    : '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {isCompleted && !isActive ? (
              <Feather name="check" size={16} color="#FFF" />
            ) : (
              <Text
                style={{
                  color: isActive ? '#FFF' : theme.colors.muted,
                  fontWeight: '800',
                  fontSize: 14,
                }}>
                {step}
              </Text>
            )}
          </View>
          <View>
            <Text
              style={{
                color: theme.colors.text,
                fontWeight: '800',
                fontSize: 16,
                opacity: isActive ? 1 : 0.8,
              }}>
              {title}
            </Text>
            {!isActive && summary ? (
              <View style={{ marginTop: 2 }}>{summary}</View>
            ) : (
              <Text
                style={{ color: theme.colors.muted, fontSize: 11, fontWeight: '600' }}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {!isActive && (
          <Feather name="chevron-down" size={18} color={theme.colors.muted} />
        )}
      </TouchableOpacity>

      {isActive && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOutUp.duration(200)}
          style={{ marginTop: 20 }}>
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default function AttendanceTravelScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { showDialog } = useDialog();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AttendanceTravel'>>();

  const { items: reduxProjects, isLoading: isProjectsLoading } = useAppSelector(
    state => state.projects,
  );
  const authToken = useAppSelector(state => state.auth.token);
  const selectedProjectId = useAppSelector(
    state => state.projects.selectedProjectId,
  );

  const isMounted = useRef(true);
  const isAddingStopFromMapRef = useRef(false);
  const mapRef = useRef<MapView>(null);
  const fullMapRef = useRef<MapView>(null);

  // Initialize state from route params
  const [fromLabel, setFromLabel] = useState(
    route.params?.fromCoords ? 'Selected location' : '',
  );
  const [fromCoords, setFromCoords] = useState<LatLng | null>(
    route.params?.fromCoords ?? null,
  );
  const [toLabel, setToLabel] = useState(
    route.params?.toCoords ? 'Selected destination' : '',
  );
  const [toCoords, setToCoords] = useState<LatLng | null>(
    route.params?.toCoords ?? null,
  );

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  // Places autocomplete
  const [fromSuggestions, setFromSuggestions] = useState<PlaceOption[]>([]);
  const [toSuggestions, setToSuggestions] = useState<PlaceOption[]>([]);
  const [loadingFromSuggestions, setLoadingFromSuggestions] = useState(false);
  const [loadingToSuggestions, setLoadingToSuggestions] = useState(false);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);

  // Stops
  const [stopLabel, setStopLabel] = useState('');
  const [stopSuggestions, setStopSuggestions] = useState<PlaceOption[]>([]);
  const [loadingStopSuggestions, setLoadingStopSuggestions] = useState(false);
  const [showStopSuggestions, setShowStopSuggestions] = useState(false);
  const [stops, setStops] = useState<TravelStop[]>([]);
  const [isAddingStopFromMap, setIsAddingStopFromMap] = useState(false);

  // Directions
  const [routes, setRoutes] = useState<DirectionsRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  const [internalSelectedProjectId, setInternalSelectedProjectId] = useState<
    string | null
  >(selectedProjectId);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);

  // Time Range States
  const [travelDate, setTravelDate] = useState(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerTarget, setPickerTarget] = useState<'date' | 'start' | 'end'>(
    'date',
  );
  const [pickerDate, setPickerDate] = useState(new Date());

  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    isAddingStopFromMapRef.current = isAddingStopFromMap;
  }, [isAddingStopFromMap]);

  useEffect(() => {
    setInternalSelectedProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const handleFromTextChange = useCallback((text: string) => {
    setFromLabel(text);
    setFromCoords(null);
    setRoutes([]);
    setSelectedRouteId(null);
    setRouteError(null);
    if (!text.trim()) {
      setFromSuggestions([]);
      setShowFromSuggestions(false);
    }
  }, []);

  const handleToTextChange = useCallback((text: string) => {
    setToLabel(text);
    setToCoords(null);
    setRoutes([]);
    setSelectedRouteId(null);
    setRouteError(null);
    if (!text.trim()) {
      setToSuggestions([]);
      setShowToSuggestions(false);
    }
  }, []);

  const handleFromSearch = useCallback(async () => {
    const query = fromLabel.trim();
    if (!query) {
      setFromSuggestions([]);
      setShowFromSuggestions(false);
      return;
    }

    setLoadingFromSuggestions(true);
    setShowFromSuggestions(true);
    try {
      const suggestions = await searchPlacesAPI(query, authToken ?? '');
      if (isMounted.current) {
        setFromSuggestions(
          suggestions.map(s => ({
            placeId: s.placeId,
            label: s.label,
            description: s.description,
          })),
        );
      }
    } catch (error) {
      console.error('Error fetching from suggestions:', error);
    } finally {
      if (isMounted.current) {
        setLoadingFromSuggestions(false);
      }
    }
  }, [fromLabel, authToken]);

  const handleToSearch = useCallback(async () => {
    const query = toLabel.trim();
    if (!query) {
      setToSuggestions([]);
      setShowToSuggestions(false);
      return;
    }

    setLoadingToSuggestions(true);
    setShowToSuggestions(true);
    try {
      const suggestions = await searchPlacesAPI(query, authToken ?? '');
      if (isMounted.current) {
        setToSuggestions(
          suggestions.map(s => ({
            placeId: s.placeId,
            label: s.label,
            description: s.description,
          })),
        );
      }
    } catch (error) {
      console.error('Error fetching to suggestions:', error);
    } finally {
      if (isMounted.current) {
        setLoadingToSuggestions(false);
      }
    }
  }, [toLabel, authToken]);

  const handleSelectFromPlace = useCallback(
    async (place: PlaceOption) => {
      setShowFromSuggestions(false);
      setLoadingFromSuggestions(true);
      try {
        const geocoded = await placeDetailAPI(place.placeId, authToken ?? '');
        if (isMounted.current) {
          setFromLabel(geocoded.label);
          setFromCoords(geocoded.coords);
        }
      } catch (error) {
        console.error('Error geocoding from place:', error);
      } finally {
        if (isMounted.current) {
          setLoadingFromSuggestions(false);
        }
      }
    },
    [authToken],
  );

  const handleSelectToPlace = useCallback(
    async (place: PlaceOption) => {
      setShowToSuggestions(false);
      setLoadingToSuggestions(true);
      try {
        const geocoded = await placeDetailAPI(place.placeId, authToken ?? '');
        if (isMounted.current) {
          setToLabel(geocoded.label);
          setToCoords(geocoded.coords);
        }
      } catch (error) {
        console.error('Error geocoding to place:', error);
      } finally {
        if (isMounted.current) {
          setLoadingToSuggestions(false);
        }
      }
    },
    [authToken],
  );

  const handleStopTextChange = useCallback((text: string) => {
    setStopLabel(text);
    if (!text.trim()) {
      setStopSuggestions([]);
      setShowStopSuggestions(false);
    }
  }, []);

  const handleStopSearch = useCallback(async () => {
    const query = stopLabel.trim();
    if (!query) {
      setStopSuggestions([]);
      setShowStopSuggestions(false);
      return;
    }

    setLoadingStopSuggestions(true);
    setShowStopSuggestions(true);
    try {
      const suggestions = await searchPlacesAPI(query, authToken ?? '');
      if (isMounted.current) {
        setStopSuggestions(
          suggestions.map(s => ({
            placeId: s.placeId,
            label: s.label,
            description: s.description,
          })),
        );
      }
    } catch (error) {
      console.error('Error fetching stop suggestions:', error);
    } finally {
      if (isMounted.current) {
        setLoadingStopSuggestions(false);
      }
    }
  }, [stopLabel, authToken]);

  const handleSelectStopPlace = useCallback(
    async (place: PlaceOption) => {
      setShowStopSuggestions(false);
      setLoadingStopSuggestions(true);
      try {
        const geocoded = await placeDetailAPI(place.placeId, authToken ?? '');
        if (isMounted.current) {
          setStops(currentStops => [
            ...currentStops,
            {
              id: `${place.placeId}-${Date.now()}`,
              label: geocoded.label,
              description: place.description,
              latitude: geocoded.coords.latitude,
              longitude: geocoded.coords.longitude,
            },
          ]);
          setStopLabel('');
          setStopSuggestions([]);
        }
      } catch (error) {
        console.error('Error geocoding stop place:', error);
      } finally {
        if (isMounted.current) {
          setLoadingStopSuggestions(false);
        }
      }
    },
    [authToken],
  );

  const handleRemoveStop = useCallback((stopId: string) => {
    setStops(currentStops => currentStops.filter(stop => stop.id !== stopId));
  }, []);

  const handleToggleAddStopFromMap = useCallback(() => {
    setIsAddingStopFromMap(currentValue => {
      const nextValue = !currentValue;
      isAddingStopFromMapRef.current = nextValue;
      return nextValue;
    });
  }, []);

  const handleMapPress = useCallback(
    async (coordinate: LatLng) => {
      if (!isAddingStopFromMapRef.current) {
        return;
      }

      isAddingStopFromMapRef.current = false;
      setIsAddingStopFromMap(false);
      const fallbackLabel = `${coordinate.latitude.toFixed(
        5,
      )}, ${coordinate.longitude.toFixed(5)}`;

      setStops(currentStops => [
        ...currentStops,
        {
          id: `map-stop-${Date.now()}`,
          label: fallbackLabel,
          description: 'Fetching address...',
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        },
      ]);

      try {
        const geocoded = await geocodeAddressAPI(
          `${coordinate.latitude},${coordinate.longitude}`,
          authToken ?? '',
        );
        if (isMounted.current) {
          setStops(currentStops =>
            currentStops.map(stop =>
              stop.latitude === coordinate.latitude &&
                stop.longitude === coordinate.longitude
                ? {
                  ...stop,
                  label: geocoded.label,
                  description: geocoded.address,
                }
                : stop,
            ),
          );
        }
      } catch (error) {
        console.error('Error reverse geocoding stop:', error);
        if (isMounted.current) {
          setStops(currentStops =>
            currentStops.map(stop =>
              stop.latitude === coordinate.latitude &&
                stop.longitude === coordinate.longitude
                ? {
                  ...stop,
                  label: fallbackLabel,
                  description: 'Address unavailable',
                }
                : stop,
            ),
          );
        }
      }
    },
    [authToken],
  );

  const routeWaypointCoords = useMemo(
    () =>
      stops.map(({ latitude, longitude }) => ({
        latitude,
        longitude,
      })),
    [stops],
  );

  // Fetch routes when both locations are set
  useEffect(() => {
    if (!fromCoords || !toCoords) {
      setRoutes([]);
      setSelectedRouteId(null);
      return;
    }

    const fetchRoutes = async () => {
      setLoadingRoutes(true);
      setRouteError(null);
      try {
        const directionsRoutes = await getDirectionAPI(
          fromCoords,
          toCoords,
          routeWaypointCoords,
          authToken ?? '',
        );
        if (isMounted.current) {
          setRoutes(directionsRoutes);
          if (directionsRoutes.length > 0) {
            setSelectedRouteId(directionsRoutes[0].id);
          } else {
            setSelectedRouteId(null);
          }
        }
      } catch (error) {
        console.error('Error fetching routes:', error);
        if (isMounted.current) {
          setRouteError(
            error instanceof Error ? error.message : 'Unable to fetch routes',
          );
        }
      } finally {
        if (isMounted.current) {
          setLoadingRoutes(false);
        }
      }
    };

    fetchRoutes();
  }, [fromCoords, toCoords, routeWaypointCoords, authToken]);

  const selectedRoute = routes.find(r => r.id === selectedRouteId);
  const mapCenter =
    fromCoords && toCoords ? midpoint(fromCoords, toCoords) : WORK_LOCATION;
  const mapRegion = buildMapRegion(mapCenter);
  const selectedRouteCoordinates = selectedRoute?.points ?? [];

  // Collect all coordinates for fitToCoordinates
  const allMapCoords = useMemo(() => {
    const coords: LatLng[] = [];
    if (fromCoords) coords.push(fromCoords);
    if (toCoords) coords.push(toCoords);
    stops.forEach(s =>
      coords.push({ latitude: s.latitude, longitude: s.longitude }),
    );
    if (selectedRouteCoordinates.length > 0) {
      return selectedRouteCoordinates;
    }
    return coords;
  }, [fromCoords, toCoords, stops, selectedRouteCoordinates]);

  // Auto-zoom both maps to fit all markers/route
  useEffect(() => {
    if (allMapCoords.length > 0) {
      const padding = { top: 60, right: 60, bottom: 60, left: 60 };
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(allMapCoords, {
          edgePadding: padding,
          animated: true,
        });
        fullMapRef.current?.fitToCoordinates(allMapCoords, {
          edgePadding: { top: 100, right: 80, bottom: 100, left: 80 },
          animated: true,
        });
      }, 500);
    }
  }, [allMapCoords]);
  const canSave =
    fromCoords &&
    toCoords &&
    topic.trim() &&
    description.trim() &&
    selectedRoute &&
    internalSelectedProjectId;

  const timeToDate = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    const date = new Date(travelDate);
    date.setHours(h || 0, m || 0, 0, 0);
    return date;
  };

  const dateToTime = (value: Date) => {
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const openPicker = (
    target: 'date' | 'start' | 'end',
    mode: 'date' | 'time',
  ) => {
    setPickerTarget(target);
    setPickerMode(mode);
    if (target === 'date') {
      setPickerDate(travelDate);
    } else {
      setPickerDate(timeToDate(target === 'start' ? startTime : endTime));
    }
    setPickerVisible(true);
  };

  const handlePickerChange = (event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') {
      setPickerVisible(false);
      if (event.type === 'set' && value) {
        if (pickerTarget === 'date') {
          setTravelDate(value);
        } else {
          const nextTime = dateToTime(value);
          if (pickerTarget === 'start') setStartTime(nextTime);
          else setEndTime(nextTime);
        }
      }
      return;
    }
    if (value) {
      setPickerDate(value);
    }
  };

  const confirmPicker = () => {
    if (pickerTarget === 'date') {
      setTravelDate(pickerDate);
    } else {
      const nextTime = dateToTime(pickerDate);
      if (pickerTarget === 'start') setStartTime(nextTime);
      else setEndTime(nextTime);
    }
    setPickerVisible(false);
  };

  const handleSaveLog = useCallback(async () => {
    if (!fromCoords || !toCoords) {
      showDialog({
        title: 'Missing Locations',
        message: 'Please select both "From" and "To" locations.',
        variant: 'warning',
        primaryAction: { label: 'Okay' },
      });
      return;
    }
    if (!selectedRoute) {
      showDialog({
        title: 'Route Not Ready',
        message: 'Please wait for the route to load and select one.',
        variant: 'warning',
        primaryAction: { label: 'Okay' },
      });
      return;
    }
    if (!topic.trim() || !description.trim()) {
      showDialog({
        title: 'Missing Details',
        message: 'Please enter both a Topic and a Description.',
        variant: 'warning',
        primaryAction: { label: 'Okay' },
      });
      return;
    }
    if (!internalSelectedProjectId) {
      showDialog({
        title: 'Missing Project',
        message: 'Please select a project before saving.',
        variant: 'warning',
        primaryAction: { label: 'Okay' },
      });
      return;
    }

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (endMins <= startMins) {
      showDialog({
        title: 'Invalid Time Range',
        message: 'End time must be after the start time.',
        variant: 'error',
        primaryAction: { label: 'Okay' },
      });
      return;
    }

    const selectedProject = reduxProjects.find(
      p => p.id === internalSelectedProjectId,
    );
    if (!selectedProject) return;

    setSaving(true);
    try {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);

      const startFullDate = new Date(travelDate);
      startFullDate.setHours(startH, startM, 0, 0);

      const endFullDate = new Date(travelDate);
      endFullDate.setHours(endH, endM, 0, 0);

      const payload = {
        project_id: Number(internalSelectedProjectId),
        start_lat: fromCoords.latitude,
        start_lng: fromCoords.longitude,
        end_lat: toCoords.latitude,
        end_lng: toCoords.longitude,
        distance: Number((selectedRoute.distanceMeters / 1000).toFixed(2)),
        duration: Math.round(
          (endFullDate.getTime() - startFullDate.getTime()) / 60000,
        ),
        start_time: formatDateTime(startFullDate),
        end_time: formatDateTime(endFullDate),
        mode: 'car',
        purpose: topic.trim(),
        notes: description.trim(),
        stops: stops.map(stop => ({
          lat: stop.latitude,
          lng: stop.longitude,
        })),
      };

      const result = await createTravelLogRequest(payload, authToken ?? '');

      if (result.success) {
        showDialog({
          title: 'Success',
          message: result.message || 'Travel log created successfully.',
          variant: 'success',
          primaryAction: {
            label: 'Okay',
            onPress: () => {
              navigation.goBack();
            },
          },
        });
        return;
      } else {
        showDialog({
          title: 'Error',
          message: result.message || 'Failed to create travel log.',
          variant: 'error',
          primaryAction: { label: 'Okay' },
        });
      }
    } catch (error) {
      console.error('Error saving travel log:', error);
      showDialog({
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to create travel log. Please try again.',
        variant: 'error',
        primaryAction: { label: 'Okay' },
      });
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
    }
  }, [
    canSave,
    selectedRoute,
    fromCoords,
    toCoords,
    internalSelectedProjectId,
    reduxProjects,
    topic,
    description,
    stops,
    authToken,
    showDialog,
    navigation,
    travelDate,
    startTime,
    endTime,
  ]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
      />

      <TopHeader
        title="Travel Log"
        subtitle="Create a travel route with stops"
        rightType="avatar"
        forceShowBack
        onBackPress={handleClose}
        style={styles.appHeader}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoiding}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {/* Step 1: Context */}
          <StepPanel
            step={1}
            activeStep={activeStep}
            title="Log Context"
            subtitle="Project & Time Details"
            onPress={() => setActiveStep(1)}
            isCompleted={!!internalSelectedProjectId && !!travelDate}
            summary={
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Feather name="briefcase" size={14} color={theme.colors.primary} />
                  <Text style={styles.summaryText}>
                    {reduxProjects.find(p => p.id === internalSelectedProjectId)?.name ??
                      'No Project'}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Feather name="clock" size={14} color={theme.colors.primary} />
                  <Text style={styles.summaryText}>
                    {startTime} - {endTime}
                  </Text>
                </View>
              </View>
            }>
            <View style={styles.cardInternal}>
              <Text allowFontScaling={false} style={styles.label}>
                Select Project
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.projectSelect}
                onPress={() => setProjectPickerVisible(true)}>
                <View style={styles.projectSelectContent}>
                  <Feather
                    name="briefcase"
                    size={18}
                    color={theme.colors.primary}
                    style={styles.projectIcon}
                  />
                  <Text allowFontScaling={false} style={styles.projectSelectText}>
                    {isProjectsLoading
                      ? 'Loading projects...'
                      : reduxProjects.find(p => p.id === internalSelectedProjectId)
                        ?.name ?? 'Tap to select project'}
                  </Text>
                </View>
                <Feather name="chevron-down" size={18} color={theme.colors.muted} />
              </TouchableOpacity>

              <Text allowFontScaling={false} style={[styles.label, { marginTop: 16 }]}>
                Travel Date & Time
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.projectSelect}
                onPress={() => openPicker('date', 'date')}>
                <View style={styles.projectSelectContent}>
                  <Feather
                    name="calendar"
                    size={18}
                    color={theme.colors.primary}
                    style={styles.projectIcon}
                  />
                  <Text allowFontScaling={false} style={styles.projectSelectText}>
                    {travelDate.toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Feather name="chevron-down" size={18} color={theme.colors.muted} />
              </TouchableOpacity>

              <View style={styles.timeRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.timeInput, { flex: 1, marginRight: 8 }]}
                  onPress={() => openPicker('start', 'time')}>
                  <View>
                    <Text allowFontScaling={false} style={styles.fieldHint}>
                      Start Time
                    </Text>
                    <Text allowFontScaling={false} style={styles.timeInputText}>
                      {startTime}
                    </Text>
                  </View>
                  <Feather name="clock" size={16} color={theme.colors.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.timeInput, { flex: 1 }]}
                  onPress={() => openPicker('end', 'time')}>
                  <View>
                    <Text allowFontScaling={false} style={styles.fieldHint}>
                      End Time
                    </Text>
                    <Text allowFontScaling={false} style={styles.timeInputText}>
                      {endTime}
                    </Text>
                  </View>
                  <Feather name="clock" size={16} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.nextButton}
                onPress={() => setActiveStep(2)}>
                <Text style={styles.nextButtonText}> Select Location</Text>
                <Feather name="arrow-right" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </StepPanel>

          {/* Step 2: Journey */}
          <StepPanel
            step={2}
            activeStep={activeStep}
            title="Journey Planner"
            subtitle="Locations & Route"
            onPress={() => setActiveStep(2)}
            isCompleted={!!fromCoords && !!toCoords}
            summary={
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Feather name="map-pin" size={14} color={theme.colors.primary} />
                  <Text style={styles.summaryText} numberOfLines={1}>
                    {fromLabel.split(',')[0]} → {toLabel.split(',')[0]}
                  </Text>
                </View>
                {selectedRoute && (
                  <View style={styles.summaryItem}>
                    <Feather name="trending-up" size={14} color={theme.colors.primary} />
                    <Text style={styles.summaryText}>
                      {(selectedRoute.distanceMeters / 1000).toFixed(1)} km
                    </Text>
                  </View>
                )}
              </View>
            }>
            <View style={styles.cardInternal}>
              {/* From Location */}
              <View style={styles.fieldHeader}>
                <Text
                  allowFontScaling={false}
                  style={[styles.label, styles.fieldHeaderLabel]}>
                  From Location
                </Text>
                <Text allowFontScaling={false} style={styles.fieldHint}>
                  Type, then search
                </Text>
              </View>
              <View style={[styles.input, styles.locationInputRow]}>
                <Feather name="search" size={20} color="rgba(255,255,255,0.46)" />
                <TextInput
                  style={styles.locationInput}
                  placeholder="Enter pickup or start point"
                  placeholderTextColor="rgba(255,255,255,0.46)"
                  value={fromLabel}
                  onChangeText={handleFromTextChange}
                  onSubmitEditing={handleFromSearch}
                  returnKeyType="search"
                  editable={!loadingFromSuggestions}
                />
                {loadingFromSuggestions ? (
                  <ActivityIndicator key="from-loading-input" size="small" color="#FFFFFF" />
                ) : fromLabel.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => handleFromTextChange('')}
                    style={styles.clearButton}
                    accessibilityLabel="Clear from location">
                    <Feather name="x-circle" size={18} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                ) : null}
              </View>
              {loadingFromSuggestions && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator key="from-loading-container" size="small" color={theme.colors.primary} />
                  <Text allowFontScaling={false} style={styles.loadingText}>
                    Searching locations...
                  </Text>
                </View>
              )}
              {showFromSuggestions && fromSuggestions.length > 0 && (
                <View style={styles.placesContainer}>
                  {fromSuggestions.map((place, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.placesSuggestion}
                      onPress={() => handleSelectFromPlace(place)}>
                      <Text
                        allowFontScaling={false}
                        style={styles.placesSuggestionText}
                        numberOfLines={1}>
                        {place.label}
                      </Text>
                      {place.description && (
                        <Text
                          allowFontScaling={false}
                          style={styles.placesSuggestionSecondary}
                          numberOfLines={1}>
                          {place.description}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {fromCoords && (
                <Text allowFontScaling={false} style={styles.successText}>
                  ✓ Location selected
                </Text>
              )}

              {/* To Location */}
              <View style={[styles.fieldHeader, { marginTop: 12 }]}>
                <Text
                  allowFontScaling={false}
                  style={[styles.label, styles.fieldHeaderLabel]}>
                  To Location
                </Text>
                <Text allowFontScaling={false} style={styles.fieldHint}>
                  Type, then search
                </Text>
              </View>
              <View style={[styles.input, styles.locationInputRow]}>
                <Feather name="search" size={20} color="rgba(255,255,255,0.46)" />
                <TextInput
                  style={styles.locationInput}
                  placeholder="Enter destination or drop point"
                  placeholderTextColor="rgba(255,255,255,0.46)"
                  value={toLabel}
                  onChangeText={handleToTextChange}
                  onSubmitEditing={handleToSearch}
                  returnKeyType="search"
                  editable={!loadingToSuggestions}
                />
                {loadingToSuggestions ? (
                  <ActivityIndicator key="to-loading-input" size="small" color="#FFFFFF" />
                ) : toLabel.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => handleToTextChange('')}
                    style={styles.clearButton}
                    accessibilityLabel="Clear to location">
                    <Feather name="x-circle" size={18} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                ) : null}
              </View>
              {loadingToSuggestions && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator key="to-loading-container" size="small" color={theme.colors.primary} />
                  <Text allowFontScaling={false} style={styles.loadingText}>
                    Searching locations...
                  </Text>
                </View>
              )}
              {showToSuggestions && toSuggestions.length > 0 && (
                <View style={styles.placesContainer}>
                  {toSuggestions.map((place, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.placesSuggestion}
                      onPress={() => handleSelectToPlace(place)}>
                      <Text
                        allowFontScaling={false}
                        style={styles.placesSuggestionText}
                        numberOfLines={1}>
                        {place.label}
                      </Text>
                      {place.description && (
                        <Text
                          allowFontScaling={false}
                          style={styles.placesSuggestionSecondary}
                          numberOfLines={1}>
                          {place.description}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {toCoords && (
                <Text allowFontScaling={false} style={styles.successText}>
                  ✓ Location selected
                </Text>
              )}

              {/* Stops */}
              <View style={[styles.fieldHeader, { marginTop: 12 }]}>
                <Text
                  allowFontScaling={false}
                  style={[styles.label, styles.fieldHeaderLabel]}>
                  Stops
                </Text>
                <Text allowFontScaling={false} style={styles.fieldHint}>
                  Optional
                </Text>
              </View>
              <View style={[styles.input, styles.locationInputRow]}>
                <Feather name="search" size={20} color="rgba(255,255,255,0.46)" />
                <TextInput
                  style={styles.locationInput}
                  placeholder="Search stop or tap the map"
                  placeholderTextColor="rgba(255,255,255,0.46)"
                  value={stopLabel}
                  onChangeText={handleStopTextChange}
                  onSubmitEditing={handleStopSearch}
                  returnKeyType="search"
                  editable={!loadingStopSuggestions}
                />
                {loadingStopSuggestions ? (
                  <ActivityIndicator key="stop-loading-input" size="small" color="#FFFFFF" />
                ) : stopLabel.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => handleStopTextChange('')}
                    style={styles.clearButton}
                    accessibilityLabel="Clear stop location">
                    <Feather name="x-circle" size={18} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                ) : null}
              </View>
              {showStopSuggestions && stopSuggestions.length > 0 ? (
                <View style={styles.placesContainer}>
                  {stopSuggestions.map((place, index) => (
                    <TouchableOpacity
                      key={`${place.placeId}-${index}`}
                      style={styles.placesSuggestion}
                      onPress={() => handleSelectStopPlace(place)}>
                      <Text
                        allowFontScaling={false}
                        style={styles.placesSuggestionText}
                        numberOfLines={1}>
                        {place.label}
                      </Text>
                      {place.description ? (
                        <Text
                          allowFontScaling={false}
                          style={styles.placesSuggestionSecondary}
                          numberOfLines={1}>
                          {place.description}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {stops.length > 0 ? (
                <View style={styles.stopList}>
                  {stops.map((stop, index) => (
                    <View key={stop.id} style={styles.stopRow}>
                      <View style={styles.stopIndex}>
                        <Text allowFontScaling={false} style={styles.stopIndexText}>
                          {index + 1}
                        </Text>
                      </View>
                      <View style={styles.stopCopy}>
                        <Text
                          allowFontScaling={false}
                          style={styles.stopTitle}
                          numberOfLines={1}>
                          {stop.label}
                        </Text>
                        <Text
                          allowFontScaling={false}
                          style={styles.stopSubtitle}
                          numberOfLines={1}>
                          {stop.description ?? 'Route stop'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.stopRemoveButton}
                        onPress={() => handleRemoveStop(stop.id)}
                        activeOpacity={0.86}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <Text allowFontScaling={false} style={styles.helperText}>
                  Add a stop if you paused on the way. Stops appear as purple pins.
                </Text>
              )}

              {/* Map & Route */}
              <TouchableOpacity
                style={[
                  styles.addStopModeButton,
                  isAddingStopFromMap && styles.addStopModeButtonActive,
                ]}
                onPress={handleToggleAddStopFromMap}
                activeOpacity={0.86}>
                <Feather
                  name="map-pin"
                  size={15}
                  color={isAddingStopFromMap ? '#FFFFFF' : theme.colors.primary}
                />
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.addStopModeText,
                    isAddingStopFromMap && styles.addStopModeTextActive,
                  ]}>
                  {isAddingStopFromMap
                    ? '📍 Tap any point on the map to add a stop'
                    : 'Tap to add a stop via map'}
                </Text>
              </TouchableOpacity>

              <View style={styles.mapCompactContainer}>
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE}
                  style={styles.mapCompact}
                  initialRegion={mapRegion}
                  onPress={event => handleMapPress(event.nativeEvent.coordinate)}>
                  <Marker coordinate={WORK_LOCATION} title="Office" pinColor="#22C55E" />
                  {fromCoords && (
                    <Marker
                      coordinate={fromCoords}
                      title="Starting Point"
                      pinColor="#2563EB"
                    />
                  )}
                  {toCoords && (
                    <Marker
                      coordinate={toCoords}
                      title="Destination"
                      pinColor="#DC2626"
                    />
                  )}
                  {stops.map((stop, index) => (
                    <Marker
                      key={stop.id}
                      coordinate={stop}
                      title={`Stop ${index + 1}`}
                      description={stop.label}
                      pinColor="#8B5CF6"
                    />
                  ))}
                  {fromCoords && toCoords && selectedRouteCoordinates.length > 1 && (
                    <Polyline
                      coordinates={selectedRouteCoordinates}
                      strokeWidth={4}
                      strokeColor={theme.colors.primary}
                    />
                  )}
                </MapView>
                <TouchableOpacity
                  style={styles.expandButtonSmall}
                  onPress={() => setIsMapModalVisible(true)}>
                  <Feather name="maximize-2" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>

              {loadingRoutes && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator key="routes-loading-container" size="small" color={theme.colors.primary} />
                  <Text allowFontScaling={false} style={styles.loadingText}>
                    Fetching route options...
                  </Text>
                </View>
              )}

              {routeError && (
                <Text allowFontScaling={false} style={styles.errorText}>
                  {routeError}
                </Text>
              )}

              {routes.length > 0 && (
                <View style={styles.routeSelectorSection}>
                  <View style={styles.routeSelectorHeader}>
                    <Feather name="git-branch" size={15} color={theme.colors.primary} />
                    <Text allowFontScaling={false} style={styles.routeSelectorTitle}>
                      Select Route
                    </Text>
                    <Text allowFontScaling={false} style={styles.routeSelectorCount}>
                      {routes.length} option{routes.length !== 1 ? 's' : ''} found
                    </Text>
                  </View>
                  {routes.map((route, idx) => {
                    const isActive = selectedRouteId === route.id;
                    const distKm = (route.distanceMeters / 1000).toFixed(1);
                    const durationMin = Math.ceil(route.durationSeconds / 60);
                    const avgSpeed =
                      route.durationSeconds > 0
                        ? (
                          route.distanceMeters /
                          1000 /
                          (route.durationSeconds / 3600)
                        ).toFixed(0)
                        : null;
                    return (
                      <TouchableOpacity
                        key={route.id}
                        style={[
                          styles.routeDetailCard,
                          isActive && styles.routeDetailCardActive,
                        ]}
                        onPress={() => setSelectedRouteId(route.id)}
                        activeOpacity={0.8}>
                        {/* Radio + Label row */}
                        <View style={styles.routeDetailTop}>
                          <View
                            style={[styles.routeRadio, isActive && styles.routeRadioActive]}>
                            {isActive && <View style={styles.routeRadioDot} />}
                          </View>
                          <View style={styles.routeDetailLabelWrap}>
                            <Text
                              allowFontScaling={false}
                              style={[
                                styles.routeDetailLabel,
                                isActive && styles.routeDetailLabelActive,
                              ]}
                              numberOfLines={1}>
                              {route.label || `Route ${idx + 1}`}
                            </Text>
                            {isActive && (
                              <View style={styles.routeSelectedBadge}>
                                <Feather name="check" size={10} color="#FFF" />
                                <Text style={styles.routeSelectedBadgeText}>Selected</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {/* Stats row */}
                        <View style={styles.routeDetailStats}>
                          <View style={styles.routeStat}>
                            <Feather
                              name="map"
                              size={12}
                              color={isActive ? theme.colors.primary : theme.colors.muted}
                            />
                            <Text
                              allowFontScaling={false}
                              style={[
                                styles.routeStatValue,
                                isActive && styles.routeStatValueActive,
                              ]}>
                              {distKm} km
                            </Text>
                          </View>
                          <View style={styles.routeStatDivider} />
                          <View style={styles.routeStat}>
                            <Feather
                              name="clock"
                              size={12}
                              color={isActive ? theme.colors.primary : theme.colors.muted}
                            />
                            <Text
                              allowFontScaling={false}
                              style={[
                                styles.routeStatValue,
                                isActive && styles.routeStatValueActive,
                              ]}>
                              {durationMin} min
                            </Text>
                          </View>
                          {avgSpeed && (
                            <>
                              <View style={styles.routeStatDivider} />
                              <View style={styles.routeStat}>
                                <Feather
                                  name="trending-up"
                                  size={12}
                                  color={isActive ? theme.colors.primary : theme.colors.muted}
                                />
                                <Text
                                  allowFontScaling={false}
                                  style={[
                                    styles.routeStatValue,
                                    isActive && styles.routeStatValueActive,
                                  ]}>
                                  avg {avgSpeed} km/h
                                </Text>
                              </View>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={styles.nextButton}
                onPress={() => setActiveStep(3)}>
                <Text style={styles.nextButtonText}>Add Log Entry</Text>
                <Feather name="arrow-right" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </StepPanel>

          {/* Step 3: Details */}
          <StepPanel
            step={3}
            activeStep={activeStep}
            title="Final Details"
            subtitle="Topic & Purpose"
            onPress={() => setActiveStep(3)}
            isCompleted={!!topic.trim() && !!description.trim()}
            summary={
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Feather name="edit-3" size={14} color={theme.colors.primary} />
                  <Text style={styles.summaryText} numberOfLines={1}>
                    {topic || 'No topic'}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Feather
                    name="dollar-sign"
                    size={14}
                    color={billable ? '#22C55E' : theme.colors.muted}
                  />
                  <Text
                    style={[
                      styles.summaryText,
                      { color: billable ? '#22C55E' : theme.colors.muted },
                    ]}>
                    {billable ? 'Billable' : 'Non-billable'}
                  </Text>
                </View>
              </View>
            }>
            <View style={styles.cardInternal}>
              <Text allowFontScaling={false} style={styles.label}>
                Topic
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Client meeting"
                placeholderTextColor="rgba(255,255,255,0.46)"
                value={topic}
                onChangeText={setTopic}
              />

              <Text allowFontScaling={false} style={styles.label}>
                Description
              </Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Describe the purpose of travel"
                placeholderTextColor="rgba(255,255,255,0.46)"
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <View style={styles.billableRow}>
                <Text allowFontScaling={false} style={styles.billableLabel}>
                  Billable Travel
                </Text>
                <Switch value={billable} onValueChange={setBillable} />
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (!canSave || saving) && styles.buttonDisabled,
                  ]}
                  onPress={handleSaveLog}
                  disabled={!canSave || saving}>
                  {saving ? (
                    <ActivityIndicator key="save-loading" size="small" color="#FFF" />
                  ) : (
                    <>
                      <Feather name="check" size={18} color="#FFF" />
                      <Text style={styles.saveButtonText}>Save Log</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </StepPanel>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={isMapModalVisible} transparent animationType="fade">
        <View style={styles.mapModalOverlay}>
          <View style={styles.mapModalContent}>
            <MapView
              ref={fullMapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.fullScreenMap}
              loadingEnabled
              initialRegion={mapRegion}
              onMapReady={() => {
                if (allMapCoords.length > 0) {
                  setTimeout(() => {
                    fullMapRef.current?.fitToCoordinates(allMapCoords, {
                      edgePadding: { top: 100, right: 80, bottom: 100, left: 80 },
                      animated: true,
                    });
                  }, 300);
                }
              }}
              onPress={event => handleMapPress(event.nativeEvent.coordinate)}>
              <Marker coordinate={WORK_LOCATION} title="Office" pinColor="#22C55E" />
              {fromCoords ? (
                <Marker coordinate={fromCoords} title="From" pinColor="#2563EB" />
              ) : null}
              {toCoords ? (
                <Marker coordinate={toCoords} title="To" pinColor="#DC2626" />
              ) : null}
              {stops.map((stop, index) => (
                <Marker
                  key={stop.id}
                  coordinate={stop}
                  title={`Stop ${index + 1}`}
                  description={stop.label}
                  pinColor="#8B5CF6"
                />
              ))}

              {fromCoords && toCoords && selectedRouteCoordinates.length > 1 ? (
                <Polyline
                  coordinates={selectedRouteCoordinates}
                  strokeWidth={5}
                  strokeColor={theme.colors.primary}
                />
              ) : null}
            </MapView>
            <TouchableOpacity
              style={styles.mapModalCloseButton}
              onPress={() => setIsMapModalVisible(false)}
              activeOpacity={0.85}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ProjectPickerModal
        visible={projectPickerVisible}
        onClose={() => setProjectPickerVisible(false)}
        theme={theme}
        projects={reduxProjects}
        selectedProjectId={internalSelectedProjectId}
        onSelectProject={id => {
          setInternalSelectedProjectId(id);
          setProjectPickerVisible(false);
        }}
      />
      {pickerVisible && Platform.OS === 'ios' ? (
        <ThemedIOSDateTimePicker
          visible={pickerVisible}
          title={
            pickerTarget === 'date'
              ? 'Select Travel Date'
              : `Select ${pickerTarget === 'start' ? 'Start' : 'End'} Time`
          }
          value={pickerDate}
          mode={pickerMode}
          is24Hour
          onChange={handlePickerChange}
          onCancel={() => setPickerVisible(false)}
          onConfirm={confirmPicker}
        />
      ) : null}
      {pickerVisible && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerDate}
          mode={pickerMode}
          display="default"
          is24Hour
          onChange={handlePickerChange}
        />
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardAvoiding: {
      flex: 1,
    },
    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
      zIndex: -1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 24,
    },
    appHeader: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 2,
    },
    card: {
      backgroundColor: theme.isDark ? 'rgba(12, 18, 32, 0.82)' : '#FFFFFF',
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
    },
    heroCard: {
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : '#DDE7FF',
      backgroundColor: theme.isDark ? 'rgba(20, 29, 49, 0.9)' : '#F7FAFF',
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    heroCopy: {
      flex: 1,
    },
    heroTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    heroSubtitle: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 3,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 12,
    },
    fieldHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    fieldHeaderLabel: {
      marginBottom: 0,
    },
    fieldHint: {
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    helperText: {
      color: theme.colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
      fontStyle: 'italic',
      paddingHorizontal: 4,
    },
    locationInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    input: {
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : '#F8FAFC',
      borderRadius: 12,
      padding: 12,
      color: theme.colors.text,
      fontSize: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
    },
    locationInput: {
      flex: 1,
      marginBottom: 0,
      color: theme.colors.text,
      fontSize: 14,
      padding: 0,
      margin: 0,
    },
    clearButton: {
      padding: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    multilineInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    projectSelect: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : '#F8FAFC',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
    },
    projectSelectContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    projectIcon: {
      marginRight: 10,
    },
    projectSelectText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    timeRow: {
      flexDirection: 'row',
      marginTop: 12,
    },
    timeInput: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : '#F8FAFC',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
    },
    timeInputText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    placesContainer: {
      marginBottom: 12,
      gap: 8,
    },
    placesSuggestion: {
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.08)' : '#F8FAFC',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0',
    },
    placesSuggestionText: {
      color: theme.colors.text,
      fontSize: 13,
    },
    placesSuggestionSecondary: {
      color: theme.colors.muted,
      fontSize: 11,
      marginTop: 4,
    },
    stopList: {
      gap: 8,
      marginTop: 4,
    },
    stopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.07)' : '#F8FAFC',
      padding: 10,
    },
    stopIndex: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#8B5CF6',
    },
    stopIndexText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },
    stopCopy: {
      flex: 1,
    },
    stopTitle: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    stopSubtitle: {
      color: theme.colors.muted,
      fontSize: 11,
      marginTop: 2,
    },
    stopRemoveButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? 'rgba(239,68,68,0.14)' : '#FEE2E2',
    },
    addStopModeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.14)' : '#D8E2F0',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#EEF6FF',
    },
    addStopModeButtonActive: {
      backgroundColor: 'rgba(139,92,246,0.15)',
      borderColor: '#8B5CF6',
    },
    addStopModeText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '700',
      flexShrink: 1,
    },
    addStopModeTextActive: {
      color: '#8B5CF6',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      gap: 8,
    },
    loadingText: {
      color: theme.colors.text,
      fontSize: 13,
    },
    billableRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    billableLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
    },
    mapContainer: {
      height: 300,
      borderRadius: 18,
      overflow: 'hidden',
      marginBottom: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    mapHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    mapExpandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.16)' : '#D8E2F0',
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#EEF6FF',
    },
    mapExpandButtonFloating: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: theme.isDark ? 'rgba(15,23,42,0.9)' : '#FFFFFF',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 4,
    },
    mapExpandText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '800',
    },
    map: {
      flex: 1,
    },
    routeCard: {
      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.07)' : '#F8FAFC',
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
    },
    routeCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.16)' : '#EEF6FF',
    },
    routeCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    routeCardBody: {
      flex: 1,
    },
    routeTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    routeTitleActive: {
      color: theme.colors.primary,
    },
    routeDetails: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
    routeSelectBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 6,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
    },
    routeSelectText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '800',
    },
    routeRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    routeRadioActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    routeRadioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.background,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 8,
      marginBottom: 8,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
    },
    buttonDisabled: {
      opacity: 0.3,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#CBD5E1',
    },
    secondaryButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      marginBottom: 8,
    },
    successText: {
      color: '#22C55E',
      fontSize: 12,
      marginBottom: 8,
    },
    mapModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.76)',
      justifyContent: 'center',
      padding: 14,
    },
    mapModalContent: {
      flex: 1,
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.16)' : '#FFFFFF',
    },
    fullScreenMap: {
      flex: 1,
    },
    mapModalCloseButton: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(15, 23, 42, 0.86)',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 4,
    },
    summaryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    summaryText: {
      fontSize: 12,
      color: theme.colors.text,
      fontWeight: '600',
    },
    cardInternal: {
      gap: 4,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      padding: 14,
      borderRadius: 16,
      marginTop: 20,
      gap: 10,
    },
    nextButtonText: {
      color: '#FFF',
      fontWeight: '800',
      fontSize: 15,
    },
    mapCompactContainer: {
      height: 260,
      borderRadius: 20,
      overflow: 'hidden',
      marginVertical: 12,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
    },
    mapCompact: {
      flex: 1,
    },
    expandButtonSmall: {
      position: 'absolute',
      right: 10,
      top: 10,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    routeSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    routeOption: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
    },
    routeOptionActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.15)' : '#EEF6FF',
    },
    routeOptionText: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: '700',
    },
    routeOptionTextActive: {
      color: theme.colors.primary,
    },
    // Route detail card styles
    routeSelectorSection: {
      marginTop: 12,
      marginBottom: 4,
      gap: 8,
    },
    routeSelectorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    routeSelectorTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
      flex: 1,
    },
    routeSelectorCount: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.muted,
    },
    routeDetailCard: {
      borderRadius: 16,
      padding: 14,
      borderWidth: 1.5,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
      gap: 10,
    },
    routeDetailCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.isDark ? 'rgba(37, 99, 235, 0.12)' : '#EEF6FF',
    },
    routeDetailTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    routeDetailLabelWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    routeDetailLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      flex: 1,
    },
    routeDetailLabelActive: {
      color: theme.colors.primary,
    },
    routeSelectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    routeSelectedBadgeText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '800',
    },
    routeDetailStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 30,
    },
    routeStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    routeStatValue: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.muted,
    },
    routeStatValueActive: {
      color: theme.colors.primary,
    },
    routeStatDivider: {
      width: 1,
      height: 12,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    saveButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      padding: 16,
      borderRadius: 18,
      gap: 8,
    },
    saveButtonText: {
      color: '#FFF',
      fontWeight: '800',
      fontSize: 16,
    },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
      borderRadius: 18,
    },
    cancelButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 14,
    },
  });
