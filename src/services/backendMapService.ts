import {LatLng} from '../constants/workLocation';

export type PlaceOption = {
  placeId: string;
  label: string;
  description: string;
};

export type GeocodedPlace = {
  placeId: string;
  label: string;
  coords: LatLng;
  address: string;
};

export type DirectionsRoute = {
  id: string;
  label: string;
  points: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  summary: string;
};

export const decodePolyline = (encoded: string): LatLng[] => {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const coordinates: LatLng[] = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const latitudeDelta = result & 1 ? ~(result >> 1) : result >> 1;
    latitude += latitudeDelta;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const longitudeDelta = result & 1 ? ~(result >> 1) : result >> 1;
    longitude += longitudeDelta;

    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return coordinates;
};

const parseGeocodeResult = (data: any, fallbackLabel: string): GeocodedPlace => {
  const result = Array.isArray(data?.data?.results) ? data.data.results[0] : 
                 Array.isArray(data?.results) ? data.results[0] :
                 data?.data || data;

  if (result?.geometry?.location) {
    return {
      placeId: String(result.place_id || 'unknown'),
      label: String(result.formatted_address || fallbackLabel),
      address: String(result.formatted_address || fallbackLabel),
      coords: {
        latitude: Number(result.geometry.location.lat),
        longitude: Number(result.geometry.location.lng),
      }
    };
  } else if (result?.lat && result?.lng) {
     return {
      placeId: String(result.place_id || 'unknown'),
      label: String(result.formatted_address || result.address || result.label || fallbackLabel),
      address: String(result.formatted_address || result.address || fallbackLabel),
      coords: {
        latitude: Number(result.lat),
        longitude: Number(result.lng),
      }
    };
  } else if (result?.latitude && result?.longitude) {
    return {
      placeId: String(result.place_id || 'unknown'),
      label: String(result.formatted_address || result.address || result.label || fallbackLabel),
      address: String(result.formatted_address || result.address || fallbackLabel),
      coords: {
        latitude: Number(result.latitude),
        longitude: Number(result.longitude),
      }
    };
  }
  
  // Custom parsing in case backend simplifies Google maps geocoding response
  if (result && typeof result === 'object' && 'latitude' in result && 'longitude' in result) {
      return {
          placeId: String(result.place_id || 'unknown'),
          label: String(result.label || result.address || fallbackLabel),
          address: String(result.address || fallbackLabel),
          coords: {
              latitude: Number(result.latitude),
              longitude: Number(result.longitude)
          }
      };
  }
  
  throw new Error('Unable to parse geocode result.');
};

export const searchPlacesAPI = async (input: string, token: string): Promise<PlaceOption[]> => {
  if (!input.trim()) return [];
  const formData = new FormData();
  formData.append('input', input.trim());
  
  const response = await fetch('https://apimaxxstation.maxxmann.info/api/android/search-places', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  
  if (!response.ok) throw new Error('Failed to search places');
  const data = await response.json();
  
  const predictions = Array.isArray(data?.data?.predictions) ? data.data.predictions :
                      Array.isArray(data?.predictions) ? data.predictions :
                      Array.isArray(data?.data) ? data.data :
                      Array.isArray(data) ? data : [];
                      
  return predictions.map((p: any) => ({
    placeId: String(p.place_id || p.placeId || ''),
    label: String(p.structured_formatting?.main_text || p.description || p.label || p.primaryText || ''),
    description: String(p.structured_formatting?.secondary_text || p.secondaryText || p.description || ''),
  }));
};

export const placeDetailAPI = async (placeId: string, token: string): Promise<GeocodedPlace> => {
  const formData = new FormData();
  formData.append('place_id', placeId);
  
  const response = await fetch('https://apimaxxstation.maxxmann.info/api/android/place-detail', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  
  if (!response.ok) throw new Error('Failed to fetch place detail');
  const data = await response.json();
  return parseGeocodeResult(data, 'Selected place');
};

export const geocodeAddressAPI = async (address: string, token: string): Promise<GeocodedPlace> => {
  const formData = new FormData();
  formData.append('address', address);
  
  const response = await fetch('https://apimaxxstation.maxxmann.info/api/android/get-geoCode', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  
  if (!response.ok) throw new Error('Failed to fetch geocode');
  const data = await response.json();
  return parseGeocodeResult(data, address);
};

const parseRouteNumber = (val: any, isDistance: boolean): number => {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && val.value !== undefined) return Number(val.value);
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
    if (isDistance) {
      if (val.toLowerCase().includes('km')) return parsed * 1000;
      if (val.toLowerCase().includes('mi')) return parsed * 1609.34;
    } else {
      if (val.toLowerCase().includes('h')) {
        let total = 0;
        const hrs = val.match(/(\d+(\.\d+)?)\s*h/i);
        const mins = val.match(/(\d+(\.\d+)?)\s*m/i);
        if (hrs) total += parseFloat(hrs[1]) * 3600;
        if (mins) total += parseFloat(mins[1]) * 60;
        return total || parsed * 60;
      }
      if (val.toLowerCase().includes('m')) return parsed * 60;
    }
    return parsed;
  }
  return 0;
};

const parseRoutesFromData = (data: any, labelPrefix: string): DirectionsRoute[] => {
  if (data?.status === false || data?.error) {
    return [];
  }

  let routes = Array.isArray(data?.data?.routes) ? data.data.routes :
               Array.isArray(data?.routes) ? data.routes :
               Array.isArray(data?.data) ? data.data :
               Array.isArray(data) ? data : [];

  if (routes.length === 0) {
    const flatData = data?.data || data;
    if (flatData && (flatData.polyline || flatData.overview_polyline || flatData.points || flatData.distance)) {
      routes = [flatData];
    }
  }

  if (!routes || routes.length === 0) return [];

  return routes.reduce((acc: DirectionsRoute[], route: any, index: number) => {
    try {
      const legs = Array.isArray(route.legs) ? route.legs : [];
      let distanceMeters = 0;
      let durationSeconds = 0;

      if (legs.length > 0) {
        distanceMeters = legs.reduce((s: number, leg: any) => s + parseRouteNumber(leg?.distance, true), 0);
        durationSeconds = legs.reduce((s: number, leg: any) => s + parseRouteNumber(leg?.duration, false), 0);
      } else {
        distanceMeters = parseRouteNumber(route.distanceMeters || route.distance, true);
        durationSeconds = parseRouteNumber(route.durationSeconds || route.duration, false);
      }

      let points: LatLng[] = [];
      if (route.overview_polyline?.points) {
        points = decodePolyline(String(route.overview_polyline.points));
      } else if (route.polyline) {
        points = decodePolyline(String(route.polyline));
      } else if (route.points) {
        points = Array.isArray(route.points) ? route.points : decodePolyline(String(route.points));
      } else if (Array.isArray(route.coordinates)) {
        points = route.coordinates;
      }

      if (points.length === 0) return acc;

      // Use the real Google Maps road name from the summary field.
      // Fall back to extracting highway names from leg steps, then to the labelPrefix.
      let roadName: string = String(route.summary || route.label || '').trim();

      if (!roadName) {
        // Try to pull major road names from the first leg's steps
        const firstLegSteps: any[] = legs[0]?.steps ?? [];
        const highwayNames = firstLegSteps
          .map((s: any) => s?.html_instructions || s?.instruction || '')
          .join(' ')
          .match(/(?:NH|SH|MDR|\bvia\s+\w+)\s*\d*/gi)
          ?? [];
        roadName = [...new Set(highwayNames)].slice(0, 2).join(', ');
      }

      if (!roadName) {
        roadName = `${labelPrefix} ${index + 1}`;
      }

      acc.push({
        id: `${labelPrefix}-${index}-${distanceMeters}`,
        label: roadName,
        points,
        distanceMeters,
        durationSeconds,
        summary: roadName,
      });
    } catch (_) { /* skip unparseable route */ }
    return acc;
  }, []);
};

const callDirectionAPI = async (
  originStr: string,
  destinationStr: string,
  avoid: string | null,
  token: string,
): Promise<DirectionsRoute[]> => {
  const formData = new FormData();
  formData.append('origin', originStr);
  formData.append('destination', destinationStr);
  formData.append('alternatives', 'true');
  if (avoid) formData.append('avoid', avoid);

  try {
    const response = await fetch('https://apimaxxstation.maxxmann.info/api/android/get-direction', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) return [];
    const data = await response.json();
    const label = avoid
      ? avoid === 'highways' ? 'Via Local Roads' : 'Avoid Tolls'
      : 'Route';
    return parseRoutesFromData(data, label);
  } catch {
    return [];
  }
};

/** Return a point offset perpendicular to the A→B vector, at fraction t along the line.
 *  offsetDeg is in degrees (~0.3° ≈ 33 km, scaled by distance). */
const perpendicularWaypoint = (
  a: LatLng,
  b: LatLng,
  t: number,
  side: 1 | -1,
): LatLng => {
  const midLat = a.latitude  + (b.latitude  - a.latitude)  * t;
  const midLng = a.longitude + (b.longitude - a.longitude) * t;

  // Vector A→B
  const dLat = b.latitude  - a.latitude;
  const dLng = b.longitude - a.longitude;
  const len  = Math.sqrt(dLat * dLat + dLng * dLng) || 1;

  // Scale offset to ~12 % of total distance (feels natural for alternative routes)
  const offset = (len * 0.12) * side;

  // Perpendicular unit vector (rotate 90°)
  return {
    latitude:  midLat + (-dLng / len) * offset,
    longitude: midLng + ( dLat / len) * offset,
  };
};

/** Call the backend for a single origin→destination (with an optional via-waypoint). */
const callDirectAPI = async (
  origin: LatLng,
  destination: LatLng,
  via: LatLng | null,
  token: string,
  label: string,
): Promise<DirectionsRoute[]> => {
  const fmt = (c: LatLng) => `${c.latitude},${c.longitude}`;
  const formData = new FormData();
  formData.append('origin',      fmt(origin));
  formData.append('destination', fmt(destination));
  formData.append('alternatives', 'true');
  if (via) formData.append('waypoints', fmt(via));

  try {
    const response = await fetch(
      'https://apimaxxstation.maxxmann.info/api/android/get-direction',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData },
    );
    if (!response.ok) return [];
    const data = await response.json();
    return parseRoutesFromData(data, label);
  } catch {
    return [];
  }
};

const fetchSingleDirection = async (
  originCoords: LatLng,
  destinationCoords: LatLng,
  token: string,
): Promise<DirectionsRoute[]> => {

  // Compute two perpendicular waypoints (left and right of the straight-line path)
  const viaLeft  = perpendicularWaypoint(originCoords, destinationCoords, 0.45,  1);
  const viaRight = perpendicularWaypoint(originCoords, destinationCoords, 0.55, -1);

  // Fire all three calls in parallel
  const [primary, altLeft, altRight] = await Promise.all([
    callDirectAPI(originCoords, destinationCoords, null,     token, 'Route'),
    callDirectAPI(originCoords, destinationCoords, viaLeft,  token, 'Alt Route'),
    callDirectAPI(originCoords, destinationCoords, viaRight, token, 'Alt Route'),
  ]);

  if (primary.length === 0 && altLeft.length === 0 && altRight.length === 0) {
    throw new Error('No routes found between these locations.');
  }

  // Keep the real road name from the backend; just tag the fastest one
  const labelledPrimary = primary.map((r, i) => ({
    ...r,
    id:    i === 0 ? 'fastest' : `route-${i}`,
    // Prepend "Fastest ·" badge only to the first result; preserve road name
    label: i === 0
      ? (r.label && !r.label.startsWith('Route')
          ? `⚡ ${r.label}` : '⚡ Fastest Route')
      : r.label,
  }));

  const labelledLeft  = altLeft.map((r, i)  => ({
    ...r,
    id:    `alt-left-${i}`,
    label: r.label && !r.label.startsWith('Alt')
      ? `🔵 ${r.label}` : `🔵 Alternative ${i + 1}`,
  }));
  const labelledRight = altRight.map((r, i) => ({
    ...r,
    id:    `alt-right-${i}`,
    label: r.label && !r.label.startsWith('Alt')
      ? `🟢 ${r.label}` : `🟢 Alternative ${i + 1}`,
  }));

  // Deduplicate by distance bucket (500 m granularity)
  const bucket = (d: number) => Math.round(d / 500);
  const seen   = new Set<number>();
  const result: DirectionsRoute[] = [];

  for (const r of [...labelledPrimary, ...labelledLeft, ...labelledRight]) {
    const key = bucket(r.distanceMeters);
    if (!seen.has(key) && r.points.length > 0) {
      seen.add(key);
      result.push(r);
    }
  }

  return result.slice(0, 4); // Show at most 4 options
};



export const getDirectionAPI = async (
  originCoords: LatLng, 
  destinationCoords: LatLng, 
  waypoints: LatLng[] = [],
  token: string
): Promise<DirectionsRoute[]> => {
  if (waypoints && waypoints.length > 0) {
      const allPoints = [originCoords, ...waypoints, destinationCoords];
      let totalDistance = 0;
      let totalDuration = 0;
      let combinedPoints: LatLng[] = [];
      let combinedSummary = 'Multi-stop Route';
      
      for (let i = 0; i < allPoints.length - 1; i++) {
          const legOrigin = allPoints[i];
          const legDest = allPoints[i + 1];
          
          const legRoutes = await fetchSingleDirection(legOrigin, legDest, token);
          if (legRoutes && legRoutes.length > 0) {
              const bestRoute = legRoutes[0];
              totalDistance += bestRoute.distanceMeters;
              totalDuration += bestRoute.durationSeconds;
              combinedPoints = [...combinedPoints, ...bestRoute.points];
              if (i === 0 && bestRoute.summary) {
                  combinedSummary = bestRoute.summary;
              }
          } else {
              throw new Error(`Failed to fetch route segment ${i + 1}`);
          }
      }
      
      return [{
          id: 'multi-stop-route',
          label: combinedSummary,
          points: combinedPoints,
          distanceMeters: totalDistance,
          durationSeconds: totalDuration,
          summary: combinedSummary
      }];
  }

  return fetchSingleDirection(originCoords, destinationCoords, token);
};
