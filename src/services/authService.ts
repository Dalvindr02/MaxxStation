import {Platform} from 'react-native';
import axios from 'axios';
import {API_ENDPOINTS, buildApiUrl} from '../constants/api';
import messaging from '@react-native-firebase/messaging';

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
  'api_token',
  'apiToken',
  'access_token',
  'accessToken',
  'bearer_token',
  'bearerToken',
  'plainTextToken',
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
  return (
   normalized === 'true' || normalized === 'success' || normalized === '1'
  );
 }

 return false;
};

const getFcmTokenWithFallback = async (
 timeoutMs: number = 2500,
): Promise<string> => {
 try {
  const messagingInstance = messaging();
  const tokenPromise = (async () => {
   try {
    const permissionStatus = await messagingInstance.hasPermission();
    if (
     permissionStatus === messaging.AuthorizationStatus.DENIED ||
     permissionStatus === messaging.AuthorizationStatus.NOT_DETERMINED
    ) {
     return null;
    }
   } catch (error) {
    console.warn(
     '[Auth] Unable to verify FCM permission before login:',
     error instanceof Error ? error.message : String(error),
    );
   }

   if (
    Platform.OS === 'ios' &&
    !messagingInstance.isDeviceRegisteredForRemoteMessages
   ) {
    await messagingInstance.registerDeviceForRemoteMessages();
   }

   return messagingInstance.getToken();
  })();

  const timeoutPromise = new Promise<string>((_, reject) =>
   setTimeout(() => reject(new Error('FCM token request timeout')), timeoutMs),
  );

  const token = await Promise.race([tokenPromise, timeoutPromise]);

  if (token && typeof token === 'string') {
   console.log('[Auth] FCM token obtained successfully');
   return token;
  }
 } catch (error) {
  console.warn(
   '[Auth] FCM token fetch failed:',
   error instanceof Error ? error.message : String(error),
  );
 }

 return 'rn-device-fallback';
};

const createLoginFormData = (
 email: string,
 password: string,
 deviceToken: string,
) => {
 const formData = new FormData();
 formData.append('email', email.trim());
 formData.append('password', password);
 formData.append('fcm_token', deviceToken);

 return formData;
};

export const loginRequest = async (
 email: string,
 password: string,
): Promise<LoginApiResult> => {
 try {
  console.log('[Auth] Starting login for:', email);

  // Get FCM token with fallback - don't let it block the login
  let fcmToken: string;
  try {
   fcmToken = await getFcmTokenWithFallback(5000);
  } catch (error) {
   console.warn('[Auth] FCM token fallback error:', error);
   fcmToken = 'rn-device-fallback';
  }

  console.log(
   '[Auth] Using FCM token:',
   fcmToken === 'rn-device-fallback' ? 'fallback' : 'real',
  );

  const loginUrl = buildApiUrl(API_ENDPOINTS.login);
  const loginPayloadParams = {
   email: email.trim(),
   password,
   fcm_token: fcmToken,
  };

  console.log('[Auth] Sending login request to:', loginUrl);
  console.log('[Auth] Login API payload params:', loginPayloadParams);

  let response;
  let lastError: any;

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
   try {
    console.log(`[Auth] Login attempt ${attempt}/3`);

    response = await axios.post(
     loginUrl,
     createLoginFormData(email, password, fcmToken),
     {
      headers: {
       Accept: 'application/json',
       'Content-Type': 'multipart/form-data',
       'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 30000, // 30 second timeout
     },
    );

    console.log('[Auth] Login request succeeded on attempt', attempt);
    break; // Success, exit retry loop
   } catch (error) {
    lastError = error;
    console.error(`[Auth] Login attempt ${attempt} failed:`, error);

    if (axios.isAxiosError(error)) {
     const statusCode = error.response?.status;
     console.error('[Auth] Response status:', statusCode);

     // Don't retry on client errors (4xx)
     if (statusCode && statusCode >= 400 && statusCode < 500) {
      throw error;
     }

     // Only retry on network errors or server errors (5xx)
     if (attempt < 3) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      console.log(`[Auth] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
     }
    }

    if (attempt === 3) {
     throw error;
    }
   }
  }

  if (!response) {
   throw lastError || new Error('Login request failed');
  }

  const payload =
   response.data && typeof response.data === 'object'
    ? (response.data as Record<string, unknown>)
    : {};

  console.log('[Auth] Login API response received:', {
   status: response.status,
   hasToken: !!getToken(payload),
   hasUser: !!getUser(payload),
  });

  const message =
   typeof payload.message === 'string' && payload.message.trim()
    ? payload.message
    : 'Login successful.';
  const token = getToken(payload);
  const user = getUser(payload);
  const success = getSuccessStatus(payload) || Boolean(token);

  if (!success) {
   console.error('[Auth] Login unsuccessful. Response:', payload);
   throw new Error(message || 'Invalid login credentials.');
  }

  if (!token) {
   console.error('[Auth] No token in response:', payload);
   throw new Error('No authentication token received from server.');
  }

  console.log('[Auth] Login successful for user:', user?.email ?? 'unknown');

  return {
   success,
   token,
   user,
   message,
   data: payload,
  };
 } catch (error) {
  console.error('[Auth] Login error:', error);

  if (axios.isAxiosError(error)) {
   const statusCode = error.response?.status;
   const statusText = error.response?.statusText;
   const payload = error.response?.data;
   const isNetworkError = !error.response; // No response means network error

   console.error('[Auth] API Error Details:', {
    status: statusCode,
    statusText,
    isNetworkError,
    message: error.message,
    code: error.code,
    data: payload,
   });

   // Network/connectivity errors
   if (isNetworkError) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
     throw new Error(
      'Connection timeout. Please check your internet connection and try again.',
     );
    }
    if (
     error.code === 'ENOTFOUND' ||
     error.code === 'ECONNREFUSED' ||
     error.message.includes('Network')
    ) {
     throw new Error(
      'Unable to reach the server. Please check your internet connection.',
     );
    }
    throw new Error(
     'Network error. Please check your internet connection and try again.',
    );
   }

   // Server response errors
   if (statusCode === 401 || statusCode === 403) {
    throw new Error('Invalid email or password. Please try again.');
   }

   if (statusCode === 404) {
    throw new Error('Login service not found. Please contact support.');
   }

   if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
    throw new Error('Server error. Please try again later.');
   }

   if (statusCode === 0 || !statusCode) {
    throw new Error('Connection failed. Please check your internet.');
   }

   if (statusCode && statusCode >= 400) {
    const fallback = `Login failed (${statusCode})`;
    throw new Error(getErrorMessage(payload, fallback));
   }

   throw new Error(error.message || 'Unable to sign in. Please try again.');
  }

  if (error instanceof Error) {
   throw error;
  }

  throw new Error('Unable to sign in. Please try again.');
 }
};

export type LogoutApiResult = {
 success: boolean;
 message: string;
};

export const logoutRequest = async (
 token: string,
 signal?: AbortSignal,
): Promise<LogoutApiResult> => {
 try {
  const response = await axios.get(buildApiUrl(API_ENDPOINTS.logout), {
   signal,
   headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
   },
  });

  const payload =
   response.data && typeof response.data === 'object'
    ? (response.data as Record<string, unknown>)
    : {};

  console.log('Logout API response:', payload);

  const message =
   typeof payload.message === 'string' && payload.message.trim()
    ? payload.message
    : 'Logged out successfully.';
  const success = getSuccessStatus(payload);

  return {
   success,
   message,
  };
 } catch (error) {
  if (axios.isAxiosError(error)) {
   const payload = error.response?.data;
   const fallback = error.response?.status
    ? `Logout failed with status ${error.response.status}`
    : 'Unable to logout. Please try again.';

   throw new Error(getErrorMessage(payload, fallback));
  }

  if (error instanceof Error) {
   throw error;
  }

  throw new Error('Unable to logout. Please try again.');
 }
};
