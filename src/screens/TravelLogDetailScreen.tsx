import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Callout,
} from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';

import { TopHeader } from '../components/TopHeader';
import { AnimatedCard } from '../components/ui';
import { useAppTheme } from '../context/ThemeContext';
import { AppTheme } from '../theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchTravelLogDetail, clearSelectedLog } from '../store/travelLogSlice';
import { decodePolyline } from '../services/backendMapService';
import { reverseGeocodeCoords } from '../services/googleMapsService';

const { width } = Dimensions.get('window');

const cleanAddress = (addr: string | undefined) => {
  if (!addr) return '';
  // Split by comma and check if the first part is a Plus Code (contains +)
  const parts = addr.split(',');
  if (parts.length > 0 && parts[0].includes('+')) {
    return parts.slice(1).join(',').trim();
  }
  return addr;
};

export const TravelLogDetailScreen = () => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const route = useRoute<any>();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const mapRef = useRef<MapView>(null);
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const stopMarkerRefs = useRef<any[]>([]);

  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [fromAddress, setFromAddress] = useState<string>('Loading address...');
  const [toAddress, setToAddress] = useState<string>('Loading address...');
  const [stopAddresses, setStopAddresses] = useState<Record<number, string>>({});

  const id = route.params?.id;
  const {
    selectedLogDetail: log,
    isDetailLoading: isLoading,
    error,
  } = useAppSelector(state => state.travelLogs);

  useEffect(() => {
    if (id) {
      dispatch(fetchTravelLogDetail(id));
    }
    return () => {
      dispatch(clearSelectedLog());
    };
  }, [id, dispatch]);

  // Fetch addresses for all points
  useEffect(() => {
    const fetchAllAddresses = async () => {
      if (!log) return;

      // Start Address
      if (isValidCoord(log.start_lat, log.start_lng)) {
        try {
          const res = await reverseGeocodeCoords({
            latitude: Number(log.start_lat),
            longitude: Number(log.start_lng),
          });
          setFromAddress(cleanAddress(log.from_address || res.address) || 'Start Location');
        } catch (e) {
          setFromAddress(cleanAddress(log.from_address) || `${log.start_lat}, ${log.start_lng}`);
        }
      }

      // End Address
      if (isValidCoord(log.end_lat, log.end_lng)) {
        try {
          const res = await reverseGeocodeCoords({
            latitude: Number(log.end_lat),
            longitude: Number(log.end_lng),
          });
          setToAddress(cleanAddress(log.to_address || res.address) || 'End Location');
        } catch (e) {
          setToAddress(cleanAddress(log.to_address) || `${log.end_lat}, ${log.end_lng}`);
        }
      }

      // Stops Addresses
      if (log.stops && log.stops.length > 0) {
        const addresses: Record<number, string> = {};
        for (let i = 0; i < log.stops.length; i++) {
          const stop = log.stops[i];
          if (isValidCoord(stop.lat, stop.lng)) {
            try {
              const res = await reverseGeocodeCoords({
                latitude: Number(stop.lat),
                longitude: Number(stop.lng),
              });
              addresses[i] = cleanAddress(stop.address || res.address) || `Stop ${i + 1}`;
            } catch (e) {
              addresses[i] = cleanAddress(stop.address) || `Stop ${i + 1}`;
            }
          }
        }
        setStopAddresses(addresses);
      }
    };

    if (log) {
      fetchAllAddresses();
    }
  }, [log]);

  const isValidCoord = (lat: any, lng: any) => {
    const nLat = parseFloat(lat);
    const nLng = parseFloat(lng);
    return !isNaN(nLat) && !isNaN(nLng) && nLat !== 0 && nLng !== 0;
  };

  const hasValidStart = log && isValidCoord(log.start_lat, log.start_lng);
  const hasValidEnd = log && isValidCoord(log.end_lat, log.end_lng);

  const waypoints = useMemo(() => {
    if (!log?.stops) return [];
    return log.stops
      .filter(stop => isValidCoord(stop.lat, stop.lng))
      .map(stop => ({
        latitude: parseFloat(stop.lat),
        longitude: parseFloat(stop.lng),
      }));
  }, [log?.stops]);

  const routeCoordinates = useMemo(() => {
    if (!log?.polyline) return [];
    return decodePolyline(log.polyline);
  }, [log?.polyline]);

  const allCoords = useMemo(() => {
    const coords: { latitude: number; longitude: number }[] = [];
    if (routeCoordinates.length > 0) {
      return routeCoordinates;
    }

    if (hasValidStart) {
      coords.push({
        latitude: Number(log.start_lat),
        longitude: Number(log.start_lng),
      });
    }
    if (hasValidEnd) {
      coords.push({ latitude: Number(log.end_lat), longitude: Number(log.end_lng) });
    }
    coords.push(...waypoints);
    return coords;
  }, [log, waypoints, hasValidStart, hasValidEnd, routeCoordinates]);

  useEffect(() => {
    if (allCoords.length > 0 && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(allCoords, {
          edgePadding: { 
            top: isMapExpanded ? insets.top + 100 : 100, 
            right: 80, 
            bottom: isMapExpanded ? insets.bottom + 180 : 100, 
            left: 80 
          },
          animated: true,
        });
      }, 800);
    }
  }, [allCoords, isMapExpanded, insets]);

  const handleCloseCallout = (type: 'start' | 'end' | number) => {
    if (type === 'start') startMarkerRef.current?.hideCallout();
    else if (type === 'end') endMarkerRef.current?.hideCallout();
    else stopMarkerRefs.current[type]?.hideCallout();
  };

  const formatDescriptiveTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';

    // Handle potential date format issues
    const date = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const hours = date.getHours();
    let period = 'Morning';
    if (hours < 5) period = 'Late Night';
    else if (hours < 12) period = 'Morning';
    else if (hours < 14) period = 'Noon';
    else if (hours < 17) period = 'Afternoon';
    else if (hours < 21) period = 'Evening';
    else period = 'Late Night';

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

    let dayStr = '';
    if (isToday) dayStr = 'Today';
    else if (isYesterday) dayStr = 'Yesterday';
    else dayStr = date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

    return `${dayStr}, ${timeStr}`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 14 }}>
          <TopHeader title="Travel Detail" />
        </View>
        <View style={styles.center}>
          <ActivityIndicator key="travel-log-detail-loading" size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching route data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !log) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 14 }}>
          <TopHeader title="Travel Detail" />
        </View>
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error || 'Log detail not found'}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
      />
      {!isMapExpanded && (
        <View style={{ padding: 14 }}>
          <TopHeader title="Travel Detail" />
        </View>
      )}
      <ScrollView
        scrollEnabled={!isMapExpanded}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isMapExpanded && { flexGrow: 1, paddingBottom: 0 }]}>
        {/* Map Section */}
        <AnimatedCard
          delay={100}
          style={[styles.mapCard, isMapExpanded && styles.mapExpanded]}>
          <View
            style={[
              styles.mapContainer,
              isMapExpanded && styles.mapContainerExpanded,
            ]}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: parseFloat(log.start_lat as any),
                longitude: parseFloat(log.start_lng as any),
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}>
              {routeCoordinates.length > 1 ? (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeWidth={5}
                  strokeColor={theme.colors.primary}
                  lineJoin="round"
                  lineCap="round"
                />
              ) : (
                hasValidStart &&
                hasValidEnd && (
                  <Polyline
                    coordinates={[
                      { latitude: Number(log.start_lat), longitude: Number(log.start_lng) },
                      ...waypoints,
                      { latitude: Number(log.end_lat), longitude: Number(log.end_lng) },
                    ]}
                    strokeColor={theme.colors.primary}
                    strokeWidth={4}
                    lineDashPattern={[5, 5]}
                  />
                )
              )}

              {/* Start Marker */}
              {hasValidStart && (
                <Marker
                  ref={startMarkerRef}
                  coordinate={{
                    latitude: Number(log.start_lat),
                    longitude: Number(log.start_lng),
                  }}
                  onPress={() =>
                    setSelectedPoint({
                      title: 'Starting Point',
                      address: cleanAddress(log.from_address || fromAddress),
                      type: 'start',
                    })
                  }
                  anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.markerWrapper}>
                    <View style={[styles.customPin, { backgroundColor: '#10B981' }]}>
                      <Feather name="map-pin" size={12} color="#FFF" />
                    </View>
                    <View style={[styles.pinTail, { borderTopColor: '#10B981' }]} />
                    <Text style={[styles.markerLabel, { color: '#10B981' }]}>START</Text>
                  </View>
                </Marker>
              )}

              {/* End Marker */}
              {hasValidEnd && (
                <Marker
                  ref={endMarkerRef}
                  coordinate={{
                    latitude: Number(log.end_lat),
                    longitude: Number(log.end_lng),
                  }}
                  onPress={() =>
                    setSelectedPoint({
                      title: 'Destination',
                      address: cleanAddress(log.to_address || toAddress),
                      type: 'end',
                    })
                  }
                  anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.markerWrapper}>
                    <View style={[styles.customPin, { backgroundColor: '#EF4444' }]}>
                      <Feather name="flag" size={12} color="#FFF" />
                    </View>
                    <View style={[styles.pinTail, { borderTopColor: '#EF4444' }]} />
                    <Text style={[styles.markerLabel, { color: '#EF4444' }]}>END</Text>
                  </View>
                </Marker>
              )}

              {/* Stops */}
              {log.stops?.map((stop, index) => {
                const stopLat = Number(stop.lat);
                const stopLng = Number(stop.lng);
                if (isNaN(stopLat) || isNaN(stopLng)) return null;

                return (
                  <Marker
                    key={`stop-${stop.id || index}`}
                    ref={el => (stopMarkerRefs.current[index] = el)}
                    coordinate={{ latitude: stopLat, longitude: stopLng }}
                    onPress={() =>
                      setSelectedPoint({
                        title: `Stop Point ${index + 1}`,
                        address: cleanAddress(stop.address || stopAddresses[index]) || 'Route stop',
                        type: 'stop',
                      })
                    }
                    anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={styles.markerWrapper}>
                      <View style={[styles.customPin, { backgroundColor: '#8B5CF6' }]}>
                        <Text style={styles.stopMarkerText}>{index + 1}</Text>
                      </View>
                      <View style={[styles.pinTail, { borderTopColor: '#8B5CF6' }]} />
                      <Text style={[styles.markerLabel, { color: '#8B5CF6' }]}>
                        STOP {index + 1}
                      </Text>
                    </View>
                  </Marker>
                );
              })}
            </MapView>
            <TouchableOpacity
              style={[
                styles.expandButton,
                isMapExpanded && { top: insets.top > 0 ? insets.top + 10 : 20 }
              ]}
              onPress={() => setIsMapExpanded(!isMapExpanded)}>
              <Feather
                name={isMapExpanded ? 'minimize-2' : 'maximize-2'}
                size={20}
                color="#FFF"
              />
            </TouchableOpacity>

            {/* Custom Info Overlay */}
            {selectedPoint && (
              <AnimatedCard style={[
                styles.floatingInfoCard,
                isMapExpanded && { bottom: insets.bottom > 0 ? insets.bottom + 20 : 30 }
              ]}>
                <View style={styles.calloutHeader}>
                  <View style={styles.calloutTitleGroup}>
                    <Feather
                      name={
                        selectedPoint.type === 'start'
                          ? 'play-circle'
                          : selectedPoint.type === 'end'
                            ? 'target'
                            : 'clock'
                      }
                      size={14}
                      color={
                        selectedPoint.type === 'start'
                          ? '#10B981'
                          : selectedPoint.type === 'end'
                            ? '#EF4444'
                            : '#8B5CF6'
                      }
                    />
                    <Text
                      style={[
                        styles.calloutTitle,
                        {
                          color:
                            selectedPoint.type === 'start'
                              ? '#10B981'
                              : selectedPoint.type === 'end'
                                ? '#EF4444'
                                : '#8B5CF6',
                        },
                      ]}>
                      {selectedPoint.title}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedPoint(null)}
                    style={styles.closeButton}>
                    <Feather name="x" size={18} color={theme.colors.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.calloutAddress}>{selectedPoint.address}</Text>
              </AnimatedCard>
            )}
          </View>
        </AnimatedCard>

        {!isMapExpanded && (
          <View style={styles.content}>
            {/* Main Info Card */}
            <AnimatedCard delay={200} style={styles.detailCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Route Summary</Text>
                {log.stops && log.stops.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    style={styles.expandToggle}>
                    <Feather
                      name={isSummaryExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.colors.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.routeInfo}>
                <View style={styles.locationRow}>
                  <View style={styles.iconColumn}>
                    <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                    {(isSummaryExpanded || !log.stops || log.stops.length === 0) && <View style={styles.line} />}
                  </View>
                  <View style={styles.textColumn}>
                    <Text style={styles.locationLabel}>START POINT</Text>
                    <Text style={styles.locationText} numberOfLines={2}>
                      {cleanAddress(log.from_address || fromAddress)}
                    </Text>
                  </View>
                </View>

                {isSummaryExpanded && log.stops?.map((stop, index) => (
                  <View key={`stop-summary-${index}`} style={styles.locationRow}>
                    <View style={styles.iconColumn}>
                      <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
                      <View style={styles.line} />
                    </View>
                    <View style={styles.textColumn}>
                      <Text style={[styles.locationLabel, { color: '#8B5CF6' }]}>
                        STOP {index + 1}
                      </Text>
                      <Text style={styles.locationText} numberOfLines={2}>
                        {cleanAddress(stop.address || stopAddresses[index]) || 'Route stop'}
                      </Text>
                    </View>
                  </View>
                ))}

                {!isSummaryExpanded && log.stops && log.stops.length > 0 && (
                  <View style={styles.locationRow}>
                    <View style={styles.iconColumn}>
                      <View style={styles.line} />
                    </View>
                    <View style={[styles.textColumn, { paddingBottom: 10 }]}>
                      <Text style={styles.collapsedStopsText}>
                        + {log.stops.length} intermediate {log.stops.length === 1 ? 'stop' : 'stops'}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.locationRow}>
                  <View style={styles.iconColumn}>
                    <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                  </View>
                  <View style={styles.textColumn}>
                    <Text style={styles.locationLabel}>END POINT</Text>
                    <Text style={styles.locationText} numberOfLines={2}>
                      {cleanAddress(log.to_address || toAddress)}
                    </Text>
                  </View>
                </View>
              </View>
            </AnimatedCard>

            {/* Stats Grid */}
            <AnimatedCard delay={300} style={styles.statsRow}>
              <View style={styles.statBox}>
                <Feather name="map" size={18} color={theme.colors.primary} />
                <Text style={styles.statValue}>{log.distance} km</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statBox}>
                <Feather name="clock" size={18} color={theme.colors.primary} />
                <Text style={styles.statValue}>
                  {log.duration || log.spent_time_minutes} min
                </Text>
                <Text style={styles.statLabel}>Time Spent</Text>
              </View>
              {/* <View style={styles.statBox}>
                <Feather name="truck" size={18} color={theme.colors.primary} />
                <Text style={styles.statValue}>{log.mode?.toUpperCase()}</Text>
                <Text style={styles.statLabel}>Mode</Text>
              </View> */}
            </AnimatedCard>

            {/* Detailed Info Card */}
            <AnimatedCard delay={400} style={styles.infoCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Travel Details</Text>
                <TouchableOpacity
                  onPress={() => setIsNotesExpanded(!isNotesExpanded)}
                  style={styles.expandToggle}>
                  <Feather
                    name={isNotesExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>START TIME</Text>
                  <Text style={styles.infoValue}>
                    {formatDescriptiveTime(log.start_time || log.start_date_time)}
                  </Text>
                </View>
                <View style={[styles.infoItem, { alignItems: 'flex-end' }]}>
                  <Text style={styles.infoLabel}>END TIME</Text>
                  <Text style={styles.infoValue}>
                    {formatDescriptiveTime(log.end_time || log.end_date_time)}
                  </Text>
                </View>
              </View>

              {isNotesExpanded && (
                <View style={styles.expandedDetails}>
                  <View style={styles.divider} />
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>PROJECT</Text>
                    <Text style={styles.infoValue}>
                      {log.project_name || 'General Project'}
                    </Text>
                  </View>

                  <View style={styles.divider} />
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>PURPOSE </Text>
                    <Text style={styles.infoValue}>
                      {log.purpose || log.task_name || 'Travel Log'}
                    </Text>
                  </View>

                  {(log.notes || log.description) && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>DESCRIPTION & NOTES</Text>
                        <Text style={styles.notesText}>{log.notes || log.description}</Text>
                      </View>
                    </>
                  )}

                  <View style={styles.divider} />
                  <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>BILLABLE</Text>
                      <Text
                        style={[
                          styles.infoValue,
                          { color: log.billable === 'Yes' ? '#10B981' : theme.colors.muted },
                        ]}>
                        {log.billable || 'No'}
                      </Text>
                    </View>
                    <View style={[styles.infoItem, { alignItems: 'flex-end' }]}>
                      <Text style={styles.infoLabel}>STATUS</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              log.status === 'Approved' ? '#10B98120' : '#F59E0B20',
                            alignSelf: 'flex-end',
                          },
                        ]}>
                        <Text
                          style={[
                            styles.statusText,
                            { color: log.status === 'Approved' ? '#10B981' : '#F59E0B' },
                          ]}>
                          {log.status?.toUpperCase() || 'REVIEW'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </AnimatedCard>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme, insets: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.9,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 12,
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    errorText: {
      marginTop: 16,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
    backButton: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
    },
    backButtonText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '700',
    },
    mapCard: {
      margin: 16,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mapExpanded: {
      margin: 10,
      borderRadius: 24,
      flex: 1,
      height: Dimensions.get('window').height - (insets.top + insets.bottom + 40),
      overflow: 'hidden',
    },
    mapContainer: {
      height: 320,
      width: '100%',
      position: 'relative',
      borderRadius: 24,
      overflow: 'hidden',
    },
    mapContainerExpanded: {
      height: '100%',
    },
    expandButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 8,
      borderRadius: 8,
      zIndex: 10,
    },
    map: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 24,
      overflow: 'hidden',
    },
    markerContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#FFF',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    customPin: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    pinTail: {
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: '#10B981',
      marginTop: -2,
      zIndex: -1,
    },
    stopMarkerText: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: '800',
    },
    content: {
      paddingHorizontal: 16,
      gap: 16,
    },
    detailCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    expandToggle: {
      padding: 4,
    },
    expandedDetails: {
      marginTop: 0,
    },
    collapsedStopsText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
      fontStyle: 'italic',
    },
    readMoreBtn: {
      fontSize: 11,
      color: theme.colors.primary,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    routeInfo: {
      gap: 0,
    },
    locationRow: {
      flexDirection: 'row',
      gap: 12,
    },
    iconColumn: {
      alignItems: 'center',
      width: 20,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 4,
    },
    line: {
      width: 2,
      flex: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 4,
    },
    textColumn: {
      flex: 1,
      paddingBottom: 20,
    },
    locationLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.muted,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    locationText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.text,
      lineHeight: 16,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    statBox: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: 8,
    },
    statLabel: {
      fontSize: 11,
      color: theme.colors.muted,
      fontWeight: '600',
      marginTop: 2,
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 20,
    },
    infoGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    infoItem: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.colors.muted,
      letterSpacing: 1,
      marginBottom: 8,
    },
    infoValue: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    notesText: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 22,
      fontWeight: '500',
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 20,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '800',
    },
    calloutCard: {
      backgroundColor: '#1E1035',
      padding: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.15)',
      width: 240,
    },
    floatingInfoCard: {
      position: 'absolute',
      bottom: 16,
      left: 16,
      right: 16,
      backgroundColor: '#1E1035',
      padding: 16,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.2)',
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      zIndex: 100,
    },
    closeButton: {
      padding: 4,
    },
    calloutHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
      paddingBottom: 6,
    },
    calloutTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    calloutTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.primary,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    calloutAddress: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '600',
      lineHeight: 18,
    },
    markerWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerLabel: {
      fontSize: 9,
      fontWeight: '900',
      marginTop: 2,
      backgroundColor: 'rgba(255,255,255,0.95)',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)',
      textAlign: 'center',
      overflow: 'hidden',
    },
  });
