/**
 * attendanceNotificationService.ts
 *
 * IMPORTANT — index.js SETUP REQUIRED:
 * ------------------------------------
 * For background / killed-state FCM to work you MUST add this to index.js
 * BEFORE AppRegistry.registerComponent (do not remove it):
 *
 *   import messaging from '@react-native-firebase/messaging';
 *   import { registerBackgroundMessageHandler } from './src/services/attendanceNotificationService';
 *   registerBackgroundMessageHandler();
 *
 * Without that call FCM messages received while the app is backgrounded or
 * killed are silently dropped by the OS and never reach the app.
 */

import {Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
 AndroidImportance,
 AndroidStyle,
 EventType,
 Event,
 Notification,
} from '@notifee/react-native';
import messaging, {
 FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {SHIFT_WINDOW} from '../constants/shift';
import {LocationStatus} from '../types/attendance';
import {todayKey} from '../utils/date';
import {
 navigateToBillableTravelFromNotification,
 requestBillableTravelNotificationNavigation,
} from '../navigation/rootNavigation';
import {BackendLocationReminder} from './attendanceLocationService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNEL_ID = 'maxxstation-alerts';
const ANDROID_COLOR_HEX = '#2563EB';

// ---------------------------------------------------------------------------
// Module-level singletons
// ---------------------------------------------------------------------------

let channelPromise: Promise<string> | null = null;
let permissionPromise: Promise<void> | null = null;
let messageUnsubscribe: (() => void) | null = null;
let foregroundListener: (() => void) | null = null;

const activeNotifications = new Set<string>();
const renderedPayloads = new Map<string, string>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationActionId =
 | 'refresh-network'
 | 'refresh-location'
 | 'open-manual-card'
 | 'open-report'
 | 'bill-time'
 | 'open-map'
 | 'check-in'
 | 'stop-billable';

// ---------------------------------------------------------------------------
// Event bus
// ---------------------------------------------------------------------------

class AttendanceEventBus {
 private listeners = new Map<NotificationActionId, Set<() => void>>();

 on(action: NotificationActionId, listener: () => void) {
  const group = this.listeners.get(action) ?? new Set();
  group.add(listener);
  this.listeners.set(action, group);
 }

 off(action: NotificationActionId, listener: () => void) {
  const group = this.listeners.get(action);
  if (!group) {
   return;
  }
  group.delete(listener);
  if (group.size === 0) {
   this.listeners.delete(action);
  }
 }

 emit(action: NotificationActionId) {
  const group = this.listeners.get(action);
  if (!group) {
   return;
  }
  group.forEach(listener => {
   try {
    listener();
   } catch (error) {
    console.warn('Notification action handler error', action, error);
   }
  });
 }
}

export const notificationEvents = new AttendanceEventBus();

// ---------------------------------------------------------------------------
// Snapshot type (kept for callers — shape unchanged)
// ---------------------------------------------------------------------------

export type AttendanceNotificationSnapshot = {
 offline: boolean;
 locationStatus: LocationStatus;
 gpsUnavailable?: boolean;
 canMarkPresence: boolean;
 shiftHasStarted: boolean;
 shiftNearEnd: boolean;
 shiftEnded: boolean;
 hasMarkedIn: boolean;
 hasMarkedOut: boolean;
 graceRemaining: number;
 minutesRemaining: number;
};

// ---------------------------------------------------------------------------
// Notification key registry
// Only two local notification keys remain active:
//   • Offline  — internet unavailable
//   • LocationPermission — GPS unavailable
// BackendLocationReminder is kept so FCM payloads can reuse the same stable id
// ---------------------------------------------------------------------------

const NotificationKey = {
 Offline: 'offline-network',
 LocationPermission: 'location-permission',
 OutsideRadius: 'outside-radius',
 // Used as the stable id for backend-sent location reminders displayed via FCM
 BackendLocationReminder: 'backend-location-reminder',
} as const;

// All legacy local notification ids that were created before the cleanup.
// They are cancelled once on app init so stale banners are cleared from the
// notification tray immediately.
const obsoleteLocalNotificationIds: string[] = [
 'shift-live',
 'shift-wrap',
 'scheduled-shift-start',
 'scheduled-shift-wrap',
 ...Array.from({length: 4}, (_, i) => `scheduled-shift-action-${i}`),
];

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type AttendanceAction = {
 id: string;
 label: string;
};

type AttendanceNotificationContent = {
 title: string;
 body: string;
 actions?: AttendanceAction[];
 categoryId?: string;
};

type ShiftNotificationSource = Record<string, unknown> | null | undefined;

type ShiftReminderState = {
 isAuthenticated: boolean;
 isOnline: boolean;
 hasManualEntry: boolean;
 shiftStart: string;
 shiftEnd: string;
 wrapReminderMinutes: number;
 dateKey: string;
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const SHIFT_REMINDER_STATE_STORAGE_KEY = 'shift_reminder_state_v1';
const ATTENDANCE_STORAGE_KEY = 'attendance_entries_v1';

// ---------------------------------------------------------------------------
// Helpers — type guards
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
 Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
 typeof value === 'string' && value.trim().length > 0;

const hasMessagingPermission = (status: number) =>
 status === messaging.AuthorizationStatus.AUTHORIZED ||
 status === messaging.AuthorizationStatus.PROVISIONAL;

// ---------------------------------------------------------------------------
// Helpers — action normalisation
// ---------------------------------------------------------------------------

const normalizeBackendLocationActions = (
 reminder: BackendLocationReminder,
): AttendanceAction[] => {
 const backendActions = [
  {id: reminder.action_1, label: reminder.action_1_title},
  {id: reminder.action_2, label: reminder.action_2_title},
  {id: reminder.action_3, label: reminder.action_3_title},
 ].reduce<AttendanceAction[]>((actions, action) => {
  if (action.id === 'OPEN_MAP') {
   actions.push({id: 'open-map', label: action.label || 'Start Billable'});
  }
  if (action.id === 'IGNORE') {
   actions.push({id: 'IGNORE', label: action.label || 'Ignore'});
  }
  return actions;
 }, []);

 return backendActions.length
  ? backendActions
  : [
     {id: 'open-map', label: 'Start Billable'},
     {id: 'IGNORE', label: 'Ignore'},
    ];
};

const hasBackendLocationReminderActions = (
 reminder: BackendLocationReminder,
) => {
 const values = [
  reminder.type,
  reminder.action_1,
  reminder.action_2,
  reminder.action_3,
 ].map(value => (typeof value === 'string' ? value.toUpperCase() : ''));

 return (
  reminder.type === 'location_reminder' ||
  values.includes('CHECK_IN') ||
  values.includes('OPEN_MAP') ||
  values.includes('IGNORE')
 );
};

const interactiveActions: NotificationActionId[] = [
 'refresh-network',
 'refresh-location',
 'open-manual-card',
 'open-report',
 'bill-time',
 'open-map',
 'check-in',
 'stop-billable',
];

const isInteractiveAction = (
 value?: string | null,
): value is NotificationActionId =>
 Boolean(value && interactiveActions.includes(value as NotificationActionId));

// ---------------------------------------------------------------------------
// Helpers — shift schedule (kept for syncShiftNotificationSchedule callers)
// ---------------------------------------------------------------------------

const findFirstString = (
 payload: ShiftNotificationSource,
 keys: string[],
): string | null => {
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
   const nestedValue = findFirstString(value, keys);
   if (nestedValue) {
    return nestedValue;
   }
  }
 }
 return null;
};

const normalizeTimeForSchedule = (value?: string | null) => {
 if (!value) {
  return null;
 }
 const normalized = value.trim().toUpperCase().replace(/\s+/g, ' ');
 const twelveHourMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
 if (twelveHourMatch) {
  const [, hourValue, minuteValue = '00', meridiem] = twelveHourMatch;
  const parsedHour = Number(hourValue);
  const parsedMinute = Number(minuteValue);
  if (
   Number.isNaN(parsedHour) ||
   Number.isNaN(parsedMinute) ||
   parsedHour < 1 ||
   parsedHour > 12 ||
   parsedMinute < 0 ||
   parsedMinute > 59
  ) {
   return null;
  }
  const hour24 = meridiem === 'PM' ? (parsedHour % 12) + 12 : parsedHour % 12;
  return `${String(hour24).padStart(2, '0')}:${String(parsedMinute).padStart(
   2,
   '0',
  )}`;
 }
 const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
 if (!twentyFourHourMatch) {
  return null;
 }
 const parsedHour = Number(twentyFourHourMatch[1]);
 const parsedMinute = Number(twentyFourHourMatch[2]);
 if (
  Number.isNaN(parsedHour) ||
  Number.isNaN(parsedMinute) ||
  parsedHour < 0 ||
  parsedHour > 23 ||
  parsedMinute < 0 ||
  parsedMinute > 59
 ) {
  return null;
 }
 return `${String(parsedHour).padStart(2, '0')}:${String(parsedMinute).padStart(
  2,
  '0',
 )}`;
};

const resolveShiftSchedule = (
 loginData?: ShiftNotificationSource,
 user?: ShiftNotificationSource,
) => {
 const source = user ?? loginData;
 const shiftStart =
  normalizeTimeForSchedule(
   findFirstString(source, [
    'shift_start',
    'shiftStart',
    'start_time',
    'start',
   ]),
  ) ?? SHIFT_WINDOW.start;
 const shiftEnd =
  normalizeTimeForSchedule(
   findFirstString(source, ['shift_end', 'shiftEnd', 'end_time', 'end']),
  ) ?? SHIFT_WINDOW.end;
 return {
  shiftStart,
  shiftEnd,
  wrapReminderMinutes: SHIFT_WINDOW.wrapReminderMinutes,
 };
};

// ---------------------------------------------------------------------------
// Helpers — persisted state
// ---------------------------------------------------------------------------

const parsePersistedAuthState = (value: string | null) => {
 if (!value) {
  return null;
 }
 try {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return {
   isAuthenticated: parsed.isAuthenticated === 'true',
   loginData: isNonEmptyString(parsed.loginData)
    ? JSON.parse(parsed.loginData)
    : null,
   user: isNonEmptyString(parsed.user) ? JSON.parse(parsed.user) : null,
  };
 } catch (error) {
  console.warn('Unable to parse persisted auth state', error);
  return null;
 }
};

const loadPersistedAttendanceEntries = async () => {
 try {
  const raw = await AsyncStorage.getItem(ATTENDANCE_STORAGE_KEY);
  if (!raw) {
   return [];
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
 } catch (error) {
  console.warn('Unable to read attendance entries from storage', error);
  return [];
 }
};

const hasTodayManualEntry = async () => {
 const entries = await loadPersistedAttendanceEntries();
 const key = todayKey();
 return entries.some(
  entry =>
   isRecord(entry) &&
   entry.date === key &&
   (isNonEmptyString(entry.clockIn) || isNonEmptyString(entry.clockOut)),
 );
};

const readShiftReminderState = async (): Promise<ShiftReminderState | null> => {
 try {
  const raw = await AsyncStorage.getItem(SHIFT_REMINDER_STATE_STORAGE_KEY);
  if (!raw) {
   return null;
  }
  const parsed = JSON.parse(raw);
  if (!isRecord(parsed)) {
   return null;
  }
  const shiftStart = normalizeTimeForSchedule(
   isNonEmptyString(parsed.shiftStart) ? parsed.shiftStart : null,
  );
  const shiftEnd = normalizeTimeForSchedule(
   isNonEmptyString(parsed.shiftEnd) ? parsed.shiftEnd : null,
  );
  return {
   isAuthenticated: parsed.isAuthenticated === true,
   isOnline: parsed.isOnline === true,
   hasManualEntry: parsed.hasManualEntry === true,
   shiftStart: shiftStart ?? SHIFT_WINDOW.start,
   shiftEnd: shiftEnd ?? SHIFT_WINDOW.end,
   wrapReminderMinutes:
    typeof parsed.wrapReminderMinutes === 'number'
     ? parsed.wrapReminderMinutes
     : SHIFT_WINDOW.wrapReminderMinutes,
   dateKey: isNonEmptyString(parsed.dateKey) ? parsed.dateKey : todayKey(),
  };
 } catch (error) {
  console.warn('Unable to read shift reminder state', error);
  return null;
 }
};

const writeShiftReminderState = async (state: ShiftReminderState) => {
 try {
  await AsyncStorage.setItem(
   SHIFT_REMINDER_STATE_STORAGE_KEY,
   JSON.stringify(state),
  );
 } catch (error) {
  console.warn('Unable to persist shift reminder state', error);
 }
};

const buildMergedShiftReminderState = async (
 updates: Partial<ShiftReminderState> = {},
): Promise<ShiftReminderState> => {
 const existingState = await readShiftReminderState();
 const persistedAuthState = parsePersistedAuthState(
  await AsyncStorage.getItem('persist:auth'),
 );
 const storedManualEntry = await hasTodayManualEntry();
 const resolvedSchedule = resolveShiftSchedule(
  persistedAuthState?.loginData,
  persistedAuthState?.user,
 );
 return {
  isAuthenticated:
   updates.isAuthenticated ??
   existingState?.isAuthenticated ??
   persistedAuthState?.isAuthenticated ??
   false,
  isOnline: updates.isOnline ?? existingState?.isOnline ?? true,
  hasManualEntry:
   updates.hasManualEntry ?? existingState?.hasManualEntry ?? storedManualEntry,
  shiftStart:
   updates.shiftStart ??
   existingState?.shiftStart ??
   resolvedSchedule.shiftStart,
  shiftEnd:
   updates.shiftEnd ?? existingState?.shiftEnd ?? resolvedSchedule.shiftEnd,
  wrapReminderMinutes:
   updates.wrapReminderMinutes ??
   existingState?.wrapReminderMinutes ??
   resolvedSchedule.wrapReminderMinutes,
  dateKey: updates.dateKey ?? todayKey(),
 };
};

// ---------------------------------------------------------------------------
// Platform setup — permissions & channel
// ---------------------------------------------------------------------------

export const getFcmToken = async () => {
 try {
  const token = await messaging().getToken();
  console.log('[FCM] Current Device Token:', token);
  return token;
 } catch (error) {
  console.warn('[FCM] Failed to get token:', error);
  return null;
 }
};

export const checkNotificationStatus = async () => {
 console.log('[Notification] Checking status...');
 const settings = await notifee.getNotificationSettings();
 console.log('[Notification] Notifee Settings:', settings);

 const authStatus = await messaging().hasPermission();
 console.log('[FCM] Auth Status:', authStatus);

 const token = await getFcmToken();
 return {settings, authStatus, token};
};

const ensurePermissions = async () => {
 if (!permissionPromise) {
  permissionPromise = (async () => {
   console.log('[Notification] Requesting permissions...');
   try {
    await notifee.requestPermission();
   } catch (error) {
    console.warn('[Notification] Notifee permission request failed', error);
   }

   let permissionStatus = messaging.AuthorizationStatus.NOT_DETERMINED;
   try {
    permissionStatus = await messaging().hasPermission();
    if (
     permissionStatus === messaging.AuthorizationStatus.DENIED ||
     permissionStatus === messaging.AuthorizationStatus.NOT_DETERMINED
    ) {
     permissionStatus = await messaging().requestPermission();
    }
   } catch (error) {
    console.warn('[FCM] Unable to verify messaging permission', error);
   }

   console.log('[FCM] Permission status:', permissionStatus);

   if (!hasMessagingPermission(permissionStatus)) {
    console.log(
     '[FCM] Skipping registration — notification permission not granted.',
    );
    return;
   }

   if (
    Platform.OS === 'ios' &&
    !messaging().isDeviceRegisteredForRemoteMessages
   ) {
    try {
     await messaging().registerDeviceForRemoteMessages();
     console.log('[FCM] iOS device registered for remote messages');
    } catch (error) {
     console.warn('[FCM] Failed to register for remote messages', error);
     return;
    }
   }

   await getFcmToken();
  })();
 }
 return permissionPromise;
};

const ensureChannel = async () => {
 if (!channelPromise) {
  channelPromise = notifee.createChannel({
   id: CHANNEL_ID,
   name: 'Shift Alerts',
   description: 'Offline, shift, and attendance guidance',
   importance: AndroidImportance.HIGH,
   lights: true,
   vibration: true,
  });
 }
 return channelPromise;
};

const ensureBackgroundReady = async () => {
 await ensureChannel();
};

const ensureReady = async () => {
 await ensurePermissions();
 await ensureChannel();
};

// ---------------------------------------------------------------------------
// Notification display / dismiss primitives
// ---------------------------------------------------------------------------

const buildSignature = (payload: AttendanceNotificationContent) =>
 JSON.stringify({
  title: payload.title,
  body: payload.body,
  actions: payload.actions,
  categoryId: payload.categoryId,
 });

export const displayTestNotification = async () => {
 await ensureReady();
 const channelId = await ensureChannel();
 await notifee.displayNotification({
  title: 'Test Notification',
  body: 'If you see this, Notifee is working correctly.',
  android: {
   channelId,
   smallIcon: 'ic_launcher',
   importance: AndroidImportance.HIGH,
  },
 });
};

const displayAttendanceNotification = async (
 key: string,
 payload: AttendanceNotificationContent,
) => {
 await ensureReady();
 const signature = buildSignature(payload);
 if (renderedPayloads.get(key) === signature) {
  console.log('[Notification] Skipping duplicate:', key);
  return;
 }

 console.log('[Notification] Displaying:', key, {
  title: payload.title,
  body: payload.body,
  actions: payload.actions?.map(a => ({id: a.id, label: a.label})),
 });

 renderedPayloads.set(key, signature);
 activeNotifications.add(key);
 const channelId = await ensureChannel();

 await notifee.displayNotification({
  id: key,
  title: payload.title,
  body: payload.body,
  android: {
   channelId,
   smallIcon: 'ic_launcher',
   color: ANDROID_COLOR_HEX,
   largeIcon: 'ic_launcher',
   pressAction: {id: 'open-app'},
   style: {type: AndroidStyle.BIGTEXT, text: payload.body},
   importance: AndroidImportance.HIGH,
   actions: payload.actions?.map(action => ({
    title: action.label,
    pressAction:
     action.id === 'open-map' || action.id === 'check-in'
      ? {id: action.id, launchActivity: 'default'}
      : {id: action.id},
   })),
  },
  ios: {
   sound: 'default',
   categoryId: payload.categoryId ?? 'essential-local',
  },
  data: {notificationKey: key},
 });
};

const dismissAttendanceNotification = async (key: string) => {
 renderedPayloads.delete(key);
 activeNotifications.delete(key);
 try {
  await notifee.cancelNotification(key);
 } catch (error) {
  console.warn('Unable to cancel notification', key, error);
 }
};

const cleanupObsoleteLocalNotifications = async () => {
 await ensureReady();
 console.log(
  '[Notification] Cancelling obsolete local notification ids:',
  obsoleteLocalNotificationIds,
 );
 await Promise.all(
  obsoleteLocalNotificationIds.map(id => dismissAttendanceNotification(id)),
 );
};

// ---------------------------------------------------------------------------
// FIX 1 — Background message handler registration
//
// This function MUST be called from index.js BEFORE AppRegistry.registerComponent.
// It registers the handler that processes FCM messages when the app is
// backgrounded or killed. Without it those messages are silently discarded.
// ---------------------------------------------------------------------------

export const registerBackgroundMessageHandler = () => {
 messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] Background message received:', remoteMessage?.messageId);
  await handleIncomingRemoteMessage(remoteMessage);
 });
};

// ---------------------------------------------------------------------------
// Public exports — shift schedule sync (API unchanged for callers)
// ---------------------------------------------------------------------------

export const cancelScheduledNotification = async (id: string) => {
 await ensureReady();
 try {
  await notifee.cancelNotification(id);
 } catch (error) {
  console.warn('Unable to cancel scheduled notification', id, error);
 }
};

export const syncShiftActionNotifications = async (
 updates: Partial<ShiftReminderState> = {},
) => {
 const state = await buildMergedShiftReminderState(updates);
 await writeShiftReminderState(state);
};

export const restoreShiftNotificationSchedulesFromStorage = async () => {
 const state = await buildMergedShiftReminderState();
 await writeShiftReminderState(state);
 await cleanupObsoleteLocalNotifications();
};

export const syncShiftNotificationSchedule = async (options: {
 isAuthenticated: boolean;
 loginData?: ShiftNotificationSource;
 user?: ShiftNotificationSource;
}) => {
 const {shiftStart, shiftEnd, wrapReminderMinutes} = resolveShiftSchedule(
  options.loginData,
  options.user,
 );
 await cleanupObsoleteLocalNotifications();
 await syncShiftActionNotifications({
  isAuthenticated: options.isAuthenticated,
  shiftStart,
  shiftEnd,
  wrapReminderMinutes,
  dateKey: todayKey(),
 });
};

// ---------------------------------------------------------------------------
// Pipeline init — foreground listeners + categories. Background FCM handler
// is registered once in index.js before the root component mounts.
// ---------------------------------------------------------------------------

export const initializeNotificationPipeline = async () => {
 await ensureReady();
 await cleanupObsoleteLocalNotifications();

 // iOS notification categories
 await notifee.setNotificationCategories([
  {
   id: 'essential-local',
   actions: [
    {id: 'refresh-location', title: 'Refresh GPS'},
    {id: 'refresh-network', title: 'Retry Connection'},
    {id: 'open-settings', title: 'Settings', foreground: true},
   ],
  },
  {
   id: 'backend-location-reminder',
   actions: [
    {id: 'check-in', title: 'Check In', foreground: true},
    {id: 'open-map', title: 'Start Billable', foreground: true},
    {id: 'IGNORE', title: 'Ignore'},
   ],
  },
 ]);

 // Tear down previous listeners before re-attaching (handles hot reload / re-init)
 messageUnsubscribe?.();
 foregroundListener?.();

 // Foreground FCM listener
 messageUnsubscribe = messaging().onMessage(async remoteMessage => {
  console.log('[FCM] Foreground message received:', remoteMessage?.messageId);
  await handleIncomingRemoteMessage(remoteMessage);
 });

 // Background FCM is registered once in index.js (before App mounts). Do not call
 // setBackgroundMessageHandler again here — a second registration replaces the
 // handler at an unpredictable time relative to native delivery.

 // Foreground notifee event listener
 foregroundListener = notifee.onForegroundEvent(async event => {
  await handleNotifeeForegroundEvent(event);
 });

 // Handle tap on notification that cold-started the app
 notifee
  .getInitialNotification()
  .then(initialNotification => {
   const actionId = initialNotification?.pressAction?.id;
   if (actionId) {
    processNotificationAction(actionId, initialNotification.notification).catch(
     error => console.warn('Initial notification action failed', error),
    );
   }
  })
  .catch(error => console.warn('Unable to read initial notification', error));

 messaging().onTokenRefresh(token => {
  console.log('[FCM] Token refreshed:', token);
 });
};

// ---------------------------------------------------------------------------
// Essential local notifications — only Internet OFF and GPS OFF remain
// ---------------------------------------------------------------------------

export const syncEssentialLocalNotifications = async ({
 offline,
 gpsUnavailable,
}: {
 offline?: boolean;
 gpsUnavailable?: boolean;
}) => {
 if (typeof offline === 'boolean') {
  if (offline) {
   await displayAttendanceNotification(NotificationKey.Offline, {
    title: 'Internet unavailable',
    body:
     'Your device is offline. Some app data may not sync until internet is restored.',
    actions: [{id: 'refresh-network', label: 'Retry'}],
    categoryId: 'essential-local',
   });
  } else {
   await dismissAttendanceNotification(NotificationKey.Offline);
  }
 }

 if (typeof gpsUnavailable === 'boolean') {
  if (gpsUnavailable) {
   await displayAttendanceNotification(NotificationKey.LocationPermission, {
    title: 'GPS unavailable',
    body: 'Enable GPS/location access to complete attendance.',
    actions: [
     {id: 'open-settings', label: 'Settings'},
     {id: 'refresh-location', label: 'Retry'},
    ],
    categoryId: 'essential-local',
   });
  } else {
   await dismissAttendanceNotification(NotificationKey.LocationPermission);
  }
 }
};

export const syncAttendanceNotifications = async (
 snapshot: AttendanceNotificationSnapshot,
) => {
 await syncEssentialLocalNotifications({
  offline: snapshot.offline,
  gpsUnavailable:
   snapshot.gpsUnavailable ?? snapshot.locationStatus === 'denied',
 });
};

// ---------------------------------------------------------------------------
// Backend location reminder — display / dismiss driven by the server
// ---------------------------------------------------------------------------

export const syncBackendLocationReminderNotification = async (
 reminder: BackendLocationReminder | null,
) => {
 if (!reminder) {
  console.log(
   '[Notification] syncBackendLocationReminderNotification → null, dismissing',
  );
  renderedPayloads.delete(NotificationKey.BackendLocationReminder);
  await dismissAttendanceNotification(NotificationKey.BackendLocationReminder);
  return;
 }

 console.log('[Notification] syncBackendLocationReminderNotification →', {
  type: reminder.type,
  action_1: reminder.action_1,
  action_1_title: reminder.action_1_title,
  action_2: reminder.action_2,
  action_2_title: reminder.action_2_title,
  action_3: reminder.action_3,
  action_3_title: reminder.action_3_title,
 });

 const actions = normalizeBackendLocationActions(reminder);
 console.log('[Notification] Normalized actions →', actions);

 await displayAttendanceNotification(NotificationKey.BackendLocationReminder, {
  title: reminder.title || 'Location Reminder',
  body:
   reminder.body ||
   reminder.message ||
   'You are outside office. Please check in or open the map.',
  actions,
  categoryId: 'backend-location-reminder',
 });
};

// ---------------------------------------------------------------------------
// FIX 3 — handleIncomingRemoteMessage
//
// Previously the function gated the entire display on hasBackendLocationReminderActions.
// Now EVERY FCM message is displayed. If the payload contains location-reminder
// action fields, the proper action buttons are attached; otherwise the message
// is shown as a plain informational notification so no FCM push is ever lost.
// ---------------------------------------------------------------------------

export const handleIncomingRemoteMessage = async (
 remoteMessage: FirebaseMessagingTypes.RemoteMessage,
) => {
 console.log('--------------------------------------------------');
 console.log('[FCM] handleIncomingRemoteMessage → RECEIVED');
 console.log('[FCM] Message ID:', remoteMessage?.messageId);
 console.log(
  '[FCM] Data Payload:',
  JSON.stringify(remoteMessage?.data, null, 2),
 );
 console.log(
  '[FCM] Notification Payload:',
  JSON.stringify(remoteMessage?.notification, null, 2),
 );
 console.log('--------------------------------------------------');

 await ensureBackgroundReady();
 const channelId = await ensureChannel();

 const data = remoteMessage.data as BackendLocationReminder | undefined;

 // Detect whether this FCM payload is a backend location reminder
 const isBackendLocationReminder = data
  ? hasBackendLocationReminderActions(data)
  : false;

 // Resolve title — prefer explicit notification fields, fall back to data fields
 const title =
  remoteMessage.notification?.title ||
  data?.title ||
  (isBackendLocationReminder ? 'Location reminder' : 'Shift update');

 // Resolve body
 const body =
  remoteMessage.notification?.body ||
  data?.body ||
  data?.message ||
  (isBackendLocationReminder
   ? 'You are outside office. Please check in or open the map.'
   : 'You have a new update.');

 // Attach action buttons only for location-reminder payloads
 const actions = isBackendLocationReminder
  ? normalizeBackendLocationActions(data as BackendLocationReminder)
  : undefined;

 // Use a stable id for location-reminder notifications so they replace each
 // other in the tray instead of stacking. Other FCM messages use the FCM
 // message id so they appear as individual banners.
 const notificationId = isBackendLocationReminder
  ? NotificationKey.BackendLocationReminder
  : remoteMessage.messageId;

 console.log('[FCM] Displaying notification:', {
  id: notificationId,
  title,
  body,
  isBackendLocationReminder,
  actions,
 });

 await notifee.displayNotification({
  id: notificationId,
  title,
  body,
  android: {
   channelId,
   smallIcon: 'ic_launcher',
   color: ANDROID_COLOR_HEX,
   largeIcon: 'ic_launcher',
   pressAction: {id: 'open-app'},
   style: {type: AndroidStyle.BIGTEXT, text: body},
   importance: AndroidImportance.HIGH,
   actions: actions?.map(action => ({
    title: action.label,
    pressAction:
     action.id === 'open-map' || action.id === 'check-in'
      ? {id: action.id, launchActivity: 'default'}
      : {id: action.id},
   })),
  },
  ios: {
   sound: 'default',
   categoryId: isBackendLocationReminder
    ? 'backend-location-reminder'
    : 'essential-local',
  },
  data: remoteMessage.data,
 });
};

// ---------------------------------------------------------------------------
// Action handler
// ---------------------------------------------------------------------------

const processNotificationAction = async (
 actionId?: string | null,
 notification?: Notification | null,
) => {
 if (!actionId) {
  return;
 }

 switch (actionId) {
  case 'open-settings':
   Linking.openSettings().catch(() => null);
   break;
  case 'CHECK_IN':
  case 'check-in':
   console.log('[Notification] CHECK_IN pressed → emitting check-in');
   notificationEvents.emit('check-in');
   break;
  case 'stop-billable':
   console.log('[Notification] STOP_BILLABLE pressed → emitting stop-billable');
   notificationEvents.emit('stop-billable');
   break;
  case 'OPEN_MAP':
  case 'open-map':
   console.log(
    '[Notification] OPEN_MAP pressed → navigating to billable travel',
   );
   await requestBillableTravelNotificationNavigation();
   await navigateToBillableTravelFromNotification();
   break;
  case 'IGNORE':
  case 'ignore':
   console.log('[Notification] IGNORE pressed → dismissing');
   break;
  default:
   if (isInteractiveAction(actionId)) {
    notificationEvents.emit(actionId);
   }
   break;
 }

 if (notification?.id) {
  await dismissAttendanceNotification(notification.id);
 }
};

// ---------------------------------------------------------------------------
// Notifee event handlers (foreground + background)
// ---------------------------------------------------------------------------

export const handleNotifeeBackgroundEvent = async (event: Event) => {
 const {type, detail} = event;
 if (type === EventType.ACTION_PRESS) {
  await processNotificationAction(detail.pressAction?.id, detail.notification);
 }
 if (type === EventType.DISMISSED && detail.notification?.id) {
  await dismissAttendanceNotification(detail.notification.id);
 }
};

const handleNotifeeForegroundEvent = async (event: Event) => {
 const {type, detail} = event;
 if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
  await processNotificationAction(detail.pressAction?.id, detail.notification);
 }
 if (type === EventType.DISMISSED && detail.notification?.id) {
  await dismissAttendanceNotification(detail.notification.id);
 }
};
