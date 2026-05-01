import React, {useEffect, useMemo, useState} from 'react';
import {
 ScrollView,
 StyleSheet,
 Text,
 TouchableOpacity,
 View,
 Platform,
 RefreshControl,
 Linking,
 ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import {check, PERMISSIONS} from 'react-native-permissions';
import {AnimatedCard} from '../components/ui';
import {TopHeader} from '../components/TopHeader';
import {useAppTheme} from '../context/ThemeContext';
import {AppTheme} from '../theme';
import LinearGradient from 'react-native-linear-gradient';
import {useDialog} from '../context/DialogContext';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {logout} from '../store/authSlice';
import {moderateScale} from 'react-native-size-matters';
import {logoutRequest} from '../services/authService';

export const ProfileScreen = () => {
 const dispatch = useAppDispatch();
 const navigation = useNavigation();
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const {showDialog} = useDialog();

 // Get user data from Redux
 const authUser = useAppSelector(state => state.auth.user);
 const loginData = useAppSelector(state => state.auth.loginData);
 const token = useAppSelector(state => state.auth.token);

 const [battery, setBattery] = useState(0);
 const [network, setNetwork] = useState('Checking...');
 const [gpsEnabled, setGpsEnabled] = useState(false);
 const [_appVersion, setAppVersion] = useState('');
 const [_lastSync, setLastSync] = useState('');
 const [refreshing, setRefreshing] = useState(false);
 const [isLoggingOut, setIsLoggingOut] = useState(false);

 const loadDeviceInfo = async () => {
  try {
   DeviceInfo.getAvailableLocationProviders().then(providers => {
    setGpsEnabled(Boolean(providers?.gps));
   });
   const level = await DeviceInfo.getBatteryLevel();
   const percent = Math.round(level * 100);
   setBattery(percent);

   if (percent < 15) {
    showDialog({
     title: 'Low Battery',
     message: 'Battery below 15%. Tracking may stop in background.',
     variant: 'error',
     primaryAction: {label: 'Okay'},
    });
   }

   setAppVersion(DeviceInfo.getVersion());
   setLastSync(new Date().toLocaleTimeString());

   const permission =
    Platform.OS === 'ios'
     ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
     : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

   const result = await check(permission);
   if (result !== 'granted') {
    setGpsEnabled(false);
   }
  } catch (e) {
   console.log(e);
  }
 };

 useEffect(() => {
  loadDeviceInfo();

  const unsubscribeNet = NetInfo.addEventListener(state => {
   if (state.type === 'cellular') {
    setNetwork(state.details?.cellularGeneration?.toUpperCase() || 'Cellular');
   } else {
    setNetwork(state.type.toUpperCase());
   }
  });

  return () => {
   unsubscribeNet();
  };
 }, []);

 const onRefresh = async () => {
  setRefreshing(true);
  await loadDeviceInfo();
  setRefreshing(false);
 };

 const getBatteryColor = () => {
  if (battery > 50) return theme.colors.success;
  if (battery > 20) return '#F4B400';
  return theme.colors.error;
 };

 const handleSignOut = async () => {
  if (!token) {
   showDialog({
    title: 'Error',
    message: 'No auth token found. Unable to logout.',
    variant: 'error',
    primaryAction: {label: 'Okay'},
   });
   return;
  }

  setIsLoggingOut(true);

  try {
   const result = await logoutRequest(token);

   if (result.success) {
    showDialog({
     title: 'Logged Out',
     message: result.message || 'You have been logged out successfully.',
     variant: 'success',
     // Prevent accidental backdrop tap during the navigation transition
     dismissOnBackdrop: false,
     primaryAction: {
      label: 'Okay',
      onPress: () => {
       // Delay dispatch so the Modal fully closes before navigation
       // switches to LoginScreen. Without this, iOS crashes because
       // the navigation tree is torn down while the Modal is still mounted.
       setTimeout(() => {
        dispatch(logout());
       }, 400);
      },
     },
    });
   } else {
    showDialog({
     title: 'Logout Failed',
     message: result.message || 'Unable to logout. Please try again.',
     variant: 'error',
     primaryAction: {label: 'Try Again'},
    });
   }
  } catch (error) {
   console.error('Error logging out:', error);
   // Even if the API call fails, let the user force-logout locally
   showDialog({
    title: 'Network Error',
    message:
     'Could not reach the server. You can force-logout from this device.',
    variant: 'warning',
    dismissOnBackdrop: false,
    primaryAction: {
     label: 'Force Logout',
     onPress: () => {
      setTimeout(() => {
       dispatch(logout());
      }, 400);
     },
    },
    secondaryAction: {label: 'Cancel'},
   });
  } finally {
   setIsLoggingOut(false);
  }
 };

 // Helper to extract user info from Redux
 const getUserName = (): string => {
  if (!authUser) return 'Quick User';

  const name =
   (typeof authUser.name === 'string' && authUser.name) ||
   (typeof authUser.full_name === 'string' && authUser.full_name) ||
   (typeof authUser.firstName === 'string' &&
   authUser.firstName &&
   typeof authUser.lastName === 'string' &&
   authUser.lastName
    ? `${authUser.firstName} ${authUser.lastName}`
    : null) ||
   (typeof authUser.email === 'string' && authUser.email
    ? authUser.email.split('@')[0]
    : null);

  return name || 'Quick User';
 };

 const getAvatarInitials = (): string => {
  const name = getUserName();
  return name
   .split(' ')
   .map(word => word[0])
   .join('')
   .toUpperCase()
   .slice(0, 2);
 };

 const getUserRole = (): string => {
  if (!authUser) return 'Employee';

  return (
   (typeof authUser.role === 'string' && authUser.role) ||
   (typeof authUser.position === 'string' && authUser.position) ||
   (typeof authUser.designation === 'string' && authUser.designation) ||
   'Employee'
  );
 };

 const getUserEmail = (): string => {
  if (!authUser) return 'user@example.com';
  return (
   (typeof authUser.email === 'string' && authUser.email) || 'user@example.com'
  );
 };

 const getUserId = (): string => {
  if (!authUser) return 'N/A';

  return (
   (typeof authUser.id === 'string' && authUser.id) ||
   (typeof authUser.user_id === 'string' && authUser.user_id) ||
   (typeof authUser.employee_id === 'string' && authUser.employee_id) ||
   'N/A'
  );
 };

 const getShiftTiming = (): {start: string; end: string} => {
  if (!loginData) return {start: '09:00 AM', end: '06:00 PM'};

  const start =
   (typeof loginData.shift_start === 'string' && loginData.shift_start) ||
   (typeof loginData.startTime === 'string' && loginData.startTime) ||
   '09:00 AM';

  const end =
   (typeof loginData.shift_end === 'string' && loginData.shift_end) ||
   (typeof loginData.endTime === 'string' && loginData.endTime) ||
   '06:00 PM';

  return {start, end};
 };

 const getShiftType = (): string => {
  if (!loginData) return 'Regular Corporate';

  return (
   (typeof loginData.shift_type === 'string' && loginData.shift_type) ||
   (typeof loginData.shiftType === 'string' && loginData.shiftType) ||
   (typeof loginData.shift === 'string' && loginData.shift) ||
   'Regular Corporate'
  );
 };

 const getDepartment = (): string => {
  if (!loginData) return 'Operations';

  return (
   (typeof loginData.department === 'string' && loginData.department) ||
   (typeof loginData.department_name === 'string' &&
    loginData.department_name) ||
   (typeof loginData.dept === 'string' && loginData.dept) ||
   (typeof loginData.designationName === 'string' &&
    loginData.designationName) ||
   'Operations'
  );
 };

 const getPhone = (): string => {
  if (!loginData) return '+1 (555) 123-4567';

  return (
   (typeof loginData.phone === 'string' && loginData.phone) ||
   (typeof loginData.phone_number === 'string' && loginData.phone_number) ||
   (typeof loginData.contact_number === 'string' && loginData.contact_number) ||
   (typeof loginData.mobile === 'string' && loginData.mobile) ||
   (typeof authUser?.phone === 'string' && authUser.phone) ||
   '+1 (555) 123-4567'
  );
 };

 const getWorkLocation = (): string => {
  if (!loginData) return 'San Francisco, CA';

  return (
   (typeof loginData.work_location === 'string' && loginData.work_location) ||
   (typeof loginData.location === 'string' && loginData.location) ||
   (typeof loginData.office_location === 'string' &&
    loginData.office_location) ||
   (typeof loginData.city === 'string' && loginData.city) ||
   (typeof loginData.address === 'string' && loginData.address) ||
   'San Francisco, CA'
  );
 };

 const getAttendanceData = (): {present: string; percentage: string} => {
  if (!loginData) return {present: '22/23', percentage: '95.6%'};

  const present =
   (typeof loginData.attendance === 'string' && loginData.attendance) ||
   (typeof loginData.present_days === 'string' && loginData.present_days) ||
   (typeof loginData.attendance_count === 'string' &&
    loginData.attendance_count) ||
   '22/23';

  const percentage =
   (typeof loginData.attendance_percentage === 'string' &&
    loginData.attendance_percentage) ||
   (typeof loginData.present_percentage === 'string' &&
    loginData.present_percentage) ||
   '95.6%';

  return {present, percentage};
 };

 const getHoursLogged = (): {hours: string; overtime: string} => {
  if (!loginData) return {hours: '176.5h', overtime: '+8.5h'};

  const hours =
   (typeof loginData.hours_logged === 'string' && loginData.hours_logged) ||
   (typeof loginData.total_hours === 'string' && loginData.total_hours) ||
   (typeof loginData.working_hours === 'string' && loginData.working_hours) ||
   '176.5h';

  const overtime =
   (typeof loginData.overtime_hours === 'string' && loginData.overtime_hours) ||
   (typeof loginData.extra_hours === 'string' && loginData.extra_hours) ||
   '+8.5h';

  return {hours, overtime};
 };

 const getLogsCreated = (): {count: string; status: string} => {
  if (!loginData) return {count: '48', status: 'All verified'};

  const count =
   (typeof loginData.logs_count === 'string' && loginData.logs_count) ||
   (typeof loginData.total_logs === 'string' && loginData.total_logs) ||
   (typeof loginData.log_entries === 'string' && loginData.log_entries) ||
   '48';

  const status =
   (typeof loginData.logs_status === 'string' && loginData.logs_status) ||
   (typeof loginData.verification_status === 'string' &&
    loginData.verification_status) ||
   'All verified';

  return {count, status};
 };

 const renderPolicy = (icon: string, title: string, meta: string) => (
  <View style={styles.policyRow}>
   <View style={styles.policyIcon}>
    <Feather name={icon} size={14} color={theme.colors.primary} />
   </View>
   <View style={styles.policyContent}>
    <Text allowFontScaling={false} style={styles.policyTitle}>
     {title}
    </Text>
    <Text allowFontScaling={false} style={styles.policyMeta}>
     {meta}
    </Text>
   </View>
  </View>
 );

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title="Profile" rightType="avatar" />

   <ScrollView
    showsVerticalScrollIndicator={false}
    refreshControl={
     <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    }>
    <AnimatedCard style={styles.profileCard}>
     <View style={styles.avatar}>
      <Text allowFontScaling={false} style={styles.avatarText}>
       {getAvatarInitials()}
      </Text>
      <View style={styles.onlineDot} />
     </View>

     <Text allowFontScaling={false} style={styles.profileName}>
      {getUserName()}
     </Text>
     <Text allowFontScaling={false} style={styles.profileMeta}>
      {getUserRole()} • {getUserEmail()}
     </Text>

     <View style={styles.dutyBadge}>
      <Text allowFontScaling={false} style={styles.dutyText}>
       ON-DUTY
      </Text>
     </View>

     <View style={styles.employeeStatusRow}>
      <View style={styles.statusItem}>
       <Text allowFontScaling={false} style={styles.statusLabel}>
        Employee ID
       </Text>
       <Text allowFontScaling={false} style={styles.statusValue}>
        {getUserId()}
       </Text>
      </View>
      <View style={[styles.statusItem, styles.statusDivider]}>
       <Text allowFontScaling={false} style={styles.statusLabel}>
        Department
       </Text>
       <Text allowFontScaling={false} style={styles.statusValue}>
        {getDepartment()}
       </Text>
      </View>
     </View>
    </AnimatedCard>

    <AnimatedCard style={styles.infoCard}>
     <Text allowFontScaling={false} style={styles.cardTitle}>
      Monthly Statistics
     </Text>
     <View style={styles.statsRow}>
      <View style={styles.statItem}>
       <View style={styles.statIconBox}>
        <Feather name="check-square" size={18} color={theme.colors.success} />
       </View>
       <Text allowFontScaling={false} style={styles.statLabel}>
        Attendance
       </Text>
       <Text allowFontScaling={false} style={styles.statValue}>
        {getAttendanceData().present}
       </Text>
       <Text allowFontScaling={false} style={styles.statMeta}>
        {getAttendanceData().percentage} present
       </Text>
      </View>

      <View style={styles.statItem}>
       <View style={styles.statIconBox}>
        <Feather name="clock" size={18} color={theme.colors.primary} />
       </View>
       <Text allowFontScaling={false} style={styles.statLabel}>
        Hours Logged
       </Text>
       <Text allowFontScaling={false} style={styles.statValue}>
        {getHoursLogged().hours}
       </Text>
       <Text allowFontScaling={false} style={styles.statMeta}>
        {getHoursLogged().overtime} overtime
       </Text>
      </View>

      <View style={styles.statItem}>
       <View style={styles.statIconBox}>
        <Feather name="file-text" size={18} color="#F4B400" />
       </View>
       <Text allowFontScaling={false} style={styles.statLabel}>
        Logs Created
       </Text>
       <Text allowFontScaling={false} style={styles.statValue}>
        {getLogsCreated().count}
       </Text>
       <Text allowFontScaling={false} style={styles.statMeta}>
        {getLogsCreated().status}
       </Text>
      </View>
     </View>
    </AnimatedCard>

    <AnimatedCard style={styles.infoCard}>
     <Text allowFontScaling={false} style={styles.cardTitle}>
      SHIFT DETAILS
     </Text>
     <View style={styles.infoRow}>
      <View>
       <Text allowFontScaling={false} style={styles.infoLabel}>
        Timing
       </Text>
       <Text allowFontScaling={false} style={styles.infoValue}>
        {getShiftTiming().start} - {getShiftTiming().end}
       </Text>
      </View>
      <View>
       <Text allowFontScaling={false} style={styles.infoLabel}>
        Shift Type
       </Text>
       <Text allowFontScaling={false} style={styles.infoValue}>
        {getShiftType()}
       </Text>
      </View>
     </View>
    </AnimatedCard>

    <AnimatedCard style={styles.infoCard}>
     <Text allowFontScaling={false} style={styles.cardTitle}>
      Account Information
     </Text>
     <View style={styles.accountRow}>
      <View style={styles.accountItem}>
       <View style={styles.accountIcon}>
        <Feather name="mail" size={16} color={theme.colors.primary} />
       </View>
       <View style={styles.accountContent}>
        <Text allowFontScaling={false} style={styles.accountLabel}>
         Email
        </Text>
        <Text allowFontScaling={false} style={styles.accountValue}>
         {getUserEmail()}
        </Text>
       </View>
      </View>

      <View style={styles.accountItem}>
       <View style={styles.accountIcon}>
        <Feather name="phone" size={16} color={theme.colors.primary} />
       </View>
       <View style={styles.accountContent}>
        <Text allowFontScaling={false} style={styles.accountLabel}>
         Phone
        </Text>
        <Text allowFontScaling={false} style={styles.accountValue}>
         {getPhone()}
        </Text>
       </View>
      </View>

      <View style={styles.accountItem}>
       <View style={styles.accountIcon}>
        <Feather name="map-pin" size={16} color={theme.colors.primary} />
       </View>
       <View style={styles.accountContent}>
        <Text allowFontScaling={false} style={styles.accountLabel}>
         Work Location
        </Text>
        <Text allowFontScaling={false} style={styles.accountValue}>
         {getWorkLocation()}
        </Text>
       </View>
      </View>
     </View>
    </AnimatedCard>

    {/* <AnimatedCard style={styles.infoCard}>
     <Text allowFontScaling={false} style={styles.cardTitle}>
      Organization Policies
     </Text>

     {renderPolicy('clock', 'Attendance Rules', '15m grace period')}
     {renderPolicy('credit-card', 'Expense Limits', '$500 / Month')}
     {renderPolicy('shield', 'Overtime Policy', 'Pre-approval required')}
    </AnimatedCard> */}

    {!gpsEnabled && (
     <View style={styles.warningBanner}>
      <Feather name="alert-triangle" size={14} color="#fff" />
      <Text allowFontScaling={false} style={styles.warningText}>
       GPS is disabled. Attendance may not work properly.
      </Text>
     </View>
    )}

    <AnimatedCard style={styles.infoCard}>
     <Text allowFontScaling={false} style={styles.cardTitle}>
      Device Health
     </Text>

     <View style={styles.healthRow}>
      <TouchableOpacity
       style={styles.healthItem}
       onPress={() => {
        if (!gpsEnabled) Linking.openSettings();
       }}>
       <Feather
        name="navigation"
        size={16}
        color={gpsEnabled ? theme.colors.success : theme.colors.error}
       />
       <Text allowFontScaling={false} style={styles.healthLabel}>
        GPS
       </Text>
       <Text allowFontScaling={false} style={styles.healthValue}>
        {gpsEnabled === true ? 'Enabled' : 'Disabled'}
       </Text>
      </TouchableOpacity>

      <View style={styles.healthItem}>
       <Feather name="wifi" size={16} color={theme.colors.primary} />
       <Text allowFontScaling={false} style={styles.healthLabel}>
        Network
       </Text>
       <Text allowFontScaling={false} style={styles.healthValue}>
        {network}
       </Text>
      </View>

      <View style={styles.healthItem}>
       <Feather name="battery" size={16} color={getBatteryColor()} />
       <Text allowFontScaling={false} style={styles.healthLabel}>
        Battery
       </Text>
       <Text
        allowFontScaling={false}
        style={[styles.healthValue, {color: getBatteryColor()}]}>
        {battery}%
       </Text>
      </View>
     </View>
    </AnimatedCard>

    <TouchableOpacity
     activeOpacity={0.9}
     style={styles.reportsButton}
     onPress={() => navigation.navigate('ReportList' as never)}>
     <LinearGradient
      colors={theme.gradients.button}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.reportsGradient}>
      <View style={styles.reportsInner}>
       <View style={styles.reportsIconWrap}>
        <Feather name="list" size={18} color="#FFFFFF" />
       </View>
       <View style={styles.reportsContent}>
        <Text allowFontScaling={false} style={styles.reportsText}>
         View Report History
        </Text>
        <Text allowFontScaling={false} style={styles.reportsMeta}>
         All your submitted reports
        </Text>
       </View>
       <View style={styles.reportsArrow}>
        <Feather name="arrow-up-right" size={16} color="#FFFFFF" />
       </View>
      </View>
     </LinearGradient>
    </TouchableOpacity>

    <TouchableOpacity
     activeOpacity={0.9}
     style={styles.signOutButton}
     disabled={isLoggingOut}
     onPress={handleSignOut}>
     <LinearGradient
      colors={
       theme.isDark
        ? ['rgba(255,106,136,0.96)', 'rgba(255,79,216,0.9)']
        : ['rgba(255,255,255,0.92)', 'rgba(255,236,242,0.98)']
      }
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.signOutGradient}>
      <View style={styles.signOutIconWrap}>
       {isLoggingOut ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
       ) : (
        <Feather name="log-out" size={18} color={theme.colors.primary} />
       )}
      </View>
      <View style={styles.signOutContent}>
       <Text allowFontScaling={false} style={styles.signOutText}>
        {isLoggingOut ? 'Signing Out...' : 'Sign Out from Workforce'}
       </Text>
       <Text allowFontScaling={false} style={styles.signOutMeta}>
        {isLoggingOut ? 'Please wait...' : 'End this session on this device'}
       </Text>
      </View>
      <View style={styles.signOutArrow}>
       <Feather name="arrow-up-right" size={16} color="#FFFFFF" />
      </View>
     </LinearGradient>
    </TouchableOpacity>

    <Text allowFontScaling={false} style={styles.footerNote}>
     Your location and activity logs are only tracked while on-duty.
    </Text>
   </ScrollView>
  </SafeAreaView>
 );
};

const createStyles = (theme: AppTheme) => {
 const glassCard = theme.colors.card;
 const glassSurface = theme.colors.surface;
 const borderColor = theme.colors.border;
 const muted = theme.colors.muted;

 return StyleSheet.create({
  safe: {
   flex: 1,
   backgroundColor: theme.colors.background,
   padding: 14,
  },
  backgroundGradient: {
   ...StyleSheet.absoluteFillObject,
   opacity: 0.9,
  },
  container: {
   padding: 18,
   paddingBottom: 40,
  },
  profileCard: {
   backgroundColor: glassCard,
   borderRadius: 20,
   borderWidth: 1,
   borderColor,
   padding: 18,
   alignItems: 'center',
   marginBottom: 16,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.3,
   shadowRadius: 16,
  },
  avatar: {
   width: 76,
   height: 76,
   borderRadius: 38,
   backgroundColor: 'rgba(95,203,255,0.14)',
   borderWidth: 1,
   borderColor: 'rgba(95,203,255,0.28)',
   alignItems: 'center',
   justifyContent: 'center',
   marginBottom: 12,
  },
  avatarText: {
   fontSize: 24,
   fontWeight: '800',
   color: theme.colors.text,
  },
  onlineDot: {
   position: 'absolute',
   right: 3,
   bottom: 5,
   width: 12,
   height: 12,
   borderRadius: 6,
   backgroundColor: theme.colors.success,
   borderWidth: 2,
   borderColor: glassCard,
  },
  profileName: {
   fontSize: 17,
   fontWeight: '700',
   color: theme.colors.text,
  },
  profileMeta: {
   marginTop: 4,
   color: muted,
   fontSize: 12,
   textAlign: 'center',
   lineHeight: 18,
   marginBottom: 8,
  },
  dutyBadge: {
   backgroundColor: 'rgba(93,255,169,0.18)',
   borderRadius: 999,
   paddingHorizontal: 10,
   paddingVertical: 4,
   borderWidth: 1,
   borderColor: 'rgba(93,255,169,0.3)',
  },
  dutyText: {
   color: theme.colors.success,
   fontSize: 11,
   fontWeight: '700',
  },
  infoCard: {
   backgroundColor: glassCard,
   borderRadius: 18,
   borderWidth: 1,
   borderColor,
   padding: 16,
   marginBottom: 14,
   shadowColor: theme.colors.glowStrong,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.22,
   shadowRadius: 12,
  },
  cardTitle: {
   color: theme.colors.text,
   fontWeight: '700',
   fontSize: 13,
   marginBottom: 10,
   textTransform: 'uppercase',
  },
  infoRow: {
   flexDirection: 'row',
   justifyContent: 'space-between',
  },
  infoLabel: {
   color: muted,
   fontSize: 12,
   marginBottom: 3,
  },
  infoValue: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '600',
  },
  warningBanner: {
   marginBottom: 14,
   backgroundColor: 'rgba(248,113,113,0.14)',
   borderRadius: 16,
   minHeight: 48,
   paddingHorizontal: 14,
   flexDirection: 'row',
   alignItems: 'center',
   gap: 10,
   borderWidth: 1,
   borderColor: 'rgba(248,113,113,0.4)',
  },
  warningText: {
   color: '#FFFFFF',
   fontSize: 12,
   flex: 1,
  },
  policyRow: {
   flexDirection: 'row',
   gap: 10,
   alignItems: 'center',
   marginBottom: 10,
  },
  policyIcon: {
   width: 36,
   height: 36,
   borderRadius: 10,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(95,203,255,0.12)',
   borderWidth: 1,
   borderColor: 'rgba(95,203,255,0.22)',
  },
  policyTitle: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '600',
  },
  policyContent: {
   flex: 1,
  },
  policyMeta: {
   color: muted,
   fontSize: 12,
   marginTop: 2,
  },
  healthRow: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   gap: 8,
  },
  healthItem: {
   flex: 1,
   borderWidth: 1,
   borderColor,
   borderRadius: 14,
   paddingVertical: 12,
   alignItems: 'center',
   backgroundColor: glassSurface,
  },
  healthLabel: {
   color: muted,
   fontSize: 11,
   marginTop: 4,
  },
  healthValue: {
   color: theme.colors.text,
   fontSize: 12,
   fontWeight: '700',
   marginTop: 2,
   textAlign: 'center',
  },
  reportsButton: {
   marginTop: 16,
   marginBottom: 8,
   borderRadius: 18,
   overflow: 'hidden',
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 10},
   shadowOpacity: theme.isDark ? 0.18 : 0.1,
   shadowRadius: 16,
   elevation: 6,
  },
  reportsGradient: {
   padding: 1,
   borderRadius: 18,
  },
  reportsInner: {
   flexDirection: 'row',
   height: moderateScale(55),
   justifyContent: 'space-between',
   gap: 12,
   alignItems: 'center',
   borderRadius: 17,
   backgroundColor: 'rgba(25,12,45,0.96)',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.06)',
  },
  reportsIconWrap: {
   width: 42,
   height: 42,
   margin: 12,
   borderRadius: 14,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(255,255,255,0.08)',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.12)',
  },
  reportsContent: {
   flex: 1,
  },
  reportsText: {
   color: '#FFFFFF',
   fontSize: 14,
   fontWeight: '800',
  },
  reportsMeta: {
   marginTop: 2,
   color: 'rgba(255,255,255,0.82)',
   fontSize: 11,
  },
  reportsArrow: {
   width: 36,
   height: 36,
   marginRight: 12,
   borderRadius: 12,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(255,255,255,0.08)',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.12)',
  },
  signOutButton: {
   marginTop: 4,
   borderRadius: 18,
   overflow: 'hidden',
   borderWidth: 1,
   borderColor: theme.isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(255,106,136,0.18)',
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 10},
   shadowOpacity: theme.isDark ? 0.28 : 0.12,
   shadowRadius: 18,
   elevation: 8,
  },
  signOutGradient: {
   flexDirection: 'row',
   // height: '20%',
   height: moderateScale(55),
   justifyContent: 'space-between',
   gap: 12,
   alignItems: 'center',
   borderRadius: 18,
   // minHeight: 68,
   // // paddingHorizontal: 14,
   // paddingVertical: 12,
   // flexDirection: 'row',
   // alignItems: 'center',
   // gap: 12,
  },
  signOutIconWrap: {
   width: 42,
   height: 42,
   margin: 12,
   borderRadius: 14,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: theme.isDark
    ? 'rgba(255,255,255,0.14)'
    : 'rgba(255,106,136,0.14)',
   borderWidth: 1,
   borderColor: theme.isDark
    ? 'rgba(255,255,255,0.14)'
    : 'rgba(255,106,136,0.2)',
  },
  signOutContent: {
   flex: 1,
  },
  signOutText: {
   color: '#0F172A',
   fontSize: 14,
   fontWeight: '800',
  },
  signOutMeta: {
   marginTop: 2,
   color: '#475569',
   fontSize: 11,
   fontWeight: '600',
  },
  signOutArrow: {
   width: 34,
   height: 34,
   right: 12,
   borderRadius: 17,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: theme.colors.primary,
  },
  footerNote: {
   marginTop: 16,
   color: muted,
   fontSize: 11,
   textAlign: 'center',
   lineHeight: 16,
  },
  employeeStatusRow: {
   flexDirection: 'row',
   gap: 12,
   marginTop: 16,
   justifyContent: 'space-between',
  },
  statusItem: {
   flex: 1,
   backgroundColor: glassSurface,
   borderRadius: 12,
   padding: 12,
   borderWidth: 1,
   borderColor: 'rgba(95,203,255,0.15)',
   alignItems: 'center',
  },
  statusDivider: {
   borderLeftWidth: 1,
   borderLeftColor: 'rgba(95,203,255,0.2)',
  },
  statusLabel: {
   color: muted,
   fontSize: 11,
   marginBottom: 6,
   fontWeight: '500',
   textAlign: 'center',
  },
  statusValue: {
   color: theme.colors.text,
   fontSize: 13,
   fontWeight: '700',
   textAlign: 'center',
  },
  statsRow: {
   flexDirection: 'row',
   gap: 12,
   justifyContent: 'space-between',
  },
  statItem: {
   flex: 1,
   backgroundColor: glassSurface,
   borderRadius: 14,
   padding: 13,
   alignItems: 'center',
   borderWidth: 1,
   borderColor: 'rgba(95,203,255,0.12)',
  },
  statIconBox: {
   width: 36,
   height: 36,
   borderRadius: 10,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(95,203,255,0.12)',
   marginBottom: 8,
   borderWidth: 1,
   borderColor: 'rgba(95,203,255,0.22)',
  },
  statLabel: {
   color: muted,
   fontSize: 10,
   marginBottom: 4,
   fontWeight: '500',
   textAlign: 'center',
  },
  statValue: {
   color: theme.colors.text,
   fontSize: 14,
   fontWeight: '800',
   marginBottom: 2,
   textAlign: 'center',
  },
  statMeta: {
   color: theme.colors.success,
   fontSize: 9,
   fontWeight: '600',
   textAlign: 'center',
  },
  accountRow: {
   gap: 12,
  },
  accountItem: {
   flexDirection: 'row',
   gap: 12,
   alignItems: 'center',
   backgroundColor: glassSurface,
   borderRadius: 12,
   padding: 13,
   borderWidth: 1,
   borderColor: 'rgba(95,203,255,0.12)',
  },
  accountIcon: {
   width: 40,
   height: 40,
   borderRadius: 10,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(95,203,255,0.18)',
   borderWidth: 1,
   borderColor: 'rgba(95,203,255,0.28)',
  },
  accountContent: {
   flex: 1,
  },
  accountLabel: {
   color: muted,
   fontSize: 11,
   marginBottom: 3,
   fontWeight: '500',
  },
  accountValue: {
   color: theme.colors.text,
   fontSize: 12,
   fontWeight: '600',
  },
 });
};
