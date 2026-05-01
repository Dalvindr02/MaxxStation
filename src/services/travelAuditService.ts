export type TravelAuditInput = {
 actualDurationMinutes: number;
 routeDurationMinutes: number;
 actualDistanceMeters: number;
 routeDistanceMeters: number;
};

export type TravelAuditResult = {
 status: 'valid' | 'review' | 'invalid';
 flags: string[];
 summary: string;
};

const DURATION_REVIEW_THRESHOLD_MINUTES = 20;
const DURATION_INVALID_THRESHOLD_MINUTES = 45;
const DISTANCE_REVIEW_RATIO = 0.25;
const DISTANCE_INVALID_RATIO = 0.45;

export const buildTravelAuditResult = (
 input: TravelAuditInput,
): TravelAuditResult => {
 const flags: string[] = [];
 const durationDiff = Math.abs(
  input.actualDurationMinutes - input.routeDurationMinutes,
 );
 const distanceBase = Math.max(input.routeDistanceMeters, 1);
 const distanceDiffRatio = Math.abs(
  input.actualDistanceMeters - input.routeDistanceMeters,
 ) / distanceBase;

 if (durationDiff >= DURATION_INVALID_THRESHOLD_MINUTES) {
  flags.push('Large mismatch between user time and route time');
 } else if (durationDiff >= DURATION_REVIEW_THRESHOLD_MINUTES) {
  flags.push('Time difference should be reviewed');
 }

 if (distanceDiffRatio >= DISTANCE_INVALID_RATIO) {
  flags.push('Large mismatch between route distance and claimed distance');
 } else if (distanceDiffRatio >= DISTANCE_REVIEW_RATIO) {
  flags.push('Distance difference should be reviewed');
 }

 if (!flags.length) {
  return {
   status: 'valid',
   flags: [],
   summary: 'Route time and distance look consistent.',
  };
 }

 const hasInvalidFlag =
  durationDiff >= DURATION_INVALID_THRESHOLD_MINUTES ||
  distanceDiffRatio >= DISTANCE_INVALID_RATIO;

 return {
   status: hasInvalidFlag ? 'invalid' : 'review',
   flags,
   summary: hasInvalidFlag
    ? 'Travel log should be flagged for audit.'
    : 'Travel log should be reviewed before approval.',
  };
};

