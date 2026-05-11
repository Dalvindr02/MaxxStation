import axios from 'axios';
import {
  API_ENDPOINTS,
  buildApiUrl,
} from '../constants/api';
import { LogEntry, LogStatus, TravelCoordinate, TravelStop } from '../context/LogsContext';

export type CreateManualLogPayload = {
  meeting_type: string;
  start_time: string;
  end_time: string;
  start_date_time: string;
  end_date_time: string;
  choose_participant: string;
  billable: string;
  meeting_agenda: string;
  project_id: number;
  id?: string | number;
  from_location?: string;
  to_location?: string;
  route_distance_meters?: number;
  route_duration_seconds?: number;
  route_polyline?: string;
  route_summary?: string;
  audit_status?: string;
  audit_flags?: string;
};

export type CreateManualLogResult = {
  success: boolean;
  message: string;
  data: Record<string, unknown> | null;
};

export type ManualLogListResult = {
  success: boolean;
  message: string;
  data: LogEntry[];
};

export type DeleteManualLogResult = {
  success: boolean;
  message: string;
};

export type CreateTravelLogPayload = {
  project_id: number;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  distance: number;
  duration: number;
  start_time: string;
  end_time: string;
  mode: string;
  purpose: string;
  notes: string;
  stops: Array<{ lat: number; lng: number }>;
};

export type CreateTravelLogResult = {
  success: boolean;
  message: string;
  data: Record<string, unknown> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (!isRecord(payload)) {
    return fallback;
  }

  const directMessage = payload.message ?? payload.error ?? payload.detail;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage;
  }

  if (isRecord(payload.errors)) {
    const firstError = Object.values(payload.errors)[0];
    if (typeof firstError === 'string' && firstError.trim()) {
      return firstError;
    }
    if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
      return firstError[0];
    }
  }

  return fallback;
};

const getSuccessStatus = (payload: unknown): boolean => {
  if (!isRecord(payload)) {
    return false;
  }

  const status = payload.status ?? payload.success;

  if (typeof status === 'boolean') {
    return status;
  }

  if (typeof status === 'number') {
    return status === 1;
  }

  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase();
    return normalized === 'true' || normalized === 'success' || normalized === '1';
  }

  return false;
};

const findFirstString = (payload: unknown, keys: string[]): string | null => {
  if (!isRecord(payload)) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  for (const value of Object.values(payload)) {
    if (isRecord(value)) {
      const nested = findFirstString(value, keys);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
};

const findFirstBoolean = (payload: unknown, keys: string[]): boolean | null => {
  if (!isRecord(payload)) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'billable', 'is_billable'].includes(normalized)) {
        return true;
      }
      if (['0', 'false', 'no', 'non-billable', 'non_billable', 'non billable'].includes(normalized)) {
        return false;
      }
    }
  }

  for (const value of Object.values(payload)) {
    if (isRecord(value)) {
      const nested = findFirstBoolean(value, keys);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
};

const findFirstNumber = (payload: unknown, keys: string[]): number | null => {
  if (!isRecord(payload)) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  for (const value of Object.values(payload)) {
    if (isRecord(value)) {
      const nested = findFirstNumber(value, keys);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
};

const findFirstArray = (payload: unknown, keys?: string[]): unknown[] | null => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of keys ?? [
    'data',
    'logs',
    'list',
    'result',
    'items',
    'manual_logs',
    'travel_logs',
    'travel_log_list',
    'manualLogList',
  ]) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      return value;
    }
    if (isRecord(value)) {
      const nested = findFirstArray(value);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
};

const toDateKey = (value: string | null) => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  const match = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
};

const toTimeValue = (value: string | null, fallback: string) => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  const directMatch = trimmed.match(/(\d{2}):(\d{2})/);
  if (directMatch) {
    return `${directMatch[1]}:${directMatch[2]}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(
      parsed.getMinutes(),
    ).padStart(2, '0')}`;
  }

  return fallback;
};

const toStatus = (value: string | null): LogStatus => {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized.includes('approve')) {
    return 'approved';
  }
  if (normalized.includes('reject')) {
    return 'rejected';
  }
  return 'review';
};

const toCoordinate = (value: unknown): TravelCoordinate | null => {
  if (!isRecord(value)) {
    return null;
  }

  const latitudeValue = value.latitude ?? value.lat ?? value.start_lat ?? value.end_lat;
  const longitudeValue = value.longitude ?? value.lng ?? value.lon ?? value.start_lng ?? value.end_lng;
  const latitude =
    typeof latitudeValue === 'number' ? latitudeValue : Number(latitudeValue);
  const longitude =
    typeof longitudeValue === 'number' ? longitudeValue : Number(longitudeValue);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {latitude, longitude};
};

const parseTravelRoutePayload = (value: string | null) => {
  if (!value) {
    return {
      routePoints: [] as TravelCoordinate[],
      stops: [] as TravelStop[],
    };
  }

  try {
    const parsed = JSON.parse(value);
    const rawRoute = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.route)
      ? parsed.route
      : [];
    const rawStops = isRecord(parsed) && Array.isArray(parsed.stops)
      ? parsed.stops
      : [];

    return {
      routePoints: rawRoute
        .map(toCoordinate)
        .filter((point): point is TravelCoordinate => Boolean(point)),
      stops: rawStops
        .map(stop => {
          const coordinate = toCoordinate(stop);
          if (!coordinate) {
            return null;
          }
          const travelStop: TravelStop = {...coordinate};
          if (isRecord(stop) && typeof stop.label === 'string') {
            travelStop.label = stop.label;
          }
          return travelStop;
        })
        .filter((stop): stop is TravelStop => Boolean(stop)),
    };
  } catch {
    return {
      routePoints: [] as TravelCoordinate[],
      stops: [] as TravelStop[],
    };
  }
};

export const mapManualLogEntry = (
  item: unknown,
  index: number,
): LogEntry | null => {
  if (!isRecord(item)) {
    return null;
  }

  const startDate = findFirstString(item, [
    'start_date',
    'log_date',
    'date',
    'entry_date',
  ]);
  const startDateTime = findFirstString(item, [
    'start_date_time',
    'start_datetime',
    'from_date_time',
  ]);
  const endDateTime = findFirstString(item, [
    'end_date_time',
    'end_datetime',
    'to_date_time',
  ]);

  const date = toDateKey(
    startDate ?? startDateTime ?? endDateTime,
  );
  const startTime = toTimeValue(
    findFirstString(item, ['start_time', 'from_time']) ?? startDateTime,
    '00:00',
  );
  const endTime = toTimeValue(
    findFirstString(item, ['end_time', 'to_time']) ?? endDateTime,
    startTime,
  );
  const {routePoints, stops} = parseTravelRoutePayload(
    findFirstString(item, ['route_polyline', 'polyline', 'route_points']),
  );
  const fromCoords =
    toCoordinate(item.from_coords) ??
    toCoordinate({lat: item.start_lat, lng: item.start_lng}) ??
    toCoordinate(item.from_coordinates) ??
    toCoordinate(item.origin) ??
    (routePoints.length > 0 ? routePoints[0] : null);
  const toCoords =
    toCoordinate(item.to_coords) ??
    toCoordinate({lat: item.end_lat, lng: item.end_lng}) ??
    toCoordinate(item.to_coordinates) ??
    toCoordinate(item.destination) ??
    (routePoints.length > 0 ? routePoints[routePoints.length - 1] : null);

  const rawDistance = findFirstNumber(item, ['route_distance_meters', 'distance', 'route_distance']);
  // If distance is string "7.30", findFirstNumber handles it.
  // Assuming distance is in KM if it's from the new response structure
  const routeDistanceMeters = rawDistance ? (rawDistance < 1000 ? rawDistance * 1000 : rawDistance) : null;

  const rawSpentMinutes = findFirstNumber(item, ['spent_time_minutes', 'duration_minutes', 'duration']);
  const routeDurationSeconds = rawSpentMinutes ? rawSpentMinutes * 60 : findFirstNumber(item, ['route_duration_seconds']);

  return {
    id:
      findFirstString(item, ['id', 'log_id', 'manual_log_id']) ??
      `${date}-${startTime}-${endTime}-${index}`,
    date,
    projectId: findFirstString(item, ['project_id', 'projectId']) ?? '0',
    projectName:
      findFirstString(item, ['project_name', 'projectName', 'project']) ??
      'Project',
    taskId: findFirstString(item, [
      'task_id',
      'taskId',
      'choose_participant',
      'participant_id',
    ]),
    taskName:
      findFirstString(item, [
        'task_name',
        'taskName',
        'participant_name',
        'participant',
      ]) ?? 'Manual log entry',
    startTime,
    endTime,
    category:
      findFirstString(item, ['log_type', 'category', 'meeting_type', 'type']) ?? 'Travel Log',
    notes:
      findFirstString(item, [
        'notes',
        'meeting_agenda',
        'agenda',
        'description',
      ]) ?? '',
    billable:
      findFirstBoolean(item, ['billable', 'is_billable', 'billable_status']) ?? false,
    status: toStatus(findFirstString(item, ['status', 'approval_status', 'log_status'])),
    fromLocation: findFirstString(item, ['from_address', 'from_location', 'origin', 'origin_address']),
    toLocation: findFirstString(item, ['to_address', 'to_location', 'destination', 'destination_address']),
    fromCoords,
    toCoords,
    routePoints,
    stops,
    routeDistanceMeters,
    routeDurationSeconds,
    routeSummary: findFirstString(item, ['route_summary', 'summary', 'description']),
    googleDistance: findFirstString(item, ['google_distance']),
    googleDuration: findFirstString(item, ['google_duration']),
  };
};

export const createManualLogRequest = async (
  payload: CreateManualLogPayload,
  authToken?: string | null,
): Promise<CreateManualLogResult> => {
  try {
    if (!authToken?.trim()) {
      throw new Error('Login token is missing. Please sign in again.');
    }

    console.log('Create manual log request payload:', payload);

    const response = await axios.post(
      buildApiUrl(API_ENDPOINTS.createManualLog),
      payload,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Authorization: `Bearer ${authToken.trim()}`,
        },
      },
    );

    console.log('Create manual log API response:', response.data);

    const responsePayload = isRecord(response.data)
      ? (response.data as Record<string, unknown>)
      : null;
    const message =
      (responsePayload &&
        typeof responsePayload.message === 'string' &&
        responsePayload.message.trim()) ||
      'Manual log created successfully.';
    const success = responsePayload
      ? getSuccessStatus(responsePayload) || response.status < 300
      : response.status < 300;

    if (!success) {
      throw new Error(message);
    }

    return {
      success,
      message,
      data: responsePayload,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('Create manual log API error response:', error.response?.data);

      const errorPayload = error.response?.data;
      const fallback = error.response?.status
        ? `Manual log request failed with status ${error.response.status}`
        : 'Unable to create manual log. Please try again.';

      throw new Error(getErrorMessage(errorPayload, fallback));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to create manual log. Please try again.');
  }
};

export const updateManualLogRequest = async (
  id: string | number,
  payload: CreateManualLogPayload,
  authToken?: string | null,
): Promise<CreateManualLogResult> => {
  try {
    if (!authToken?.trim()) {
      throw new Error('Login token is missing. Please sign in again.');
    }

    console.log('Update manual log request payload:', payload);

    const response = await axios.post(
      `${buildApiUrl(API_ENDPOINTS.updateManualLog)}/${id}`,
      payload,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Authorization: `Bearer ${authToken.trim()}`,
        },
      },
    );

    console.log('Update manual log API response:', response.data);

    const responsePayload = isRecord(response.data)
      ? (response.data as Record<string, unknown>)
      : null;
    const message =
      (responsePayload &&
        typeof responsePayload.message === 'string' &&
        responsePayload.message.trim()) ||
      'Manual log updated successfully.';
    const success = responsePayload
      ? getSuccessStatus(responsePayload) || response.status < 300
      : response.status < 300;

    if (!success) {
      throw new Error(message);
    }

    return {
      success,
      message,
      data: responsePayload,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('Update manual log API error response:', error.response?.data);

      const errorPayload = error.response?.data;
      const fallback = error.response?.status
        ? `Update manual log request failed with status ${error.response.status}`
        : 'Unable to update manual log. Please try again.';

      throw new Error(getErrorMessage(errorPayload, fallback));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to update manual log. Please try again.');
  }
};

export const createTravelLogRequest = async (
  payload: CreateTravelLogPayload,
  authToken?: string | null,
): Promise<CreateTravelLogResult> => {
  try {
    if (!authToken?.trim()) {
      throw new Error('Login token is missing. Please sign in again.');
    }

    console.log('Create travel log request payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      buildApiUrl(API_ENDPOINTS.travelLogCreate),
      payload,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Authorization: `Bearer ${authToken.trim()}`,
        },
      },
    );

    console.log('Create travel log API response:', response.data);

    const responsePayload = isRecord(response.data)
      ? (response.data as Record<string, unknown>)
      : null;
    
    const success = responsePayload
      ? getSuccessStatus(responsePayload) || response.status < 300
      : response.status < 300;

    const message =
      (responsePayload &&
        typeof responsePayload.message === 'string' &&
        responsePayload.message.trim()) ||
      (success ? 'Travel log created successfully.' : 'Failed to create travel log.');

    if (!success) {
      throw new Error(message);
    }

    return {
      success,
      message,
      data: responsePayload,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('Create travel log API error response:', error.response?.data);

      const errorPayload = error.response?.data;
      const fallback = error.response?.status
        ? `Travel log request failed with status ${error.response.status}`
        : 'Unable to create travel log. Please try again.';

      throw new Error(getErrorMessage(errorPayload, fallback));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to create travel log. Please try again.');
  }
};

export const fetchManualLogListRequest = async (
  authToken?: string | null,
): Promise<ManualLogListResult> => {
  try {
    if (!authToken?.trim()) {
      throw new Error('Login token is missing. Please sign in again.');
    }

    console.log('Fetch manual log list request:', {
      url: buildApiUrl(API_ENDPOINTS.getManualLogList),
      hasAuthToken: Boolean(authToken?.trim()),
    });

    const response = await axios.get(buildApiUrl(API_ENDPOINTS.getManualLogList), {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Authorization: `Bearer ${authToken.trim()}`,
      },
    });

    console.log('Fetch manual log list API response:', response.data);

    const responsePayload = isRecord(response.data)
      ? (response.data as Record<string, unknown>)
      : null;
    const rawItems =
      findFirstArray(response.data, [
        'manual_logs',
        'data',
        'logs',
        'list',
        'result',
        'items',
        'manualLogList',
      ]) ?? [];
    const data = rawItems
      .map((item, index) => mapManualLogEntry(item, index))
      .filter((item): item is LogEntry => Boolean(item));
    console.log('Fetch manual log list API summary:', {
      rawItemCount: rawItems.length,
      mappedItemCount: data.length,
      firstMappedId: data[0]?.id ?? null,
    });
    const message =
      (responsePayload &&
        typeof responsePayload.message === 'string' &&
        responsePayload.message.trim()) ||
      'Manual logs loaded successfully.';

    return {
      success: true,
      message,
      data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('Fetch manual log list API error response:', error.response?.data);
      const payload = error.response?.data;
      const fallback = error.response?.status
        ? `Manual log list request failed with status ${error.response.status}`
        : 'Unable to load manual logs. Please try again.';

      throw new Error(getErrorMessage(payload, fallback));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to load manual logs. Please try again.');
  }
};

export const deleteManualLogRequest = async (
  id: string,
  authToken?: string | null,
): Promise<DeleteManualLogResult> => {
  try {
    if (!authToken?.trim()) {
      throw new Error('Login token is missing. Please sign in again.');
    }

    if (!id?.trim()) {
      throw new Error('Manual log id is missing.');
    }

    const url = `${buildApiUrl(API_ENDPOINTS.deleteManualLog)}?id=${encodeURIComponent(
      id.trim(),
    )}`;

    console.log('Delete manual log request:', {
      url,
      hasAuthToken: Boolean(authToken?.trim()),
    });

    const response = await axios.get(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Authorization: `Bearer ${authToken.trim()}`,
      },
    });

    console.log('Delete manual log API response:', response.data);

    const responsePayload = isRecord(response.data)
      ? (response.data as Record<string, unknown>)
      : null;
    const message =
      (responsePayload &&
        typeof responsePayload.message === 'string' &&
        responsePayload.message.trim()) ||
      'Manual log deleted successfully.';
    const success = responsePayload
      ? getSuccessStatus(responsePayload) || response.status < 300
      : response.status < 300;

    if (!success) {
      throw new Error(message);
    }

    return {
      success,
      message,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('Delete manual log API error response:', error.response?.data);
      const errorPayload = error.response?.data;
      const fallback = error.response?.status
        ? `Delete manual log request failed with status ${error.response.status}`
        : 'Unable to delete manual log. Please try again.';

      throw new Error(getErrorMessage(errorPayload, fallback));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to delete manual log. Please try again.');
  }
};
