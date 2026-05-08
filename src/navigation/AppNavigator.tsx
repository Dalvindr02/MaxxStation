import React, {useMemo} from 'react';
import {
 DarkTheme as NavigationDarkTheme,
 DefaultTheme as NavigationDefaultTheme,
 NavigationContainer,
} from '@react-navigation/native';
import {
 BottomTabBarProps,
 createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {enableScreens} from 'react-native-screens';
import {useAppTheme} from '../context/ThemeContext';
import {CustomTabBar} from '../components/CustomTabBar';
import AttendanceScreen from '../screens/AttendanceScreen';
import AttendanceHistoryScreen from '../screens/AttendanceHistoryScreen';
import AttendanceTravelScreen from '../screens/AttendanceTravelScreen';
import {TravelLogListScreen} from '../screens/TravelLogListScreen';
import {ExpensesScreen, ExpenseEntry} from '../screens/ExpensesScreen';
import {ExpenseListScreen} from '../screens/ExpenseListScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import {LogsScreen} from '../screens/LogsScreen';
import {ProfileScreen} from '../screens/ProfileScreen';
import {ReportScreen} from '../screens/ReportScreen';
import LogsHistoryScreen from '../screens/LogHistoryScreen';
import {LogDetailScreen} from '../screens/LogDetailScreen';
import {TravelLogDetailScreen} from '../screens/TravelLogDetailScreen';
import {ReportListScreen} from '../screens/ReportListScreen';
import {ReportDetailScreen} from '../screens/ReportDetailScreen';
import {useAppSelector} from '../store/hooks';
import {RootStackParamList} from './types';

enableScreens();

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();
type ExpenseStackParamList = {
 Expenses: undefined;
 ExpenseList: undefined;
 ExpenseDetail: {expense?: ExpenseEntry} | undefined;
 ReportScreen: undefined;
};
type LogStackParamList = {
 LogsHome: undefined;
 ReportScreen: undefined;
 LogsHistoryScreen: {date?: string} | undefined;
 LogDetailScreen: {log: any} | undefined;
};
const ExpenseStack = createNativeStackNavigator<ExpenseStackParamList>();
const LogStack = createNativeStackNavigator<LogStackParamList>();

const TabNavigator = () => {
 const {theme} = useAppTheme();
 const renderTabBar = (props: BottomTabBarProps) => (
  <CustomTabBar {...props} theme={theme} />
 );

 return (
  <Tabs.Navigator
   tabBar={renderTabBar}
   screenOptions={{
    headerShown: false,
   }}>
   <Tabs.Screen name="Home" component={HomeScreen} />
   <Tabs.Screen name="Attendance" component={AttendanceScreen} />
   <Tabs.Screen name="Logs" component={LogNavigator} />
   <Tabs.Screen
    name="Expenses"
    component={ExpenseNavigator}
    // listeners={{
    //   tabPress: e => {
    //     e.preventDefault();
    //   },
    // }}
   />
   <Tabs.Screen
    name="Profile"
    component={ProfileScreen}
    // listeners={{
    //   tabPress: e => {
    //     e.preventDefault();
    //   },
    // }}
   />
  </Tabs.Navigator>
 );
};
const ExpenseNavigator = () => {
 return (
  <ExpenseStack.Navigator
   screenOptions={{
    headerShown: false,
    gestureEnabled: true,
   }}>
   <ExpenseStack.Screen name="Expenses" component={ExpensesScreen} />
   <ExpenseStack.Screen name="ExpenseList" component={ExpenseListScreen} />
   <ExpenseStack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
   <ExpenseStack.Screen name="ReportScreen" component={ReportScreen} />
  </ExpenseStack.Navigator>
 );
};
const LogNavigator = () => {
 return (
  <LogStack.Navigator
   screenOptions={{
    headerShown: false,
    gestureEnabled: true,
   }}>
   <LogStack.Screen name="LogsHome" component={LogsScreen} />
   <LogStack.Screen name="ReportScreen" component={ReportScreen} />
   <LogStack.Screen name="LogsHistoryScreen" component={LogsHistoryScreen} />
   <LogStack.Screen name="LogDetailScreen" component={LogDetailScreen} />
  </LogStack.Navigator>
 );
};
export const AppNavigator = () => {
 const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
 const {theme, resolvedThemeMode} = useAppTheme();

 const navigationTheme = useMemo(
  () => ({
   ...(resolvedThemeMode === 'dark'
    ? NavigationDarkTheme
    : NavigationDefaultTheme),
   colors: {
    ...(resolvedThemeMode === 'dark'
     ? NavigationDarkTheme.colors
     : NavigationDefaultTheme.colors),
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.card,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.danger,
   },
  }),
  [resolvedThemeMode, theme],
 );

 return (
  <NavigationContainer theme={navigationTheme}>
   <Stack.Navigator screenOptions={{headerShown: false}}>
    {!isAuthenticated ? (
     <Stack.Group navigationKey="auth-flow">
      <Stack.Screen name="Auth" component={LoginScreen} />
     </Stack.Group>
    ) : (
     <Stack.Group navigationKey="app-flow">
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
       name="Report"
       component={ReportScreen}
       options={{presentation: 'modal'}}
      />
      <Stack.Screen
       name="AttendanceHistory"
       component={AttendanceHistoryScreen}
       options={{
        presentation: 'modal',
        animation: 'slide_from_right',
       }}
      />
      <Stack.Screen
       name="AttendanceTravel"
       component={AttendanceTravelScreen}
       options={{
        presentation: 'modal',
        animation: 'slide_from_right',
       }}
      />
      <Stack.Screen
       name="TravelLogs"
       component={TravelLogListScreen}
       options={{
        presentation: 'modal',
        animation: 'slide_from_right',
       }}
      />
      <Stack.Screen
       name="TravelLogDetail"
       component={TravelLogDetailScreen}
       options={{
        presentation: 'modal',
        animation: 'slide_from_right',
       }}
      />
      <Stack.Screen
       name="ReportList"
       component={ReportListScreen}
       options={{
        presentation: 'modal',
        animation: 'slide_from_right',
       }}
      />
      <Stack.Screen
       name="ReportDetail"
       component={ReportDetailScreen}
       options={{
        presentation: 'modal',
        animation: 'slide_from_right',
       }}
      />
     </Stack.Group>
    )}
   </Stack.Navigator>
  </NavigationContainer>
 );
};
