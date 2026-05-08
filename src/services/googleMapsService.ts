import axios from 'axios';
import Geocoder from 'react-native-geocoding';
import Config from 'react-native-config';
import {LatLng} from '../constants/workLocation';

// Load the Google Maps Web API key from the native environment.
// This keeps the key out of source control and lets the app read it from .env.
// Fallback: You can temporarily hardcode the key here for testing
export const GOOGLE_MAPS_WEB_API_KEY =
 Config.GOOGLE_MAPS_WEB_API_KEY?.trim() || '';
('');

console.log(
 '[GoogleMapsService] API Key loaded:',
 GOOGLE_MAPS_WEB_API_KEY ? '✓ Present' : '✗ Missing',
);

Geocoder.init(GOOGLE_MAPS_WEB_API_KEY);

export type PlaceSuggestion = {
 placeId: string;
 primaryText: string;
 secondaryText: string;
 fullText: string;
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

const hasConfiguredApiKey = () =>
 GOOGLE_MAPS_WEB_API_KEY.trim().length > 0 &&
 !GOOGLE_MAPS_WEB_API_KEY.includes('EXAMPLE');

const assertApiKey = () => {
 if (!hasConfiguredApiKey()) {
  throw new Error(
   'Google Maps Web API key is not configured. Ensure the same key used in AndroidManifest.xml is also enabled for Places, Geocoding and Directions web APIs, or replace the placeholder here.',
  );
 }
};

const decodePolyline = (encoded: string): LatLng[] => {
 /* eslint-disable no-bitwise */
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
 /* eslint-enable no-bitwise */
};

export const autocompletePlaces = async (
 input: string,
): Promise<PlaceSuggestion[]> => {
 assertApiKey();

 if (!input.trim()) return [];

 const response = await axios.get(
  'https://maps.googleapis.com/maps/api/place/autocomplete/json',
  {
   params: {
    input: input.trim(),
    key: GOOGLE_MAPS_WEB_API_KEY,
    components: 'country:in',
   },
  },
 );

 const predictions = Array.isArray(response.data?.predictions)
  ? response.data.predictions
  : [];

 return predictions.map((prediction: any) => ({
  placeId: String(prediction.place_id ?? ''),
  primaryText: String(
   prediction.structured_formatting?.main_text ?? prediction.description ?? '',
  ),
  secondaryText: String(prediction.structured_formatting?.secondary_text ?? ''),
  fullText: String(prediction.description ?? ''),
 }));
};

export const geocodePlaceById = async (
 placeId: string,
): Promise<GeocodedPlace> => {
 if (!placeId.trim()) {
  throw new Error('Place id is required to geocode a selected place.');
 }

 try {
  const response = await axios.get(
   'https://maps.googleapis.com/maps/api/geocode/json',
   {
    params: {
     place_id: placeId,
     key: GOOGLE_MAPS_WEB_API_KEY,
    },
   },
  );

  const result = Array.isArray(response.data?.results)
   ? response.data.results[0]
   : null;

  if (!result?.geometry?.location) {
   throw new Error('Unable to geocode selected place.');
  }

  return {
   placeId,
   label: String(result.formatted_address ?? 'Selected place'),
   address: String(result.formatted_address ?? 'Selected place'),
   coords: {
    latitude: Number(result.geometry.location.lat),
    longitude: Number(result.geometry.location.lng),
   },
  };
 } catch (error) {
  throw new Error(
   error instanceof Error ? error.message : 'Unable to geocode selected place.',
  );
 }
};

export const geocodeAddress = async (
 address: string,
): Promise<GeocodedPlace> => {
 const query = address.trim();
 if (!query) {
  throw new Error('Enter a location before searching.');
 }

 try {
  const results = await Geocoder.from(query);
  const result = Array.isArray(results) ? results[0] : null;

  if (!result?.position) {
   throw new Error('No matching location found.');
  }

  return {
   placeId: String(result.place_id ?? query),
   label: String(result.formatted_address ?? query),
   address: String(result.formatted_address ?? query),
   coords: {
    latitude: result.position.latitude,
    longitude: result.position.longitude,
   },
  };
 } catch (error) {
  throw new Error(
   error instanceof Error
    ? error.message
    : 'Unable to search address with geocoding.',
  );
 }
};

export const reverseGeocodeCoords = async (
 coords: LatLng,
): Promise<GeocodedPlace> => {
 assertApiKey();

 try {
  const response = await axios.get(
   'https://maps.googleapis.com/maps/api/geocode/json',
   {
    params: {
     latlng: `${coords.latitude},${coords.longitude}`,
     key: GOOGLE_MAPS_WEB_API_KEY,
    },
   },
  );

  const result = Array.isArray(response.data?.results)
   ? response.data.results[0]
   : null;
  const fallback = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(
   5,
  )}`;

  return {
   placeId: String(result?.place_id ?? fallback),
   label: String(result?.formatted_address ?? fallback),
   address: String(result?.formatted_address ?? fallback),
   coords,
  };
 } catch (error) {
  throw new Error(
   error instanceof Error
    ? error.message
    : 'Unable to fetch address for selected stop.',
  );
 }
};

export const fetchDirectionsRoutes = async (params: {
 origin: LatLng;
 destination: LatLng;
 waypoints?: LatLng[];
}): Promise<DirectionsRoute[]> => {
 assertApiKey();

 const waypointString = params.waypoints?.length
  ? params.waypoints
     .map(point => `${point.latitude},${point.longitude}`)
     .join('|')
  : undefined;

 const response = await axios.get(
  'https://maps.googleapis.com/maps/api/directions/json',
  {
   params: {
    origin: `${params.origin.latitude},${params.origin.longitude}`,
    destination: `${params.destination.latitude},${params.destination.longitude}`,
    waypoints: waypointString,
    alternatives: true,
    mode: 'driving',
    key: GOOGLE_MAPS_WEB_API_KEY,
   },
  },
 );

 const routes = Array.isArray(response.data?.routes)
  ? response.data.routes
  : [];

 return routes.map((route: any, index: number) => {
  const legs = Array.isArray(route.legs) ? route.legs : [];
  const distanceMeters = legs.reduce(
   (total: number, leg: any) => total + Number(leg?.distance?.value ?? 0),
   0,
  );
  const durationSeconds = legs.reduce(
   (total: number, leg: any) => total + Number(leg?.duration?.value ?? 0),
   0,
  );

  return {
   id: String(route.summary ?? `route-${index}`),
   label: route.summary ? String(route.summary) : `Route ${index + 1}`,
   points: decodePolyline(String(route.overview_polyline?.points ?? '')),
   distanceMeters,
   durationSeconds,
   summary: String(route.summary ?? `Route ${index + 1}`),
  };
 });
};
