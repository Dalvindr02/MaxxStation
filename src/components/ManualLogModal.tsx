import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import Feather from 'react-native-vector-icons/Feather';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {
 searchPlacesAPI,
 placeDetailAPI,
 getDirectionAPI,
 geocodeAddressAPI,
 DirectionsRoute,
} from '../services/backendMapService';
import {AppTheme} from '../theme';
import {LatLng, WORK_LOCATION} from '../constants/workLocation';
import {
 createManualLogRequest,
 createTravelLogRequest,
} from '../services/manualLogService';
import {buildTravelAuditResult} from '../services/travelAuditService';
import {TopHeader} from './TopHeader';
import {ProjectPickerModal} from './Logs/ProjectPickerModal';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {fetchProjects} from '../store/projectsSlice';
import DateTimePicker, {
 DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {ThemedIOSDateTimePicker} from './ThemedIOSDateTimePicker';
import {useDialog} from '../context/DialogContext';

export interface ManualLogModalProps {
 visible: boolean;
 onClose: () => void;
 onSave: () => void;
 theme: AppTheme;
 authToken: string;
 selectedProjectId: string | null;
 projects: Array<{id: string; name: string; tasks: Array<{id: string}>}>;
}

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
  searchButtonDisabled: {
   opacity: 0.54,
  },
  multilineInput: {
   minHeight: 80,
   textAlignVertical: 'top',
  },
  dropdown: {
   backgroundColor: 'rgba(255, 255, 255, 0.08)',
   borderRadius: 8,
   padding: 12,
   marginBottom: 12,
   borderWidth: 1,
   borderColor: 'rgba(255, 255, 255, 0.1)',
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
  dropdownItem: {
   padding: 12,
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
   shadowOffset: {width: 0, height: 6},
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
   shadowColor: theme.colors.primary,
   shadowOffset: {width: 0, height: 4},
   shadowOpacity: 0.3,
   shadowRadius: 6,
   elevation: 5,
  },
  buttonDisabled: {
   opacity: 0.3,
   backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#CBD5E1',
   shadowOpacity: 0,
   elevation: 0,
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
  helperText: {
   fontSize: 12,
   color: 'rgba(255, 255, 255, 0.6)',
   marginTop: 8,
  },
  header: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   paddingHorizontal: 16,
   paddingVertical: 12,
   backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
   borderBottomWidth: 1,
   borderBottomColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
  },
  headerTitle: {
   fontSize: 18,
   fontWeight: '600',
   color: theme.colors.text,
  },
  closeButton: {
   padding: 8,
  },
  rowContainer: {
   flexDirection: 'row',
   gap: 8,
   marginBottom: 12,
  },
  rowItem: {
   flex: 1,
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
 });

export const ManualLogModal: React.FC<ManualLogModalProps> = ({
 visible,
 onClose,
 onSave,
 theme,
 authToken,
 selectedProjectId,
 projects,
}) => {
 const styles = useMemo(() => createStyles(theme), [theme]);
 const insets = useSafeAreaInsets();
 const {showDialog} = useDialog();
 const dispatch = useAppDispatch();
 const {items: reduxProjects, isLoading: isProjectsLoading} = useAppSelector(
  state => state.projects,
 );
 const isMounted = useRef(true);
 const isAddingStopFromMapRef = useRef(false);

 // State
 const [fromLabel, setFromLabel] = useState('');
 const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
 const [toLabel, setToLabel] = useState('');
 const [toCoords, setToCoords] = useState<LatLng | null>(null);
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

 // Fetch projects on mount if the modal becomes visible
 useEffect(() => {
  if (visible) {
   dispatch(fetchProjects());
  }
 }, [visible, dispatch]);

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

 useEffect(() => {
  isAddingStopFromMapRef.current = isAddingStopFromMap;
 }, [isAddingStopFromMap]);

 // Synchronize internal state with prop if prop changes
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

 // Handle from location search
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
   const suggestions = await searchPlacesAPI(query, authToken);
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

 // Handle to location search
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
   const suggestions = await searchPlacesAPI(query, authToken);
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

 // Handle from place selection
 const handleSelectFromPlace = useCallback(
  async (place: PlaceOption) => {
   setShowFromSuggestions(false);
   setLoadingFromSuggestions(true);
   try {
    const geocoded = await placeDetailAPI(place.placeId, authToken);
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

 // Handle to place selection
 const handleSelectToPlace = useCallback(
  async (place: PlaceOption) => {
   setShowToSuggestions(false);
   setLoadingToSuggestions(true);
   try {
    const geocoded = await placeDetailAPI(place.placeId, authToken);
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
   const suggestions = await searchPlacesAPI(query, authToken);
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
    const geocoded = await placeDetailAPI(place.placeId, authToken);
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
     authToken,
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
   stops.map(({latitude, longitude}) => ({
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
     authToken,
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
 const canSave =
  fromCoords &&
  toCoords &&
  topic.trim() &&
  description.trim() &&
  selectedRoute &&
  internalSelectedProjectId;

 const resetForm = useCallback(() => {
  setFromLabel('');
  setFromCoords(null);
  setToLabel('');
  setToCoords(null);
  setTopic('');
  setDescription('');
  setBillable(true);
  setStopLabel('');
  setFromSuggestions([]);
  setToSuggestions([]);
  setStopSuggestions([]);
  setStops([]);
  isAddingStopFromMapRef.current = false;
  setIsAddingStopFromMap(false);
  setRoutes([]);
  setSelectedRouteId(null);
  setRouteError(null);
  setIsMapModalVisible(false);
  setTravelDate(new Date());
  setStartTime('09:00');
  setEndTime('10:00');
 }, []);

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
    primaryAction: {label: 'Okay'},
   });
   return;
  }
  if (!selectedRoute) {
   showDialog({
    title: 'Route Not Ready',
    message: 'Please wait for the route to load and select one.',
    variant: 'warning',
    primaryAction: {label: 'Okay'},
   });
   return;
  }
  if (!topic.trim() || !description.trim()) {
   showDialog({
    title: 'Missing Details',
    message: 'Please enter both a Topic and a Description.',
    variant: 'warning',
    primaryAction: {label: 'Okay'},
   });
   return;
  }
  if (!internalSelectedProjectId) {
   showDialog({
    title: 'Missing Project',
    message: 'Please select a project before saving.',
    variant: 'warning',
    primaryAction: {label: 'Okay'},
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
    primaryAction: {label: 'Okay'},
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

   console.log(
    'Sending payload to travel-log-create:',
    JSON.stringify(payload, null, 2),
   );

   const result = await createTravelLogRequest(payload, authToken);

   if (result.success) {
    showDialog({
     title: 'Success',
     message: result.message || 'Travel log created successfully.',
     variant: 'success',
     primaryAction: {
      label: 'Okay',
      onPress: () => {
       onSave();
       resetForm();
       onClose();
      },
     },
    });
    return;
   } else {
    showDialog({
     title: 'Error',
     message: result.message || 'Failed to create travel log.',
     variant: 'error',
     primaryAction: {label: 'Okay'},
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
    primaryAction: {label: 'Okay'},
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
  onSave,
  onClose,
  resetForm,
  travelDate,
  startTime,
  endTime,
 ]);

 const handleClose = useCallback(() => {
  resetForm();
  onClose();
 }, [resetForm, onClose]);

 return (
  <Modal
   visible={visible}
   animationType="slide"
   transparent={false}
   onRequestClose={handleClose}>
   <View
    style={[
     styles.safe,
     {
      paddingTop: Platform.OS === 'ios' ? insets.top : 0,
      paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
     },
    ]}>
    <LinearGradient
     colors={theme.gradients.screen}
     start={{x: 0.5, y: 0}}
     end={{x: 0.5, y: 1}}
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
      <View style={styles.heroCard}>
       <View style={styles.heroRow}>
        <View style={styles.heroIcon}>
         <Feather name="navigation" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.heroCopy}>
         <Text allowFontScaling={false} style={styles.heroTitle}>
          Manual Travel Log
         </Text>
         <Text allowFontScaling={false} style={styles.heroSubtitle}>
          Search each stop, review the route, then save billable travel.
         </Text>
        </View>
       </View>
      </View>

      {/* Project Selection */}
      <View style={styles.card}>
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
      </View>

      {/* Date and Time Range */}
      <View style={styles.card}>
       <Text allowFontScaling={false} style={styles.label}>
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
         style={[styles.timeInput, {flex: 1, marginRight: 8}]}
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
         style={[styles.timeInput, {flex: 1}]}
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
      </View>

      {/* From Location */}
      <View style={styles.card}>
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
         <ActivityIndicator size="small" color="#FFFFFF" />
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
         <ActivityIndicator size="small" color={theme.colors.primary} />
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
      </View>

      {/* To Location */}
      <View style={styles.card}>
       <View style={styles.fieldHeader}>
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
         <ActivityIndicator size="small" color="#FFFFFF" />
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
         <ActivityIndicator size="small" color={theme.colors.primary} />
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
      </View>

      <View style={styles.card}>
       <View style={styles.fieldHeader}>
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
         <ActivityIndicator size="small" color="#FFFFFF" />
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
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel={`Remove stop ${index + 1}`}>
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
      </View>

      <View style={styles.card}>
       {/* Map header */}
       <View style={styles.mapHeaderRow}>
        <View>
         <Text allowFontScaling={false} style={styles.label}>
          Route Map
         </Text>
         {selectedRoute ? (
          <Text allowFontScaling={false} style={styles.fieldHint}>
           {(selectedRoute.distanceMeters / 1000).toFixed(1)} km ·{' '}
           {Math.ceil(selectedRoute.durationSeconds / 60)} min
          </Text>
         ) : null}
        </View>
       </View>

       {/* Add stop from map — full-width strip above the map */}
       <TouchableOpacity
        style={[
         styles.addStopModeButton,
         isAddingStopFromMap && styles.addStopModeButtonActive,
        ]}
        onPress={handleToggleAddStopFromMap}
        activeOpacity={0.86}
        accessibilityRole="button"
        accessibilityLabel="Add stop from map">
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

       <View style={styles.mapContainer}>
        <MapView
         provider={PROVIDER_GOOGLE}
         style={styles.map}
         initialRegion={mapRegion}
         region={mapRegion}
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
           strokeWidth={4}
           strokeColor={theme.colors.primary}
          />
         ) : null}
        </MapView>
        <TouchableOpacity
         style={[styles.mapExpandButton, styles.mapExpandButtonFloating]}
         onPress={() => setIsMapModalVisible(true)}
         activeOpacity={0.86}
         accessibilityRole="button"
         accessibilityLabel="Open large route map">
         <Feather name="maximize-2" size={14} color={theme.colors.primary} />
         <Text allowFontScaling={false} style={styles.mapExpandText}>
          Large view
         </Text>
        </TouchableOpacity>
       </View>
      </View>

      {/* Route Selection */}
      {routes.length > 0 && (
       <View style={styles.card}>
        <Text allowFontScaling={false} style={styles.label}>
         Select Route
        </Text>
        {routes.map(route => (
         <TouchableOpacity
          key={route.id}
          style={[
           styles.routeCard,
           selectedRoute?.id === route.id && styles.routeCardActive,
          ]}
          onPress={() => setSelectedRouteId(route.id)}>
          <View style={styles.routeCardContent}>
           <View
            style={[
             styles.routeRadio,
             selectedRoute?.id === route.id && styles.routeRadioActive,
            ]}>
            {selectedRoute?.id === route.id && (
             <View style={styles.routeRadioDot} />
            )}
           </View>
           <View style={styles.routeCardBody}>
            <Text
             allowFontScaling={false}
             numberOfLines={1}
             style={[
              styles.routeTitle,
              selectedRoute?.id === route.id && styles.routeTitleActive,
             ]}>
             {route.label}
            </Text>
            <Text allowFontScaling={false} style={styles.routeDetails}>
             {(route.distanceMeters / 1000).toFixed(1)} km •{' '}
             {Math.ceil(route.durationSeconds / 60)} min
             {route.durationSeconds > 0
              ? `  •  avg ${(
                 route.distanceMeters /
                 1000 /
                 (route.durationSeconds / 3600)
                ).toFixed(0)} km/h`
              : ''}
            </Text>
           </View>
           <View style={styles.routeSelectBadge}>
            <Feather
             name={selectedRoute?.id === route.id ? 'check' : 'map'}
             size={12}
             color={theme.colors.primary}
            />
            <Text allowFontScaling={false} style={styles.routeSelectText}>
             {selectedRoute?.id === route.id ? 'Selected' : 'Select'}
            </Text>
           </View>
          </View>
         </TouchableOpacity>
        ))}
       </View>
      )}

      {loadingRoutes && (
       <View style={styles.card}>
        <View style={styles.loadingContainer}>
         <ActivityIndicator size="small" color={theme.colors.primary} />
         <Text allowFontScaling={false} style={styles.loadingText}>
          Fetching route options...
         </Text>
        </View>
       </View>
      )}

      {routeError && (
       <View style={styles.card}>
        <Text allowFontScaling={false} style={styles.errorText}>
         {routeError}
        </Text>
       </View>
      )}

      {/* Travel Details */}
      <View style={styles.card}>
       <Text allowFontScaling={false} style={styles.label}>
        Travel Details
       </Text>

       <Text allowFontScaling={false} style={styles.label}>
        Topic
       </Text>
       <TextInput
        style={styles.input}
        placeholder="e.g., Client meeting, Office visit"
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
      </View>

      {/* Save Button */}
      <View style={styles.card}>
       <TouchableOpacity
        style={[
         styles.button,
         styles.primaryButton,
         (!canSave || saving) && styles.buttonDisabled,
        ]}
        onPress={handleSaveLog}>
        {saving ? (
         <>
          <ActivityIndicator size="small" color={theme.colors.text} />
          <Text allowFontScaling={false} style={styles.buttonText}>
           Saving...
          </Text>
         </>
        ) : (
         <>
          <Feather name="save" size={16} color={theme.colors.text} />
          <Text allowFontScaling={false} style={styles.buttonText}>
           Save Travel Log
          </Text>
         </>
        )}
       </TouchableOpacity>

       <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={handleClose}
        disabled={saving}>
        <Feather name="x" size={16} color={theme.colors.text} />
        <Text allowFontScaling={false} style={styles.buttonText}>
         Cancel
        </Text>
       </TouchableOpacity>
      </View>
     </ScrollView>
    </KeyboardAvoidingView>
   </View>
   <Modal visible={isMapModalVisible} transparent animationType="fade">
    <View style={styles.mapModalOverlay}>
     <View style={styles.mapModalContent}>
      <MapView
       provider={PROVIDER_GOOGLE}
       style={styles.fullScreenMap}
       loadingEnabled
       initialRegion={mapRegion}
       region={mapRegion}
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
       activeOpacity={0.85}
       accessibilityRole="button"
       accessibilityLabel="Close large route map">
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
  </Modal>
 );
};
