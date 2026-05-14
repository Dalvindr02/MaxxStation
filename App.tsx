import React from 'react';
import {Provider} from 'react-redux';
import {StatusBar, AppState} from 'react-native';
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
  syncEssentialLocalNotifications,
} from './src/services/notificationService';
import {persistor, store} from './src/store/store';

// ---------------------------------------------------------------------------
// Module-level singleton guards
//
// These flags live in the JS module scope — they are reset only when the JS
// bundle is fully reloaded (app killed), NOT on component re-mounts or
// background/foreground transitions.
//
// This prevents duplicate initialization of heavy native services when React
// re-renders AppContent (e.g. during PersistGate rehydration cycles).
// ---------------------------------------------------------------------------

let notificationPipelineInitialized = false;

// ---------------------------------------------------------------------------
// AppContent
//
// IMPORTANT — the old AppShell component with a 10-second setTimeout has been
// REMOVED. That timer was the primary cause of global crashes on background
// resume:
//
//   1. OS kills the JS thread under memory pressure
//   2. User brings app to foreground → JS restarts fresh
//   3. AppShell.minSplashElapsed = false → AppNavigator is NOT rendered
//   4. Background geolocation / notification callbacks try to call into the
//      now-destroyed navigator tree → native crash
//
// PersistGate already shows <LiveTrackingSplash /> while redux-persist
// rehydrates (< 1 second on device). AppNavigator is rendered immediately
// after rehydration completes with no artificial delay.
// ---------------------------------------------------------------------------

const AppContent = () => {
  const {theme} = useAppTheme();

  // ------------------------------------------------------------------
  // Global AppState monitor — single subscription at the root level.
  // Screens should NOT add their own AppState listeners unless they
  // need screen-specific logic. A global listener here gives full
  // visibility into background/foreground transitions for debugging.
  // ------------------------------------------------------------------
  const appStateRef = React.useRef(AppState.currentState);
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const prev = appStateRef.current;
      appStateRef.current = nextAppState;
      console.log(`[App] AppState: ${prev} → ${nextAppState}`);
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // ------------------------------------------------------------------
  // Notification pipeline — initialized EXACTLY ONCE per JS process.
  // The module-level flag ensures re-renders of AppContent (e.g. during
  // PersistGate rehydration) never trigger a second initialization.
  // A second call to initializeNotificationPipeline tears down and
  // re-attaches all FCM/Notifee listeners, creating duplicate handlers
  // that fire twice per notification event.
  // ------------------------------------------------------------------
  React.useEffect(() => {
    if (!notificationPipelineInitialized) {
      notificationPipelineInitialized = true;
      initializeNotificationPipeline().catch(error =>
        console.warn('[App] Notification pipeline init failed', error),
      );
    }
  }, []);

  // ------------------------------------------------------------------
  // Network status — sync essential local notifications when connectivity
  // changes. The unsubscribe return value is used as the cleanup function.
  // ------------------------------------------------------------------
  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isOnline =
        Boolean(state.isConnected) && state.isInternetReachable !== false;
      syncEssentialLocalNotifications({offline: !isOnline}).catch(error =>
        console.warn('[App] Network notification sync failed', error),
      );
    });

    // Trigger an immediate sync on mount so the notification tray is
    // accurate before the first NetInfo change event fires.
    NetInfo.fetch()
      .then(state => {
        const isOnline =
          Boolean(state.isConnected) && state.isInternetReachable !== false;
        return syncEssentialLocalNotifications({offline: !isOnline});
      })
      .catch(error =>
        console.warn('[App] Initial network sync failed', error),
      );

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
            {/* AppNavigator is rendered immediately — no artificial delay. */}
            <AppNavigator />
          </DialogProvider>
        </LogsProvider>
      </AttendanceProvider>
    </>
  );
};

// ---------------------------------------------------------------------------
// Root App component
//
// Render order:
//  SafeAreaProvider
//   └─ Redux Provider
//       └─ ThemeProvider
//           └─ PersistGate  ← shows LiveTrackingSplash while rehydrating
//               └─ AppContent  ← AppNavigator rendered immediately after
// ---------------------------------------------------------------------------

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
