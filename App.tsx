import React from 'react';
import {Platform, StatusBar, Text, TextInput} from 'react-native';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from './src/navigation/AppNavigator';
import {ThemeProvider, useAppTheme} from './src/context/ThemeContext';
import {LiveTrackingSplash} from './src/components/LiveTrackingSplash';
import {LogsProvider} from './src/context/LogsContext';
import {DialogProvider} from './src/context/DialogContext';
import {AttendanceProvider} from './src/context/AttendanceContext';
import {initializeNotificationPipeline} from './src/services/notificationService';
import {useAppSelector} from './src/store/hooks';
import {persistor, store} from './src/store/store';

const DEFAULT_FONT_FAMILY =
 Platform.OS === 'ios' || Platform.OS === 'android'
  ? 'Montserrat-Regular'
  : undefined;

if (DEFAULT_FONT_FAMILY) {
 const withDefaultFont = (style: unknown) => {
  if (Array.isArray(style)) {
   return [{fontFamily: DEFAULT_FONT_FAMILY}, ...style];
  }
  return style
   ? [{fontFamily: DEFAULT_FONT_FAMILY}, style]
   : [{fontFamily: DEFAULT_FONT_FAMILY}];
 };

 const NativeText = Text as any;
 const NativeTextInput = TextInput as any;

 NativeText.defaultProps = NativeText.defaultProps || {};
 NativeText.defaultProps.style = withDefaultFont(NativeText.defaultProps.style);
 NativeText.defaultProps.allowFontScaling = false;

 NativeTextInput.defaultProps = NativeTextInput.defaultProps || {};
 NativeTextInput.defaultProps.style = withDefaultFont(
  NativeTextInput.defaultProps.style,
 );
 NativeTextInput.defaultProps.allowFontScaling = false;
}

const AppShell = () => {
 const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
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

 return <AppNavigator key={isAuthenticated ? 'app-flow' : 'auth-flow'} />;
};

const AppContent = () => {
 const {resolvedThemeMode, theme} = useAppTheme();
 React.useEffect(() => {
  initializeNotificationPipeline().catch(error =>
   console.warn('Notification init failed', error),
  );
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
// the credential will available in email with app store or playstore , and then user will change password after login first in app.
// way point creation for track (stops of user)
// way point automaitically if user want creation acccording to set time by user (10 min, 20 min, 30 min, 40 min, 50 min, 60 min) then calculate the total price of way of oout
