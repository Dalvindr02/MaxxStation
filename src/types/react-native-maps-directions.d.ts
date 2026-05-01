declare module 'react-native-maps-directions' {
 import React from 'react';
 import {LatLng} from 'react-native-maps';

 export interface MapViewDirectionsResult {
  coordinates: LatLng[];
  distance: number;
  duration: number;
 }

 export interface MapViewDirectionsProps {
  origin: LatLng;
  destination: LatLng;
  waypoints?: LatLng[];
  apikey: string;
  strokeWidth?: number;
  strokeColor?: string;
  optimizeWaypoints?: boolean;
  onReady?: (result: MapViewDirectionsResult) => void;
  onError?: (error: Error) => void;
 }

 const MapViewDirections: React.ComponentType<MapViewDirectionsProps>;
 export default MapViewDirections;
}
