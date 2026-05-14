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

messaging().setBackgroundMessageHandler(async remoteMessage => {
 console.log('setBackgroundMessageHandler invoked', remoteMessage?.messageId);
 return handleIncomingRemoteMessage(remoteMessage);
});
notifee.onBackgroundEvent(handleNotifeeBackgroundEvent);
AppRegistry.registerHeadlessTask(
 'RNFirebaseBackgroundMessage',
 () => async remoteMessage => {
  console.log(
   'RNFirebaseBackgroundMessage headless task invoked',
   remoteMessage?.messageId,
  );
  return handleIncomingRemoteMessage(remoteMessage);
 },
);

AppRegistry.registerComponent(appName, () => App);
