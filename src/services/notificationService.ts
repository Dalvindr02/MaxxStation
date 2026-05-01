import {Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
 AlarmType,
 AndroidImportance,
 AndroidStyle,
 EventType,
 Event,
 Notification,
 TriggerType,
} from '@notifee/react-native';
import messaging, {
 FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {SHIFT_WINDOW} from '../constants/shift';
import {LocationStatus} from '../types/attendance';
import {todayKey} from '../utils/date';

const CHANNEL_ID = 'maxxstation-alerts';
const ANDROID_COLOR_HEX = '#2563EB';

let channelPromise: Promise<string> | null = null;
let permissionPromise: Promise<void> | null = null;
let messageUnsubscribe: (() => void) | null = null;
let foregroundListener: (() => void) | null = null;

const activeNotifications = new Set<string>();
const renderedPayloads = new Map<string, string>();

export type NotificationActionId =
 | 'refresh-network'
 | 'refresh-location'
 | 'open-manual-card'
 | 'mark-presence'
 | 'open-report'
 | 'bill-time';

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

export type AttendanceNotificationSnapshot = {
 offline: boolean;
 locationStatus: LocationStatus;
 canMarkPresence: boolean;
 shiftHasStarted: boolean;
 shiftNearEnd: boolean;
 shiftEnded: boolean;
 hasMarkedIn: boolean;
 hasMarkedOut: boolean;
 graceRemaining: number;
 minutesRemaining: number;
};

const NotificationKey = {
 Offline: 'offline-network',
 LocationPermission: 'location-permission',
 OutsideRadius: 'outside-radius',
 ShiftLive: 'shift-live',
 ShiftWrap: 'shift-wrap',
} as const;

const ScheduledNotificationKey = {
 ShiftStart: 'scheduled-shift-start',
 ShiftWrap: 'scheduled-shift-wrap',
} as const;

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

const ShiftActionNotificationKey = {
 Prefix: 'scheduled-shift-action',
} as const;

const SHIFT_REMINDER_STATE_STORAGE_KEY = 'shift_reminder_state_v1';
const ATTENDANCE_STORAGE_KEY = 'attendance_entries_v1';
const SHIFT_ACTION_REMINDER_COUNT = 4;
const SHIFT_ACTION_REMINDER_INTERVAL_MINUTES = 5;
const ANDROID_TEST_SHIFT_OVERRIDE =
 Platform.OS === 'android'
  ? {shiftStart: '09:00', shiftEnd: '18:00', wrapReminderMinutes: 5}
  : null;

type AttendanceAction = {
 id: string;
 label: string;
};

type AttendanceNotificationContent = {
 title: string;
 body: string;
 actions?: AttendanceAction[];
};

const interactiveActions: NotificationActionId[] = [
 'refresh-network',
 'refresh-location',
 'open-manual-card',
 'mark-presence',
 'open-report',
 'bill-time',
];

const isInteractiveAction = (
 value?: string | null,
): value is NotificationActionId =>
 Boolean(value && interactiveActions.includes(value as NotificationActionId));

const hasMessagingPermission = (status: number) =>
 status === messaging.AuthorizationStatus.AUTHORIZED ||
 status === messaging.AuthorizationStatus.PROVISIONAL;

const isRecord = (value: unknown): value is Record<string, unknown> =>
 Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
 typeof value === 'string' && value.trim().length > 0;

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
 if (ANDROID_TEST_SHIFT_OVERRIDE) {
  return {
   shiftStart: ANDROID_TEST_SHIFT_OVERRIDE.shiftStart,
   shiftEnd: ANDROID_TEST_SHIFT_OVERRIDE.shiftEnd,
   wrapReminderMinutes:
    ANDROID_TEST_SHIFT_OVERRIDE.wrapReminderMinutes ??
    SHIFT_WINDOW.wrapReminderMinutes,
  };
 }

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

const getShiftActionNotificationId = (index: number) =>
 `${ShiftActionNotificationKey.Prefix}-${index}`;

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

const buildReminderMessage = (state: ShiftReminderState) => {
 if (!state.isOnline) {
  return 'Your shift has started. Please turn on your internet.';
 }

 if (!state.isAuthenticated && !state.hasManualEntry) {
  return 'Your shift has started. Please log in or add manual entry.';
 }

 return null;
};

const parseDateKeyAndTime = (dateKey: string, time: string) => {
 const [year, month, day] = dateKey.split('-').map(Number);
 const [hour, minute] = time.split(':').map(Number);

 return new Date(
  year,
  (month || 1) - 1,
  day || 1,
  hour || 0,
  minute || 0,
  0,
  0,
 );
};

const ensurePermissions = async () => {
 if (!permissionPromise) {
  permissionPromise = (async () => {
   try {
    await notifee.requestPermission();
   } catch (error) {
    console.warn('Notifee permission request failed', error);
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
    console.warn('Unable to verify messaging permission', error);
   }

   if (!hasMessagingPermission(permissionStatus)) {
    console.log(
     'Skipping FCM registration because notification permission is not granted on this device.',
    );
    return;
   }

   if (
    Platform.OS === 'ios' &&
    !messaging().isDeviceRegisteredForRemoteMessages
   ) {
    try {
     await messaging().registerDeviceForRemoteMessages();
    } catch (error) {
     console.warn('Failed to register for remote messages', error);
     return;
    }
   }

   try {
    const token = await messaging().getToken();
    console.log('Firebase messaging token', token);
   } catch (error) {
    console.warn('Unable to fetch FCM token', error);
   }
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

const buildScheduledNotificationPayload = (
 id: string,
 title: string,
 body: string,
 actions?: AttendanceAction[],
) => ({
 id,
 title,
 body,
 android: {
  channelId: CHANNEL_ID,
  smallIcon: 'ic_launcher',
  color: ANDROID_COLOR_HEX,
  largeIcon: 'ic_launcher',
  pressAction: {id: 'open-app'},
  style: {type: AndroidStyle.BIGTEXT, text: body},
  importance: AndroidImportance.HIGH,
  actions: actions?.map(action => ({
   title: action.label,
   pressAction: {id: action.id},
  })),
 },
 ios: {
  sound: 'default',
  categoryId: 'attendance',
 },
 data: {
  scheduledNotification: id,
 },
});

export const scheduleNotificationTrigger = async (
 id: string,
 title: string,
 body: string,
 timestamp: number,
 actions?: AttendanceAction[],
) => {
 if (timestamp <= Date.now()) {
  console.log(
   'Skipping notification trigger because timestamp is in the past',
   {
    id,
    timestamp,
   },
  );
  return;
 }
 await ensureReady();
 await notifee.cancelNotification(id);
 try {
  await notifee.createTriggerNotification(
   buildScheduledNotificationPayload(id, title, body, actions) as any,
   {
    type: TriggerType.TIMESTAMP,
    timestamp,
    ...(Platform.OS === 'android'
     ? {
        alarmManager: {
         type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE,
        },
       }
     : {}),
   } as any,
  );
  console.log('Scheduled notification trigger', {
   id,
   title,
   timestamp,
   scheduledFor: new Date(timestamp).toISOString(),
  });
 } catch (error) {
  console.warn('Failed to schedule exact trigger notification', id, error);
  if (Platform.OS !== 'android') {
   throw error;
  }

  await notifee.createTriggerNotification(
   buildScheduledNotificationPayload(id, title, body, actions) as any,
   {
    type: TriggerType.TIMESTAMP,
    timestamp,
   } as any,
  );
  console.log('Scheduled fallback trigger notification', {
   id,
   title,
   timestamp,
   scheduledFor: new Date(timestamp).toISOString(),
  });
 }
};

export const cancelScheduledNotification = async (id: string) => {
 await ensureReady();
 try {
  await notifee.cancelNotification(id);
 } catch (error) {
  console.warn('Unable to cancel scheduled notification', id, error);
 }
};

const parseTimeToToday = (time: string) => {
 const [hour, minute] = time.split(':').map(Number);
 const now = new Date();
 return new Date(
  now.getFullYear(),
  now.getMonth(),
  now.getDate(),
  hour,
  minute,
  0,
  0,
 );
};

export const scheduleTodayShiftNotifications = async (
 shiftStart: string,
 shiftEnd: string,
 wrapReminderMinutes: number,
) => {
 const now = Date.now();
 const endDate = parseTimeToToday(shiftEnd);
 const wrapDate = new Date(endDate.getTime() - wrapReminderMinutes * 60000);
 await cancelScheduledNotification(ScheduledNotificationKey.ShiftStart);

 if (wrapDate.getTime() > now && wrapDate.getTime() < endDate.getTime()) {
  await scheduleNotificationTrigger(
   ScheduledNotificationKey.ShiftWrap,
   'Shift ending soon',
   `You have ${wrapReminderMinutes} minutes left in your shift. Wrap up logs or submit your report.`,
   wrapDate.getTime(),
   [{id: 'open-report', label: 'Open report'}],
  );
 } else {
  await cancelScheduledNotification(ScheduledNotificationKey.ShiftWrap);
 }
};

export const cancelShiftActionNotifications = async () => {
 await ensureReady();
 await Promise.all(
  Array.from({length: SHIFT_ACTION_REMINDER_COUNT}, (_, index) =>
   cancelScheduledNotification(getShiftActionNotificationId(index)),
  ),
 );
};

export const syncShiftActionNotifications = async (
 updates: Partial<ShiftReminderState> = {},
) => {
 const state = await buildMergedShiftReminderState(updates);
 await writeShiftReminderState(state);

 const message = buildReminderMessage(state);
 if (!message) {
  await cancelShiftActionNotifications();
  return;
 }

 const shiftStartDate = parseDateKeyAndTime(state.dateKey, state.shiftStart);
 const shiftStartTimestamp = shiftStartDate.getTime();
 if (Number.isNaN(shiftStartTimestamp)) {
  console.warn('Unable to schedule shift action notifications', state);
  return;
 }

 const now = Date.now();
 const shiftEndTimestamp = parseDateKeyAndTime(
  state.dateKey,
  state.shiftEnd,
 ).getTime();
 const firstReminderTimestamp =
  now > shiftStartTimestamp
   ? now + SHIFT_ACTION_REMINDER_INTERVAL_MINUTES * 60 * 1000
   : shiftStartTimestamp;

 if (firstReminderTimestamp >= shiftEndTimestamp) {
  await cancelShiftActionNotifications();
  return;
 }

 const reminderTimestamps = Array.from(
  {length: SHIFT_ACTION_REMINDER_COUNT},
  (_, index) =>
   firstReminderTimestamp +
   index * SHIFT_ACTION_REMINDER_INTERVAL_MINUTES * 60 * 1000,
 );
 const latestReminderTimestamp =
  reminderTimestamps[reminderTimestamps.length - 1] ?? firstReminderTimestamp;
 if (Date.now() > latestReminderTimestamp) {
  await cancelShiftActionNotifications();
  return;
 }

 await Promise.all(
  reminderTimestamps.map((timestamp, index) =>
   scheduleNotificationTrigger(
    getShiftActionNotificationId(index),
    'Shift started',
    message,
    timestamp,
    [{id: 'open-report', label: 'Open app'}],
   ),
  ),
 );
};

export const restoreShiftNotificationSchedulesFromStorage = async () => {
 const state = await buildMergedShiftReminderState();
 await writeShiftReminderState(state);
 if (state.isAuthenticated) {
  await scheduleTodayShiftNotifications(
   state.shiftStart,
   state.shiftEnd,
   state.wrapReminderMinutes,
  );
 } else {
  await cancelScheduledNotification(ScheduledNotificationKey.ShiftWrap);
 }
 await syncShiftActionNotifications(state);
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

 if (options.isAuthenticated) {
  await scheduleTodayShiftNotifications(
   shiftStart,
   shiftEnd,
   wrapReminderMinutes,
  );
 } else {
  await cancelScheduledNotification(ScheduledNotificationKey.ShiftWrap);
 }
 await syncShiftActionNotifications({
  isAuthenticated: options.isAuthenticated,
  shiftStart,
  shiftEnd,
  wrapReminderMinutes,
  dateKey: todayKey(),
 });
};

export const initializeNotificationPipeline = async () => {
 await ensureReady();
 await notifee.setNotificationCategories([
  {
   id: 'attendance',
   actions: [
    {id: 'mark-presence', title: 'Mark Presence'},
    {id: 'refresh-location', title: 'Refresh GPS'},
    {id: 'open-manual-card', title: 'Manual Pin'},
    {id: 'bill-time', title: 'Bill travel time', foreground: true},
    {id: 'refresh-network', title: 'Retry Connection'},
    {id: 'open-report', title: 'Open Report', foreground: true},
    {id: 'open-settings', title: 'Settings', foreground: true},
   ],
  },
 ]);

 messageUnsubscribe?.();
 foregroundListener?.();

 messageUnsubscribe = messaging().onMessage(handleIncomingRemoteMessage);
 foregroundListener = notifee.onForegroundEvent(async event => {
  await handleNotifeeForegroundEvent(event);
 });

 messaging().onTokenRefresh(token => {
  console.log('Firebase messaging token refreshed', token);
 });
};

const buildSignature = (payload: AttendanceNotificationContent) =>
 JSON.stringify({title: payload.title, body: payload.body});

const displayAttendanceNotification = async (
 key: string,
 payload: AttendanceNotificationContent,
) => {
 await ensureReady();
 const signature = buildSignature(payload);
 if (renderedPayloads.get(key) === signature) {
  return;
 }

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
    pressAction: {id: action.id},
   })),
  },
  ios: {
   sound: 'default',
   categoryId: 'attendance',
  },
  data: {
   notificationKey: key,
  },
 });
};

const dismissAttendanceNotification = async (key: string) => {
 if (!activeNotifications.has(key)) {
  return;
 }
 renderedPayloads.delete(key);
 activeNotifications.delete(key);
 try {
  await notifee.cancelNotification(key);
 } catch (error) {
  console.warn('Unable to cancel notification', key, error);
 }
};

const formatMinutes = (minutes: number) => {
 if (minutes <= 0) return 'now';
 if (minutes === 1) return '1 minute';
 return `${minutes} minutes`;
};

export const syncAttendanceNotifications = async (
 snapshot: AttendanceNotificationSnapshot,
) => {
 const showOffline = snapshot.offline;
 if (showOffline) {
  const body = snapshot.shiftHasStarted
   ? 'You are offline during your shift. Add a manual travel log or retry connection to sync later.'
   : 'You are offline. Attendance, logs, and reports will sync automatically when connectivity is restored.';
  const actions = snapshot.shiftHasStarted
   ? [
      {id: 'open-manual-card', label: 'Open manual log'},
      {id: 'refresh-network', label: 'Retry'},
     ]
   : [{id: 'refresh-network', label: 'Retry'}];

  await displayAttendanceNotification(NotificationKey.Offline, {
   title: 'You are offline',
   body,
   actions,
  });
 } else {
  await dismissAttendanceNotification(NotificationKey.Offline);
 }

 const showLocationPermission =
  snapshot.locationStatus === 'denied' || snapshot.locationStatus === 'error';
 if (showLocationPermission) {
  const detail =
   snapshot.locationStatus === 'denied'
    ? 'Enable location access to complete attendance.'
    : 'Unable to acquire GPS lock. Try again from an open area.';
  await displayAttendanceNotification(NotificationKey.LocationPermission, {
   title: 'Location services required',
   body: detail,
   actions: [
    {id: 'open-settings', label: 'Settings'},
    {id: 'refresh-location', label: 'Retry'},
   ],
  });
 } else {
  await dismissAttendanceNotification(NotificationKey.LocationPermission);
 }

 const showOutside = snapshot.locationStatus === 'outside';
 if (showOutside) {
  const title = snapshot.shiftHasStarted
   ? 'You are outside the office boundary'
   : 'Outside mapped location';
  const body = snapshot.shiftHasStarted
   ? 'You have left the work location during shift. Bill this travel time or add a manual pin.'
   : 'Move within the geofence or add a manual pin for today.';
  const actions = snapshot.shiftHasStarted
   ? [
      {id: 'bill-time', label: 'Bill travel time'},
      {id: 'open-manual-card', label: 'Add Manual Pin'},
      {id: 'refresh-location', label: 'Refresh GPS'},
     ]
   : [
      {id: 'open-manual-card', label: 'Add Manual Pin'},
      {id: 'refresh-location', label: 'Refresh GPS'},
     ];

  await displayAttendanceNotification(NotificationKey.OutsideRadius, {
   title,
   body,
   actions,
  });
 } else {
  await dismissAttendanceNotification(NotificationKey.OutsideRadius);
 }

 const showShiftLive = snapshot.shiftHasStarted && !snapshot.hasMarkedIn;
 if (showShiftLive) {
  const clockBody = snapshot.canMarkPresence
   ? `Mark presence ${
      snapshot.graceRemaining > 0
       ? `within ${formatMinutes(snapshot.graceRemaining)}`
       : 'now to avoid a late flag'
     }.`
   : 'Reach the mapped site or drop a manual pin to continue.';
  await displayAttendanceNotification(NotificationKey.ShiftLive, {
   title: 'Shift is live',
   body: clockBody,
   actions: [{id: 'mark-presence', label: 'Mark Now'}],
  });
 } else {
  await dismissAttendanceNotification(NotificationKey.ShiftLive);
 }

 const showWrap =
  (snapshot.shiftNearEnd || snapshot.shiftEnded) &&
  snapshot.hasMarkedIn &&
  !snapshot.hasMarkedOut;
 if (showWrap) {
  const body = snapshot.shiftEnded
   ? 'Shift has ended. Wrap your logs and submit the E.O.D report.'
   : `About ${formatMinutes(
      snapshot.minutesRemaining,
     )} left in your shift. Start wrapping up.`;
  await displayAttendanceNotification(NotificationKey.ShiftWrap, {
   title: snapshot.shiftEnded ? 'Shift ended' : 'Shift ending soon',
   body,
   actions: [{id: 'open-report', label: 'Open Report'}],
  });
 } else {
  await dismissAttendanceNotification(NotificationKey.ShiftWrap);
 }
};

export const handleIncomingRemoteMessage = async (
 remoteMessage: FirebaseMessagingTypes.RemoteMessage,
) => {
 console.log(
  'FCM background message received',
  remoteMessage?.messageId,
  remoteMessage?.data,
 );
 await ensureBackgroundReady();
 const channelId = await ensureChannel();
 const title =
  (typeof remoteMessage.notification?.title === 'string'
   ? remoteMessage.notification.title
   : undefined) ||
  (typeof remoteMessage.data?.title === 'string'
   ? remoteMessage.data.title
   : undefined) ||
  'Shift update';
 const body =
  (typeof remoteMessage.notification?.body === 'string'
   ? remoteMessage.notification.body
   : undefined) ||
  (typeof remoteMessage.data?.body === 'string'
   ? remoteMessage.data.body
   : undefined) ||
  'You have a new update.';

 await notifee.displayNotification({
  title,
  body,
  android: {
   channelId,
   smallIcon: 'ic_launcher',
   pressAction: {id: 'open-app'},
  },
  ios: {
   sound: 'default',
  },
  data: remoteMessage.data,
 });
};

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
