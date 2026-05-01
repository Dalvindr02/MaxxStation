import React from 'react';
import {Provider} from 'react-redux';
import {StatusBar} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {PersistGate} from 'redux-persist/integration/react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from './src/navigation/AppNavigator';
import {ThemeProvider, useAppTheme} from './src/context/ThemeContext';
import {LiveTrackingSplash} from './src/components/LiveTrackingSplash';
import {LogsProvider} from './src/context/LogsContext';
import {DialogProvider} from './src/context/DialogContext';
import {AttendanceProvider} from './src/context/AttendanceContext';
import {
 initializeNotificationPipeline,
 restoreShiftNotificationSchedulesFromStorage,
 syncShiftActionNotifications,
 syncShiftNotificationSchedule,
} from './src/services/notificationService';
import {useAppSelector} from './src/store/hooks';
import {persistor, store} from './src/store/store';

const AppShell = () => {
 const [minSplashElapsed, setMinSplashElapsed] = React.useState(false);

 React.useEffect(() => {
  const timer = setTimeout(() => {
   setMinSplashElapsed(true);
  }, 10000);
  return () => clearTimeout(timer);
 }, []);

 if (!minSplashElapsed) {
  return <LiveTrackingSplash />;
 }

 return <AppNavigator />;
};

const AppContent = () => {
 const {theme} = useAppTheme();
 const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
 const loginData = useAppSelector(state => state.auth.loginData);
 const user = useAppSelector(state => state.auth.user);

 React.useEffect(() => {
  initializeNotificationPipeline().catch(error =>
   console.warn('Notification init failed', error),
  );
  restoreShiftNotificationSchedulesFromStorage().catch(error =>
   console.warn('Shift notification restore failed', error),
  );
 }, []);

 React.useEffect(() => {
  syncShiftNotificationSchedule({
   isAuthenticated,
   loginData,
   user,
  }).catch(error =>
   console.warn('Shift notification scheduling failed', error),
  );
 }, [isAuthenticated, loginData, user]);

 React.useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
   const isOnline =
    Boolean(state.isConnected) && state.isInternetReachable !== false;
   syncShiftActionNotifications({isOnline}).catch(error =>
    console.warn('Shift network notification sync failed', error),
   );
  });

  NetInfo.fetch()
   .then(state => {
    const isOnline =
     Boolean(state.isConnected) && state.isInternetReachable !== false;
    return syncShiftActionNotifications({isOnline});
   })
   .catch(error => console.warn('Initial network sync failed', error));

  return unsubscribe;
 }, []);

 return (
  <>
   <StatusBar
    barStyle="light-content"
    backgroundColor={theme.colors.background}
   />
   <AttendanceProvider>
    <LogsProvider>
     <DialogProvider>
      <AppShell />
     </DialogProvider>
    </LogsProvider>
   </AttendanceProvider>
  </>
 );
};

function App() {
 return (
  <SafeAreaProvider>
   <Provider store={store}>
    <ThemeProvider>
     <PersistGate loading={<LiveTrackingSplash />} persistor={persistor}>
      <AppContent />
     </PersistGate>
    </ThemeProvider>
   </Provider>
  </SafeAreaProvider>
 );
}

export default App;

// the app should be available with email invite link after signup the user on web,
// the credential will available in email with app store or playstore link , and then user will change password after login first time enter in app.
// way point creation for track (stops of user)
// way point automaitically if user want creation according to set time by user (10 min, 20 min, 30 min, 40 min, 50 min, 60 min) then calculate the total price of way of out
