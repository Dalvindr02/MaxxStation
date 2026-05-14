import axios from 'axios';
import {API_ENDPOINTS, buildApiUrl} from '../constants/api';

export type CheckLocationParams = {
 latitude: number;
 longitude: number;
};

export type BackendLocationAction = 'CHECK_IN' | 'OPEN_MAP' | 'IGNORE';

export type BackendLocationReminder = {
 action_1_title?: string;
 action_2_title?: string;
 action_3_title?: string;
 action_1?: string;
 action_2?: string;
 action_3?: string;
 type?: string;
 user_id?: string | number;
 title?: string;
 body?: string;
 message?: string;
};

const createFallbackLocationReminder = (): BackendLocationReminder => ({
 type: 'location_reminder',
 action_1: 'OPEN_MAP',
 action_1_title: 'Start Billable',
 action_2: 'IGNORE',
 action_2_title: 'Ignore',
});

export type CheckLocationResult = {
 raw: unknown;
 locationStatus: 'inside' | 'outside' | null;
 notification: BackendLocationReminder | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
 Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
 typeof value === 'string' && value.trim().length > 0;

const findFirstRecord = (
 payload: unknown,
 keys: string[],
): Record<string, unknown> | null => {
 if (!isRecord(payload)) {
  return null;
 }

 for (const key of keys) {
  const value = payload[key];
  if (isRecord(value)) {
   return value;
  }
 }

 for (const value of Object.values(payload)) {
  const nested = findFirstRecord(value, keys);
  if (nested) {
   return nested;
  }
 }

 return null;
};

const findFirstString = (payload: unknown, keys: string[]): string | null => {
 if (!isRecord(payload)) {
  return null;
 }

 for (const key of keys) {
  const value = payload[key];
  if (isNonEmptyString(value)) {
   return value.trim();
  }
 }

 for (const value of Object.values(payload)) {
  if (isRecord(value)) {
   const nestedValue = findFirstString(value, keys);
   if (nestedValue) {
    return nestedValue;
   }
  }
 }

 return null;
};

const includesAny = (text: string, needles: string[]) =>
 needles.some(needle => text.includes(needle));

const readBoolean = (
 record: Record<string, unknown>,
 keys: string[],
): boolean | null => {
 for (const key of keys) {
  const value = record[key];
  if (typeof value === 'boolean') {
   return value;
  }
  if (typeof value === 'number') {
   return value === 1;
  }
  if (typeof value === 'string') {
   const normalized = value.trim().toLowerCase();
   if (['true', '1', 'yes', 'inside', 'in'].includes(normalized)) {
    return true;
   }
   if (['false', '0', 'no', 'outside', 'out'].includes(normalized)) {
    return false;
   }
  }
 }
 return null;
};

const normalizeStatus = (payload: unknown): 'inside' | 'outside' | null => {
 if (!isRecord(payload)) {
  return null;
 }

 const explicitStatus =
  payload.location_status ?? payload.locationStatus ?? payload.status;
 if (typeof explicitStatus === 'string') {
  const normalized = explicitStatus.trim().toLowerCase();
  if (
   ['inside', 'in_office', 'within', 'allowed', 'valid', 'success'].includes(
    normalized,
   )
  ) {
   return 'inside';
  }
  if (
   ['outside', 'out_of_office', 'outside_office', 'invalid'].includes(
    normalized,
   )
  ) {
   return 'outside';
  }
 }

 const allowed = readBoolean(payload, [
  'is_inside',
  'inside',
  'within_radius',
  'withinRadius',
  'can_mark_attendance',
  'canMarkAttendance',
  'allowed',
  'success',
 ]);
 if (allowed != null) {
  return allowed ? 'inside' : 'outside';
 }

 const nested = findFirstRecord(payload, ['data', 'result', 'location']);
 if (nested && nested !== payload) {
  return normalizeStatus(nested);
 }

 const textMatch = findFirstString(payload, [
  'location_status',
  'locationStatus',
  'status',
  'location',
  'message',
  'body',
  'result',
 ]);
 if (textMatch) {
  const normalized = textMatch.trim().toLowerCase();
  if (includesAny(normalized, ['outside', 'out_of_office', 'out office'])) {
   return 'outside';
  }
  if (includesAny(normalized, ['inside', 'in_office', 'within'])) {
   return 'inside';
  }
 }

 return null;
};

const normalizeReminder = (
 payload: unknown,
): BackendLocationReminder | null => {
 const candidate =
  findFirstRecord(payload, [
   'notification',
   'reminder',
   'notificationData',
   'notification_data',
   'locationReminder',
   'location_reminder',
   'data',
   'result',
  ]) ?? (isRecord(payload) ? payload : null);

 if (!candidate) {
  return null;
 }

 const values = Object.values(candidate)
  .filter(value => typeof value === 'string')
  .map(value => String(value).toUpperCase());
 const hasLocationReminder =
  candidate.type === 'location_reminder' ||
  values.includes('CHECK_IN') ||
  values.includes('OPEN_MAP') ||
  values.includes('IGNORE');

 if (!hasLocationReminder) {
  return null;
 }

 return candidate as BackendLocationReminder;
};

export const extractBackendLocationReminder = (
 payload: unknown,
): BackendLocationReminder | null => normalizeReminder(payload);

export const checkUserLocation = async (
 params: CheckLocationParams,
 token: string | null,
): Promise<CheckLocationResult> => {
 if (!token?.trim()) {
  throw new Error('No authentication token available.');
 }

 const {latitude, longitude} = params;
 if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
  throw new Error('Current location coordinates are invalid.');
 }

 console.log('[CheckLocation] API Request →', {
  endpoint: API_ENDPOINTS.checkLocation,
  payload: {latitude, longitude},
 });

 const response = await axios.post(
  buildApiUrl(API_ENDPOINTS.checkLocation),
  {latitude, longitude},
  {
   headers: {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
   },
   timeout: 30000,
  },
 );

 console.log(
  '[CheckLocation] API Response ←',
  JSON.stringify(response.data, null, 2),
 );

 const notification = normalizeReminder(response.data);
 const locationStatus = notification
  ? 'outside'
  : normalizeStatus(response.data);
 const fallbackNotification =
  notification ??
  (locationStatus === 'outside'
   ? createFallbackLocationReminder()
   : normalizeReminder(response.data));

 console.log('[CheckLocation] Parsed →', {
  locationStatus,
  notification: fallbackNotification
   ? {
      type: fallbackNotification.type,
      action_1: fallbackNotification.action_1,
      action_1_title: fallbackNotification.action_1_title,
      action_2: fallbackNotification.action_2,
      action_2_title: fallbackNotification.action_2_title,
      action_3: fallbackNotification.action_3,
      action_3_title: fallbackNotification.action_3_title,
     }
   : null,
 });

 return {
  raw: response.data,
  locationStatus,
  notification: fallbackNotification,
 };
};
