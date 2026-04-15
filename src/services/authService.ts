import axios from 'axios';
import { API_ENDPOINTS, buildApiUrl } from '../constants/api';

export type LoginApiResult = {
  success: boolean;
  token: string | null;
  user: Record<string, unknown> | null;
  message: string;
  data: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const findFirstRecord = (
  payload: unknown,
  preferredKeys: string[],
): Record<string, unknown> | null => {
  if (!isRecord(payload)) {
    return null;
  }

  for (const key of preferredKeys) {
    const value = payload[key];
    if (isRecord(value)) {
      return value;
    }
  }

  for (const value of Object.values(payload)) {
    if (isRecord(value)) {
      const nested = findFirstRecord(value, preferredKeys);
      if (nested) {
        return nested;
      }
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
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
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

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const directMessage = record.message ?? record.error ?? record.detail;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage;
  }

  if (record.errors && typeof record.errors === 'object') {
    const firstError = Object.values(record.errors)[0];
    if (typeof firstError === 'string' && firstError.trim()) {
      return firstError;
    }
    if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
      return firstError[0];
    }
  }

  return fallback;
};

const getToken = (payload: unknown): string | null => {
  return findFirstString(payload, [
    'token',
    'access_token',
    'accessToken',
    'jwt',
    'authToken',
  ]);
};

const getUser = (payload: unknown): Record<string, unknown> | null => {
  return findFirstRecord(payload, [
    'user',
    'employee',
    'profile',
    'account',
    'data',
    'result',
  ]);
};

const getSuccessStatus = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const status = record.status ?? record.success;

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

export const loginRequest = async (
  email: string,
  password: string,
  projectId?: string | null,
): Promise<LoginApiResult> => {
  try {
    const formData = new FormData();
    formData.append('email', email.trim());
    formData.append('password', password);
    if (projectId?.trim()) {
      formData.append('project_id', projectId.trim());
    }
    formData.append('device_token', 'react-native-device');

    const response = await axios.post(buildApiUrl(API_ENDPOINTS.login), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const payload =
      response.data && typeof response.data === 'object'
        ? (response.data as Record<string, unknown>)
        : {};

    console.log('Login API response:', payload);

    const message =
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message
        : 'Login successful.';
    const success = getSuccessStatus(payload);

    if (!success) {
      throw new Error(message || 'Invalid login credentials.');
    }

    return {
      success,
      token: getToken(payload),
      user: getUser(payload),
      message,
      data: payload,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const payload = error.response?.data;
      const fallback = error.response?.status
        ? `Login failed with status ${error.response.status}`
        : 'Unable to sign in. Please try again.';

      throw new Error(getErrorMessage(payload, fallback));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to sign in. Please try again.');
  }
};
