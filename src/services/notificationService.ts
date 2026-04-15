import { Linking } from 'react-native';
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
import { LocationStatus } from '../types/attendance';

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
  | 'open-report';

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
];

const isInteractiveAction = (
  value?: string | null,
): value is NotificationActionId =>
  Boolean(value && interactiveActions.includes(value as NotificationActionId));

const ensurePermissions = async () => {
  if (!permissionPromise) {
    permissionPromise = (async () => {
      try {
        await notifee.requestPermission();
      } catch (error) {
        console.warn('Notifee permission request failed', error);
      }

      try {
        await messaging().registerDeviceForRemoteMessages();
      } catch (error) {
        console.warn('Failed to register for remote messages', error);
      }

      try {
        const status = await messaging().hasPermission();
        if (
          status === messaging.AuthorizationStatus.DENIED ||
          status === messaging.AuthorizationStatus.NOT_DETERMINED
        ) {
          await messaging().requestPermission();
        }
      } catch (error) {
        console.warn('Unable to verify messaging permission', error);
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

const ensureReady = async () => {
  await ensurePermissions();
  await ensureChannel();
};

export const initializeNotificationPipeline = async () => {
  await ensureReady();
  await notifee.setNotificationCategories([
    {
      id: 'attendance',
      actions: [
        { id: 'mark-presence', title: 'Mark Presence' },
        { id: 'refresh-location', title: 'Refresh GPS' },
        { id: 'open-manual-card', title: 'Manual Pin' },
        { id: 'refresh-network', title: 'Retry Connection' },
        { id: 'open-report', title: 'Open Report', foreground: true },
        { id: 'open-settings', title: 'Settings', foreground: true },
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
  JSON.stringify({ title: payload.title, body: payload.body });

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
      pressAction: { id: 'open-app' },
      style: { type: AndroidStyle.BIGTEXT, text: payload.body },
      importance: AndroidImportance.HIGH,
      actions: payload.actions?.map(action => ({
        title: action.label,
        pressAction: { id: action.id },
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
    await displayAttendanceNotification(NotificationKey.Offline, {
      title: 'You are offline',
      body: 'Reconnect to sync attendance, logs, and expenses.',
      actions: [{ id: 'refresh-network', label: 'Retry' }],
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
        { id: 'open-settings', label: 'Settings' },
        { id: 'refresh-location', label: 'Retry' },
      ],
    });
  } else {
    await dismissAttendanceNotification(NotificationKey.LocationPermission);
  }

  const showOutside = snapshot.locationStatus === 'outside';
  if (showOutside) {
    await displayAttendanceNotification(NotificationKey.OutsideRadius, {
      title: 'Outside mapped location',
      body: 'Move within the geofence or add a manual pin for today.',
      actions: [
        { id: 'open-manual-card', label: 'Add Manual Pin' },
        { id: 'refresh-location', label: 'Refresh GPS' },
      ],
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
      actions: [{ id: 'mark-presence', label: 'Mark Now' }],
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
      actions: [{ id: 'open-report', label: 'Open Report' }],
    });
  } else {
    await dismissAttendanceNotification(NotificationKey.ShiftWrap);
  }
};

export const handleIncomingRemoteMessage = async (
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
) => {
  await ensureReady();
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
      pressAction: { id: 'open-app' },
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
  const { type, detail } = event;
  if (type === EventType.ACTION_PRESS) {
    await processNotificationAction(
      detail.pressAction?.id,
      detail.notification,
    );
  }
  if (type === EventType.DISMISSED && detail.notification?.id) {
    await dismissAttendanceNotification(detail.notification.id);
  }
};

const handleNotifeeForegroundEvent = async (event: Event) => {
  const { type, detail } = event;
  if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
    await processNotificationAction(
      detail.pressAction?.id,
      detail.notification,
    );
  }
  if (type === EventType.DISMISSED && detail.notification?.id) {
    await dismissAttendanceNotification(detail.notification.id);
  }
};
