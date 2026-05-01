declare module 'react-native-geocoding' {
 export interface LatLng {
  latitude: number;
  longitude: number;
 }

 export interface GeocodingResult {
  position: LatLng;
  formatted_address: string;
  place_id?: string;
  address_components?: Array<{
   long_name: string;
   short_name: string;
   types: string[];
  }>;
 }

 class Geocoder {
  static init(apiKey: string, options?: {language?: string}): void;
  static from(address: string): Promise<GeocodingResult[]>;
  static nearbyAddress(coord: LatLng): Promise<GeocodingResult[]>;
 }

 export default Geocoder;
}
