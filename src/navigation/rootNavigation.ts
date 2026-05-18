import {createNavigationContainerRef} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RootStackParamList} from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
const PENDING_ATTENDANCE_TRAVEL_NAVIGATION_KEY =
 'pending_attendance_travel_navigation';
const PENDING_BILLABLE_TRAVEL_NAVIGATION_KEY =
 'pending_billable_travel_navigation';

let lastAttendanceTravelNavigationAt = 0;
let pendingAttendanceTravelNavigation = false;
let lastBillableTravelNavigationAt = 0;
let pendingBillableTravelNavigation = false;

export const requestBillableTravelNotificationNavigation = async () => {
 pendingBillableTravelNavigation = true;
 try {
  await AsyncStorage.setItem(PENDING_BILLABLE_TRAVEL_NAVIGATION_KEY, 'true');
 } catch (error) {
  console.warn('Unable to persist pending billable navigation', error);
 }
};

export const navigateToBillableTravelFromNotification = async () => {
 const now = Date.now();
 if (now - lastBillableTravelNavigationAt < 1500) {
  return;
 }
 lastBillableTravelNavigationAt = now;

 if (navigationRef.isReady()) {
  pendingBillableTravelNavigation = false;
  try {
   await AsyncStorage.removeItem(PENDING_BILLABLE_TRAVEL_NAVIGATION_KEY);
  } catch (error) {
   console.warn('Unable to clear pending billable navigation', error);
  }
  navigationRef.navigate('BillableTravel');
 } else {
  await requestBillableTravelNotificationNavigation();
 }
};

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
 let hasPersistedPendingBillableNavigation = false;
 try {
  hasPersistedPendingNavigation =
   (await AsyncStorage.getItem(PENDING_ATTENDANCE_TRAVEL_NAVIGATION_KEY)) ===
   'true';
  hasPersistedPendingBillableNavigation =
   (await AsyncStorage.getItem(PENDING_BILLABLE_TRAVEL_NAVIGATION_KEY)) ===
   'true';
 } catch (error) {
  console.warn('Unable to read pending notification navigation', error);
 }

 if (
  (pendingBillableTravelNavigation || hasPersistedPendingBillableNavigation) &&
  navigationRef.isReady()
 ) {
  pendingBillableTravelNavigation = false;
  try {
   await AsyncStorage.removeItem(PENDING_BILLABLE_TRAVEL_NAVIGATION_KEY);
  } catch (error) {
   console.warn('Unable to clear pending billable navigation', error);
  }
  navigationRef.navigate('BillableTravel');
  return;
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
