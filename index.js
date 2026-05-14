/**
 * @format
 */

import 'react-native-gesture-handler';
import 'react-native-reanimated';
import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';
import {
 handleIncomingRemoteMessage,
 handleNotifeeBackgroundEvent,
} from './src/services/notificationService';

// FCM background delivery: single handler. @react-native-firebase/messaging already
// registers AppRegistry headless task "ReactNativeFirebaseMessagingHeadlessTask"
// internally — do NOT register a second task name (stale RNFirebaseBackgroundMessage
// duplicates were never invoked by native and added noise during startup).
messaging().setBackgroundMessageHandler(async remoteMessage => {
 console.log('setBackgroundMessageHandler invoked', remoteMessage?.messageId);
 return handleIncomingRemoteMessage(remoteMessage);
});
notifee.onBackgroundEvent(handleNotifeeBackgroundEvent);

AppRegistry.registerComponent(appName, () => App);
