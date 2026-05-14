import {createNavigationContainerRef} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RootStackParamList} from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
const PENDING_ATTENDANCE_TRAVEL_NAVIGATION_KEY =
 'pending_attendance_travel_navigation';

let lastAttendanceTravelNavigationAt = 0;
let pendingAttendanceTravelNavigation = false;

export const requestAttendanceTravelNotificationNavigation = async () => {
 pendingAttendanceTravelNavigation = true;
 try {
  await AsyncStorage.setItem(PENDING_ATTENDANCE_TRAVEL_NAVIGATION_KEY, 'true');
 } catch (error) {
  console.warn('Unable to persist pending notification navigation', error);
 }
};

export const navigateToAttendanceTravelFromNotification = async () => {
 const now = Date.now();
 if (now - lastAttendanceTravelNavigationAt < 1500) {
  return;
 }
 lastAttendanceTravelNavigationAt = now;

 if (navigationRef.isReady()) {
  pendingAttendanceTravelNavigation = false;
  try {
   await AsyncStorage.removeItem(PENDING_ATTENDANCE_TRAVEL_NAVIGATION_KEY);
  } catch (error) {
   console.warn('Unable to clear pending notification navigation', error);
  }
  navigationRef.navigate('AttendanceTravel');
 } else {
  await requestAttendanceTravelNotificationNavigation();
 }
};

export const flushPendingNotificationNavigation = async () => {
 let hasPersistedPendingNavigation = false;
 try {
  hasPersistedPendingNavigation =
   (await AsyncStorage.getItem(PENDING_ATTENDANCE_TRAVEL_NAVIGATION_KEY)) ===
   'true';
 } catch (error) {
  console.warn('Unable to read pending notification navigation', error);
 }

 if (
  (!pendingAttendanceTravelNavigation && !hasPersistedPendingNavigation) ||
  !navigationRef.isReady()
 ) {
  return;
 }

 pendingAttendanceTravelNavigation = false;
 try {
  await AsyncStorage.removeItem(PENDING_ATTENDANCE_TRAVEL_NAVIGATION_KEY);
 } catch (error) {
  console.warn('Unable to clear pending notification navigation', error);
 }
 navigationRef.navigate('AttendanceTravel');
};
