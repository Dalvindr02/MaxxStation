export type LatLng = {
  latitude: number;
  longitude: number;
};

export type WorkLocation = LatLng & {
  label: string;
  radiusMeters: number;
};

export const WORK_LOCATION: WorkLocation = {
  label: 'Office',
  latitude: 30.721827,
  longitude: 76.76705,
  radiusMeters: 50,
};

export const earthRadiusMeters = 6371000;

export const toRadians = (value: number) => (value * Math.PI) / 180;

export const getDistanceMeters = (pointA: LatLng, pointB: LatLng) => {
  const latDelta = toRadians(pointB.latitude - pointA.latitude);
  const lonDelta = toRadians(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(toRadians(pointA.latitude)) *
      Math.cos(toRadians(pointB.latitude)) *
      Math.sin(lonDelta / 2) *
      Math.sin(lonDelta / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

export const isWithinWorkLocation = (point: LatLng) =>
  getDistanceMeters(point, WORK_LOCATION) <= WORK_LOCATION.radiusMeters;
